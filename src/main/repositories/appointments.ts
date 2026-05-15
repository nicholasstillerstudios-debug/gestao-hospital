import { getDb } from '../db'
import { logAudit } from '../audit'
import { getCurrentUser } from '../session'
import type {
  Appointment,
  AppointmentStatus,
  AppointmentWithRefs,
  TriageColor
} from '@shared/types'
import { TRIAGE_ORDER } from '@shared/types'

interface Row {
  id: number
  patient_id: number
  professional_id: number
  scheduled_at: string
  duration_min: number
  status: AppointmentStatus
  reason: string | null
  triage_color: TriageColor | null
  triage_notes: string | null
  notes: string | null
  checked_in_at: string | null
  started_at: string | null
  ended_at: string | null
  created_by_user_id: number | null
  created_at: string
  updated_at: string
}

interface RowWithRefs extends Row {
  patient_full_name: string
  patient_cpf: string | null
  patient_cns: string | null
  patient_birth_date: string
  patient_sex: 'M' | 'F' | 'O'
  professional_full_name: string
  professional_specialty: string | null
}

function toModel(row: Row): Appointment {
  return {
    id: row.id,
    patientId: row.patient_id,
    professionalId: row.professional_id,
    scheduledAt: row.scheduled_at,
    durationMin: row.duration_min,
    status: row.status,
    reason: row.reason,
    triageColor: row.triage_color,
    triageNotes: row.triage_notes,
    notes: row.notes,
    checkedInAt: row.checked_in_at,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function toModelWithRefs(row: RowWithRefs): AppointmentWithRefs {
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
    professional: {
      id: row.professional_id,
      fullName: row.professional_full_name,
      specialty: row.professional_specialty
    }
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
         pr.specialty AS professional_specialty
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    JOIN professionals pr ON pr.id = a.professional_id
`

export interface AppointmentInput {
  patientId: number
  professionalId: number
  scheduledAt: string
  durationMin: number
  reason: string | null
  notes: string | null
}

export function createAppointment(input: AppointmentInput): Appointment {
  const db = getDb()
  const user = getCurrentUser()
  const result = db
    .prepare(
      `INSERT INTO appointments (
        patient_id, professional_id, scheduled_at, duration_min,
        reason, notes, created_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.patientId,
      input.professionalId,
      input.scheduledAt,
      input.durationMin,
      input.reason,
      input.notes,
      user?.id ?? null
    )
  const row = db
    .prepare('SELECT * FROM appointments WHERE id = ?')
    .get(result.lastInsertRowid) as Row
  logAudit({
    action: 'create',
    entity: 'appointment',
    entityId: row.id,
    details: { patientId: input.patientId, scheduledAt: input.scheduledAt }
  })
  return toModel(row)
}

export function updateAppointment(id: number, input: AppointmentInput): Appointment {
  const db = getDb()
  db.prepare(
    `UPDATE appointments
        SET patient_id = ?, professional_id = ?, scheduled_at = ?,
            duration_min = ?, reason = ?, notes = ?,
            updated_at = datetime('now')
      WHERE id = ?`
  ).run(
    input.patientId,
    input.professionalId,
    input.scheduledAt,
    input.durationMin,
    input.reason,
    input.notes,
    id
  )
  const row = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id) as Row
  logAudit({ action: 'update', entity: 'appointment', entityId: id })
  return toModel(row)
}

export function listAppointmentsForDay(dateIso: string): AppointmentWithRefs[] {
  const rows = getDb()
    .prepare(
      `${SELECT_WITH_REFS}
        WHERE date(a.scheduled_at) = date(?)
        ORDER BY a.scheduled_at ASC`
    )
    .all(dateIso) as RowWithRefs[]
  return rows.map(toModelWithRefs)
}

export function listAppointmentsForPatient(patientId: number): AppointmentWithRefs[] {
  const rows = getDb()
    .prepare(
      `${SELECT_WITH_REFS}
        WHERE a.patient_id = ?
        ORDER BY a.scheduled_at DESC`
    )
    .all(patientId) as RowWithRefs[]
  return rows.map(toModelWithRefs)
}

export function listAppointmentsRange(startIso: string, endIso: string): AppointmentWithRefs[] {
  const rows = getDb()
    .prepare(
      `${SELECT_WITH_REFS}
        WHERE a.scheduled_at >= ? AND a.scheduled_at < ?
        ORDER BY a.scheduled_at ASC`
    )
    .all(startIso, endIso) as RowWithRefs[]
  return rows.map(toModelWithRefs)
}

export function getAppointment(id: number): AppointmentWithRefs | null {
  const row = getDb().prepare(`${SELECT_WITH_REFS} WHERE a.id = ?`).get(id) as
    | RowWithRefs
    | undefined
  return row ? toModelWithRefs(row) : null
}

export function getQueue(dateIso: string): AppointmentWithRefs[] {
  const rows = getDb()
    .prepare(
      `${SELECT_WITH_REFS}
        WHERE date(a.scheduled_at) = date(?)
          AND a.status IN ('aguardando','em_atendimento')
        ORDER BY a.scheduled_at ASC`
    )
    .all(dateIso) as RowWithRefs[]
  const list = rows.map(toModelWithRefs)
  list.sort((a, b) => {
    const aOrder = a.triageColor ? TRIAGE_ORDER[a.triageColor] : 99
    const bOrder = b.triageColor ? TRIAGE_ORDER[b.triageColor] : 99
    if (aOrder !== bOrder) return aOrder - bOrder
    return a.scheduledAt.localeCompare(b.scheduledAt)
  })
  return list
}

export function updateStatus(id: number, status: AppointmentStatus): Appointment {
  const db = getDb()
  db.prepare(`UPDATE appointments SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(
    status,
    id
  )
  const row = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id) as Row
  logAudit({ action: 'update-status', entity: 'appointment', entityId: id, details: { status } })
  return toModel(row)
}

export function checkIn(id: number): Appointment {
  const db = getDb()
  db.prepare(
    `UPDATE appointments
        SET status = 'aguardando',
            checked_in_at = datetime('now'),
            updated_at = datetime('now')
      WHERE id = ?`
  ).run(id)
  const row = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id) as Row
  logAudit({ action: 'check-in', entity: 'appointment', entityId: id })
  return toModel(row)
}

export function setTriage(id: number, color: TriageColor, notes: string | null): Appointment {
  const db = getDb()
  db.prepare(
    `UPDATE appointments
        SET triage_color = ?, triage_notes = ?, updated_at = datetime('now')
      WHERE id = ?`
  ).run(color, notes, id)
  const row = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id) as Row
  logAudit({ action: 'set-triage', entity: 'appointment', entityId: id, details: { color } })
  return toModel(row)
}

export function cancelAppointment(id: number, reason: string | null): Appointment {
  const db = getDb()
  db.prepare(
    `UPDATE appointments
        SET status = 'cancelado',
            notes = COALESCE(notes || char(10), '') || 'Cancelado: ' || COALESCE(?, '—'),
            updated_at = datetime('now')
      WHERE id = ?`
  ).run(reason, id)
  const row = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id) as Row
  logAudit({ action: 'cancel', entity: 'appointment', entityId: id, details: { reason } })
  return toModel(row)
}
