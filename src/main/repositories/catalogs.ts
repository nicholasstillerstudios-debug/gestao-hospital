import { getDb } from '../db'
import { logAudit } from '../audit'
import type {
  CatalogImportResult,
  Ciap2Entry,
  Cid10Entry,
  SigtapEntry
} from '@shared/types'

/** Normaliza para busca: lowercase + remove diacríticos (acentos). */
function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Casa termos individuais (qualquer ordem) em conteúdo já normalizado. */
function searchSql(): string {
  // `name_normalized` é populado no insert; fallback para name se NULL.
  return `COALESCE(name_normalized, LOWER(name))`
}

export function searchCid10(query: string, limit = 20): Cid10Entry[] {
  const q = normalize(query.trim())
  if (q.length < 2) return []
  const rows = getDb()
    .prepare(
      `SELECT code, name, chapter FROM cid10
       WHERE active = 1 AND (LOWER(code) LIKE ? OR ${searchSql()} LIKE ?)
       ORDER BY (LOWER(code) = ?) DESC, code LIMIT ?`
    )
    .all(`${q}%`, `%${q}%`, q, limit) as Cid10Entry[]
  return rows
}

export function searchSigtap(query: string, limit = 20): SigtapEntry[] {
  const q = normalize(query.trim())
  if (q.length < 2) return []
  const rows = getDb()
    .prepare(
      `SELECT code, name, complexity, catalog_group AS "group" FROM sigtap
       WHERE active = 1 AND (LOWER(code) LIKE ? OR ${searchSql()} LIKE ?)
       ORDER BY (LOWER(code) = ?) DESC, code LIMIT ?`
    )
    .all(`${q}%`, `%${q}%`, q, limit) as SigtapEntry[]
  return rows
}

export function searchCiap2(query: string, limit = 20): Ciap2Entry[] {
  const q = normalize(query.trim())
  if (q.length < 2) return []
  const rows = getDb()
    .prepare(
      `SELECT code, name, chapter FROM ciap2
       WHERE active = 1 AND (LOWER(code) LIKE ? OR ${searchSql()} LIKE ?)
       ORDER BY (LOWER(code) = ?) DESC, code LIMIT ?`
    )
    .all(`${q}%`, `%${q}%`, q, limit) as Ciap2Entry[]
  return rows
}

export function count(table: 'cid10' | 'sigtap' | 'ciap2'): number {
  const r = getDb().prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }
  return r.n
}

/** Importa um CSV genérico (header obrigatório: code,name[,chapter|complexity|group]). */
function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) return []
  const header = lines[0].split(/[,;]/).map((h) => h.trim().toLowerCase())
  const out: Array<Record<string, string>> = []
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(/[,;]/).map((c) => c.trim())
    const row: Record<string, string> = {}
    for (let j = 0; j < header.length; j++) row[header[j]] = cells[j] ?? ''
    if (row.code && row.name) out.push(row)
  }
  return out
}

export function importCid10(csv: string): CatalogImportResult {
  const rows = parseCsv(csv)
  const stmt = getDb().prepare(
    'INSERT OR IGNORE INTO cid10 (code, name, chapter, name_normalized) VALUES (?, ?, ?, ?)'
  )
  let inserted = 0
  let skipped = 0
  getDb().transaction(() => {
    for (const r of rows) {
      const res = stmt.run(r.code.toUpperCase(), r.name, r.chapter || null, normalize(r.name))
      if (res.changes > 0) inserted++
      else skipped++
    }
  })()
  logAudit({ action: 'import', entity: 'cid10', details: { inserted, skipped } })
  return { inserted, skipped, total: rows.length }
}

export function importSigtap(csv: string): CatalogImportResult {
  const rows = parseCsv(csv)
  const stmt = getDb().prepare(
    'INSERT OR IGNORE INTO sigtap (code, name, complexity, catalog_group, name_normalized) VALUES (?, ?, ?, ?, ?)'
  )
  let inserted = 0
  let skipped = 0
  getDb().transaction(() => {
    for (const r of rows) {
      const res = stmt.run(
        r.code,
        r.name,
        r.complexity || null,
        r.group || null,
        normalize(r.name)
      )
      if (res.changes > 0) inserted++
      else skipped++
    }
  })()
  logAudit({ action: 'import', entity: 'sigtap', details: { inserted, skipped } })
  return { inserted, skipped, total: rows.length }
}

export function importCiap2(csv: string): CatalogImportResult {
  const rows = parseCsv(csv)
  const stmt = getDb().prepare(
    'INSERT OR IGNORE INTO ciap2 (code, name, chapter, name_normalized) VALUES (?, ?, ?, ?)'
  )
  let inserted = 0
  let skipped = 0
  getDb().transaction(() => {
    for (const r of rows) {
      const res = stmt.run(r.code.toUpperCase(), r.name, r.chapter || null, normalize(r.name))
      if (res.changes > 0) inserted++
      else skipped++
    }
  })()
  logAudit({ action: 'import', entity: 'ciap2', details: { inserted, skipped } })
  return { inserted, skipped, total: rows.length }
}

/** Preenche name_normalized para registros antigos (NULL após migration 26). */
export function backfillNormalized(): { cid10: number; sigtap: number; ciap2: number } {
  const db = getDb()
  const counts = { cid10: 0, sigtap: 0, ciap2: 0 }
  for (const table of ['cid10', 'sigtap', 'ciap2'] as const) {
    const rows = db
      .prepare(`SELECT code, name FROM ${table} WHERE name_normalized IS NULL`)
      .all() as Array<{ code: string; name: string }>
    if (rows.length === 0) continue
    const stmt = db.prepare(`UPDATE ${table} SET name_normalized = ? WHERE code = ?`)
    db.transaction(() => {
      for (const r of rows) stmt.run(normalize(r.name), r.code)
    })()
    counts[table] = rows.length
  }
  return counts
}
