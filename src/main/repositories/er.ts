/**
 * Pronto-Socorro: atendimentos (er_visits) + triagem (er_triages).
 *
 * Cada chegada de paciente vira uma `er_visit`. Triagem é registrada
 * em `er_triages` (uma visita pode ter retriagem, mas só a mais recente
 * conta para fila e cor exibida). O desfecho fecha a visita e — quando
 * for `internado` — pode opcionalmente vincular `admission_id`.
 */

import { getDb } from '../db'
import { logAudit } from '../audit'
import { getCurrentUser } from '../session'
import type {
  ErVisit,
  ErVisitWithRefs,
  ErVisitInput,
  ErVisitStatus,
  ErTriage,
  ErTriageWithRefs,
  ErTriageInput,
  ErCloseInput,
  TriageColor
} from '@shared/types'
import { TRIAGE_TARGET_MINUTES } from '@shared/types'

// ─────────────────────────────────────────────────────────── visits ─────

interface VisitRow {
  id: number
  patient_id: number
  arrived_at: string
  arrival_mode: string | null
  chief_complaint: string
  status: string
  attending_professional_id: number | null
  notes: string | null
  closed_at: string | null
  outcome_summary: string | null
  admission_id: number | null
  created_by_user_id: number | null
  created_at: string
  updated_at: string
}

interface VisitRowWithRefs extends VisitRow {
  patient_name: string
  patient_cpf: string | null
  patient_birth_date: string
  attending_professional_name: string | null
  latest_triage_color: string | null
  latest_triage_at: string | null
}

function toVisit(r: VisitRow): ErVisit {
  return {
    id: r.id,
    patientId: r.patient_id,
    arrivedAt: r.arrived_at,
    arrivalMode: (r.arrival_mode as ErVisit['arrivalMode']) ?? null,
    chiefComplaint: r.chief_complaint,
    status: r.status as ErVisitStatus,
    attendingProfessionalId: r.attending_professional_id,
    notes: r.notes,
    closedAt: r.closed_at,
    outcomeSummary: r.outcome_summary,
    admissionId: r.admission_id,
    createdByUserId: r.created_by_user_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}

function toVisitWithRefs(r: VisitRowWithRefs): ErVisitWithRefs {
  return {
    ...toVisit(r),
    patientName: r.patient_name,
    patientCpf: r.patient_cpf,
    patientBirthDate: r.patient_birth_date,
    attendingProfessionalName: r.attending_professional_name,
    latestTriageColor: (r.latest_triage_color as TriageColor | null) ?? null,
    latestTriageAt: r.latest_triage_at
  }
}

const SELECT_VISIT_WITH_REFS = `
  SELECT v.*,
         p.full_name AS patient_name,
         p.cpf       AS patient_cpf,
         p.birth_date AS patient_birth_date,
         pr.full_name AS attending_professional_name,
         (SELECT t.color FROM er_triages t WHERE t.visit_id = v.id
            ORDER BY t.triaged_at DESC LIMIT 1) AS latest_triage_color,
         (SELECT t.triaged_at FROM er_triages t WHERE t.visit_id = v.id
            ORDER BY t.triaged_at DESC LIMIT 1) AS latest_triage_at
    FROM er_visits v
    JOIN patients p ON p.id = v.patient_id
    LEFT JOIN professionals pr ON pr.id = v.attending_professional_id
`

/**
 * Lista visitas ativas (não encerradas) ordenadas por:
 *   1. status: aguardando_triagem antes de triado etc
 *   2. cor da triagem mais recente (vermelho > laranja > amarelo > verde > azul)
 *   3. ordem de chegada
 *
 * Quando `includeClosed = true`, traz também alta/internado/etc. das últimas 24h.
 */
export function listVisits(includeClosed = false): ErVisitWithRefs[] {
  const sql = `${SELECT_VISIT_WITH_REFS}
    WHERE ${
      includeClosed
        ? `v.status IN ('aguardando_triagem','triado','em_atendimento','aguardando_internacao')
        OR v.closed_at >= datetime('now','-1 day')`
        : `v.status IN ('aguardando_triagem','triado','em_atendimento','aguardando_internacao')`
    }
    ORDER BY
      CASE (SELECT t.color FROM er_triages t WHERE t.visit_id = v.id
              ORDER BY t.triaged_at DESC LIMIT 1)
        WHEN 'vermelho' THEN 1
        WHEN 'laranja'  THEN 2
        WHEN 'amarelo'  THEN 3
        WHEN 'verde'    THEN 4
        WHEN 'azul'     THEN 5
        ELSE 6
      END,
      v.arrived_at ASC`
  const rows = getDb().prepare(sql).all() as VisitRowWithRefs[]
  return rows.map(toVisitWithRefs)
}

export function getVisit(id: number): ErVisitWithRefs | null {
  const row = getDb()
    .prepare(`${SELECT_VISIT_WITH_REFS} WHERE v.id = ?`)
    .get(id) as VisitRowWithRefs | undefined
  return row ? toVisitWithRefs(row) : null
}

export function createVisit(input: ErVisitInput): ErVisitWithRefs {
  if (!input.chiefComplaint?.trim()) {
    throw Object.assign(new Error('Queixa principal é obrigatória.'), {
      code: 'ER_CHIEF_COMPLAINT_REQUIRED'
    })
  }
  const db = getDb()
  const user = getCurrentUser()
  const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(input.patientId) as
    | { id: number }
    | undefined
  if (!patient) {
    throw Object.assign(new Error('Paciente não encontrado.'), { code: 'PATIENT_NOT_FOUND' })
  }

  const result = db
    .prepare(
      `INSERT INTO er_visits (patient_id, arrival_mode, chief_complaint, notes, created_by_user_id)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      input.patientId,
      input.arrivalMode ?? null,
      input.chiefComplaint.trim(),
      input.notes?.trim() || null,
      user?.id ?? null
    )

  const id = Number(result.lastInsertRowid)
  logAudit({ action: 'create', entity: 'er_visit', entityId: id, details: { patientId: input.patientId } })
  return getVisit(id)!
}

const ALLOWED_TRANSITIONS: Record<ErVisitStatus, ErVisitStatus[]> = {
  aguardando_triagem: ['triado'],
  triado: ['em_atendimento'],
  em_atendimento: ['aguardando_internacao', 'alta', 'transferido', 'evasao', 'obito'],
  aguardando_internacao: ['internado', 'alta', 'transferido', 'evasao', 'obito'],
  alta: [],
  internado: [],
  transferido: [],
  evasao: [],
  obito: []
}

export function setVisitStatus(
  id: number,
  status: ErVisitStatus,
  attendingProfessionalId?: number | null
): ErVisitWithRefs {
  const db = getDb()
  const current = db.prepare('SELECT * FROM er_visits WHERE id = ?').get(id) as
    | VisitRow
    | undefined
  if (!current) {
    throw Object.assign(new Error('Atendimento não encontrado.'), { code: 'ER_VISIT_NOT_FOUND' })
  }
  const allowed = ALLOWED_TRANSITIONS[current.status as ErVisitStatus] ?? []
  if (!allowed.includes(status)) {
    throw Object.assign(
      new Error(`Transição de status inválida: ${current.status} → ${status}.`),
      { code: 'ER_INVALID_TRANSITION' }
    )
  }
  db.prepare(
    `UPDATE er_visits
       SET status = ?,
           attending_professional_id = COALESCE(?, attending_professional_id),
           updated_at = datetime('now')
     WHERE id = ?`
  ).run(status, attendingProfessionalId ?? null, id)
  logAudit({ action: 'update', entity: 'er_visit', entityId: id, details: { status } })
  return getVisit(id)!
}

export function closeVisit(input: ErCloseInput): ErVisitWithRefs {
  const db = getDb()
  const current = db.prepare('SELECT * FROM er_visits WHERE id = ?').get(input.visitId) as
    | VisitRow
    | undefined
  if (!current) {
    throw Object.assign(new Error('Atendimento não encontrado.'), { code: 'ER_VISIT_NOT_FOUND' })
  }
  if (current.closed_at) {
    throw Object.assign(new Error('Atendimento já encerrado.'), { code: 'ER_ALREADY_CLOSED' })
  }
  db.prepare(
    `UPDATE er_visits
       SET status = ?, closed_at = datetime('now'),
           outcome_summary = ?, admission_id = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(input.outcome, input.outcomeSummary?.trim() || null, input.admissionId ?? null, input.visitId)
  logAudit({
    action: 'update',
    entity: 'er_visit',
    entityId: input.visitId,
    details: { outcome: input.outcome }
  })
  return getVisit(input.visitId)!
}

// ─────────────────────────────────────────────────────────── triages ────

interface TriageRow {
  id: number
  visit_id: number
  professional_id: number | null
  triaged_at: string
  color: string
  target_wait_minutes: number
  discriminator: string | null
  systolic_bp: number | null
  diastolic_bp: number | null
  heart_rate: number | null
  respiratory_rate: number | null
  temperature_c: number | null
  oxygen_saturation: number | null
  pain_score: number | null
  glasgow: number | null
  notes: string | null
  created_by_user_id: number | null
  created_at: string
}

interface TriageRowWithRefs extends TriageRow {
  professional_name: string | null
}

function toTriage(r: TriageRow): ErTriage {
  return {
    id: r.id,
    visitId: r.visit_id,
    professionalId: r.professional_id,
    triagedAt: r.triaged_at,
    color: r.color as TriageColor,
    targetWaitMinutes: r.target_wait_minutes,
    discriminator: r.discriminator,
    systolicBp: r.systolic_bp,
    diastolicBp: r.diastolic_bp,
    heartRate: r.heart_rate,
    respiratoryRate: r.respiratory_rate,
    temperatureC: r.temperature_c,
    oxygenSaturation: r.oxygen_saturation,
    painScore: r.pain_score,
    glasgow: r.glasgow,
    notes: r.notes,
    createdByUserId: r.created_by_user_id,
    createdAt: r.created_at
  }
}

function toTriageWithRefs(r: TriageRowWithRefs): ErTriageWithRefs {
  return { ...toTriage(r), professionalName: r.professional_name }
}

export function listTriagesForVisit(visitId: number): ErTriageWithRefs[] {
  const rows = getDb()
    .prepare(
      `SELECT t.*, p.full_name AS professional_name
         FROM er_triages t
         LEFT JOIN professionals p ON p.id = t.professional_id
        WHERE t.visit_id = ?
        ORDER BY t.triaged_at DESC, t.id DESC`
    )
    .all(visitId) as TriageRowWithRefs[]
  return rows.map(toTriageWithRefs)
}

export function createTriage(input: ErTriageInput): ErTriageWithRefs {
  const db = getDb()
  const visit = db.prepare('SELECT id, status FROM er_visits WHERE id = ?').get(input.visitId) as
    | { id: number; status: string }
    | undefined
  if (!visit) {
    throw Object.assign(new Error('Atendimento não encontrado.'), { code: 'ER_VISIT_NOT_FOUND' })
  }
  if (visit.status !== 'aguardando_triagem' && visit.status !== 'triado') {
    throw Object.assign(
      new Error('Só é possível triar atendimentos em "aguardando triagem" ou retriar "triado".'),
      { code: 'ER_INVALID_STATE_FOR_TRIAGE' }
    )
  }

  // Validações de faixas — proteção contra typos grosseiros.
  const checks: [string, number | null | undefined, number, number][] = [
    ['systolicBp', input.systolicBp, 30, 300],
    ['diastolicBp', input.diastolicBp, 10, 250],
    ['heartRate', input.heartRate, 0, 350],
    ['respiratoryRate', input.respiratoryRate, 0, 90],
    ['temperatureC', input.temperatureC, 25, 45],
    ['oxygenSaturation', input.oxygenSaturation, 0, 100],
    ['painScore', input.painScore, 0, 10],
    ['glasgow', input.glasgow, 3, 15]
  ]
  for (const [field, value, min, max] of checks) {
    if (value == null) continue
    if (!Number.isFinite(value) || value < min || value > max) {
      throw Object.assign(new Error(`Valor fora da faixa plausível para ${field} (${min}–${max}).`), {
        code: 'ER_TRIAGE_OUT_OF_RANGE'
      })
    }
  }

  const target = TRIAGE_TARGET_MINUTES[input.color]
  const user = getCurrentUser()
  const result = db
    .prepare(
      `INSERT INTO er_triages
         (visit_id, professional_id, color, target_wait_minutes, discriminator,
          systolic_bp, diastolic_bp, heart_rate, respiratory_rate,
          temperature_c, oxygen_saturation, pain_score, glasgow,
          notes, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.visitId,
      input.professionalId ?? null,
      input.color,
      target,
      input.discriminator?.trim() || null,
      input.systolicBp ?? null,
      input.diastolicBp ?? null,
      input.heartRate ?? null,
      input.respiratoryRate ?? null,
      input.temperatureC ?? null,
      input.oxygenSaturation ?? null,
      input.painScore ?? null,
      input.glasgow ?? null,
      input.notes?.trim() || null,
      user?.id ?? null
    )

  // Marca visita como triada (idempotente — retriagem mantém "triado").
  db.prepare(
    `UPDATE er_visits SET status = 'triado', updated_at = datetime('now') WHERE id = ?`
  ).run(input.visitId)

  const id = Number(result.lastInsertRowid)
  logAudit({
    action: 'create',
    entity: 'er_triage',
    entityId: id,
    details: { visitId: input.visitId, color: input.color }
  })

  const row = getDb()
    .prepare(
      `SELECT t.*, p.full_name AS professional_name
         FROM er_triages t LEFT JOIN professionals p ON p.id = t.professional_id
        WHERE t.id = ?`
    )
    .get(id) as TriageRowWithRefs
  return toTriageWithRefs(row)
}
