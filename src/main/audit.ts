import { getDb } from './db'
import type { AuditLogEntry } from '@shared/types'
import { getCurrentUser } from './session'

export function logAudit(params: {
  action: string
  entity: string
  entityId?: string | number | null
  details?: Record<string, unknown> | string | null
}): void {
  const user = getCurrentUser()
  const db = getDb()
  const details =
    params.details == null
      ? null
      : typeof params.details === 'string'
        ? params.details
        : JSON.stringify(params.details)
  db.prepare(
    `INSERT INTO audit_log (user_id, username, action, entity, entity_id, details)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    user?.id ?? null,
    user?.username ?? null,
    params.action,
    params.entity,
    params.entityId == null ? null : String(params.entityId),
    details
  )
}

export function listAudit(limit = 200): AuditLogEntry[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT id, user_id AS userId, username, action, entity,
              entity_id AS entityId, details, created_at AS createdAt
         FROM audit_log
        ORDER BY id DESC
        LIMIT ?`
    )
    .all(limit) as AuditLogEntry[]
  return rows
}

export function listAuditByEntity(entity: string, entityId: string | number): AuditLogEntry[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT id, user_id AS userId, username, action, entity,
              entity_id AS entityId, details, created_at AS createdAt
         FROM audit_log
        WHERE entity = ? AND entity_id = ?
        ORDER BY id DESC`
    )
    .all(entity, String(entityId)) as AuditLogEntry[]
  return rows
}

/**
 * Apaga linhas de auditoria mais antigas que `retentionDays`. Retorna o número
 * de linhas removidas. Quando `retentionDays <= 0` é tratado como retenção
 * indefinida e nada é removido.
 */
export function purgeAuditOlderThan(retentionDays: number): number {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) return 0
  const db = getDb()
  const result = db
    .prepare(`DELETE FROM audit_log WHERE created_at < datetime('now', ?)`)
    .run(`-${Math.floor(retentionDays)} days`)
  if (result.changes > 0) {
    db.prepare(
      `INSERT INTO audit_log (user_id, username, action, entity, entity_id, details)
       VALUES (NULL, 'system', 'purge', 'audit_log', NULL, ?)`
    ).run(JSON.stringify({ retentionDays, removed: result.changes }))
  }
  return result.changes
}
