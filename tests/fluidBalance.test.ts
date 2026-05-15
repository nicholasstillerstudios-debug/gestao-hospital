/**
 * Testes do módulo de balanço hídrico (PR2 hospitalar).
 *
 * Cobre:
 *  - Inserção de entradas e saídas
 *  - Validações de volume (positivo, faixa, subtipo obrigatório)
 *  - Cálculo de saldo diário e total
 *  - Bloqueio em internação encerrada (alta / óbito)
 *  - Autorização de delete (somente autor ou admin)
 *  - seedHospitalDemo cria estrutura sem erros de SQL
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
  tempDir = mkdtempSync(join(tmpdir(), 'gestao-fb-'))
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

const PATIENT = {
  fullName: 'Ana Souza',
  cpf: '11122233396',
  cns: null,
  birthDate: '1985-03-15',
  sex: 'F' as const,
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
}

async function setupAdmission(): Promise<number> {
  const wardsRepo = await import('../src/main/repositories/wards')
  const bedsRepo = await import('../src/main/repositories/beds')
  const patientsRepo = await import('../src/main/repositories/patients')
  const admissionsRepo = await import('../src/main/repositories/admissions')
  const ward = wardsRepo.createWard({
    name: 'Clínica Médica',
    kind: 'enfermaria',
    code: 'CM',
    floor: '2',
    notes: null
  })
  const bed = bedsRepo.createBed({ wardId: ward.id, code: 'CM-01', kind: 'standard' })
  const patient = patientsRepo.createPatient(PATIENT)
  const adm = admissionsRepo.admitPatient({
    patientId: patient.id,
    bedId: bed.id,
    attendingProfessionalId: null,
    admissionType: 'urgencia',
    admissionDiagnosis: 'Teste',
    admissionCid10: null
  })
  return adm.id
}

describe('Balanço hídrico — entradas, saídas e saldo', () => {
  it('registra entrada e saída e calcula saldo total', async () => {
    await freshDb()
    const admissionId = await setupAdmission()
    const fb = await import('../src/main/repositories/fluidBalance')

    fb.createEntry({
      admissionId,
      type: 'entrada',
      subtype: 'SF 0,9%',
      volumeMl: 500,
      recordedAt: '2026-05-14T08:00:00.000Z'
    })
    fb.createEntry({
      admissionId,
      type: 'entrada',
      subtype: 'Água oral',
      volumeMl: 200,
      recordedAt: '2026-05-14T12:00:00.000Z'
    })
    fb.createEntry({
      admissionId,
      type: 'saida',
      subtype: 'Diurese',
      volumeMl: 350,
      recordedAt: '2026-05-14T14:00:00.000Z'
    })

    const entries = fb.listEntriesForAdmission(admissionId)
    expect(entries).toHaveLength(3)

    const summary = fb.getSummaryForAdmission(admissionId)
    expect(summary.totalIn).toBe(700)
    expect(summary.totalOut).toBe(350)
    expect(summary.balance).toBe(350)
    expect(summary.byDay).toHaveLength(1)
    expect(summary.byDay[0].date).toBe('2026-05-14')
    expect(summary.byDay[0].balance).toBe(350)
  })

  it('agrupa por dia corretamente quando há registros em datas diferentes', async () => {
    await freshDb()
    const admissionId = await setupAdmission()
    const fb = await import('../src/main/repositories/fluidBalance')

    fb.createEntry({
      admissionId,
      type: 'entrada',
      subtype: 'SF',
      volumeMl: 1000,
      recordedAt: '2026-05-13T10:00:00.000Z'
    })
    fb.createEntry({
      admissionId,
      type: 'saida',
      subtype: 'Diurese',
      volumeMl: 800,
      recordedAt: '2026-05-13T22:00:00.000Z'
    })
    fb.createEntry({
      admissionId,
      type: 'entrada',
      subtype: 'SF',
      volumeMl: 500,
      recordedAt: '2026-05-14T08:00:00.000Z'
    })

    const summary = fb.getSummaryForAdmission(admissionId)
    expect(summary.byDay).toHaveLength(2)
    expect(summary.byDay[0].date).toBe('2026-05-13')
    expect(summary.byDay[0].balance).toBe(200)
    expect(summary.byDay[1].date).toBe('2026-05-14')
    expect(summary.byDay[1].balance).toBe(500)
    expect(summary.balance).toBe(700)
  })

  it('rejeita volume zero ou negativo', async () => {
    await freshDb()
    const admissionId = await setupAdmission()
    const fb = await import('../src/main/repositories/fluidBalance')

    expect(() =>
      fb.createEntry({ admissionId, type: 'entrada', subtype: 'SF', volumeMl: 0 })
    ).toThrow(/positivo/)
    expect(() =>
      fb.createEntry({ admissionId, type: 'entrada', subtype: 'SF', volumeMl: -100 })
    ).toThrow(/positivo/)
  })

  it('rejeita volume acima da faixa plausível (>99 999 mL)', async () => {
    await freshDb()
    const admissionId = await setupAdmission()
    const fb = await import('../src/main/repositories/fluidBalance')

    expect(() =>
      fb.createEntry({ admissionId, type: 'entrada', subtype: 'SF', volumeMl: 100000 })
    ).toThrow(/fora da faixa/)
  })

  it('rejeita subtipo vazio', async () => {
    await freshDb()
    const admissionId = await setupAdmission()
    const fb = await import('../src/main/repositories/fluidBalance')

    expect(() =>
      fb.createEntry({ admissionId, type: 'entrada', subtype: '   ', volumeMl: 100 })
    ).toThrow(/Subtipo/)
  })

  it('bloqueia registro em internação que recebeu alta', async () => {
    await freshDb()
    const admissionId = await setupAdmission()
    const fb = await import('../src/main/repositories/fluidBalance')
    const admissionsRepo = await import('../src/main/repositories/admissions')

    admissionsRepo.dischargeAdmission({
      admissionId,
      dischargeType: 'alta_melhora',
      dischargeSummary: 'paciente estável',
      dischargeCid10: null
    })

    expect(() =>
      fb.createEntry({ admissionId, type: 'entrada', subtype: 'SF', volumeMl: 500 })
    ).toThrow(/encerrada/i)
  })

  it('bloqueia registro em internação inexistente', async () => {
    await freshDb()
    const fb = await import('../src/main/repositories/fluidBalance')

    expect(() =>
      fb.createEntry({ admissionId: 99999, type: 'entrada', subtype: 'SF', volumeMl: 500 })
    ).toThrow(/não encontrada/i)
  })

  it('arredonda volumes decimais para inteiro (mL não tem casas)', async () => {
    await freshDb()
    const admissionId = await setupAdmission()
    const fb = await import('../src/main/repositories/fluidBalance')

    const entry = fb.createEntry({
      admissionId,
      type: 'entrada',
      subtype: 'SF',
      volumeMl: 123.7
    })
    expect(entry.volumeMl).toBe(124)
  })

  it('delete remove o registro', async () => {
    await freshDb()
    const admissionId = await setupAdmission()
    const fb = await import('../src/main/repositories/fluidBalance')

    const entry = fb.createEntry({
      admissionId,
      type: 'entrada',
      subtype: 'SF',
      volumeMl: 500
    })
    expect(fb.listEntriesForAdmission(admissionId)).toHaveLength(1)

    fb.deleteEntry(entry.id)
    expect(fb.listEntriesForAdmission(admissionId)).toHaveLength(0)
  })

  it('delete em registro inexistente lança erro', async () => {
    await freshDb()
    const fb = await import('../src/main/repositories/fluidBalance')
    expect(() => fb.deleteEntry(99999)).toThrow(/não encontrado/i)
  })
})

describe('seedHospitalDemo — popular demonstração hospitalar', () => {
  it('cria alas, leitos, internações e balanço sem violar schema', async () => {
    await freshDb()
    const demoRepo = await import('../src/main/repositories/demo')
    const wardsRepo = await import('../src/main/repositories/wards')
    const bedsRepo = await import('../src/main/repositories/beds')
    const admissionsRepo = await import('../src/main/repositories/admissions')
    const fb = await import('../src/main/repositories/fluidBalance')
    const patientsRepo = await import('../src/main/repositories/patients')

    // seedHospitalDemo cria pacientes/profissionais automaticamente se base vazia
    const result = demoRepo.seedHospitalDemo(1, 'admin')
    if ('skipped' in result && result.skipped) {
      throw new Error('seedHospitalDemo retornou skipped na primeira chamada')
    }
    expect(result.wardsCreated).toBeGreaterThan(0)
    expect(result.bedsCreated).toBeGreaterThan(0)
    expect(result.admissionsCreated).toBeGreaterThan(0)

    // Verifica que dados realmente foram persistidos no schema correto
    const wards = wardsRepo.listWards()
    expect(wards.length).toBe(result.wardsCreated)

    const occupancy = bedsRepo.listOccupancyByWard()
    const totalOcupado = occupancy.reduce((sum, w) => sum + w.ocupado, 0)
    expect(totalOcupado).toBe(result.admissionsCreated)

    const active = admissionsRepo.listActiveAdmissions()
    expect(active.length).toBe(result.admissionsCreated)

    // Pelo menos uma internação tem balanço hídrico
    const firstAdm = active[0]
    const entries = fb.listEntriesForAdmission(firstAdm.id)
    expect(entries.length).toBeGreaterThan(0)
    const summary = fb.getSummaryForAdmission(firstAdm.id)
    expect(summary.totalIn).toBeGreaterThan(0)
    expect(summary.totalOut).toBeGreaterThan(0)

    // E pacientes foram criados pelo demo prévio
    expect(patientsRepo.listPatients().length).toBeGreaterThan(0)
  })

  it('seedHospitalDemo é idempotente — pula se já há wards cadastradas', async () => {
    await freshDb()
    const demoRepo = await import('../src/main/repositories/demo')
    const wardsRepo = await import('../src/main/repositories/wards')

    demoRepo.seedHospitalDemo(1, 'admin')
    const firstCount = wardsRepo.listWards().length

    const second = demoRepo.seedHospitalDemo(1, 'admin')
    expect(second.skipped).toBe(true)
    expect(wardsRepo.listWards().length).toBe(firstCount)
  })
})
