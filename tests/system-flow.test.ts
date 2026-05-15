/**
 * Smoke test do fluxo geral do sistema: profissionais, usuários, consultas
 * e admissão. Cobre os caminhos que mais se mexem na UI.
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
  tempDir = mkdtempSync(join(tmpdir(), 'gestao-sf-'))
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

describe('Fluxo de profissionais', () => {
  it('cria profissional com payload padrão da UI', async () => {
    await freshDb()
    const repo = await import('../src/main/repositories/professionals')
    const p = repo.createProfessional({
      fullName: 'Dr. Carlos Mendes',
      cpf: '11122233396',
      councilType: 'CRM',
      councilNumber: '54321',
      councilUf: 'SP',
      specialty: 'Clínica Médica',
      category: 'medico',
      cboCode: '225125',
      cboName: 'Médico clínico',
      councilExpiresAt: null,
      email: 'carlos@hosp.com',
      phone: '(11) 98765-4321'
    })
    expect(p.id).toBeGreaterThan(0)
    expect(p.fullName).toBe('Dr. Carlos Mendes')
    expect(p.active).toBe(true)
  })

  it('lista profissionais retorna o criado', async () => {
    await freshDb()
    const repo = await import('../src/main/repositories/professionals')
    repo.createProfessional({
      fullName: 'Dra. Ana Costa',
      cpf: null,
      councilType: 'CRM',
      councilNumber: '12345',
      councilUf: 'SP',
      specialty: null,
      category: 'medico',
      cboCode: null,
      cboName: null,
      councilExpiresAt: null,
      email: null,
      phone: null
    })
    const list = repo.listProfessionals()
    expect(list.length).toBeGreaterThanOrEqual(1)
    expect(list.find((p) => p.fullName === 'Dra. Ana Costa')).toBeDefined()
  })
})

describe('Fluxo de usuários', () => {
  it('cria usuário com cargos válidos', async () => {
    await freshDb()
    const repo = await import('../src/main/repositories/users')
    const u = repo.createUser({
      username: 'enfermeiro1',
      password: 'Senha123',
      fullName: 'José Enfermeiro',
      role: 'enfermagem'
    })
    expect(u.id).toBeGreaterThan(0)
    expect(u.role).toBe('enfermagem')
    expect(u.active).toBe(true)
  })

  it('rejeita username duplicado com mensagem clara', async () => {
    await freshDb()
    const repo = await import('../src/main/repositories/users')
    repo.createUser({
      username: 'recep1',
      password: 'Senha123',
      fullName: 'Recep',
      role: 'recepcao'
    })
    expect(() =>
      repo.createUser({
        username: 'recep1',
        password: 'Senha456',
        fullName: 'Outro',
        role: 'recepcao'
      })
    ).toThrow(/já existe/i)
  })

  it('rejeita senha curta (mínimo 8 chars)', async () => {
    await freshDb()
    const repo = await import('../src/main/repositories/users')
    expect(() =>
      repo.createUser({
        username: 'medico1',
        password: 'curto1',
        fullName: 'Med',
        role: 'medico'
      })
    ).toThrow(/8 caracteres/)
  })

  it('rejeita senha só com letras ou só com números', async () => {
    await freshDb()
    const repo = await import('../src/main/repositories/users')
    expect(() =>
      repo.createUser({
        username: 'medico2',
        password: 'apenasletras',
        fullName: 'Med',
        role: 'medico'
      })
    ).toThrow(/letras e números/i)
    expect(() =>
      repo.createUser({
        username: 'medico3',
        password: '12345678',
        fullName: 'Med',
        role: 'medico'
      })
    ).toThrow(/letras e números/i)
  })

  it('rejeita username inválido (com espaço, caracteres especiais)', async () => {
    await freshDb()
    const repo = await import('../src/main/repositories/users')
    expect(() =>
      repo.createUser({
        username: 'com espaco',
        password: 'Senha123',
        fullName: 'X',
        role: 'recepcao'
      })
    ).toThrow(/inválido/i)
    expect(() =>
      repo.createUser({
        username: 'ab',
        password: 'Senha123',
        fullName: 'X',
        role: 'recepcao'
      })
    ).toThrow(/inválido/i)
  })

  it('impede desativar a si mesmo (anti-lockout)', async () => {
    await freshDb()
    const repo = await import('../src/main/repositories/users')
    const session = await import('../src/main/session')
    const admin = session.getCurrentUser()!
    expect(() => repo.setUserActive(admin.id, false, admin.id)).toThrow(/própria/)
  })

  it('impede desativar o último admin ativo', async () => {
    await freshDb()
    const repo = await import('../src/main/repositories/users')
    const session = await import('../src/main/session')
    const admin = session.getCurrentUser()!
    // Cria outro usuário (não admin) e tenta desativar o admin pelo outro
    repo.createUser({
      username: 'recep1',
      password: 'Senha123',
      fullName: 'R',
      role: 'recepcao'
    })
    // Desativando admin por outro actorId — passa do check de auto-desat,
    // mas deve cair no "último admin"
    expect(() => repo.setUserActive(admin.id, false, 9999)).toThrow(/admin/i)
  })
})

describe('Fluxo de consultas (agenda ambulatorial)', () => {
  it('cria consulta com paciente + profissional existentes', async () => {
    await freshDb()
    const patients = await import('../src/main/repositories/patients')
    const profs = await import('../src/main/repositories/professionals')
    const appts = await import('../src/main/repositories/appointments')

    const patient = patients.createPatient({
      fullName: 'Paciente Teste',
      cpf: '11122233396',
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
    const prof = profs.createProfessional({
      fullName: 'Dr. Test',
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
    const future = new Date(Date.now() + 86400000).toISOString()
    const appt = appts.createAppointment({
      patientId: patient.id,
      professionalId: prof.id,
      scheduledAt: future,
      durationMin: 30,
      reason: 'Consulta de rotina',
      notes: null
    })
    expect(appt.id).toBeGreaterThan(0)
    expect(appt.status).toBe('agendado')
  })
})

describe('Fluxo de admissão hospitalar', () => {
  it('admite paciente em leito (fluxo completo PR/triagem→leito→internação)', async () => {
    await freshDb()
    const patients = await import('../src/main/repositories/patients')
    const wards = await import('../src/main/repositories/wards')
    const beds = await import('../src/main/repositories/beds')
    const admissions = await import('../src/main/repositories/admissions')

    const patient = patients.createPatient({
      fullName: 'Internado Teste',
      cpf: '11122233396',
      cns: null,
      birthDate: '1970-01-01',
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
    const ward = wards.createWard({
      name: 'UTI Adulto Teste',
      kind: 'uti',
      code: 'UTI',
      floor: '3',
      notes: null
    })
    const bed = beds.createBed({ wardId: ward.id, code: 'UTI-01', kind: 'uti' })
    const admission = admissions.admitPatient({
      patientId: patient.id,
      bedId: bed.id,
      attendingProfessionalId: null,
      admissionType: 'emergencia',
      admissionDiagnosis: 'IAM',
      admissionCid10: 'I21.0'
    })
    expect(admission.status).toBe('ativa')
    expect(admission.currentBed?.id).toBe(bed.id)
  })
})
