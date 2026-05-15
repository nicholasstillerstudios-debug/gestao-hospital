import { getDb } from '../db'
import { logAudit } from '../audit'
import type { PatientCall, PatientCallInput } from '@shared/types'

interface Row {
  id: number
  patient_id: number | null
  appointment_id: number | null
  patient_name: string
  room: string
  message: string | null
  called_by_user_id: number | null
  called_by_name: string | null
  called_at: string
}

function toCall(row: Row): PatientCall {
  return {
    id: row.id,
    patientId: row.patient_id,
    appointmentId: row.appointment_id,
    patientName: row.patient_name,
    room: row.room,
    message: row.message,
    calledByUserId: row.called_by_user_id,
    calledByName: row.called_by_name,
    calledAt: row.called_at
  }
}

export function create(
  input: PatientCallInput,
  calledByUserId: number | null,
  calledByName: string | null
): PatientCall {
  const db = getDb()
  const patientName = input.patientName.trim()
  const room = input.room.trim()
  if (!patientName) {
    const err = new Error('Nome do paciente é obrigatório.') as Error & { code?: string }
    err.code = 'VALIDATION_ERROR'
    throw err
  }
  if (!room) {
    const err = new Error('Consultório / sala é obrigatório.') as Error & { code?: string }
    err.code = 'VALIDATION_ERROR'
    throw err
  }
  const result = db
    .prepare(
      `INSERT INTO patient_calls
         (patient_id, appointment_id, patient_name, room, message, called_by_user_id, called_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.patientId ?? null,
      input.appointmentId ?? null,
      patientName,
      room,
      input.message ?? null,
      calledByUserId,
      calledByName
    )
  const row = db
    .prepare<[number], Row>('SELECT * FROM patient_calls WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as Row
  logAudit({
    action: 'CALL_PATIENT',
    entity: 'patient_call',
    entityId: String(row.id),
    details: { room, patientName, appointmentId: input.appointmentId, calledByUserId, calledByName }
  })
  return toCall(row)
}

export function recent(limit: number = 10): PatientCall[] {
  const db = getDb()
  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)))
  const rows = db
    .prepare<
      [number],
      Row
    >('SELECT * FROM patient_calls ORDER BY datetime(called_at) DESC, id DESC LIMIT ?')
    .all(safeLimit)
  return rows.map(toCall)
}

export function repeat(
  callId: number,
  calledByUserId: number | null,
  calledByName: string | null
): PatientCall {
  const db = getDb()
  const existing = db.prepare<[number], Row>('SELECT * FROM patient_calls WHERE id = ?').get(callId)
  if (!existing) {
    const err = new Error('Chamada não encontrada.') as Error & { code?: string }
    err.code = 'NOT_FOUND'
    throw err
  }
  return create(
    {
      patientId: existing.patient_id,
      appointmentId: existing.appointment_id,
      patientName: existing.patient_name,
      room: existing.room,
      message: existing.message
    },
    calledByUserId,
    calledByName
  )
}
