/**
 * Repositório de internações hospitalares.
 *
 * Responsável por:
 * - Admitir paciente (atomicamente: cria internação + ocupa leito + registra
 *   movimento).
 * - Transferir entre leitos (libera o anterior, ocupa o novo, registra
 *   movimento).
 * - Dar alta / registrar óbito / evasão / transferência externa.
 * - Listar internações ativas e histórico do paciente.
 *
 * Toda mudança de estado roda em uma transação better-sqlite3 pra evitar
 * que um leito fique inconsistente com a internação correspondente.
 */

import { getDb } from '../db'
import { logAudit } from '../audit'
import { getCurrentUser } from '../session'
import type {
  Admission,
  AdmissionInput,
  AdmissionStatus,
  AdmissionType,
  AdmissionWithRefs,
  BedMovement,
  BedMovementAction,
  DischargeAdmissionInput,
  DischargeType,
  Sex,
  TransferAdmissionInput
} from '@shared/types'

interface Row {
  id: number
  patient_id: number
  attending_professional_id: number | null
  admitted_at: string
  admission_type: AdmissionType
  admission_origin: string | null
  chief_complaint: string | null
  admission_diagnosis: string | null
  admission_cid10: string | null
  status: AdmissionStatus
  current_bed_id: number | null
  discharge_at: string | null
  discharge_type: DischargeType | null
  discharge_summary: string | null
  discharge_cid10: string | null
  notes: string | null
  created_by_user_id: number | null
  created_at: string
  updated_at: string
}

interface RowWithRefs extends Row {
  patient_full_name: string
  patient_cpf: string | null
  patient_cns: string | null
  patient_birth_date: string
  patient_sex: Sex
  professional_full_name: string | null
  professional_specialty: string | null
  bed_code: string | null
  bed_ward_id: number | null
  ward_name: string | null
  room_name: string | null
}

interface BedMovementRow {
  id: number
  admission_id: number
  bed_id: number | null
  ward_id: number | null
  action: BedMovementAction
  from_bed_id: number | null
  reason: string | null
  notes: string | null
  performed_by_user_id: number | null
  performed_by_name: string | null
  created_at: string
  bed_code: string | null
  ward_name: string | null
  from_bed_code: string | null
}

function toModel(row: Row): Admission {
  return {
    id: row.id,
    patientId: row.patient_id,
    attendingProfessionalId: row.attending_professional_id,
    admittedAt: row.admitted_at,
    admissionType: row.admission_type,
    admissionOrigin: row.admission_origin,
    chiefComplaint: row.chief_complaint,
    admissionDiagnosis: row.admission_diagnosis,
    admissionCid10: row.admission_cid10,
    status: row.status,
    currentBedId: row.current_bed_id,
    dischargeAt: row.discharge_at,
    dischargeType: row.discharge_type,
    dischargeSummary: row.discharge_summary,
    dischargeCid10: row.discharge_cid10,
    notes: row.notes,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function toModelWithRefs(row: RowWithRefs): AdmissionWithRefs {
  return {
    ...toModel(row),
    patient: {
      id: row.patient_id,
      fullName: row.patient_full_name,
      cpf: row.patient_cpf,
      cns: row.patient_cns,
      birthDate: row.patient_birth_date,
      sex: row.patient_sex
    },
    attendingProfessional:
      row.attending_professional_id != null
        ? {
            id: row.attending_professional_id,
            fullName: row.professional_full_name ?? '',
            specialty: row.professional_specialty
          }
        : null,
    currentBed:
      row.current_bed_id != null && row.bed_code != null && row.bed_ward_id != null
        ? {
            id: row.current_bed_id,
            code: row.bed_code,
            wardId: row.bed_ward_id,
            wardName: row.ward_name ?? '',
            roomName: row.room_name
          }
        : null
  }
}

const SELECT_WITH_REFS = `
  SELECT a.*,
         p.full_name AS patient_full_name,
         p.cpf AS patient_cpf,
         p.cns AS patient_cns,
         p.birth_date AS patient_birth_date,
         p.sex AS patient_sex,
         pr.full_name AS professional_full_name,
         pr.specialty AS professional_specialty,
         b.code AS bed_code,
         b.ward_id AS bed_ward_id,
         w.name AS ward_name,
         r.name AS room_name
    FROM admissions a
    JOIN patients p ON p.id = a.patient_id
    LEFT JOIN professionals pr ON pr.id = a.attending_professional_id
    LEFT JOIN beds b ON b.id = a.current_bed_id
    LEFT JOIN wards w ON w.id = b.ward_id
    LEFT JOIN rooms r ON r.id = b.room_id
`

export function listActiveAdmissions(): AdmissionWithRefs[] {
  const rows = getDb()
    .prepare(`${SELECT_WITH_REFS} WHERE a.status = 'ativa' ORDER BY a.admitted_at DESC`)
    .all() as RowWithRefs[]
  return rows.map(toModelWithRefs)
}

export function listAdmissionsForPatient(patientId: number): AdmissionWithRefs[] {
  const rows = getDb()
    .prepare(`${SELECT_WITH_REFS} WHERE a.patient_id = ? ORDER BY a.admitted_at DESC`)
    .all(patientId) as RowWithRefs[]
  return rows.map(toModelWithRefs)
}

export function listRecentDischarges(limit = 50): AdmissionWithRefs[] {
  const rows = getDb()
    .prepare(
      `${SELECT_WITH_REFS}
       WHERE a.status != 'ativa'
       ORDER BY COALESCE(a.discharge_at, a.updated_at) DESC
       LIMIT ?`
    )
    .all(limit) as RowWithRefs[]
  return rows.map(toModelWithRefs)
}

export function getAdmission(id: number): AdmissionWithRefs | null {
  const row = getDb().prepare(`${SELECT_WITH_REFS} WHERE a.id = ?`).get(id) as
    | RowWithRefs
    | undefined
  return row ? toModelWithRefs(row) : null
}

export function listBedMovements(admissionId: number): BedMovement[] {
  const rows = getDb()
    .prepare(
      `SELECT m.id, m.admission_id, m.bed_id, m.ward_id, m.action,
              m.from_bed_id, m.reason, m.notes,
              m.performed_by_user_id, m.performed_by_name, m.created_at,
              b.code AS bed_code, w.name AS ward_name,
              fb.code AS from_bed_code
         FROM bed_movements m
         LEFT JOIN beds b ON b.id = m.bed_id
         LEFT JOIN wards w ON w.id = m.ward_id
         LEFT JOIN beds fb ON fb.id = m.from_bed_id
        WHERE m.admission_id = ?
        ORDER BY m.created_at ASC, m.id ASC`
    )
    .all(admissionId) as BedMovementRow[]
  return rows.map((r) => ({
    id: r.id,
    admissionId: r.admission_id,
    bedId: r.bed_id,
    bedCode: r.bed_code,
    wardId: r.ward_id,
    wardName: r.ward_name,
    action: r.action,
    fromBedId: r.from_bed_id,
    fromBedCode: r.from_bed_code,
    reason: r.reason,
    notes: r.notes,
    performedByUserId: r.performed_by_user_id,
    performedByName: r.performed_by_name,
    createdAt: r.created_at
  }))
}

interface BedRow {
  id: number
  ward_id: number
  status: string
  active: number
  current_admission_id: number | null
  sex_restriction: 'M' | 'F' | null
}

interface PatientRow {
  id: number
  sex: Sex
  full_name: string
}

function checkBedAvailableForPatient(
  bed: BedRow,
  patient: PatientRow,
  ignoreCurrentAdmissionId?: number
): void {
  if (bed.active !== 1) {
    throw Object.assign(new Error('Leito está inativo.'), { code: 'BED_INACTIVE' })
  }
  if (bed.status !== 'livre') {
    if (
      bed.status === 'ocupado' &&
      ignoreCurrentAdmissionId != null &&
      bed.current_admission_id === ignoreCurrentAdmissionId
    ) {
      // OK — é o leito atual da própria internação, ignorar.
    } else {
      throw Object.assign(new Error(`Leito não está livre (status: ${bed.status}).`), {
        code: 'BED_NOT_FREE'
      })
    }
  }
  if (bed.sex_restriction && patient.sex !== 'O' && bed.sex_restriction !== patient.sex) {
    throw Object.assign(
      new Error(`Leito é restrito ao sexo ${bed.sex_restriction}; paciente é ${patient.sex}.`),
      { code: 'BED_SEX_RESTRICTION' }
    )
  }
}

/**
 * Admite paciente. Cria a internação, marca o leito como ocupado e registra
 * o movimento de admissão — tudo numa transação atômica.
 *
 * Lança `PATIENT_ALREADY_ADMITTED` se o paciente já tem internação ativa.
 */
export function admitPatient(input: AdmissionInput): AdmissionWithRefs {
  const db = getDb()
  const user = getCurrentUser()

  const tx = db.transaction((): number => {
    const existing = db
      .prepare(`SELECT id FROM admissions WHERE patient_id = ? AND status = 'ativa' LIMIT 1`)
      .get(input.patientId) as { id: number } | undefined
    if (existing) {
      throw Object.assign(new Error('Paciente já possui internação ativa em andamento.'), {
        code: 'PATIENT_ALREADY_ADMITTED'
      })
    }

    const patient = db
      .prepare('SELECT id, sex, full_name FROM patients WHERE id = ?')
      .get(input.patientId) as PatientRow | undefined
    if (!patient) {
      throw Object.assign(new Error('Paciente não encontrado.'), {
        code: 'PATIENT_NOT_FOUND'
      })
    }

    const bed = db
      .prepare(
        `SELECT id, ward_id, status, active, current_admission_id, sex_restriction
           FROM beds WHERE id = ?`
      )
      .get(input.bedId) as BedRow | undefined
    if (!bed) {
      throw Object.assign(new Error('Leito não encontrado.'), { code: 'BED_NOT_FOUND' })
    }
    checkBedAvailableForPatient(bed, patient)

    const admittedAt = input.admittedAt ?? new Date().toISOString()
    const insert = db.prepare(
      `INSERT INTO admissions (
         patient_id, attending_professional_id, admitted_at, admission_type,
         admission_origin, chief_complaint, admission_diagnosis, admission_cid10,
         status, current_bed_id, notes, created_by_user_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ativa', ?, ?, ?)`
    )
    const result = insert.run(
      input.patientId,
      input.attendingProfessionalId ?? null,
      admittedAt,
      input.admissionType,
      input.admissionOrigin?.trim() || null,
      input.chiefComplaint?.trim() || null,
      input.admissionDiagnosis?.trim() || null,
      input.admissionCid10?.trim() || null,
      input.bedId,
      input.notes?.trim() || null,
      user?.id ?? null
    )
    const admissionId = Number(result.lastInsertRowid)

    db.prepare(
      `UPDATE beds
          SET status = 'ocupado',
              current_admission_id = ?,
              updated_at = datetime('now')
        WHERE id = ?`
    ).run(admissionId, input.bedId)

    db.prepare(
      `INSERT INTO bed_movements (
         admission_id, bed_id, ward_id, action, from_bed_id, reason, notes,
         performed_by_user_id, performed_by_name
       ) VALUES (?, ?, ?, 'admissao', NULL, ?, ?, ?, ?)`
    ).run(
      admissionId,
      input.bedId,
      bed.ward_id,
      `Admissão (${input.admissionType})`,
      input.notes?.trim() || null,
      user?.id ?? null,
      user?.fullName ?? null
    )

    return admissionId
  })

  const admissionId = tx()
  logAudit({
    action: 'admit',
    entity: 'admission',
    entityId: admissionId,
    details: {
      patientId: input.patientId,
      bedId: input.bedId,
      admissionType: input.admissionType
    }
  })
  const admission = getAdmission(admissionId)
  if (!admission) {
    throw new Error('Falha ao recuperar internação recém-criada.')
  }
  return admission
}

/**
 * Transfere paciente para outro leito (mesma internação). Libera o leito
 * antigo (status `livre`), ocupa o novo, registra o movimento.
 */
export function transferAdmission(input: TransferAdmissionInput): AdmissionWithRefs {
  const db = getDb()
  const user = getCurrentUser()

  const tx = db.transaction((): void => {
    const admission = db.prepare('SELECT * FROM admissions WHERE id = ?').get(input.admissionId) as
      | Row
      | undefined
    if (!admission) {
      throw Object.assign(new Error('Internação não encontrada.'), {
        code: 'ADMISSION_NOT_FOUND'
      })
    }
    if (admission.status !== 'ativa') {
      throw Object.assign(new Error('Apenas internações ativas podem ser transferidas.'), {
        code: 'ADMISSION_NOT_ACTIVE'
      })
    }

    const targetBed = db
      .prepare(
        `SELECT id, ward_id, status, active, current_admission_id, sex_restriction
           FROM beds WHERE id = ?`
      )
      .get(input.toBedId) as BedRow | undefined
    if (!targetBed) {
      throw Object.assign(new Error('Leito de destino não encontrado.'), {
        code: 'BED_NOT_FOUND'
      })
    }
    if (targetBed.id === admission.current_bed_id) {
      throw Object.assign(new Error('Leito de destino é o mesmo da internação atual.'), {
        code: 'BED_SAME_AS_CURRENT'
      })
    }
    const patient = db
      .prepare('SELECT id, sex, full_name FROM patients WHERE id = ?')
      .get(admission.patient_id) as PatientRow
    checkBedAvailableForPatient(targetBed, patient, admission.id)

    const fromBedId = admission.current_bed_id
    if (fromBedId != null) {
      db.prepare(
        `UPDATE beds
            SET status = 'higienizacao',
                current_admission_id = NULL,
                updated_at = datetime('now')
          WHERE id = ?`
      ).run(fromBedId)
    }

    db.prepare(
      `UPDATE beds
          SET status = 'ocupado',
              current_admission_id = ?,
              updated_at = datetime('now')
        WHERE id = ?`
    ).run(admission.id, input.toBedId)

    db.prepare(
      `UPDATE admissions
          SET current_bed_id = ?, updated_at = datetime('now')
        WHERE id = ?`
    ).run(input.toBedId, admission.id)

    db.prepare(
      `INSERT INTO bed_movements (
         admission_id, bed_id, ward_id, action, from_bed_id, reason, notes,
         performed_by_user_id, performed_by_name
       ) VALUES (?, ?, ?, 'transferencia', ?, ?, ?, ?, ?)`
    ).run(
      admission.id,
      input.toBedId,
      targetBed.ward_id,
      fromBedId,
      input.reason?.trim() || null,
      input.notes?.trim() || null,
      user?.id ?? null,
      user?.fullName ?? null
    )
  })

  tx()
  logAudit({
    action: 'transfer',
    entity: 'admission',
    entityId: input.admissionId,
    details: { toBedId: input.toBedId, reason: input.reason ?? null }
  })
  const updated = getAdmission(input.admissionId)
  if (!updated) throw new Error('Internação não encontrada após transferência.')
  return updated
}

const ACTIVE_TO_TERMINAL: Record<DischargeType, AdmissionStatus> = {
  alta_melhora: 'alta',
  alta_pedido: 'alta',
  alta_administrativa: 'alta',
  transferencia_externa: 'transferencia',
  obito: 'obito',
  evasao: 'evasao'
}

const DISCHARGE_TO_BED_STATUS: Record<DischargeType, 'higienizacao'> = {
  alta_melhora: 'higienizacao',
  alta_pedido: 'higienizacao',
  alta_administrativa: 'higienizacao',
  transferencia_externa: 'higienizacao',
  obito: 'higienizacao',
  evasao: 'higienizacao'
}

const DISCHARGE_TO_MOVEMENT: Record<DischargeType, BedMovementAction> = {
  alta_melhora: 'alta',
  alta_pedido: 'alta',
  alta_administrativa: 'alta',
  transferencia_externa: 'transferencia_externa',
  obito: 'obito',
  evasao: 'evasao'
}

/**
 * Encerra a internação (alta médica, alta administrativa, óbito, transferência
 * externa ou evasão). Libera o leito (vai para `higienizacao`), encerra a
 * internação e registra o movimento.
 */
export function dischargeAdmission(input: DischargeAdmissionInput): AdmissionWithRefs {
  const db = getDb()
  const user = getCurrentUser()

  const tx = db.transaction((): void => {
    const admission = db.prepare('SELECT * FROM admissions WHERE id = ?').get(input.admissionId) as
      | Row
      | undefined
    if (!admission) {
      throw Object.assign(new Error('Internação não encontrada.'), {
        code: 'ADMISSION_NOT_FOUND'
      })
    }
    if (admission.status !== 'ativa') {
      throw Object.assign(new Error('Internação já está encerrada.'), {
        code: 'ADMISSION_NOT_ACTIVE'
      })
    }

    const dischargeAt = input.dischargeAt ?? new Date().toISOString()
    if (dischargeAt < admission.admitted_at) {
      throw Object.assign(new Error('Data da saída não pode ser anterior à admissão.'), {
        code: 'DISCHARGE_BEFORE_ADMISSION'
      })
    }
    const newStatus = ACTIVE_TO_TERMINAL[input.dischargeType]
    const bedStatus = DISCHARGE_TO_BED_STATUS[input.dischargeType]
    const movementAction = DISCHARGE_TO_MOVEMENT[input.dischargeType]

    db.prepare(
      `UPDATE admissions
          SET status = ?,
              discharge_at = ?,
              discharge_type = ?,
              discharge_summary = ?,
              discharge_cid10 = ?,
              notes = COALESCE(?, notes),
              current_bed_id = NULL,
              updated_at = datetime('now')
        WHERE id = ?`
    ).run(
      newStatus,
      dischargeAt,
      input.dischargeType,
      input.dischargeSummary?.trim() || null,
      input.dischargeCid10?.trim() || null,
      input.notes?.trim() || null,
      admission.id
    )

    let releasedWardId: number | null = null
    if (admission.current_bed_id != null) {
      const bedWard = db
        .prepare('SELECT ward_id FROM beds WHERE id = ?')
        .get(admission.current_bed_id) as { ward_id: number } | undefined
      releasedWardId = bedWard?.ward_id ?? null
      db.prepare(
        `UPDATE beds
            SET status = ?, current_admission_id = NULL, updated_at = datetime('now')
          WHERE id = ?`
      ).run(bedStatus, admission.current_bed_id)
    }

    db.prepare(
      `INSERT INTO bed_movements (
         admission_id, bed_id, ward_id, action, from_bed_id, reason, notes,
         performed_by_user_id, performed_by_name
       ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      admission.id,
      releasedWardId,
      movementAction,
      admission.current_bed_id,
      input.dischargeSummary?.trim() || null,
      input.notes?.trim() || null,
      user?.id ?? null,
      user?.fullName ?? null
    )
  })

  tx()
  logAudit({
    action: 'discharge',
    entity: 'admission',
    entityId: input.admissionId,
    details: { dischargeType: input.dischargeType }
  })
  const updated = getAdmission(input.admissionId)
  if (!updated) throw new Error('Internação não encontrada após alta.')
  return updated
}
