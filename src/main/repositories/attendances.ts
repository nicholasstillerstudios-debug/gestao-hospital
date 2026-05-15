import { getDb } from '../db'
import { logAudit } from '../audit'
import { getCurrentUser } from '../session'
import type { Attendance } from '@shared/types'

interface Row {
  id: number
  appointment_id: number
  patient_id: number
  professional_id: number
  started_at: string
  ended_at: string | null
  subjective: string | null
  objective: string | null
  assessment: string | null
  plan: string | null
  prescription: string | null
  created_by_user_id: number | null
  created_at: string
}

function toModel(row: Row): Attendance {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    patientId: row.patient_id,
    professionalId: row.professional_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    subjective: row.subjective,
    objective: row.objective,
    assessment: row.assessment,
    plan: row.plan,
    prescription: row.prescription,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at
  }
}

export function getByAppointment(appointmentId: number): Attendance | null {
  const row = getDb()
    .prepare('SELECT * FROM attendances WHERE appointment_id = ?')
    .get(appointmentId) as Row | undefined
  return row ? toModel(row) : null
}

export function startAttendance(appointmentId: number): Attendance {
  const db = getDb()
  const existing = getByAppointment(appointmentId)
  if (existing) return existing

  const appt = db
    .prepare('SELECT patient_id, professional_id FROM appointments WHERE id = ?')
    .get(appointmentId) as { patient_id: number; professional_id: number } | undefined
  if (!appt) throw new Error('Agendamento não encontrado')

  const user = getCurrentUser()
  const result = db
    .prepare(
      `INSERT INTO attendances (
         appointment_id, patient_id, professional_id, started_at, created_by_user_id
       ) VALUES (?, ?, ?, datetime('now'), ?)`
    )
    .run(appointmentId, appt.patient_id, appt.professional_id, user?.id ?? null)

  db.prepare(
    `UPDATE appointments
        SET status = 'em_atendimento',
            started_at = datetime('now'),
            updated_at = datetime('now')
      WHERE id = ?`
  ).run(appointmentId)

  const row = db
    .prepare('SELECT * FROM attendances WHERE id = ?')
    .get(result.lastInsertRowid) as Row
  logAudit({
    action: 'start',
    entity: 'attendance',
    entityId: row.id,
    details: { appointmentId }
  })
  return toModel(row)
}

export interface AttendanceSaveInput {
  subjective: string | null
  objective: string | null
  assessment: string | null
  plan: string | null
  prescription: string | null
}

export function saveAttendance(id: number, input: AttendanceSaveInput): Attendance {
  const db = getDb()
  db.prepare(
    `UPDATE attendances
        SET subjective = ?, objective = ?, assessment = ?, plan = ?, prescription = ?
      WHERE id = ?`
  ).run(input.subjective, input.objective, input.assessment, input.plan, input.prescription, id)
  const row = db.prepare('SELECT * FROM attendances WHERE id = ?').get(id) as Row
  logAudit({ action: 'save', entity: 'attendance', entityId: id })
  return toModel(row)
}

export function finishAttendance(id: number, input: AttendanceSaveInput): Attendance {
  const db = getDb()
  db.prepare(
    `UPDATE attendances
        SET subjective = ?, objective = ?, assessment = ?, plan = ?, prescription = ?,
            ended_at = datetime('now')
      WHERE id = ?`
  ).run(input.subjective, input.objective, input.assessment, input.plan, input.prescription, id)
  const row = db.prepare('SELECT * FROM attendances WHERE id = ?').get(id) as Row
  db.prepare(
    `UPDATE appointments
        SET status = 'concluido',
            ended_at = datetime('now'),
            updated_at = datetime('now')
      WHERE id = ?`
  ).run(row.appointment_id)
  logAudit({ action: 'finish', entity: 'attendance', entityId: id })
  return toModel(row)
}

export function listForPatient(patientId: number): Attendance[] {
  const rows = getDb()
    .prepare('SELECT * FROM attendances WHERE patient_id = ? ORDER BY started_at DESC')
    .all(patientId) as Row[]
  return rows.map(toModel)
}
