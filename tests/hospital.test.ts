/**
 * Testes do PR1 hospitalar: setores (wards), leitos (beds) e internações
 * (admissions). Foco nos invariantes de negócio: atomicidade entre leito e
 * internação, validação de sexo do leito, transferência (libera origem em
 * higienização e ocupa destino) e alta/óbito (libera leito).
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
  tempDir = mkdtempSync(join(tmpdir(), 'gestao-his-'))
  process.env.GESTAO_HOSPITAL_DB_PATH = join(tempDir, 'test.db')
  vi.resetModules()
  const dbModule = await import('../src/main/db')
  const db = dbModule.initDatabase()
  // Cria um usuário admin pra satisfazer FKs em created_by_user_id e
  // representar quem está gravando nas tabelas hospitalares.
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

const PATIENT_F = {
  fullName: 'Maria das Dores',
  cpf: '11122233396',
  cns: null,
  birthDate: '1980-05-10',
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

const PATIENT_M = {
  fullName: 'João da Silva',
  cpf: '55566677720',
  cns: null,
  birthDate: '1975-08-22',
  sex: 'M' as const,
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

async function seedWardWithBeds(): Promise<{ wardId: number; bedAId: number; bedBId: number }> {
  const wardsRepo = await import('../src/main/repositories/wards')
  const bedsRepo = await import('../src/main/repositories/beds')
  const ward = wardsRepo.createWard({
    name: 'Clínica Médica',
    kind: 'enfermaria',
    code: 'CM',
    floor: '2',
    notes: null
  })
  const bedA = bedsRepo.createBed({ wardId: ward.id, code: 'CM-01', kind: 'standard' })
  const bedB = bedsRepo.createBed({ wardId: ward.id, code: 'CM-02', kind: 'standard' })
  return { wardId: ward.id, bedAId: bedA.id, bedBId: bedB.id }
}

describe('Hospital PR1 — wards e beds', () => {
  it('cria setor com beds e calcula occupancyByWard com leitos livres', async () => {
    await freshDb()
    const { wardId } = await seedWardWithBeds()
    const bedsRepo = await import('../src/main/repositories/beds')
    const summary = bedsRepo.listOccupancyByWard()
    expect(summary).toHaveLength(1)
    expect(summary[0].ward.id).toBe(wardId)
    expect(summary[0].total).toBe(2)
    expect(summary[0].livre).toBe(2)
    expect(summary[0].ocupado).toBe(0)
  })

  it('setBedStatus rejeita transição direta para "ocupado" (deve passar por admissão)', async () => {
    await freshDb()
    const { bedAId } = await seedWardWithBeds()
    const bedsRepo = await import('../src/main/repositories/beds')
    expect(() => bedsRepo.setBedStatus(bedAId, 'ocupado')).toThrow()
    // Mas aceita higienizacao, manutencao, etc.
    const updated = bedsRepo.setBedStatus(bedAId, 'higienizacao', 'limpeza pós-uso')
    expect(updated.status).toBe('higienizacao')
  })

  it('createBed valida wardId e código único por setor', async () => {
    await freshDb()
    const { wardId } = await seedWardWithBeds()
    const bedsRepo = await import('../src/main/repositories/beds')
    expect(() => bedsRepo.createBed({ wardId, code: 'CM-01', kind: 'standard' })).toThrow()
  })

  it('listOccupancyByWard ignora leitos inativos no total/livres', async () => {
    await freshDb()
    const { wardId, bedBId } = await seedWardWithBeds()
    const bedsRepo = await import('../src/main/repositories/beds')
    bedsRepo.setBedActive(bedBId, false)
    const summary = bedsRepo.listOccupancyByWard()
    const ward = summary.find((s) => s.ward.id === wardId)!
    // Só o leito ativo deve aparecer no total e nos livres.
    expect(ward.total).toBe(1)
    expect(ward.livre).toBe(1)
    expect(ward.beds.every((b) => b.active)).toBe(true)
  })
})

describe('Hospital PR1 — admissão, transferência e alta', () => {
  it('admitPatient cria internação, ocupa leito e registra movimento (atômico)', async () => {
    await freshDb()
    const { bedAId } = await seedWardWithBeds()
    const patientsRepo = await import('../src/main/repositories/patients')
    const admissionsRepo = await import('../src/main/repositories/admissions')
    const bedsRepo = await import('../src/main/repositories/beds')
    const patient = patientsRepo.createPatient(PATIENT_F)

    const admission = admissionsRepo.admitPatient({
      patientId: patient.id,
      bedId: bedAId,
      attendingProfessionalId: null,
      admissionType: 'urgencia',
      admissionDiagnosis: 'Pneumonia comunitária',
      admissionCid10: 'J18'
    })

    expect(admission.status).toBe('ativa')
    expect(admission.currentBed?.id).toBe(bedAId)

    const bed = bedsRepo.getBedWithRefs(bedAId)
    expect(bed?.status).toBe('ocupado')
    expect(bed?.admission?.patientId).toBe(patient.id)

    const movements = admissionsRepo.listBedMovements(admission.id)
    expect(movements).toHaveLength(1)
    expect(movements[0].action).toBe('admissao')
  })

  it('rejeita admitir paciente em leito ocupado', async () => {
    await freshDb()
    const { bedAId } = await seedWardWithBeds()
    const patientsRepo = await import('../src/main/repositories/patients')
    const admissionsRepo = await import('../src/main/repositories/admissions')
    const p1 = patientsRepo.createPatient(PATIENT_F)
    const p2 = patientsRepo.createPatient(PATIENT_M)

    admissionsRepo.admitPatient({
      patientId: p1.id,
      bedId: bedAId,
      attendingProfessionalId: null,
      admissionType: 'eletiva'
    })

    expect(() =>
      admissionsRepo.admitPatient({
        patientId: p2.id,
        bedId: bedAId,
        attendingProfessionalId: null,
        admissionType: 'eletiva'
      })
    ).toThrow()
  })

  it('respeita restrição de sexo do leito', async () => {
    await freshDb()
    const wardsRepo = await import('../src/main/repositories/wards')
    const bedsRepo = await import('../src/main/repositories/beds')
    const ward = wardsRepo.createWard({ name: 'Obstetrícia', kind: 'obstetrica' })
    const bed = bedsRepo.createBed({
      wardId: ward.id,
      code: 'OBS-1',
      kind: 'obstetrico',
      sexRestriction: 'F'
    })
    const patientsRepo = await import('../src/main/repositories/patients')
    const admissionsRepo = await import('../src/main/repositories/admissions')
    const male = patientsRepo.createPatient(PATIENT_M)
    expect(() =>
      admissionsRepo.admitPatient({
        patientId: male.id,
        bedId: bed.id,
        attendingProfessionalId: null,
        admissionType: 'eletiva'
      })
    ).toThrow()
  })

  it('transferAdmission libera origem (higienização) e ocupa destino', async () => {
    await freshDb()
    const { bedAId, bedBId } = await seedWardWithBeds()
    const patientsRepo = await import('../src/main/repositories/patients')
    const admissionsRepo = await import('../src/main/repositories/admissions')
    const bedsRepo = await import('../src/main/repositories/beds')
    const patient = patientsRepo.createPatient(PATIENT_F)
    const admission = admissionsRepo.admitPatient({
      patientId: patient.id,
      bedId: bedAId,
      attendingProfessionalId: null,
      admissionType: 'urgencia'
    })

    const transferred = admissionsRepo.transferAdmission({
      admissionId: admission.id,
      toBedId: bedBId,
      reason: 'isolamento'
    })

    expect(transferred.currentBed?.id).toBe(bedBId)
    expect(bedsRepo.getBedWithRefs(bedAId)?.status).toBe('higienizacao')
    expect(bedsRepo.getBedWithRefs(bedBId)?.status).toBe('ocupado')

    const movements = admissionsRepo.listBedMovements(admission.id)
    expect(movements.map((m) => m.action)).toEqual(['admissao', 'transferencia'])
  })

  it('dischargeAdmission encerra internação e libera leito (higienização)', async () => {
    await freshDb()
    const { bedAId } = await seedWardWithBeds()
    const patientsRepo = await import('../src/main/repositories/patients')
    const admissionsRepo = await import('../src/main/repositories/admissions')
    const bedsRepo = await import('../src/main/repositories/beds')
    const patient = patientsRepo.createPatient(PATIENT_F)
    const admission = admissionsRepo.admitPatient({
      patientId: patient.id,
      bedId: bedAId,
      attendingProfessionalId: null,
      admissionType: 'urgencia'
    })

    const ended = admissionsRepo.dischargeAdmission({
      admissionId: admission.id,
      dischargeType: 'alta_melhora',
      dischargeSummary: 'Recuperado'
    })

    expect(ended.status).toBe('alta')
    expect(ended.currentBed).toBeNull()
    expect(bedsRepo.getBedWithRefs(bedAId)?.status).toBe('higienizacao')

    // Ativas deve estar vazia; histórico deve trazer a internação encerrada.
    expect(admissionsRepo.listActiveAdmissions()).toHaveLength(0)
    const recent = admissionsRepo.listRecentDischarges(10)
    expect(recent).toHaveLength(1)
    expect(recent[0].id).toBe(admission.id)
  })

  it('óbito é registrado como tipo de saída próprio', async () => {
    await freshDb()
    const { bedAId } = await seedWardWithBeds()
    const patientsRepo = await import('../src/main/repositories/patients')
    const admissionsRepo = await import('../src/main/repositories/admissions')
    const patient = patientsRepo.createPatient(PATIENT_F)
    const admission = admissionsRepo.admitPatient({
      patientId: patient.id,
      bedId: bedAId,
      attendingProfessionalId: null,
      admissionType: 'emergencia'
    })

    const ended = admissionsRepo.dischargeAdmission({
      admissionId: admission.id,
      dischargeType: 'obito',
      dischargeSummary: 'PCR refratária'
    })

    expect(ended.status).toBe('obito')
    expect(ended.dischargeType).toBe('obito')
    const movements = admissionsRepo.listBedMovements(admission.id)
    expect(movements.at(-1)?.action).toBe('obito')
  })

  it('paciente com internação ativa não pode ser admitido novamente', async () => {
    await freshDb()
    const { bedAId, bedBId } = await seedWardWithBeds()
    const patientsRepo = await import('../src/main/repositories/patients')
    const admissionsRepo = await import('../src/main/repositories/admissions')
    const patient = patientsRepo.createPatient(PATIENT_F)
    admissionsRepo.admitPatient({
      patientId: patient.id,
      bedId: bedAId,
      attendingProfessionalId: null,
      admissionType: 'urgencia'
    })
    expect(() =>
      admissionsRepo.admitPatient({
        patientId: patient.id,
        bedId: bedBId,
        attendingProfessionalId: null,
        admissionType: 'urgencia'
      })
    ).toThrow()
  })

  it('updateBed bloqueia mudar setor, tipo ou restrição de sexo em leito ocupado', async () => {
    await freshDb()
    const { wardId, bedAId } = await seedWardWithBeds()
    const wardsRepo = await import('../src/main/repositories/wards')
    const bedsRepo = await import('../src/main/repositories/beds')
    const patientsRepo = await import('../src/main/repositories/patients')
    const admissionsRepo = await import('../src/main/repositories/admissions')
    const otherWard = wardsRepo.createWard({ name: 'UTI', kind: 'uti' })
    const patient = patientsRepo.createPatient(PATIENT_M)
    admissionsRepo.admitPatient({
      patientId: patient.id,
      bedId: bedAId,
      attendingProfessionalId: null,
      admissionType: 'urgencia'
    })

    // Mudar restrição de sexo: bloqueado.
    expect(() =>
      bedsRepo.updateBed(bedAId, {
        wardId,
        code: 'CM-01',
        kind: 'standard',
        sexRestriction: 'F'
      })
    ).toThrow(/ocupado/i)

    // Mudar setor: bloqueado.
    expect(() =>
      bedsRepo.updateBed(bedAId, {
        wardId: otherWard.id,
        code: 'CM-01',
        kind: 'standard'
      })
    ).toThrow(/ocupado/i)

    // Mudar tipo: bloqueado.
    expect(() =>
      bedsRepo.updateBed(bedAId, {
        wardId,
        code: 'CM-01',
        kind: 'uti'
      })
    ).toThrow(/ocupado/i)

    // Mas mudar código e notes (campos cosméticos) é permitido.
    const updated = bedsRepo.updateBed(bedAId, {
      wardId,
      code: 'CM-01-A',
      kind: 'standard',
      notes: 'realocado fisicamente'
    })
    expect(updated.code).toBe('CM-01-A')
    expect(updated.notes).toBe('realocado fisicamente')
  })
})

describe('Hospital PR1 — invariantes de ativação e validação', () => {
  it('setBedActive(false) recusa leito ocupado (paciente sumiria do mapa)', async () => {
    await freshDb()
    const { bedAId } = await seedWardWithBeds()
    const patientsRepo = await import('../src/main/repositories/patients')
    const admissionsRepo = await import('../src/main/repositories/admissions')
    const bedsRepo = await import('../src/main/repositories/beds')
    const patient = patientsRepo.createPatient(PATIENT_F)
    admissionsRepo.admitPatient({
      patientId: patient.id,
      bedId: bedAId,
      attendingProfessionalId: null,
      admissionType: 'urgencia'
    })

    expect(() => bedsRepo.setBedActive(bedAId, false)).toThrow(/ocupado/i)

    // Mas com leito livre, pode desativar normalmente.
    const wardsRepo = await import('../src/main/repositories/wards')
    const otherWard = wardsRepo.createWard({ name: 'UTI', kind: 'uti' })
    const freeBed = bedsRepo.createBed({
      wardId: otherWard.id,
      code: 'UTI-1',
      kind: 'uti'
    })
    expect(() => bedsRepo.setBedActive(freeBed.id, false)).not.toThrow()
  })

  it('setWardActive(false) recusa setor com leitos ocupados', async () => {
    await freshDb()
    const { wardId, bedAId } = await seedWardWithBeds()
    const patientsRepo = await import('../src/main/repositories/patients')
    const admissionsRepo = await import('../src/main/repositories/admissions')
    const wardsRepo = await import('../src/main/repositories/wards')
    const patient = patientsRepo.createPatient(PATIENT_F)
    admissionsRepo.admitPatient({
      patientId: patient.id,
      bedId: bedAId,
      attendingProfessionalId: null,
      admissionType: 'urgencia'
    })

    expect(() => wardsRepo.setWardActive(wardId, false)).toThrow(/ocupado/i)

    // Após alta, setor pode ser desativado.
    const admissions = admissionsRepo.listActiveAdmissions()
    admissionsRepo.dischargeAdmission({
      admissionId: admissions[0].id,
      dischargeType: 'alta_melhora'
    })
    expect(() => wardsRepo.setWardActive(wardId, false)).not.toThrow()
  })

  it('createBed/updateBed rejeitam código vazio (evita unique index quebrar com mensagem feia)', async () => {
    await freshDb()
    const { wardId, bedAId } = await seedWardWithBeds()
    const bedsRepo = await import('../src/main/repositories/beds')
    expect(() => bedsRepo.createBed({ wardId, code: '', kind: 'standard' })).toThrow(
      /obrigat[óo]rio/i
    )
    expect(() => bedsRepo.createBed({ wardId, code: '   ', kind: 'standard' })).toThrow(
      /obrigat[óo]rio/i
    )
    expect(() => bedsRepo.updateBed(bedAId, { wardId, code: '', kind: 'standard' })).toThrow(
      /obrigat[óo]rio/i
    )
  })

  it('createWard/updateWard rejeitam nome vazio', async () => {
    await freshDb()
    const wardsRepo = await import('../src/main/repositories/wards')
    const created = wardsRepo.createWard({ name: 'X', kind: 'enfermaria' })
    expect(() => wardsRepo.createWard({ name: '', kind: 'enfermaria' })).toThrow(/obrigat[óo]rio/i)
    expect(() => wardsRepo.createWard({ name: '   ', kind: 'enfermaria' })).toThrow(
      /obrigat[óo]rio/i
    )
    expect(() => wardsRepo.updateWard(created.id, { name: '', kind: 'enfermaria' })).toThrow(
      /obrigat[óo]rio/i
    )
  })

  it('dischargeAdmission rejeita data de saída anterior à admissão', async () => {
    await freshDb()
    const { bedAId } = await seedWardWithBeds()
    const patientsRepo = await import('../src/main/repositories/patients')
    const admissionsRepo = await import('../src/main/repositories/admissions')
    const patient = patientsRepo.createPatient(PATIENT_F)
    const admitted = admissionsRepo.admitPatient({
      patientId: patient.id,
      bedId: bedAId,
      attendingProfessionalId: null,
      admissionType: 'urgencia',
      admittedAt: '2025-10-15T10:00:00.000Z'
    })

    expect(() =>
      admissionsRepo.dischargeAdmission({
        admissionId: admitted.id,
        dischargeType: 'alta_melhora',
        dischargeAt: '2025-10-14T09:00:00.000Z'
      })
    ).toThrow(/anterior/i)

    // Mas alta posterior à admissão funciona.
    const ended = admissionsRepo.dischargeAdmission({
      admissionId: admitted.id,
      dischargeType: 'alta_melhora',
      dischargeAt: '2025-10-16T12:00:00.000Z'
    })
    expect(ended.status).toBe('alta')
  })

  it('listBedMovements tem ordenação estável (id como tiebreaker)', async () => {
    await freshDb()
    const { bedAId, bedBId } = await seedWardWithBeds()
    const patientsRepo = await import('../src/main/repositories/patients')
    const admissionsRepo = await import('../src/main/repositories/admissions')
    const patient = patientsRepo.createPatient(PATIENT_F)
    const admission = admissionsRepo.admitPatient({
      patientId: patient.id,
      bedId: bedAId,
      attendingProfessionalId: null,
      admissionType: 'urgencia'
    })
    admissionsRepo.transferAdmission({
      admissionId: admission.id,
      toBedId: bedBId,
      reason: 'teste'
    })

    // Mesmo se created_at colidir (mesmo segundo no SQLite), o id maior
    // (transferência) deve aparecer depois do id menor (admissão).
    const movements = admissionsRepo.listBedMovements(admission.id)
    expect(movements.map((m) => m.action)).toEqual(['admissao', 'transferencia'])
    expect(movements[0].id).toBeLessThan(movements[1].id)
  })
})

async function seedAdmission(): Promise<{ admissionId: number; patientId: number }> {
  const { bedAId } = await seedWardWithBeds()
  const patientsRepo = await import('../src/main/repositories/patients')
  const admissionsRepo = await import('../src/main/repositories/admissions')
  const patient = patientsRepo.createPatient(PATIENT_F)
  const admission = admissionsRepo.admitPatient({
    patientId: patient.id,
    bedId: bedAId,
    attendingProfessionalId: null,
    admissionType: 'eletiva'
  })
  return { admissionId: admission.id, patientId: patient.id }
}

describe('Hospital PR2a — evoluções clínicas', () => {
  it('cria evolução SOAP e lista por internação (DESC)', async () => {
    await freshDb()
    const { admissionId } = await seedAdmission()
    const evolutionsRepo = await import('../src/main/repositories/evolutions')

    const ev1 = evolutionsRepo.createEvolution({
      admissionId,
      authorRole: 'medico',
      subjective: 'paciente refere dor leve',
      objective: null,
      assessment: 'estável',
      plan: 'manter conduta'
    })
    const ev2 = evolutionsRepo.createEvolution({
      admissionId,
      authorRole: 'enfermagem',
      freeText: 'paciente sem queixas no plantão noturno'
    })

    const list = evolutionsRepo.listEvolutionsForAdmission(admissionId)
    expect(list).toHaveLength(2)
    // Ordem DESC: a mais recente (ev2) primeiro
    expect(list[0].id).toBe(ev2.id)
    expect(list[1].id).toBe(ev1.id)
    expect(list[0].authorRole).toBe('enfermagem')
    expect(list[0].freeText).toMatch(/plantão noturno/)
    expect(list[1].subjective).toMatch(/dor leve/)
  })

  it('rejeita evolução totalmente vazia (sem SOAP nem texto livre)', async () => {
    await freshDb()
    const { admissionId } = await seedAdmission()
    const evolutionsRepo = await import('../src/main/repositories/evolutions')

    expect(() =>
      evolutionsRepo.createEvolution({
        admissionId,
        authorRole: 'medico',
        subjective: '   ',
        freeText: ''
      })
    ).toThrow(/vazia/i)
  })

  it('bloqueia edição e remoção após alta da internação', async () => {
    await freshDb()
    const { admissionId } = await seedAdmission()
    const evolutionsRepo = await import('../src/main/repositories/evolutions')
    const admissionsRepo = await import('../src/main/repositories/admissions')

    const ev = evolutionsRepo.createEvolution({
      admissionId,
      authorRole: 'medico',
      assessment: 'estável'
    })

    admissionsRepo.dischargeAdmission({
      admissionId,
      dischargeType: 'alta_melhora'
    })

    expect(() =>
      evolutionsRepo.updateEvolution(ev.id, {
        admissionId,
        authorRole: 'medico',
        assessment: 'mudou'
      })
    ).toThrow(/encerrada/i)

    expect(() => evolutionsRepo.deleteEvolution(ev.id)).toThrow(/encerrada/i)
  })

  it('só o autor (ou admin) pode editar/excluir; outro usuário é negado', async () => {
    await freshDb()
    const { admissionId } = await seedAdmission()
    const evolutionsRepo = await import('../src/main/repositories/evolutions')
    const usersRepo = await import('../src/main/repositories/users')
    const session = await import('../src/main/session')

    // admin cria a evolução
    const ev = evolutionsRepo.createEvolution({
      admissionId,
      authorRole: 'medico',
      plan: 'inicial'
    })

    // Cria segundo usuário (médico) e troca de sessão
    const outroMedico = usersRepo.createUser({
      username: 'medico2',
      password: 'temp1234',
      fullName: 'Dr. Outro',
      role: 'medico'
    })
    session.setCurrentUser({
      id: outroMedico.id,
      username: outroMedico.username,
      fullName: outroMedico.fullName,
      role: 'medico',
      professionalId: null,
      mustChangePassword: false
    })

    expect(() =>
      evolutionsRepo.updateEvolution(ev.id, {
        admissionId,
        authorRole: 'medico',
        plan: 'tentando editar'
      })
    ).toThrow(/autor/i)
    expect(() => evolutionsRepo.deleteEvolution(ev.id)).toThrow(/autor/i)
  })
})

describe('Hospital PR2a — sinais vitais', () => {
  it('registra sinais vitais e calcula latest corretamente', async () => {
    await freshDb()
    const { admissionId } = await seedAdmission()
    const vitalSignsRepo = await import('../src/main/repositories/vitalSigns')

    vitalSignsRepo.createVitalSigns({
      admissionId,
      systolicBp: 120,
      diastolicBp: 80,
      heartRate: 78,
      temperatureC: 36.5,
      oxygenSaturation: 97,
      measuredAt: '2025-10-15T08:00:00.000Z'
    })
    const v2 = vitalSignsRepo.createVitalSigns({
      admissionId,
      systolicBp: 110,
      diastolicBp: 70,
      heartRate: 72,
      measuredAt: '2025-10-15T14:00:00.000Z'
    })

    const list = vitalSignsRepo.listVitalSignsForAdmission(admissionId)
    expect(list).toHaveLength(2)
    // DESC por measured_at
    expect(list[0].id).toBe(v2.id)

    const latest = vitalSignsRepo.getLatestVitalSignsForAdmission(admissionId)
    expect(latest?.id).toBe(v2.id)
    expect(latest?.systolicBp).toBe(110)
  })

  it('rejeita registro vazio (todas as medidas null)', async () => {
    await freshDb()
    const { admissionId } = await seedAdmission()
    const vitalSignsRepo = await import('../src/main/repositories/vitalSigns')

    expect(() =>
      vitalSignsRepo.createVitalSigns({
        admissionId,
        notes: 'só uma nota, sem medida'
      })
    ).toThrow(/medida/i)
  })

  it('valida faixas plausíveis (PA 1200 rejeitada, dor 11 rejeitada)', async () => {
    await freshDb()
    const { admissionId } = await seedAdmission()
    const vitalSignsRepo = await import('../src/main/repositories/vitalSigns')

    expect(() =>
      vitalSignsRepo.createVitalSigns({
        admissionId,
        systolicBp: 1200,
        diastolicBp: 80
      })
    ).toThrow(/faixa/i)

    expect(() =>
      vitalSignsRepo.createVitalSigns({
        admissionId,
        painScore: 11
      })
    ).toThrow(/faixa/i)
  })

  it('rejeita diastólica ≥ sistólica', async () => {
    await freshDb()
    const { admissionId } = await seedAdmission()
    const vitalSignsRepo = await import('../src/main/repositories/vitalSigns')

    expect(() =>
      vitalSignsRepo.createVitalSigns({
        admissionId,
        systolicBp: 90,
        diastolicBp: 100
      })
    ).toThrow(/diastólica/i)
  })

  it('bloqueia criação e remoção após alta', async () => {
    await freshDb()
    const { admissionId } = await seedAdmission()
    const vitalSignsRepo = await import('../src/main/repositories/vitalSigns')
    const admissionsRepo = await import('../src/main/repositories/admissions')

    const v = vitalSignsRepo.createVitalSigns({
      admissionId,
      heartRate: 80
    })

    admissionsRepo.dischargeAdmission({
      admissionId,
      dischargeType: 'alta_melhora'
    })

    expect(() =>
      vitalSignsRepo.createVitalSigns({
        admissionId,
        heartRate: 90
      })
    ).toThrow(/encerrada/i)

    expect(() => vitalSignsRepo.deleteVitalSigns(v.id)).toThrow(/encerrada/i)
  })
})

describe('Hospital PR2b — prescrição hospitalar', () => {
  it('cria prescrição com items e gera MAR aprazado para items com intervalo', async () => {
    await freshDb()
    const { admissionId } = await seedAdmission()
    const hospitalRx = await import('../src/main/repositories/hospitalPrescriptions')

    const startAt = '2025-10-15T08:00:00.000Z'
    const created = hospitalRx.createPrescription({
      admissionId,
      prescribedAt: startAt,
      items: [
        {
          medicationName: 'Dipirona 500mg',
          dose: '1g',
          route: 'iv',
          frequencyLabel: '8/8h',
          intervalHours: 8,
          durationDays: 1, // 24h ⇒ 3 doses (08h, 16h, 00h)
          startAt
        },
        {
          medicationName: 'Paracetamol 500mg',
          dose: '1cp',
          route: 'oral',
          frequencyLabel: 'S/N',
          ifNecessary: true // SOS — não aprazado
        }
      ]
    })

    expect(created.items).toHaveLength(2)
    const mar = hospitalRx.listMarForAdmission(admissionId)
    // 3 doses do Dipirona, 0 do Paracetamol SOS
    expect(mar).toHaveLength(3)
    expect(mar.every((m) => m.status === 'aprazado')).toBe(true)
    expect(mar[0].medicationName).toBe('Dipirona 500mg')
  })

  it('rejeita prescrição vazia (sem items) e item sem dose/medicamento', async () => {
    await freshDb()
    const { admissionId } = await seedAdmission()
    const hospitalRx = await import('../src/main/repositories/hospitalPrescriptions')

    expect(() => hospitalRx.createPrescription({ admissionId, items: [] })).toThrow(
      /pelo menos um item/i
    )

    expect(() =>
      hospitalRx.createPrescription({
        admissionId,
        items: [
          {
            medicationName: '',
            dose: '1g',
            route: 'iv',
            frequencyLabel: '8/8h'
          }
        ]
      })
    ).toThrow(/medicamento/i)

    expect(() =>
      hospitalRx.createPrescription({
        admissionId,
        items: [
          {
            medicationName: 'Dipirona',
            dose: '   ',
            route: 'iv',
            frequencyLabel: '8/8h'
          }
        ]
      })
    ).toThrow(/dose/i)
  })

  it('checagem de dose: aprazado → administrado → revert', async () => {
    await freshDb()
    const { admissionId } = await seedAdmission()
    const hospitalRx = await import('../src/main/repositories/hospitalPrescriptions')
    const startAt = '2025-10-15T08:00:00.000Z'

    hospitalRx.createPrescription({
      admissionId,
      prescribedAt: startAt,
      items: [
        {
          medicationName: 'Dipirona',
          dose: '1g',
          route: 'iv',
          frequencyLabel: '8/8h',
          intervalHours: 8,
          durationDays: 1,
          startAt
        }
      ]
    })

    const mar = hospitalRx.listMarForAdmission(admissionId)
    const first = mar[0]
    expect(first.status).toBe('aprazado')

    const checked = hospitalRx.checkAdministration(first.id, {
      status: 'administrado',
      doseGiven: '1g IV'
    })
    expect(checked.status).toBe('administrado')
    expect(checked.administeredAt).toBeTruthy()
    expect(checked.administeredByUserId).not.toBeNull()
    expect(checked.doseGiven).toBe('1g IV')

    const reverted = hospitalRx.revertAdministration(first.id)
    expect(reverted.status).toBe('aprazado')
    expect(reverted.administeredAt).toBeNull()
    expect(reverted.doseGiven).toBeNull()
    expect(reverted.administeredByUserId).toBeNull()
  })

  it('suspender prescrição cancela doses futuras (status=suspenso) mas preserva administradas', async () => {
    await freshDb()
    const { admissionId } = await seedAdmission()
    const hospitalRx = await import('../src/main/repositories/hospitalPrescriptions')

    // Start no passado pra que algumas doses já estejam vencidas/passadas
    // e a primeira esteja administrada.
    const past = new Date(Date.now() - 36 * 3600 * 1000).toISOString()
    const created = hospitalRx.createPrescription({
      admissionId,
      prescribedAt: past,
      items: [
        {
          medicationName: 'Cefepima 1g',
          dose: '1g',
          route: 'iv',
          frequencyLabel: '12/12h',
          intervalHours: 12,
          durationDays: 3,
          startAt: past
        }
      ]
    })

    const marBefore = hospitalRx.listMarForAdmission(admissionId)
    // 3 dias / 12h = 6 doses
    expect(marBefore.length).toBeGreaterThanOrEqual(5)
    // Administra a primeira dose
    hospitalRx.checkAdministration(marBefore[0].id, { status: 'administrado' })

    // Suspende a prescrição
    hospitalRx.setPrescriptionStatus(created.id, 'suspensa')

    const marAfter = hospitalRx.listMarForAdmission(admissionId)
    const futureSuspendidos = marAfter.filter(
      (m) => new Date(m.scheduledAt).getTime() > Date.now() && m.status === 'suspenso'
    )
    expect(futureSuspendidos.length).toBeGreaterThan(0)
    // A dose administrada permanece intacta
    const admin = marAfter.find((m) => m.id === marBefore[0].id)
    expect(admin?.status).toBe('administrado')
  })

  it('bloqueia criação de prescrição após alta', async () => {
    await freshDb()
    const { admissionId } = await seedAdmission()
    const hospitalRx = await import('../src/main/repositories/hospitalPrescriptions')
    const admissionsRepo = await import('../src/main/repositories/admissions')

    admissionsRepo.dischargeAdmission({
      admissionId,
      dischargeType: 'alta_melhora'
    })

    expect(() =>
      hospitalRx.createPrescription({
        admissionId,
        items: [
          {
            medicationName: 'Dipirona',
            dose: '1g',
            route: 'iv',
            frequencyLabel: '8/8h'
          }
        ]
      })
    ).toThrow(/encerrada/i)
  })

  it('aprazamento respeita intervalo de 6h com duração de 2 dias (gera 8 doses)', async () => {
    await freshDb()
    const { admissionId } = await seedAdmission()
    const hospitalRx = await import('../src/main/repositories/hospitalPrescriptions')

    const startAt = '2025-10-15T00:00:00.000Z'
    hospitalRx.createPrescription({
      admissionId,
      prescribedAt: startAt,
      items: [
        {
          medicationName: 'Vancomicina',
          dose: '1g',
          route: 'iv',
          frequencyLabel: '6/6h',
          intervalHours: 6,
          durationDays: 2,
          startAt
        }
      ]
    })

    const mar = hospitalRx.listMarForAdmission(admissionId)
    // 2 dias × 4 doses/dia = 8
    expect(mar).toHaveLength(8)
    // primeiro horário == startAt
    expect(mar[0].scheduledAt).toBe(startAt)
    // sexto horário = startAt + 30h
    expect(new Date(mar[5].scheduledAt).getTime() - new Date(startAt).getTime()).toBe(
      5 * 6 * 3600 * 1000
    )
  })

  it('suspender item individual não cancela doses dos outros items', async () => {
    await freshDb()
    const { admissionId } = await seedAdmission()
    const hospitalRx = await import('../src/main/repositories/hospitalPrescriptions')

    const futureStart = new Date(Date.now() + 3600 * 1000).toISOString()
    const rx = hospitalRx.createPrescription({
      admissionId,
      items: [
        {
          medicationName: 'Med A',
          dose: '1g',
          route: 'iv',
          frequencyLabel: '12/12h',
          intervalHours: 12,
          durationDays: 1,
          startAt: futureStart
        },
        {
          medicationName: 'Med B',
          dose: '1g',
          route: 'iv',
          frequencyLabel: '12/12h',
          intervalHours: 12,
          durationDays: 1,
          startAt: futureStart
        }
      ]
    })
    const itemA = rx.items[0]

    hospitalRx.setPrescriptionItemStatus(itemA.id, 'suspensa')

    const mar = hospitalRx.listMarForAdmission(admissionId)
    const aSuspended = mar.filter(
      (m) => m.prescriptionItemId === itemA.id && m.status === 'suspenso'
    )
    const bActive = mar.filter(
      (m) => m.prescriptionItemId === rx.items[1].id && m.status === 'aprazado'
    )
    expect(aSuspended.length).toBeGreaterThan(0)
    expect(bActive.length).toBeGreaterThan(0)
  })
})
