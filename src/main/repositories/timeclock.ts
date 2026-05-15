/**
 * Ponto eletrônico (controle de jornada).
 *
 * Cada batida é uma linha (entrada / saída / intervalo). O saldo da jornada
 * é calculado em consulta — não está desnormalizado, evitando inconsistência
 * em correções manuais. Profissionais batem o ponto; o RH/admin pode
 * registrar batidas retroativas (com nota justificando).
 */

import { getDb } from '../db'
import { logAudit } from '../audit'
import { getCurrentUser } from '../session'
import type {
  TimeclockEntry,
  TimeclockEntryInput,
  TimeclockEntryType,
  TimeclockEntryWithRefs,
  TimeclockDaySummary
} from '@shared/types'

interface Row {
  id: number
  professional_id: number
  type: string
  recorded_at: string
  notes: string | null
  created_by_user_id: number | null
  created_at: string
}

interface RowWithRefs extends Row {
  professional_name: string
}

function toEntry(r: Row): TimeclockEntry {
  return {
    id: r.id,
    professionalId: r.professional_id,
    type: r.type as TimeclockEntryType,
    recordedAt: r.recorded_at,
    notes: r.notes,
    createdByUserId: r.created_by_user_id,
    createdAt: r.created_at
  }
}

function toEntryWithRefs(r: RowWithRefs): TimeclockEntryWithRefs {
  return { ...toEntry(r), professionalName: r.professional_name }
}

const SELECT_WITH_REFS = `
  SELECT t.*, p.full_name AS professional_name
    FROM timeclock_entries t
    JOIN professionals p ON p.id = t.professional_id
`

export function listEntries(options?: {
  professionalId?: number
  fromDate?: string
  toDate?: string
  limit?: number
}): TimeclockEntryWithRefs[] {
  const where: string[] = []
  const params: (string | number)[] = []
  if (options?.professionalId) {
    where.push('t.professional_id = ?')
    params.push(options.professionalId)
  }
  if (options?.fromDate) {
    where.push('t.recorded_at >= ?')
    params.push(options.fromDate)
  }
  if (options?.toDate) {
    where.push('t.recorded_at <= ?')
    params.push(options.toDate)
  }
  const limit = options?.limit && options.limit > 0 ? Math.floor(options.limit) : 200
  const sql = `${SELECT_WITH_REFS}
    ${where.length > 0 ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY t.recorded_at DESC, t.id DESC
    LIMIT ${limit}`
  const rows = getDb().prepare(sql).all(...params) as RowWithRefs[]
  return rows.map(toEntryWithRefs)
}

export function createEntry(input: TimeclockEntryInput): TimeclockEntryWithRefs {
  const allowedTypes: TimeclockEntryType[] = [
    'entrada',
    'saida',
    'intervalo_inicio',
    'intervalo_fim'
  ]
  if (!allowedTypes.includes(input.type)) {
    throw Object.assign(new Error('Tipo de batida inválido.'), { code: 'TIMECLOCK_TYPE_INVALID' })
  }
  const db = getDb()
  const prof = db
    .prepare('SELECT id FROM professionals WHERE id = ? AND active = 1')
    .get(input.professionalId) as { id: number } | undefined
  if (!prof) {
    throw Object.assign(new Error('Profissional não encontrado ou inativo.'), {
      code: 'TIMECLOCK_PROFESSIONAL_NOT_FOUND'
    })
  }
  const user = getCurrentUser()
  const recordedAt = input.recordedAt ?? new Date().toISOString()
  const result = db
    .prepare(
      `INSERT INTO timeclock_entries (professional_id, type, recorded_at, notes, created_by_user_id)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      input.professionalId,
      input.type,
      recordedAt,
      input.notes?.trim() || null,
      user?.id ?? null
    )
  const id = Number(result.lastInsertRowid)
  logAudit({
    action: 'create',
    entity: 'timeclock_entry',
    entityId: id,
    details: { professionalId: input.professionalId, type: input.type }
  })
  const row = db.prepare(`${SELECT_WITH_REFS} WHERE t.id = ?`).get(id) as RowWithRefs
  return toEntryWithRefs(row)
}

export function deleteEntry(id: number): void {
  const db = getDb()
  const user = getCurrentUser()
  const current = db
    .prepare('SELECT created_by_user_id FROM timeclock_entries WHERE id = ?')
    .get(id) as { created_by_user_id: number | null } | undefined
  if (!current) {
    throw Object.assign(new Error('Batida não encontrada.'), { code: 'TIMECLOCK_NOT_FOUND' })
  }
  // Apenas admin ou quem registrou pode apagar.
  if (
    user &&
    user.role !== 'admin' &&
    current.created_by_user_id != null &&
    current.created_by_user_id !== user.id
  ) {
    throw Object.assign(new Error('Apenas o autor (ou admin) pode remover a batida.'), {
      code: 'TIMECLOCK_NOT_AUTHOR'
    })
  }
  db.prepare('DELETE FROM timeclock_entries WHERE id = ?').run(id)
  logAudit({ action: 'delete', entity: 'timeclock_entry', entityId: id })
}

/**
 * Resumo da jornada por dia para um profissional em um intervalo.
 * Calcula horas trabalhadas pareando entrada → saida (em ordem cronológica).
 * Intervalos (intervalo_inicio/intervalo_fim) descontam do total.
 *
 * Implementação MVP: pareamento simples — entrada seguida da próxima saída
 * é uma jornada. Se houver batidas ímpares, o dia é flagado como "inconsistente".
 */
export function getDaySummaries(
  professionalId: number,
  fromDate: string,
  toDate: string
): TimeclockDaySummary[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM timeclock_entries
        WHERE professional_id = ?
          AND recorded_at >= ? AND recorded_at <= ?
        ORDER BY recorded_at ASC, id ASC`
    )
    .all(professionalId, fromDate, toDate) as Row[]

  // Agrupa por dia
  const byDay = new Map<string, Row[]>()
  for (const r of rows) {
    const day = r.recorded_at.slice(0, 10)
    const list = byDay.get(day) ?? []
    list.push(r)
    byDay.set(day, list)
  }

  const summaries: TimeclockDaySummary[] = []
  for (const [day, entries] of byDay) {
    let workedMs = 0
    let breakMs = 0
    let consistent = true
    let workOpen: number | null = null
    let breakOpen: number | null = null

    for (const e of entries) {
      const t = Date.parse(e.recorded_at)
      if (e.type === 'entrada') {
        if (workOpen != null) consistent = false
        workOpen = t
      } else if (e.type === 'saida') {
        if (workOpen == null) consistent = false
        else {
          workedMs += t - workOpen
          workOpen = null
        }
      } else if (e.type === 'intervalo_inicio') {
        if (breakOpen != null) consistent = false
        breakOpen = t
      } else if (e.type === 'intervalo_fim') {
        if (breakOpen == null) consistent = false
        else {
          breakMs += t - breakOpen
          breakOpen = null
        }
      }
    }
    if (workOpen != null || breakOpen != null) consistent = false

    const workedMinutes = Math.max(0, Math.round((workedMs - breakMs) / 60000))
    summaries.push({
      date: day,
      entries: entries.map(toEntry),
      workedMinutes,
      breakMinutes: Math.round(breakMs / 60000),
      consistent
    })
  }
  return summaries.sort((a, b) => a.date.localeCompare(b.date))
}
