/**
 * Smoke test do fluxo de pacientes: simula exatamente o que a UI faz
 * (PatientForm envia strings vazias para campos opcionais; busca usa
 * parâmetros simples; PatientRecord carrega o paciente individual).
 *
 * Objetivo: descobrir bugs de validação/persistência que só aparecem
 * com o formato real enviado pela UI, não com payloads "pretty".
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

let tempDir: string

vi.mock('electron', () => ({
  app: {
    getName: () => 'Gestão Hospitalar',
    getVersion: () => '1.0.0-test',
    getPath: () => tempDir
  }
}))

async function freshDb(): Promise<void> {
  tempDir = mkdtempSync(join(tmpdir(), 'gestao-pf-'))
  process.env.GESTAO_HOSPITAL_DB_PATH = join(tempDir, 'test.db')
  vi.resetModules()
  const dbModule = await import('../src/main/db')
  const db = dbModule.initDatabase()
  const seed = await import('../src/main/db/seed')
  seed.seedInitialAdmin(db)
  const adminRow = db
    .prepare("SELECT id, username, full_name, role FROM users WHERE username = 'admin'")
    .get() as { id: number; username: string; full_name: string; role: string }
  const session = await import('../src/main/session')
  session.setCurrentUser({
    id: adminRow.id,
    username: adminRow.username,
    fullName: adminRow.full_name,
    role: adminRow.role as 'admin',
    professionalId: null,
    mustChangePassword: false
  })
}

beforeEach(() => {
  process.env.GESTAO_HOSPITAL_DB_PATH = ''
})

afterEach(async () => {
  const session = await import('../src/main/session')
  session.setCurrentUser(null)
  if (tempDir) {
    try {
      rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  }
})

// Payload IGUAL ao que PatientForm envia: strings vazias em vez de null
// para campos opcionais. Este é o ponto crítico — repositório precisa
// converter strings vazias em null antes de gravar.
const PAYLOAD_FROM_FORM = {
  fullName: 'Maria Aparecida da Silva',
  cpf: '11122233396',
  cns: '',
  birthDate: '1985-03-15',
  sex: 'F' as const,
  phone: '(11) 98765-4321',
  email: '',
  motherName: 'Joana da Silva',
  race: 'parda',
  addressStreet: 'Rua das Flores',
  addressNumber: '123',
  addressComplement: '',
  addressNeighborhood: 'Centro',
  addressCity: 'São Paulo',
  addressState: 'SP',
  addressZip: '01000000',
  notes: ''
}

describe('Fluxo de pacientes — payload da UI', () => {
  it('cria paciente com strings vazias nos opcionais (igual o form envia)', async () => {
    await freshDb()
    const repo = await import('../src/main/repositories/patients')

    const created = repo.createPatient(PAYLOAD_FROM_FORM)
    expect(created.id).toBeGreaterThan(0)
    expect(created.fullName).toBe('Maria Aparecida da Silva')
    expect(created.cpf).toBe('11122233396')
    // CNS vazio deve virar null no DB
    expect(created.cns).toBeNull()
    // Email vazio idem
    expect(created.email).toBeNull()
    // Strings com conteúdo devem permanecer
    expect(created.phone).toBe('(11) 98765-4321')
    expect(created.motherName).toBe('Joana da Silva')
    expect(created.addressCity).toBe('São Paulo')
  })

  it('lista pacientes retorna o paciente cadastrado', async () => {
    await freshDb()
    const repo = await import('../src/main/repositories/patients')
    repo.createPatient(PAYLOAD_FROM_FORM)
    const list = repo.listPatients()
    expect(list.length).toBe(1)
    expect(list[0].fullName).toBe('Maria Aparecida da Silva')
  })

  it('busca por nome, CPF e fragmento', async () => {
    await freshDb()
    const repo = await import('../src/main/repositories/patients')
    repo.createPatient(PAYLOAD_FROM_FORM)
    repo.createPatient({ ...PAYLOAD_FROM_FORM, fullName: 'João Silva', cpf: '55566677720' })

    expect(repo.searchPatients('Maria').length).toBe(1)
    expect(repo.searchPatients('Silva').length).toBe(2)
    expect(repo.searchPatients('111.222.333-96').length).toBe(1) // tolerante a formatação
    expect(repo.searchPatients('11122233396').length).toBe(1)
    expect(repo.searchPatients('555').length).toBe(1)
  })

  it('rejeita CPF duplicado com mensagem clara', async () => {
    await freshDb()
    const repo = await import('../src/main/repositories/patients')
    repo.createPatient(PAYLOAD_FROM_FORM)
    expect(() => repo.createPatient(PAYLOAD_FROM_FORM)).toThrow(/CPF/i)
  })

  it('rejeita CPF inválido (checksum)', async () => {
    await freshDb()
    const repo = await import('../src/main/repositories/patients')
    expect(() =>
      repo.createPatient({ ...PAYLOAD_FROM_FORM, cpf: '12345678900' })
    ).toThrow(/CPF/i)
  })

  it('aceita paciente sem CPF (vazio)', async () => {
    await freshDb()
    const repo = await import('../src/main/repositories/patients')
    const p = repo.createPatient({ ...PAYLOAD_FROM_FORM, cpf: '' })
    expect(p.id).toBeGreaterThan(0)
    expect(p.cpf).toBeNull()
  })

  it('rejeita data de nascimento futura ou inválida', async () => {
    await freshDb()
    const repo = await import('../src/main/repositories/patients')
    const future = new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10)
    expect(() => repo.createPatient({ ...PAYLOAD_FROM_FORM, birthDate: future })).toThrow()
  })

  it('atualiza paciente preservando id e createdAt', async () => {
    await freshDb()
    const repo = await import('../src/main/repositories/patients')
    const created = repo.createPatient(PAYLOAD_FROM_FORM)
    const updated = repo.updatePatient(created.id, {
      ...PAYLOAD_FROM_FORM,
      phone: '(11) 11111-1111',
      addressCity: 'Campinas'
    })
    expect(updated.id).toBe(created.id)
    expect(updated.createdAt).toBe(created.createdAt)
    expect(updated.phone).toBe('(11) 11111-1111')
    expect(updated.addressCity).toBe('Campinas')
  })

  it('getPatient retorna null quando não existe', async () => {
    await freshDb()
    const repo = await import('../src/main/repositories/patients')
    expect(repo.getPatient(99999)).toBeNull()
  })

  it('getPatient retorna paciente com todos os campos', async () => {
    await freshDb()
    const repo = await import('../src/main/repositories/patients')
    const c = repo.createPatient(PAYLOAD_FROM_FORM)
    const g = repo.getPatient(c.id)
    expect(g).not.toBeNull()
    expect(g!.fullName).toBe('Maria Aparecida da Silva')
    expect(g!.birthDate).toBe('1985-03-15')
  })

  it('anonimiza paciente (LGPD) — apaga PII mas preserva id', async () => {
    await freshDb()
    const repo = await import('../src/main/repositories/patients')
    const c = repo.createPatient(PAYLOAD_FROM_FORM)
    const result = repo.anonymizePatient(c.id)
    expect(result.patientId).toBe(c.id)
    const after = repo.getPatient(c.id)
    expect(after).not.toBeNull()
    expect(after!.cpf).toBeNull()
    expect(after!.cns).toBeNull()
    expect(after!.phone).toBeNull()
    expect(after!.anonymizedAt).not.toBeNull()
  })
})
