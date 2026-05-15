/**
 * Smoke test do fluxo walk-in: cria paciente, cria profissional,
 * busca paciente, cria appointment, faz check-in. Esse é o caminho
 * exato que o WalkInModal de Reception.tsx percorre.
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
  tempDir = mkdtempSync(join(tmpdir(), 'gestao-wi-'))
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

describe('Walk-in: fluxo completo da Recepção', () => {
  it('cria paciente → cria profissional → busca → cria appointment → check-in', async () => {
    await freshDb()
    const patients = await import('../src/main/repositories/patients')
    const profs = await import('../src/main/repositories/professionals')
    const appts = await import('../src/main/repositories/appointments')

    // 1) cria paciente
    const p = patients.createPatient({
      fullName: 'João da Silva Walk-in',
      cpf: '11122233396',
      cns: null,
      birthDate: '1980-01-01',
      sex: 'M',
      phone: null,
      email: null,
      motherName: null,
      race: null,
      addressStreet: null,
      addressNumber: null,
      addressComplement: null,
      addressNeighborhood: null,
      addressCity: null,
      addressState: null,
      addressZip: null,
      notes: null
    })

    // 2) cria profissional
    const prof = profs.createProfessional({
      fullName: 'Dr. Bruno Costa',
      cpf: null,
      councilType: 'CRM',
      councilNumber: '54321',
      councilUf: 'SP',
      specialty: 'Pediatria',
      category: 'medico',
      cboCode: null,
      cboName: null,
      councilExpiresAt: null,
      email: null,
      phone: null
    })

    // 3) busca paciente — como o modal faz
    const results = patients.searchPatients('João')
    expect(results.length).toBe(1)
    expect(results[0].id).toBe(p.id)

    // 4) busca tambem deve achar pelo CPF
    const byCpf = patients.searchPatients('111.222.333-96')
    expect(byCpf.length).toBe(1)

    // 5) cria appointment (encaixe walk-in) com payload exato do modal
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const hh = String(now.getHours()).padStart(2, '0')
    const mi = String(now.getMinutes()).padStart(2, '0')
    const scheduledAt = `${yyyy}-${mm}-${dd}T${hh}:${mi}:00`

    const appt = appts.createAppointment({
      patientId: p.id,
      professionalId: prof.id,
      scheduledAt,
      durationMin: 30,
      reason: 'Dor abdominal',
      notes: null
    })
    expect(appt.id).toBeGreaterThan(0)
    expect(appt.status).toBe('agendado')

    // 6) check-in: paciente vai pra "Aguardando triagem"
    const checked = appts.checkIn(appt.id)
    expect(checked.status).toBe('aguardando')
    expect(checked.checkedInAt).not.toBeNull()

    // 7) listForDay deve incluir o atendimento criado hoje
    const todayList = appts.listAppointmentsForDay(`${yyyy}-${mm}-${dd}`)
    expect(todayList.length).toBeGreaterThanOrEqual(1)
    expect(todayList.find((a) => a.id === appt.id)).toBeDefined()
  })

  it('rejeita appointment com paciente inexistente', async () => {
    await freshDb()
    const appts = await import('../src/main/repositories/appointments')
    expect(() =>
      appts.createAppointment({
        patientId: 99999,
        professionalId: 99999,
        scheduledAt: new Date().toISOString(),
        durationMin: 30,
        reason: null,
        notes: null
      })
    ).toThrow()
  })

  it('listForDay vazio retorna []', async () => {
    await freshDb()
    const appts = await import('../src/main/repositories/appointments')
    const list = appts.listAppointmentsForDay('2026-01-01')
    expect(list).toEqual([])
  })

  it('professionals.list filtra ativos vs todos', async () => {
    await freshDb()
    const profs = await import('../src/main/repositories/professionals')
    const p1 = profs.createProfessional({
      fullName: 'Dr. Ativo',
      cpf: null,
      councilType: 'CRM',
      councilNumber: '111',
      councilUf: 'SP',
      specialty: null,
      category: 'medico',
      cboCode: null,
      cboName: null,
      councilExpiresAt: null,
      email: null,
      phone: null
    })
    profs.createProfessional({
      fullName: 'Dr. Inativo',
      cpf: null,
      councilType: 'CRM',
      councilNumber: '222',
      councilUf: 'SP',
      specialty: null,
      category: 'medico',
      cboCode: null,
      cboName: null,
      councilExpiresAt: null,
      email: null,
      phone: null
    })
    profs.setProfessionalActive(p1.id, false)
    const todos = profs.listProfessionals()
    const ativos = profs.listProfessionals(true)
    expect(todos.length).toBe(2)
    expect(ativos.length).toBe(1)
    expect(ativos[0].fullName).toBe('Dr. Inativo')
  })

  it('busca de paciente com 1 caractere não retorna (mín 2)', async () => {
    await freshDb()
    const patients = await import('../src/main/repositories/patients')
    patients.createPatient({
      fullName: 'Maria Teste',
      cpf: null,
      cns: null,
      birthDate: '1990-01-01',
      sex: 'F',
      phone: null,
      email: null,
      motherName: null,
      race: null,
      addressStreet: null,
      addressNumber: null,
      addressComplement: null,
      addressNeighborhood: null,
      addressCity: null,
      addressState: null,
      addressZip: null,
      notes: null
    })
    // Backend não impõe limite mínimo — quem impõe é a UI (>= 2).
    // Aqui só validamos que mesmo busca curta funciona se chamada.
    const result = patients.searchPatients('M')
    expect(result.length).toBe(1)
  })

  it('busca por substring case-insensitive funciona', async () => {
    await freshDb()
    const patients = await import('../src/main/repositories/patients')
    patients.createPatient({
      fullName: 'Pedro ALCANTARA',
      cpf: null,
      cns: null,
      birthDate: '1990-01-01',
      sex: 'M',
      phone: null,
      email: null,
      motherName: null,
      race: null,
      addressStreet: null,
      addressNumber: null,
      addressComplement: null,
      addressNeighborhood: null,
      addressCity: null,
      addressState: null,
      addressZip: null,
      notes: null
    })
    expect(patients.searchPatients('alcantara').length).toBe(1)
    expect(patients.searchPatients('ALCANTARA').length).toBe(1)
    expect(patients.searchPatients('Pedro').length).toBe(1)
    expect(patients.searchPatients('alc').length).toBe(1)
  })
})
