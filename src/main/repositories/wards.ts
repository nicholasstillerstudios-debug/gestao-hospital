/**
 * Repositório de setores (wards) hospitalares.
 *
 * Um setor é uma ala como "Clínica Médica 2º andar", "UTI Adulto", "Pediatria".
 * Leitos pertencem a um setor. Quartos são opcionais (podem agrupar leitos
 * dentro de um setor, mas não é obrigatório).
 */

import { getDb } from '../db'
import { logAudit } from '../audit'
import type { Ward, WardInput, WardKind } from '@shared/types'

interface Row {
  id: number
  name: string
  code: string | null
  kind: WardKind
  floor: string | null
  notes: string | null
  active: number
  created_at: string
  updated_at: string
}

function toModel(row: Row): Ward {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    kind: row.kind,
    floor: row.floor,
    notes: row.notes,
    active: row.active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function normalizeKind(kind: WardKind | undefined): WardKind {
  return kind ?? 'enfermaria'
}

export function listWards(activeOnly = false): Ward[] {
  const sql = activeOnly
    ? 'SELECT * FROM wards WHERE active = 1 ORDER BY name'
    : 'SELECT * FROM wards ORDER BY name'
  return (getDb().prepare(sql).all() as Row[]).map(toModel)
}

export function getWard(id: number): Ward | null {
  const row = getDb().prepare('SELECT * FROM wards WHERE id = ?').get(id) as Row | undefined
  return row ? toModel(row) : null
}

export function createWard(input: WardInput): Ward {
  const name = input.name.trim()
  if (!name) {
    throw Object.assign(new Error('Nome do setor é obrigatório.'), { code: 'WARD_NAME_REQUIRED' })
  }
  const db = getDb()
  const result = db
    .prepare(
      `INSERT INTO wards (name, code, kind, floor, notes, active)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      name,
      input.code?.trim() || null,
      normalizeKind(input.kind),
      input.floor?.trim() || null,
      input.notes?.trim() || null,
      input.active === false ? 0 : 1
    )
  const row = db.prepare('SELECT * FROM wards WHERE id = ?').get(result.lastInsertRowid) as Row
  logAudit({ action: 'create', entity: 'ward', entityId: row.id, details: { name: row.name } })
  return toModel(row)
}

export function updateWard(id: number, input: WardInput): Ward {
  const name = input.name.trim()
  if (!name) {
    throw Object.assign(new Error('Nome do setor é obrigatório.'), { code: 'WARD_NAME_REQUIRED' })
  }
  const db = getDb()
  db.prepare(
    `UPDATE wards
        SET name = ?, code = ?, kind = ?, floor = ?, notes = ?,
            updated_at = datetime('now')
      WHERE id = ?`
  ).run(
    name,
    input.code?.trim() || null,
    normalizeKind(input.kind),
    input.floor?.trim() || null,
    input.notes?.trim() || null,
    id
  )
  const row = db.prepare('SELECT * FROM wards WHERE id = ?').get(id) as Row
  logAudit({ action: 'update', entity: 'ward', entityId: id })
  return toModel(row)
}

/**
 * Ativa/desativa um setor. Desativar setor com leitos ocupados é proibido:
 * `listOccupancyByWard` ignora setores inativos (passa `activeOnly=true`),
 * então os pacientes sumiriam do mapa enquanto suas internações seguem
 * ativas. Dê alta ou transfira antes de desativar.
 */
export function setWardActive(id: number, active: boolean): void {
  const db = getDb()
  const exists = db.prepare('SELECT id FROM wards WHERE id = ?').get(id) as
    | { id: number }
    | undefined
  if (!exists) {
    throw Object.assign(new Error('Setor não encontrado.'), { code: 'WARD_NOT_FOUND' })
  }
  if (!active) {
    const occupied = db
      .prepare(`SELECT COUNT(*) AS c FROM beds WHERE ward_id = ? AND status = 'ocupado'`)
      .get(id) as { c: number }
    if (occupied.c > 0) {
      throw Object.assign(
        new Error(
          `Setor possui ${occupied.c} leito(s) ocupado(s). Dê alta ou transfira os pacientes antes de desativar.`
        ),
        { code: 'WARD_HAS_OCCUPIED_BEDS' }
      )
    }
  }
  db.prepare(`UPDATE wards SET active = ?, updated_at = datetime('now') WHERE id = ?`).run(
    active ? 1 : 0,
    id
  )
  logAudit({ action: active ? 'activate' : 'deactivate', entity: 'ward', entityId: id })
}

/**
 * Remove um setor — só permitido se nenhum leito ainda referenciar.
 * Caso contrário lança CONFLICT pra evitar deixar leitos órfãos.
 */
export function deleteWard(id: number): void {
  const db = getDb()
  const used = db.prepare('SELECT COUNT(*) as c FROM beds WHERE ward_id = ?').get(id) as {
    c: number
  }
  if (used.c > 0) {
    throw Object.assign(
      new Error(
        `Setor não pode ser removido: ${used.c} leito(s) ainda vinculado(s). Remova os leitos primeiro ou desative o setor.`
      ),
      { code: 'WARD_HAS_BEDS' }
    )
  }
  db.prepare('DELETE FROM wards WHERE id = ?').run(id)
  logAudit({ action: 'delete', entity: 'ward', entityId: id })
}
