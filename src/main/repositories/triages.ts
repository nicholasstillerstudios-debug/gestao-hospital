import { getDb } from '../db'
import { logAudit } from '../audit'
import type { TriageColor, TriageRecord, TriageRecordInput } from '@shared/types'

interface Row {
  id: number
  appointment_id: number
  patient_id: number
  systolic_bp: number | null
  diastolic_bp: number | null
  heart_rate: number | null
  resp_rate: number | null
  spo2: number | null
  temperature_c: number | null
  glucose_mg_dl: number | null
  pain_scale: number | null
  weight_kg: number | null
  height_cm: number | null
  chief_complaint: string | null
  flowchart_key: string | null
  discriminators: string | null
  suggested_color: TriageColor | null
  final_color: TriageColor
  override_reason: string | null
  notes: string | null
  performed_by_user_id: number | null
  performed_by_name: string | null
  created_at: string
}

function toRecord(r: Row): TriageRecord {
  return {
    id: r.id,
    appointmentId: r.appointment_id,
    patientId: r.patient_id,
    systolicBp: r.systolic_bp,
    diastolicBp: r.diastolic_bp,
    heartRate: r.heart_rate,
    respRate: r.resp_rate,
    spo2: r.spo2,
    temperatureC: r.temperature_c,
    glucoseMgDl: r.glucose_mg_dl,
    painScale: r.pain_scale,
    weightKg: r.weight_kg,
    heightCm: r.height_cm,
    chiefComplaint: r.chief_complaint,
    flowchartKey: r.flowchart_key,
    discriminators: r.discriminators ? (JSON.parse(r.discriminators) as string[]) : [],
    suggestedColor: r.suggested_color,
    finalColor: r.final_color,
    overrideReason: r.override_reason,
    notes: r.notes,
    performedByUserId: r.performed_by_user_id,
    performedByName: r.performed_by_name,
    createdAt: r.created_at
  }
}

function validateRange(
  field: string,
  value: number | null | undefined,
  min: number,
  max: number
): void {
  if (value == null) return
  if (!Number.isFinite(value) || value < min || value > max) {
    const err = new Error(`${field} fora do intervalo permitido (${min}–${max}).`) as Error & {
      code?: string
    }
    err.code = 'VALIDATION_ERROR'
    throw err
  }
}

export function save(
  input: TriageRecordInput,
  performedByUserId: number | null,
  performedByName: string | null
): TriageRecord {
  if (!input.appointmentId || input.appointmentId <= 0) {
    const err = new Error('Atendimento inválido para triagem.') as Error & { code?: string }
    err.code = 'VALIDATION_ERROR'
    throw err
  }

  // Validações simples para evitar valores inviáveis no banco.
  validateRange('PA sistólica', input.systolicBp, 40, 300)
  validateRange('PA diastólica', input.diastolicBp, 20, 200)
  validateRange('FC', input.heartRate, 20, 250)
  validateRange('FR', input.respRate, 5, 80)
  validateRange('SpO₂', input.spo2, 50, 100)
  validateRange('Temperatura', input.temperatureC, 30, 45)
  validateRange('Glicemia', input.glucoseMgDl, 20, 800)
  validateRange('Dor (0–10)', input.painScale, 0, 10)
  validateRange('Peso', input.weightKg, 0.5, 400)
  validateRange('Altura', input.heightCm, 30, 250)

  const db = getDb()
  const appt = db
    .prepare<
      [number],
      { id: number; patient_id: number }
    >('SELECT id, patient_id FROM appointments WHERE id = ?')
    .get(input.appointmentId)
  if (!appt) {
    const err = new Error('Atendimento não encontrado.') as Error & { code?: string }
    err.code = 'NOT_FOUND'
    throw err
  }

  const discriminatorsJson = JSON.stringify(input.discriminators ?? [])

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO triage_records
         (appointment_id, patient_id, systolic_bp, diastolic_bp, heart_rate, resp_rate, spo2,
          temperature_c, glucose_mg_dl, pain_scale, weight_kg, height_cm, chief_complaint,
          flowchart_key, discriminators, suggested_color, final_color, override_reason, notes,
          performed_by_user_id, performed_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(appointment_id) DO UPDATE SET
         systolic_bp = excluded.systolic_bp,
         diastolic_bp = excluded.diastolic_bp,
         heart_rate = excluded.heart_rate,
         resp_rate = excluded.resp_rate,
         spo2 = excluded.spo2,
         temperature_c = excluded.temperature_c,
         glucose_mg_dl = excluded.glucose_mg_dl,
         pain_scale = excluded.pain_scale,
         weight_kg = excluded.weight_kg,
         height_cm = excluded.height_cm,
         chief_complaint = excluded.chief_complaint,
         flowchart_key = excluded.flowchart_key,
         discriminators = excluded.discriminators,
         suggested_color = excluded.suggested_color,
         final_color = excluded.final_color,
         override_reason = excluded.override_reason,
         notes = excluded.notes,
         performed_by_user_id = excluded.performed_by_user_id,
         performed_by_name = excluded.performed_by_name,
         created_at = datetime('now')`
    ).run(
      input.appointmentId,
      appt.patient_id,
      input.systolicBp ?? null,
      input.diastolicBp ?? null,
      input.heartRate ?? null,
      input.respRate ?? null,
      input.spo2 ?? null,
      input.temperatureC ?? null,
      input.glucoseMgDl ?? null,
      input.painScale ?? null,
      input.weightKg ?? null,
      input.heightCm ?? null,
      input.chiefComplaint ?? null,
      input.flowchartKey ?? null,
      discriminatorsJson,
      input.suggestedColor ?? null,
      input.finalColor,
      input.overrideReason ?? null,
      input.notes ?? null,
      performedByUserId,
      performedByName
    )

    // Mantém triage_color do appointment sincronizado para a fila ordenar.
    db.prepare(
      `UPDATE appointments
       SET triage_color = ?, triage_notes = COALESCE(?, triage_notes), updated_at = datetime('now')
       WHERE id = ?`
    ).run(input.finalColor, input.chiefComplaint ?? input.notes ?? null, input.appointmentId)
  })

  tx()

  const row = db
    .prepare<[number], Row>('SELECT * FROM triage_records WHERE appointment_id = ?')
    .get(input.appointmentId) as Row

  logAudit({
    action: 'TRIAGE_SAVE',
    entity: 'triage_record',
    entityId: String(row.id),
    details: {
      appointmentId: input.appointmentId,
      flowchart: input.flowchartKey,
      suggested: input.suggestedColor,
      final: input.finalColor,
      overridden: input.suggestedColor !== input.finalColor,
      overrideReason: input.overrideReason,
      performedByUserId,
      performedByName
    }
  })

  return toRecord(row)
}

export function getByAppointment(appointmentId: number): TriageRecord | null {
  const db = getDb()
  const row = db
    .prepare<[number], Row>('SELECT * FROM triage_records WHERE appointment_id = ?')
    .get(appointmentId)
  return row ? toRecord(row) : null
}

export function listForPatient(patientId: number, limit: number = 20): TriageRecord[] {
  const db = getDb()
  const safe = Math.max(1, Math.min(100, Math.floor(limit)))
  const rows = db
    .prepare<
      [number, number],
      Row
    >('SELECT * FROM triage_records WHERE patient_id = ? ORDER BY datetime(created_at) DESC LIMIT ?')
    .all(patientId, safe)
  return rows.map(toRecord)
}
