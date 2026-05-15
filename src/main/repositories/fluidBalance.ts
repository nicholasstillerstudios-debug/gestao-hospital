import { getDb } from '../db'
import { logAudit } from '../audit'
import { getCurrentUser } from '../session'
import type {
  FluidBalanceEntry,
  FluidBalanceEntryWithRefs,
  FluidBalanceInput,
  FluidBalanceSummary,
  FluidBalanceDailySummary
} from '@shared/types'

interface Row {
  id: number
  admission_id: number
  type: 'entrada' | 'saida'
  subtype: string
  volume_ml: number
  recorded_at: string
  professional_id: number | null
  notes: string | null
  created_by_user_id: number | null
  created_at: string
}

interface RowWithRefs extends Row {
  professional_name: string | null
  created_by_user_name: string | null
}

function toModel(row: Row): FluidBalanceEntry {
  return {
    id: row.id,
    admissionId: row.admission_id,
    type: row.type,
    subtype: row.subtype,
    volumeMl: row.volume_ml,
    recordedAt: row.recorded_at,
    professionalId: row.professional_id,
    notes: row.notes,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at
  }
}

function toModelWithRefs(row: RowWithRefs): FluidBalanceEntryWithRefs {
  return {
    ...toModel(row),
    professionalName: row.professional_name,
    createdByUserName: row.created_by_user_name
  }
}

const SELECT_WITH_REFS = `
  SELECT f.*,
         p.full_name AS professional_name,
         u.full_name AS created_by_user_name
    FROM admission_fluid_balance f
    LEFT JOIN professionals p ON p.id = f.professional_id
    LEFT JOIN users u ON u.id = f.created_by_user_id
`

function ensureAdmissionActive(admissionId: number): void {
  const admission = getDb()
    .prepare('SELECT id, status FROM admissions WHERE id = ?')
    .get(admissionId) as { id: number; status: string } | undefined
  if (!admission) {
    throw Object.assign(new Error('Internação não encontrada.'), { code: 'ADMISSION_NOT_FOUND' })
  }
  if (admission.status !== 'ativa') {
    throw Object.assign(
      new Error('Internação encerrada: não é mais possível registrar balanço hídrico.'),
      { code: 'ADMISSION_NOT_ACTIVE' }
    )
  }
}

export function listEntriesForAdmission(admissionId: number): FluidBalanceEntryWithRefs[] {
  const rows = getDb()
    .prepare(
      `${SELECT_WITH_REFS}
       WHERE f.admission_id = ?
       ORDER BY f.recorded_at DESC, f.id DESC`
    )
    .all(admissionId) as RowWithRefs[]
  return rows.map(toModelWithRefs)
}

export function getSummaryForAdmission(admissionId: number): FluidBalanceSummary {
  const db = getDb()

  interface DayRow {
    date: string
    type: 'entrada' | 'saida'
    total: number
  }

  const dayRows = db
    .prepare(
      `SELECT substr(recorded_at, 1, 10) AS date, type, SUM(volume_ml) AS total
         FROM admission_fluid_balance
        WHERE admission_id = ?
        GROUP BY substr(recorded_at, 1, 10), type
        ORDER BY date`
    )
    .all(admissionId) as DayRow[]

  // agrupa por data
  const byDateMap = new Map<string, { in: number; out: number }>()
  for (const r of dayRows) {
    let day = byDateMap.get(r.date)
    if (!day) {
      day = { in: 0, out: 0 }
      byDateMap.set(r.date, day)
    }
    if (r.type === 'entrada') day.in += r.total
    else day.out += r.total
  }

  const byDay: FluidBalanceDailySummary[] = []
  let totalIn = 0
  let totalOut = 0

  for (const [date, { in: inVol, out: outVol }] of byDateMap) {
    totalIn += inVol
    totalOut += outVol
    byDay.push({ date, totalIn: inVol, totalOut: outVol, balance: inVol - outVol })
  }

  return { totalIn, totalOut, balance: totalIn - totalOut, byDay }
}

export function createEntry(input: FluidBalanceInput): FluidBalanceEntryWithRefs {
  ensureAdmissionActive(input.admissionId)

  if (!Number.isFinite(input.volumeMl) || input.volumeMl <= 0) {
    throw Object.assign(new Error('Volume deve ser um número positivo.'), {
      code: 'FLUID_VOLUME_INVALID'
    })
  }
  if (input.volumeMl > 99999) {
    throw Object.assign(new Error('Volume fora da faixa plausível (máx. 99 999 mL).'), {
      code: 'FLUID_VOLUME_OUT_OF_RANGE'
    })
  }
  if (!input.subtype?.trim()) {
    throw Object.assign(new Error('Subtipo é obrigatório.'), { code: 'FLUID_SUBTYPE_REQUIRED' })
  }

  const db = getDb()
  const user = getCurrentUser()
  const recordedAt = input.recordedAt ?? new Date().toISOString()

  const result = db
    .prepare(
      `INSERT INTO admission_fluid_balance
         (admission_id, type, subtype, volume_ml, recorded_at, professional_id, notes, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.admissionId,
      input.type,
      input.subtype.trim(),
      Math.round(input.volumeMl),
      recordedAt,
      input.professionalId ?? null,
      input.notes?.trim() || null,
      user?.id ?? null
    )

  const id = Number(result.lastInsertRowid)
  logAudit({
    action: 'create',
    entity: 'admission_fluid_balance',
    entityId: id,
    details: { admissionId: input.admissionId, type: input.type, volumeMl: input.volumeMl }
  })

  const row = db.prepare(`${SELECT_WITH_REFS} WHERE f.id = ?`).get(id) as RowWithRefs
  return toModelWithRefs(row)
}

export function deleteEntry(id: number): void {
  const db = getDb()
  const current = db
    .prepare('SELECT * FROM admission_fluid_balance WHERE id = ?')
    .get(id) as Row | undefined
  if (!current) {
    throw Object.assign(new Error('Registro não encontrado.'), { code: 'FLUID_NOT_FOUND' })
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
      code: 'NOT_FLUID_AUTHOR'
    })
  }

  db.prepare('DELETE FROM admission_fluid_balance WHERE id = ?').run(id)
  logAudit({ action: 'delete', entity: 'admission_fluid_balance', entityId: id })
}
