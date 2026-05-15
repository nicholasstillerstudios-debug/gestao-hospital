import { getDb } from '../db'
import { logAudit } from '../audit'
import { getCurrentUser } from '../session'
import type {
  Requisition,
  RequisitionInput,
  RequisitionStatus,
  RequisitionType,
  RequisitionWithRefs
} from '@shared/types'

interface Row {
  id: number
  patient_id: number
  attendance_id: number | null
  professional_id: number
  type: RequisitionType
  items: string
  observations: string | null
  status: RequisitionStatus
  issued_at: string
  created_by_user_id: number | null
  created_at: string
}

interface JoinedRow extends Row {
  patient_full_name: string
  patient_cpf: string | null
  patient_cns: string | null
  patient_birth_date: string
  patient_sex: string
  professional_full_name: string
  professional_specialty: string | null
  professional_council_type: string | null
  professional_council_number: string | null
  professional_council_uf: string | null
}

function parseItems(json: string): string[] {
  try {
    const parsed = JSON.parse(json)
    if (!Array.isArray(parsed)) return []
    return parsed.map((it) => String(it).trim()).filter((s) => s.length > 0)
  } catch {
    return []
  }
}

function mapRow(row: Row): Requisition {
  return {
    id: row.id,
    patientId: row.patient_id,
    attendanceId: row.attendance_id,
    professionalId: row.professional_id,
    type: row.type,
    items: parseItems(row.items),
    observations: row.observations,
    status: row.status,
    issuedAt: row.issued_at,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at
  }
}

function mapJoinedRow(row: JoinedRow): RequisitionWithRefs {
  return {
    ...mapRow(row),
    patient: {
      id: row.patient_id,
      fullName: row.patient_full_name,
      cpf: row.patient_cpf,
      cns: row.patient_cns,
      birthDate: row.patient_birth_date,
      sex: row.patient_sex as RequisitionWithRefs['patient']['sex']
    },
    professional: {
      id: row.professional_id,
      fullName: row.professional_full_name,
      specialty: row.professional_specialty,
      councilType: row.professional_council_type,
      councilNumber: row.professional_council_number,
      councilUf: row.professional_council_uf
    }
  }
}

const SELECT_JOINED = `
  SELECT r.*,
         pa.full_name AS patient_full_name,
         pa.cpf AS patient_cpf,
         pa.cns AS patient_cns,
         pa.birth_date AS patient_birth_date,
         pa.sex AS patient_sex,
         pr.full_name AS professional_full_name,
         pr.specialty AS professional_specialty,
         pr.council_type AS professional_council_type,
         pr.council_number AS professional_council_number,
         pr.council_uf AS professional_council_uf
  FROM requisitions r
  JOIN patients pa ON pa.id = r.patient_id
  JOIN professionals pr ON pr.id = r.professional_id
`

const VALID_TYPES: RequisitionType[] = ['laboratorio', 'imagem', 'procedimento', 'encaminhamento']

function validateInput(input: RequisitionInput): void {
  if (!Number.isFinite(input.patientId) || input.patientId <= 0) {
    throw Object.assign(new Error('Paciente é obrigatório.'), { code: 'VALIDATION' })
  }
  if (!Number.isFinite(input.professionalId) || input.professionalId <= 0) {
    throw Object.assign(new Error('Profissional é obrigatório.'), { code: 'VALIDATION' })
  }
  if (!VALID_TYPES.includes(input.type)) {
    throw Object.assign(new Error('Tipo de requisição inválido.'), { code: 'VALIDATION' })
  }
  if (!Array.isArray(input.items) || input.items.filter((s) => s && s.trim()).length === 0) {
    throw Object.assign(new Error('Inclua pelo menos um item.'), { code: 'VALIDATION' })
  }
}

export function createRequisition(input: RequisitionInput): Requisition {
  validateInput(input)
  const user = getCurrentUser()
  const items = input.items.map((s) => s.trim()).filter((s) => s.length > 0)
  const stmt = getDb().prepare(
    `INSERT INTO requisitions (patient_id, attendance_id, professional_id, type, items, observations, created_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
  const result = stmt.run(
    input.patientId,
    input.attendanceId,
    input.professionalId,
    input.type,
    JSON.stringify(items),
    input.observations ? input.observations.trim() : null,
    user?.id ?? null
  )
  const id = Number(result.lastInsertRowid)
  logAudit({
    action: 'create',
    entity: 'requisition',
    entityId: id,
    details: { type: input.type, itemCount: items.length }
  })
  const row = getDb().prepare('SELECT * FROM requisitions WHERE id = ?').get(id) as Row
  return mapRow(row)
}

export function listForPatient(patientId: number): RequisitionWithRefs[] {
  const rows = getDb()
    .prepare(SELECT_JOINED + ' WHERE r.patient_id = ? ORDER BY r.issued_at DESC')
    .all(patientId) as JoinedRow[]
  return rows.map(mapJoinedRow)
}

/**
 * Lista bruta (sem joins) usada pelo export de portabilidade LGPD.
 */
export function listRawForPatient(patientId: number): Requisition[] {
  const rows = getDb()
    .prepare('SELECT * FROM requisitions WHERE patient_id = ? ORDER BY issued_at')
    .all(patientId) as Row[]
  return rows.map(mapRow)
}

export function getById(id: number): RequisitionWithRefs | null {
  const row = getDb()
    .prepare(SELECT_JOINED + ' WHERE r.id = ?')
    .get(id) as JoinedRow | undefined
  return row ? mapJoinedRow(row) : null
}

export function updateStatus(id: number, status: RequisitionStatus): Requisition | null {
  if (!['solicitada', 'realizada', 'cancelada'].includes(status)) {
    throw Object.assign(new Error('Status inválido.'), { code: 'VALIDATION' })
  }
  getDb().prepare('UPDATE requisitions SET status = ? WHERE id = ?').run(status, id)
  logAudit({ action: 'update-status', entity: 'requisition', entityId: id, details: { status } })
  const row = getDb().prepare('SELECT * FROM requisitions WHERE id = ?').get(id) as Row | undefined
  return row ? mapRow(row) : null
}

export function deleteRequisition(id: number): void {
  const result = getDb().prepare('DELETE FROM requisitions WHERE id = ?').run(id)
  if (result.changes > 0) {
    logAudit({ action: 'delete', entity: 'requisition', entityId: id })
  }
}
