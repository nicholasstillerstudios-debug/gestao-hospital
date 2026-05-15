/**
 * CCIH — Controle de Infecção Hospitalar.
 *
 * Dois agregados:
 *  1. iras_cases — notificações de IRAS (corrente sanguínea, ITU, PAV/PNM,
 *     sítio cirúrgico, etc). Pode ou não estar ligada a uma internação;
 *     algumas infecções são detectadas após alta.
 *  2. isolations — isolamentos vigentes ou históricos por internação.
 *     ended_at NULL = isolamento ativo.
 *
 * Indicadores: contagem por sítio e por dispositivo, e isolamentos ativos.
 */

import { getDb } from '../db'
import { logAudit } from '../audit'
import { getCurrentUser } from '../session'
import type {
  IrasCase,
  IrasCaseInput,
  IrasCaseWithRefs,
  InfectionSite,
  DeviceType,
  Isolation,
  IsolationInput,
  IsolationKind,
  IrasIndicators
} from '@shared/types'
import { INFECTION_SITE_LABELS } from '@shared/types'

// ─────────────────────────────────────────────────── iras cases ─────────

interface IrasRow {
  id: number
  patient_id: number
  admission_id: number | null
  notification_date: string
  infection_site: string
  microorganism: string | null
  resistant_profile: string | null
  is_device_associated: number
  device_type: string | null
  culture_collected: number
  culture_collected_at: string | null
  culture_result: string | null
  notes: string | null
  notified_by_professional_id: number | null
  created_by_user_id: number | null
  created_at: string
  updated_at: string
}

interface IrasRowWithRefs extends IrasRow {
  patient_name: string
  patient_cpf: string | null
  notified_by_professional_name: string | null
}

function toIras(r: IrasRow): IrasCase {
  return {
    id: r.id,
    patientId: r.patient_id,
    admissionId: r.admission_id,
    notificationDate: r.notification_date,
    infectionSite: r.infection_site as InfectionSite,
    microorganism: r.microorganism,
    resistantProfile: r.resistant_profile,
    isDeviceAssociated: r.is_device_associated === 1,
    deviceType: (r.device_type as DeviceType | null) ?? null,
    cultureCollected: r.culture_collected === 1,
    cultureCollectedAt: r.culture_collected_at,
    cultureResult: r.culture_result,
    notes: r.notes,
    notifiedByProfessionalId: r.notified_by_professional_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}

function toIrasWithRefs(r: IrasRowWithRefs): IrasCaseWithRefs {
  return {
    ...toIras(r),
    patientName: r.patient_name,
    patientCpf: r.patient_cpf,
    notifiedByProfessionalName: r.notified_by_professional_name
  }
}

const SELECT_IRAS = `
  SELECT c.*, p.full_name AS patient_name, p.cpf AS patient_cpf,
         pr.full_name AS notified_by_professional_name
    FROM iras_cases c
    JOIN patients p ON p.id = c.patient_id
    LEFT JOIN professionals pr ON pr.id = c.notified_by_professional_id
`

export function listIrasCases(options?: {
  fromDate?: string
  toDate?: string
  site?: InfectionSite
}): IrasCaseWithRefs[] {
  const where: string[] = []
  const params: (string | number)[] = []
  if (options?.fromDate) {
    where.push('c.notification_date >= ?')
    params.push(options.fromDate)
  }
  if (options?.toDate) {
    where.push('c.notification_date <= ?')
    params.push(options.toDate)
  }
  if (options?.site) {
    where.push('c.infection_site = ?')
    params.push(options.site)
  }
  const sql = `${SELECT_IRAS}
    ${where.length > 0 ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY c.notification_date DESC, c.id DESC`
  const rows = getDb().prepare(sql).all(...params) as IrasRowWithRefs[]
  return rows.map(toIrasWithRefs)
}

export function getIrasCase(id: number): IrasCaseWithRefs | null {
  const row = getDb()
    .prepare(`${SELECT_IRAS} WHERE c.id = ?`)
    .get(id) as IrasRowWithRefs | undefined
  return row ? toIrasWithRefs(row) : null
}

function validateIras(input: IrasCaseInput): void {
  if (input.isDeviceAssociated && !input.deviceType) {
    throw Object.assign(
      new Error('Quando associada a dispositivo invasivo, informe o tipo do dispositivo.'),
      { code: 'IRAS_DEVICE_TYPE_REQUIRED' }
    )
  }
  if (input.cultureCollected && !input.cultureCollectedAt) {
    throw Object.assign(new Error('Informe a data de coleta da cultura.'), {
      code: 'IRAS_CULTURE_DATE_REQUIRED'
    })
  }
  if (!INFECTION_SITE_LABELS[input.infectionSite]) {
    throw Object.assign(new Error('Sítio de infecção inválido.'), { code: 'IRAS_SITE_INVALID' })
  }
}

export function createIrasCase(input: IrasCaseInput): IrasCaseWithRefs {
  validateIras(input)
  const db = getDb()
  const user = getCurrentUser()
  const result = db
    .prepare(
      `INSERT INTO iras_cases
         (patient_id, admission_id, infection_site, microorganism, resistant_profile,
          is_device_associated, device_type, culture_collected, culture_collected_at,
          culture_result, notes, notified_by_professional_id, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.patientId,
      input.admissionId ?? null,
      input.infectionSite,
      input.microorganism?.trim() || null,
      input.resistantProfile?.trim() || null,
      input.isDeviceAssociated ? 1 : 0,
      input.deviceType ?? null,
      input.cultureCollected ? 1 : 0,
      input.cultureCollectedAt ?? null,
      input.cultureResult?.trim() || null,
      input.notes?.trim() || null,
      input.notifiedByProfessionalId ?? null,
      user?.id ?? null
    )
  const id = Number(result.lastInsertRowid)
  logAudit({
    action: 'create',
    entity: 'iras_case',
    entityId: id,
    details: { patientId: input.patientId, site: input.infectionSite }
  })
  return getIrasCase(id)!
}

export function updateIrasCase(id: number, input: IrasCaseInput): IrasCaseWithRefs {
  validateIras(input)
  const db = getDb()
  const exists = db.prepare('SELECT id FROM iras_cases WHERE id = ?').get(id)
  if (!exists) {
    throw Object.assign(new Error('Caso IRAS não encontrado.'), { code: 'IRAS_NOT_FOUND' })
  }
  db.prepare(
    `UPDATE iras_cases
       SET admission_id = ?, infection_site = ?, microorganism = ?, resistant_profile = ?,
           is_device_associated = ?, device_type = ?, culture_collected = ?,
           culture_collected_at = ?, culture_result = ?, notes = ?,
           notified_by_professional_id = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    input.admissionId ?? null,
    input.infectionSite,
    input.microorganism?.trim() || null,
    input.resistantProfile?.trim() || null,
    input.isDeviceAssociated ? 1 : 0,
    input.deviceType ?? null,
    input.cultureCollected ? 1 : 0,
    input.cultureCollectedAt ?? null,
    input.cultureResult?.trim() || null,
    input.notes?.trim() || null,
    input.notifiedByProfessionalId ?? null,
    id
  )
  logAudit({ action: 'update', entity: 'iras_case', entityId: id })
  return getIrasCase(id)!
}

export function deleteIrasCase(id: number): void {
  const db = getDb()
  db.prepare('DELETE FROM iras_cases WHERE id = ?').run(id)
  logAudit({ action: 'delete', entity: 'iras_case', entityId: id })
}

// ────────────────────────────────────────────────── isolations ──────────

interface IsolationRow {
  id: number
  admission_id: number
  kind: string
  reason: string
  started_at: string
  ended_at: string | null
  ended_reason: string | null
  started_by_user_id: number | null
  ended_by_user_id: number | null
  notes: string | null
  created_at: string
}

function toIsolation(r: IsolationRow): Isolation {
  return {
    id: r.id,
    admissionId: r.admission_id,
    kind: r.kind as IsolationKind,
    reason: r.reason,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    endedReason: r.ended_reason,
    notes: r.notes,
    createdAt: r.created_at
  }
}

export function listIsolationsForAdmission(admissionId: number): Isolation[] {
  const rows = getDb()
    .prepare(`SELECT * FROM isolations WHERE admission_id = ? ORDER BY started_at DESC`)
    .all(admissionId) as IsolationRow[]
  return rows.map(toIsolation)
}

export function listActiveIsolations(): Isolation[] {
  const rows = getDb()
    .prepare(`SELECT * FROM isolations WHERE ended_at IS NULL ORDER BY started_at DESC`)
    .all() as IsolationRow[]
  return rows.map(toIsolation)
}

export function listIsolations(): Isolation[] {
  const rows = getDb()
    .prepare(`SELECT * FROM isolations ORDER BY started_at DESC LIMIT 500`)
    .all() as IsolationRow[]
  return rows.map(toIsolation)
}

export function startIsolation(input: IsolationInput): Isolation {
  if (!input.reason?.trim()) {
    throw Object.assign(new Error('Motivo do isolamento é obrigatório.'), {
      code: 'ISOLATION_REASON_REQUIRED'
    })
  }
  const db = getDb()
  // Verifica que internação existe e está ativa.
  const adm = db
    .prepare('SELECT id, status FROM admissions WHERE id = ?')
    .get(input.admissionId) as { id: number; status: string } | undefined
  if (!adm) {
    throw Object.assign(new Error('Internação não encontrada.'), { code: 'ADMISSION_NOT_FOUND' })
  }
  if (adm.status !== 'ativa') {
    throw Object.assign(new Error('Internação encerrada: não é possível iniciar isolamento.'), {
      code: 'ADMISSION_NOT_ACTIVE'
    })
  }

  const user = getCurrentUser()
  const result = db
    .prepare(
      `INSERT INTO isolations (admission_id, kind, reason, started_by_user_id, notes)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      input.admissionId,
      input.kind,
      input.reason.trim(),
      user?.id ?? null,
      input.notes?.trim() || null
    )
  const id = Number(result.lastInsertRowid)
  logAudit({
    action: 'create',
    entity: 'isolation',
    entityId: id,
    details: { admissionId: input.admissionId, kind: input.kind }
  })
  const row = db.prepare('SELECT * FROM isolations WHERE id = ?').get(id) as IsolationRow
  return toIsolation(row)
}

export function endIsolation(id: number, endedReason: string): Isolation {
  if (!endedReason?.trim()) {
    throw Object.assign(new Error('Motivo do encerramento é obrigatório.'), {
      code: 'ISOLATION_END_REASON_REQUIRED'
    })
  }
  const db = getDb()
  const current = db.prepare('SELECT * FROM isolations WHERE id = ?').get(id) as
    | IsolationRow
    | undefined
  if (!current) {
    throw Object.assign(new Error('Isolamento não encontrado.'), { code: 'ISOLATION_NOT_FOUND' })
  }
  if (current.ended_at) {
    throw Object.assign(new Error('Isolamento já encerrado.'), { code: 'ISOLATION_ALREADY_ENDED' })
  }
  const user = getCurrentUser()
  db.prepare(
    `UPDATE isolations
       SET ended_at = datetime('now'), ended_reason = ?, ended_by_user_id = ?
     WHERE id = ?`
  ).run(endedReason.trim(), user?.id ?? null, id)
  logAudit({ action: 'update', entity: 'isolation', entityId: id, details: { ended: true } })
  const row = db.prepare('SELECT * FROM isolations WHERE id = ?').get(id) as IsolationRow
  return toIsolation(row)
}

// ─────────────────────────────────────────────────── indicators ─────────

export function getIndicators(options?: {
  fromDate?: string
  toDate?: string
}): IrasIndicators {
  const db = getDb()
  const where: string[] = []
  const params: (string | number)[] = []
  if (options?.fromDate) {
    where.push('notification_date >= ?')
    params.push(options.fromDate)
  }
  if (options?.toDate) {
    where.push('notification_date <= ?')
    params.push(options.toDate)
  }
  const whereSql = where.length > 0 ? 'WHERE ' + where.join(' AND ') : ''

  const total = db
    .prepare(`SELECT COUNT(*) AS n FROM iras_cases ${whereSql}`)
    .get(...params) as { n: number }

  const sites = db
    .prepare(
      `SELECT infection_site AS site, COUNT(*) AS n FROM iras_cases ${whereSql} GROUP BY infection_site`
    )
    .all(...params) as { site: InfectionSite; n: number }[]

  const bySite: Record<InfectionSite, number> = {
    corrente_sanguinea: 0,
    itu: 0,
    pneumonia: 0,
    sitio_cirurgico: 0,
    cateter_central: 0,
    pele_tecidos_moles: 0,
    outro: 0
  }
  for (const s of sites) bySite[s.site] = s.n

  const deviceAssoc = db
    .prepare(
      `SELECT COUNT(*) AS n FROM iras_cases ${whereSql} ${whereSql ? 'AND' : 'WHERE'} is_device_associated = 1`
    )
    .get(...params) as { n: number }

  const activeIsolations = db
    .prepare('SELECT COUNT(*) AS n FROM isolations WHERE ended_at IS NULL')
    .get() as { n: number }

  return {
    totalCases: total.n,
    bySite,
    deviceAssociated: deviceAssoc.n,
    activeIsolations: activeIsolations.n
  }
}
