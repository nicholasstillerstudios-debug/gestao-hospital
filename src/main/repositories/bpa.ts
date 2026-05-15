/**
 * BPA — Boletim de Produção Ambulatorial (SUS).
 *
 * Cada registro é uma linha de produção (procedimento realizado).
 * As consolidações agregam por competência (ano+mês) e podem gerar o
 * arquivo BPA-C/BPA-I no futuro. Por enquanto, MVP: persistência,
 * listagem com filtros, e consolidação manual (totaliza e fecha o mês).
 */

import { getDb } from '../db'
import { logAudit } from '../audit'
import { getCurrentUser } from '../session'
import type {
  BpaRecord,
  BpaRecordInput,
  BpaRecordWithRefs,
  BpaConsolidation,
  BpaConsolidationStatus
} from '@shared/types'

// ─────────────────────────────────────────────────── records ────────────

interface RecRow {
  id: number
  patient_id: number | null
  professional_id: number | null
  procedure_code: string
  procedure_name: string
  procedure_date: string
  quantity: number
  cid10: string | null
  cbo_code: string | null
  notes: string | null
  source_module: string | null
  source_id: number | null
  consolidation_id: number | null
  created_by_user_id: number | null
  created_at: string
}

interface RecRowWithRefs extends RecRow {
  patient_name: string | null
  professional_name: string | null
}

function toRec(r: RecRow): BpaRecord {
  return {
    id: r.id,
    patientId: r.patient_id,
    professionalId: r.professional_id,
    procedureCode: r.procedure_code,
    procedureName: r.procedure_name,
    procedureDate: r.procedure_date,
    quantity: r.quantity,
    cid10: r.cid10,
    cboCode: r.cbo_code,
    notes: r.notes,
    sourceModule: r.source_module,
    sourceId: r.source_id,
    consolidationId: r.consolidation_id,
    createdByUserId: r.created_by_user_id,
    createdAt: r.created_at
  }
}

function toRecWithRefs(r: RecRowWithRefs): BpaRecordWithRefs {
  return {
    ...toRec(r),
    patientName: r.patient_name,
    professionalName: r.professional_name
  }
}

const SELECT_REC = `
  SELECT r.*,
         p.full_name AS patient_name,
         pr.full_name AS professional_name
    FROM bpa_records r
    LEFT JOIN patients p ON p.id = r.patient_id
    LEFT JOIN professionals pr ON pr.id = r.professional_id
`

export function listRecords(options?: {
  year?: number
  month?: number
  procedureCode?: string
}): BpaRecordWithRefs[] {
  const where: string[] = []
  const params: (string | number)[] = []
  if (options?.year && options?.month) {
    where.push("strftime('%Y-%m', r.procedure_date) = ?")
    params.push(`${options.year}-${String(options.month).padStart(2, '0')}`)
  }
  if (options?.procedureCode) {
    where.push('r.procedure_code = ?')
    params.push(options.procedureCode)
  }
  const sql = `${SELECT_REC}
    ${where.length > 0 ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY r.procedure_date DESC, r.id DESC
    LIMIT 1000`
  const rows = getDb().prepare(sql).all(...params) as RecRowWithRefs[]
  return rows.map(toRecWithRefs)
}

export function createRecord(input: BpaRecordInput): BpaRecordWithRefs {
  if (!input.procedureCode?.trim()) {
    throw Object.assign(new Error('Código do procedimento (SIGTAP) é obrigatório.'), {
      code: 'BPA_PROCEDURE_CODE_REQUIRED'
    })
  }
  if (!input.procedureName?.trim()) {
    throw Object.assign(new Error('Nome do procedimento é obrigatório.'), {
      code: 'BPA_PROCEDURE_NAME_REQUIRED'
    })
  }
  if (!input.procedureDate?.trim()) {
    throw Object.assign(new Error('Data do procedimento é obrigatória.'), {
      code: 'BPA_DATE_REQUIRED'
    })
  }
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw Object.assign(new Error('Quantidade deve ser positiva.'), {
      code: 'BPA_QUANTITY_INVALID'
    })
  }
  const db = getDb()
  const user = getCurrentUser()
  const result = db
    .prepare(
      `INSERT INTO bpa_records
         (patient_id, professional_id, procedure_code, procedure_name,
          procedure_date, quantity, cid10, cbo_code, notes,
          source_module, source_id, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.patientId ?? null,
      input.professionalId ?? null,
      input.procedureCode.trim(),
      input.procedureName.trim(),
      input.procedureDate,
      Math.floor(input.quantity),
      input.cid10?.trim() || null,
      input.cboCode?.trim() || null,
      input.notes?.trim() || null,
      input.sourceModule?.trim() || null,
      input.sourceId ?? null,
      user?.id ?? null
    )
  const id = Number(result.lastInsertRowid)
  logAudit({
    action: 'create',
    entity: 'bpa_record',
    entityId: id,
    details: { procedureCode: input.procedureCode }
  })
  const row = getDb()
    .prepare(`${SELECT_REC} WHERE r.id = ?`)
    .get(id) as RecRowWithRefs
  return toRecWithRefs(row)
}

export function deleteRecord(id: number): void {
  const db = getDb()
  const row = db.prepare('SELECT consolidation_id FROM bpa_records WHERE id = ?').get(id) as
    | { consolidation_id: number | null }
    | undefined
  if (!row) {
    throw Object.assign(new Error('Registro não encontrado.'), { code: 'BPA_NOT_FOUND' })
  }
  if (row.consolidation_id != null) {
    throw Object.assign(
      new Error('Registro pertence a uma consolidação fechada e não pode ser excluído.'),
      { code: 'BPA_CONSOLIDATED' }
    )
  }
  db.prepare('DELETE FROM bpa_records WHERE id = ?').run(id)
  logAudit({ action: 'delete', entity: 'bpa_record', entityId: id })
}

// ──────────────────────────────────────────────── consolidations ────────

interface ConsRow {
  id: number
  year: number
  month: number
  total_records: number
  total_procedures: number
  status: string
  generated_at: string | null
  file_path: string | null
  notes: string | null
  created_by_user_id: number | null
  created_at: string
  updated_at: string
}

function toCons(r: ConsRow): BpaConsolidation {
  return {
    id: r.id,
    year: r.year,
    month: r.month,
    totalRecords: r.total_records,
    totalProcedures: r.total_procedures,
    status: r.status as BpaConsolidationStatus,
    generatedAt: r.generated_at,
    filePath: r.file_path,
    notes: r.notes,
    createdByUserId: r.created_by_user_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}

export function listConsolidations(): BpaConsolidation[] {
  const rows = getDb()
    .prepare(`SELECT * FROM bpa_consolidations ORDER BY year DESC, month DESC`)
    .all() as ConsRow[]
  return rows.map(toCons)
}

/**
 * Consolida o mês: conta registros não consolidados do período, registra
 * totais e marca cada linha com o consolidation_id. Status passa a 'fechado'.
 */
export function consolidateMonth(year: number, month: number): BpaConsolidation {
  if (year < 2000 || year > 2100) {
    throw Object.assign(new Error('Ano inválido.'), { code: 'BPA_YEAR_INVALID' })
  }
  if (month < 1 || month > 12) {
    throw Object.assign(new Error('Mês inválido.'), { code: 'BPA_MONTH_INVALID' })
  }
  const db = getDb()
  const user = getCurrentUser()
  const period = `${year}-${String(month).padStart(2, '0')}`

  const tx = db.transaction((): number => {
    // Verifica se já existe consolidação para o período
    const existing = db
      .prepare('SELECT id, status FROM bpa_consolidations WHERE year = ? AND month = ?')
      .get(year, month) as { id: number; status: string } | undefined
    if (existing && existing.status !== 'aberto') {
      throw Object.assign(
        new Error(`Competência ${period} já foi consolidada (status: ${existing.status}).`),
        { code: 'BPA_ALREADY_CONSOLIDATED' }
      )
    }

    // Conta registros não consolidados do período
    const totals = db
      .prepare(
        `SELECT COUNT(*) AS records, COALESCE(SUM(quantity), 0) AS procedures
           FROM bpa_records
          WHERE consolidation_id IS NULL
            AND strftime('%Y-%m', procedure_date) = ?`
      )
      .get(period) as { records: number; procedures: number }

    let consolidationId: number
    if (existing) {
      consolidationId = existing.id
      db.prepare(
        `UPDATE bpa_consolidations
           SET total_records = ?, total_procedures = ?, status = 'fechado',
               generated_at = datetime('now'), updated_at = datetime('now')
         WHERE id = ?`
      ).run(totals.records, totals.procedures, consolidationId)
    } else {
      const result = db
        .prepare(
          `INSERT INTO bpa_consolidations
             (year, month, total_records, total_procedures, status, generated_at, created_by_user_id)
           VALUES (?, ?, ?, ?, 'fechado', datetime('now'), ?)`
        )
        .run(year, month, totals.records, totals.procedures, user?.id ?? null)
      consolidationId = Number(result.lastInsertRowid)
    }

    // Marca registros como consolidados
    db.prepare(
      `UPDATE bpa_records
         SET consolidation_id = ?
       WHERE consolidation_id IS NULL
         AND strftime('%Y-%m', procedure_date) = ?`
    ).run(consolidationId, period)

    return consolidationId
  })

  const id = tx()
  logAudit({
    action: 'update',
    entity: 'bpa_consolidation',
    entityId: id,
    details: { year, month }
  })
  const row = db.prepare('SELECT * FROM bpa_consolidations WHERE id = ?').get(id) as ConsRow
  return toCons(row)
}

export function getSummaryForPeriod(year: number, month: number): {
  period: string
  totalRecords: number
  totalProcedures: number
  byProcedure: { code: string; name: string; count: number; total: number }[]
  consolidation: BpaConsolidation | null
} {
  const period = `${year}-${String(month).padStart(2, '0')}`
  const db = getDb()
  const totals = db
    .prepare(
      `SELECT COUNT(*) AS records, COALESCE(SUM(quantity), 0) AS procedures
         FROM bpa_records
        WHERE strftime('%Y-%m', procedure_date) = ?`
    )
    .get(period) as { records: number; procedures: number }
  const byProc = db
    .prepare(
      `SELECT procedure_code AS code, procedure_name AS name,
              COUNT(*) AS count, COALESCE(SUM(quantity), 0) AS total
         FROM bpa_records
        WHERE strftime('%Y-%m', procedure_date) = ?
        GROUP BY procedure_code, procedure_name
        ORDER BY total DESC`
    )
    .all(period) as { code: string; name: string; count: number; total: number }[]
  const cons = db
    .prepare('SELECT * FROM bpa_consolidations WHERE year = ? AND month = ?')
    .get(year, month) as ConsRow | undefined
  return {
    period,
    totalRecords: totals.records,
    totalProcedures: totals.procedures,
    byProcedure: byProc,
    consolidation: cons ? toCons(cons) : null
  }
}
