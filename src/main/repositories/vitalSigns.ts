/**
 * Repositório de sinais vitais durante a internação.
 *
 * Cada registro é uma aferição pontual (PA, FC, FR, SatO2, temperatura,
 * dor, glicemia, peso, altura). Todos os campos são opcionais — o
 * operador preenche apenas o que mediu. É registro de prontuário:
 * uma vez gravado, não pode ser editado, só apagado pelo próprio autor
 * (ou admin) enquanto a internação estiver ativa.
 */

import { getDb } from '../db'
import { logAudit } from '../audit'
import { getCurrentUser } from '../session'
import type {
  AdmissionVitalSigns,
  AdmissionVitalSignsInput,
  AdmissionVitalSignsWithRefs
} from '@shared/types'

interface Row {
  id: number
  admission_id: number
  professional_id: number | null
  measured_at: string
  systolic_bp: number | null
  diastolic_bp: number | null
  heart_rate: number | null
  respiratory_rate: number | null
  temperature_c: number | null
  oxygen_saturation: number | null
  pain_score: number | null
  blood_glucose: number | null
  weight_kg: number | null
  height_cm: number | null
  notes: string | null
  created_by_user_id: number | null
  created_at: string
}

interface RowWithRefs extends Row {
  professional_name: string | null
  created_by_user_name: string | null
}

function toModel(row: Row): AdmissionVitalSigns {
  return {
    id: row.id,
    admissionId: row.admission_id,
    professionalId: row.professional_id,
    measuredAt: row.measured_at,
    systolicBp: row.systolic_bp,
    diastolicBp: row.diastolic_bp,
    heartRate: row.heart_rate,
    respiratoryRate: row.respiratory_rate,
    temperatureC: row.temperature_c,
    oxygenSaturation: row.oxygen_saturation,
    painScore: row.pain_score,
    bloodGlucose: row.blood_glucose,
    weightKg: row.weight_kg,
    heightCm: row.height_cm,
    notes: row.notes,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at
  }
}

function toModelWithRefs(row: RowWithRefs): AdmissionVitalSignsWithRefs {
  return {
    ...toModel(row),
    professionalName: row.professional_name,
    createdByUserName: row.created_by_user_name
  }
}

const SELECT_WITH_REFS = `
  SELECT v.*,
         p.full_name AS professional_name,
         u.full_name AS created_by_user_name
    FROM admission_vital_signs v
    LEFT JOIN professionals p ON p.id = v.professional_id
    LEFT JOIN users u ON u.id = v.created_by_user_id
`

export function listVitalSignsForAdmission(
  admissionId: number,
  limit?: number
): AdmissionVitalSignsWithRefs[] {
  const safeLimit =
    typeof limit === 'number' && Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : null
  const sql = `${SELECT_WITH_REFS}
       WHERE v.admission_id = ?
       ORDER BY v.measured_at DESC, v.id DESC
       ${safeLimit != null ? 'LIMIT ?' : ''}`
  const stmt = getDb().prepare(sql)
  const rows = (
    safeLimit != null ? stmt.all(admissionId, safeLimit) : stmt.all(admissionId)
  ) as RowWithRefs[]
  return rows.map(toModelWithRefs)
}

export function getLatestVitalSignsForAdmission(
  admissionId: number
): AdmissionVitalSignsWithRefs | null {
  const row = getDb()
    .prepare(
      `${SELECT_WITH_REFS}
       WHERE v.admission_id = ?
       ORDER BY v.measured_at DESC, v.id DESC
       LIMIT 1`
    )
    .get(admissionId) as RowWithRefs | undefined
  return row ? toModelWithRefs(row) : null
}

function ensureAdmissionActive(admissionId: number): void {
  const admission = getDb()
    .prepare('SELECT id, status FROM admissions WHERE id = ?')
    .get(admissionId) as { id: number; status: string } | undefined
  if (!admission) {
    throw Object.assign(new Error('Internação não encontrada.'), {
      code: 'ADMISSION_NOT_FOUND'
    })
  }
  if (admission.status !== 'ativa') {
    throw Object.assign(
      new Error('Internação encerrada: não é mais possível registrar sinais vitais.'),
      { code: 'ADMISSION_NOT_ACTIVE' }
    )
  }
}

function hasAnyMeasurement(input: AdmissionVitalSignsInput): boolean {
  return [
    input.systolicBp,
    input.diastolicBp,
    input.heartRate,
    input.respiratoryRate,
    input.temperatureC,
    input.oxygenSaturation,
    input.painScore,
    input.bloodGlucose,
    input.weightKg,
    input.heightCm
  ].some((v) => v != null)
}

/** Faixas plausíveis — fora delas rejeitamos pra evitar typo grosseiro
 *  (ex.: PA 1200 em vez de 120). Não substitui validação clínica. */
function validateMeasurements(input: AdmissionVitalSignsInput): void {
  const checks: [string, number | null | undefined, number, number][] = [
    ['systolicBp', input.systolicBp, 30, 300],
    ['diastolicBp', input.diastolicBp, 10, 250],
    ['heartRate', input.heartRate, 0, 350],
    ['respiratoryRate', input.respiratoryRate, 0, 90],
    ['temperatureC', input.temperatureC, 25, 45],
    ['oxygenSaturation', input.oxygenSaturation, 0, 100],
    ['painScore', input.painScore, 0, 10],
    ['bloodGlucose', input.bloodGlucose, 10, 1500],
    ['weightKg', input.weightKg, 0.2, 600],
    ['heightCm', input.heightCm, 20, 260]
  ]
  for (const [field, value, min, max] of checks) {
    if (value == null) continue
    if (!Number.isFinite(value) || value < min || value > max) {
      throw Object.assign(
        new Error(`Valor fora da faixa plausível para ${field} (${min}–${max}).`),
        { code: 'VITAL_OUT_OF_RANGE' }
      )
    }
  }
  if (input.systolicBp != null && input.diastolicBp != null) {
    if (input.diastolicBp >= input.systolicBp) {
      throw Object.assign(new Error('Pressão diastólica deve ser menor que a sistólica.'), {
        code: 'VITAL_BP_INVALID'
      })
    }
  }
}

export function createVitalSigns(input: AdmissionVitalSignsInput): AdmissionVitalSignsWithRefs {
  ensureAdmissionActive(input.admissionId)
  if (!hasAnyMeasurement(input)) {
    throw Object.assign(
      new Error(
        'Informe pelo menos uma medida (PA, FC, FR, SatO2, temperatura, dor, glicemia, peso ou altura).'
      ),
      { code: 'VITAL_EMPTY' }
    )
  }
  validateMeasurements(input)
  const db = getDb()
  const user = getCurrentUser()
  const measuredAt = input.measuredAt ?? new Date().toISOString()
  const result = db
    .prepare(
      `INSERT INTO admission_vital_signs (
         admission_id, professional_id, measured_at,
         systolic_bp, diastolic_bp, heart_rate, respiratory_rate,
         temperature_c, oxygen_saturation, pain_score, blood_glucose,
         weight_kg, height_cm, notes, created_by_user_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.admissionId,
      input.professionalId ?? null,
      measuredAt,
      input.systolicBp ?? null,
      input.diastolicBp ?? null,
      input.heartRate ?? null,
      input.respiratoryRate ?? null,
      input.temperatureC ?? null,
      input.oxygenSaturation ?? null,
      input.painScore ?? null,
      input.bloodGlucose ?? null,
      input.weightKg ?? null,
      input.heightCm ?? null,
      input.notes?.trim() || null,
      user?.id ?? null
    )
  const id = Number(result.lastInsertRowid)
  logAudit({
    action: 'create',
    entity: 'admission_vital_signs',
    entityId: id,
    details: { admissionId: input.admissionId }
  })
  const row = db.prepare(`${SELECT_WITH_REFS} WHERE v.id = ?`).get(id) as RowWithRefs
  return toModelWithRefs(row)
}

/**
 * Remove um registro de sinais vitais. Permitido enquanto a internação
 * estiver ativa e apenas pelo autor (ou admin). Para retificar um erro
 * de digitação, a prática é apagar e lançar um novo.
 */
export function deleteVitalSigns(id: number): void {
  const db = getDb()
  const current = db.prepare('SELECT * FROM admission_vital_signs WHERE id = ?').get(id) as
    | Row
    | undefined
  if (!current) {
    throw Object.assign(new Error('Registro não encontrado.'), { code: 'VITAL_NOT_FOUND' })
  }
  ensureAdmissionActive(current.admission_id)
  const user = getCurrentUser()
  if (
    user &&
    user.role !== 'admin' &&
    current.created_by_user_id != null &&
    current.created_by_user_id !== user.id
  ) {
    throw Object.assign(new Error('Apenas o autor (ou um admin) pode remover este registro.'), {
      code: 'NOT_VITAL_AUTHOR'
    })
  }
  db.prepare('DELETE FROM admission_vital_signs WHERE id = ?').run(id)
  logAudit({ action: 'delete', entity: 'admission_vital_signs', entityId: id })
}
