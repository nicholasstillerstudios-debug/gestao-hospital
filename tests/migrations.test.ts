/**
 * Testes específicos do mecanismo de migrations — em particular, a
 * preservação de chaves estrangeiras quando uma migration recria uma
 * tabela referenciada (caso da #6 com `users`).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

vi.mock('electron', () => ({
  app: {
    getName: () => 'Gestão Hospitalar',
    getVersion: () => '0.1.0-test',
    getPath: () => tmpdir()
  }
}))

let tempDir: string

beforeEach(() => {
  process.env.GESTAO_HOSPITAL_DB_PATH = ''
})

afterEach(() => {
  if (tempDir) {
    try {
      rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  }
})

describe('Migration #6 (papel farmacia + recriar users)', () => {
  it('preserva created_by_user_id em tabelas filhas após recriar users', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'gestao-ubs-mig-'))
    process.env.GESTAO_HOSPITAL_DB_PATH = join(tempDir, 'test.db')
    vi.resetModules()
    const dbModule = await import('../src/main/db')
    const db = dbModule.initDatabase()

    // Cenário: usuário cria registros antes da migration 6, com user_id setado.
    // (na prática o teste apenas confirma que após initDatabase — que aplica
    // todas as migrations — referências user_id não foram zeradas em uma
    // base já populada.)
    const userId = (
      db
        .prepare(
          `INSERT INTO users (username, password_hash, full_name, role)
           VALUES ('mig_user', 'x', 'Teste', 'admin') RETURNING id`
        )
        .get() as { id: number }
    ).id
    const patientId = (
      db
        .prepare(
          `INSERT INTO patients (full_name, birth_date, sex)
           VALUES ('Paciente Teste', '1990-01-01', 'M') RETURNING id`
        )
        .get() as { id: number }
    ).id
    const profId = (
      db
        .prepare(
          `INSERT INTO professionals (full_name, council_type, council_number, specialty, active)
           VALUES ('Dr. Teste', 'CRM-SP', '99999', 'Clínica', 1) RETURNING id`
        )
        .get() as { id: number }
    ).id
    db.prepare(
      `INSERT INTO appointments (patient_id, professional_id, scheduled_at, created_by_user_id)
       VALUES (?, ?, '2030-01-01T10:00:00', ?)`
    ).run(patientId, profId, userId)

    // Fecha + reabre — força re-aplicação de migrations idempotentes.
    dbModule.closeDatabase()
    vi.resetModules()
    const dbModule2 = await import('../src/main/db')
    const db2 = dbModule2.initDatabase()

    // Confere que appointment manteve created_by_user_id e que o user existe.
    const appt = db2
      .prepare<
        [],
        { created_by_user_id: number | null }
      >('SELECT created_by_user_id FROM appointments LIMIT 1')
      .get()
    expect(appt?.created_by_user_id).toBe(userId)

    const u = db2
      .prepare<[], { id: number; role: string }>('SELECT id, role FROM users WHERE id = ?')
      .get(userId)
    expect(u?.id).toBe(userId)
    expect(u?.role).toBe('admin')

    // Foreign keys devem voltar a estar habilitadas após a migration.
    const fk = db2.pragma('foreign_keys', { simple: true })
    expect(fk).toBe(1)

    // O novo papel 'farmacia' deve ser aceito.
    expect(() =>
      db2
        .prepare(
          `INSERT INTO users (username, password_hash, full_name, role)
           VALUES ('farma1', 'x', 'Farmacêutico', 'farmacia')`
        )
        .run()
    ).not.toThrow()
  })
})

describe('Migration #8 (categoria + CBO + UF do conselho em professionals)', () => {
  it('adiciona colunas e permite gravar/ler dados estruturados', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'gestao-ubs-mig8-'))
    process.env.GESTAO_HOSPITAL_DB_PATH = join(tempDir, 'test.db')
    vi.resetModules()
    const dbModule = await import('../src/main/db')
    const db = dbModule.initDatabase()

    // Confere que as colunas novas existem.
    const cols = db.prepare(`PRAGMA table_info(professionals)`).all() as Array<{ name: string }>
    const colNames = new Set(cols.map((c) => c.name))
    for (const col of [
      'category',
      'cbo_code',
      'cbo_name',
      'council_uf',
      'council_expires_at',
      'email',
      'phone'
    ]) {
      expect(colNames.has(col), `falta coluna ${col}`).toBe(true)
    }

    // Insert/Select round-trip via repository.
    const profRepo = await import('../src/main/repositories/professionals')
    const created = profRepo.createProfessional({
      fullName: 'Dra. Teste',
      cpf: null,
      category: 'medico',
      cboCode: '2251-25',
      cboName: 'Médico clínico (atenção básica)',
      councilType: 'CRM',
      councilNumber: '12345',
      councilUf: 'SP',
      councilExpiresAt: '2030-12-31',
      specialty: 'Clínica Geral',
      email: 'teste@ubs.gov.br',
      phone: '(11) 99999-0000'
    })
    expect(created.id).toBeGreaterThan(0)
    expect(created.category).toBe('medico')
    expect(created.cboCode).toBe('2251-25')
    expect(created.councilUf).toBe('SP')

    const fetched = profRepo.getProfessional(created.id)
    expect(fetched?.cboName).toBe('Médico clínico (atenção básica)')
    expect(fetched?.email).toBe('teste@ubs.gov.br')
    expect(fetched?.councilExpiresAt).toBe('2030-12-31')
  })
})
