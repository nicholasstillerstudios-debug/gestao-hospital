import { getDb } from '../db'
import { logAudit } from '../audit'
import { getCurrentUser } from '../session'
import type {
  Prescription,
  PrescriptionInput,
  PrescriptionItem,
  PrescriptionWithRefs
} from '@shared/types'

interface Row {
  id: number
  patient_id: number
  attendance_id: number | null
  professional_id: number
  issued_at: string
  notes: string | null
  items: string
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

function parseItems(json: string): PrescriptionItem[] {
  try {
    const parsed = JSON.parse(json)
    if (!Array.isArray(parsed)) return []
    return parsed.map((it: Partial<PrescriptionItem>) => ({
      medication: String(it.medication ?? '').trim(),
      dose: it.dose != null ? String(it.dose) : null,
      via: it.via != null ? String(it.via) : null,
      posology: it.posology != null ? String(it.posology) : null,
      duration: it.duration != null ? String(it.duration) : null,
      quantity: it.quantity != null ? String(it.quantity) : null,
      notes: it.notes != null ? String(it.notes) : null
    }))
  } catch {
    return []
  }
}

function mapRow(row: Row): Prescription {
  return {
    id: row.id,
    patientId: row.patient_id,
    attendanceId: row.attendance_id,
    professionalId: row.professional_id,
    issuedAt: row.issued_at,
    notes: row.notes,
    items: parseItems(row.items),
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at
  }
}

function mapJoinedRow(row: JoinedRow): PrescriptionWithRefs {
  return {
    ...mapRow(row),
    patient: {
      id: row.patient_id,
      fullName: row.patient_full_name,
      cpf: row.patient_cpf,
      cns: row.patient_cns,
      birthDate: row.patient_birth_date,
      sex: row.patient_sex as PrescriptionWithRefs['patient']['sex']
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
  SELECT p.*,
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
  FROM prescriptions p
  JOIN patients pa ON pa.id = p.patient_id
  JOIN professionals pr ON pr.id = p.professional_id
`

function validateInput(input: PrescriptionInput): void {
  if (!Number.isFinite(input.patientId) || input.patientId <= 0) {
    throw Object.assign(new Error('Paciente é obrigatório.'), { code: 'VALIDATION' })
  }
  if (!Number.isFinite(input.professionalId) || input.professionalId <= 0) {
    throw Object.assign(new Error('Profissional é obrigatório.'), { code: 'VALIDATION' })
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw Object.assign(new Error('Inclua pelo menos um medicamento.'), { code: 'VALIDATION' })
  }
  for (const it of input.items) {
    if (!it.medication || !it.medication.trim()) {
      throw Object.assign(new Error('Medicamento sem nome.'), { code: 'VALIDATION' })
    }
  }
}

export function createPrescription(input: PrescriptionInput): Prescription {
  validateInput(input)
  const user = getCurrentUser()
  const items: PrescriptionItem[] = input.items.map((it) => ({
    medication: it.medication.trim(),
    dose: it.dose ? it.dose.trim() : null,
    via: it.via ? it.via.trim() : null,
    posology: it.posology ? it.posology.trim() : null,
    duration: it.duration ? it.duration.trim() : null,
    quantity: it.quantity ? it.quantity.trim() : null,
    notes: it.notes ? it.notes.trim() : null
  }))
  const stmt = getDb().prepare(
    `INSERT INTO prescriptions (patient_id, attendance_id, professional_id, notes, items, created_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
  const result = stmt.run(
    input.patientId,
    input.attendanceId,
    input.professionalId,
    input.notes ? input.notes.trim() : null,
    JSON.stringify(items),
    user?.id ?? null
  )
  const id = Number(result.lastInsertRowid)
  logAudit({
    action: 'create',
    entity: 'prescription',
    entityId: id,
    details: { itemCount: items.length }
  })
  const row = getDb().prepare('SELECT * FROM prescriptions WHERE id = ?').get(id) as Row
  return mapRow(row)
}

export function listForPatient(patientId: number): PrescriptionWithRefs[] {
  const rows = getDb()
    .prepare(SELECT_JOINED + ' WHERE p.patient_id = ? ORDER BY p.issued_at DESC')
    .all(patientId) as JoinedRow[]
  return rows.map(mapJoinedRow)
}

/**
 * Lista bruta (sem joins de paciente/profissional). Usada pelo export LGPD
 * de portabilidade, que já tem o paciente em outra parte do JSON.
 */
export function listRawForPatient(patientId: number): Prescription[] {
  const rows = getDb()
    .prepare('SELECT * FROM prescriptions WHERE patient_id = ? ORDER BY issued_at')
    .all(patientId) as Row[]
  return rows.map(mapRow)
}

export function getById(id: number): PrescriptionWithRefs | null {
  const row = getDb()
    .prepare(SELECT_JOINED + ' WHERE p.id = ?')
    .get(id) as JoinedRow | undefined
  return row ? mapJoinedRow(row) : null
}

export function deletePrescription(id: number): void {
  const result = getDb().prepare('DELETE FROM prescriptions WHERE id = ?').run(id)
  if (result.changes > 0) {
    logAudit({ action: 'delete', entity: 'prescription', entityId: id })
  }
}
