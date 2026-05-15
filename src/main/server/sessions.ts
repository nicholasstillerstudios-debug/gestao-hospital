/**
 * Sessões da API HTTP. Gerencia os tokens Bearer usados pelos clientes
 * para se autenticar no servidor LAN. Tokens são opacos (UUID-like),
 * têm TTL e são invalidados no logout.
 */
import { randomBytes } from 'node:crypto'
import { getDb } from '../db'
import * as usersRepo from '../repositories/users'
import type { AuthUser } from '@shared/types'

const TTL_HOURS = 12

interface Row {
  token: string
  user_id: number
  expires_at: string
}

function nowIso(): string {
  return new Date().toISOString()
}

function expiresAtIso(): string {
  return new Date(Date.now() + TTL_HOURS * 3600 * 1000).toISOString()
}

export function createApiSession(userId: number): string {
  const token = randomBytes(32).toString('base64url')
  getDb()
    .prepare(
      `INSERT INTO api_sessions (token, user_id, expires_at) VALUES (?, ?, ?)`
    )
    .run(token, userId, expiresAtIso())
  return token
}

export function resolveApiSession(token: string): AuthUser | null {
  if (!token) return null
  const db = getDb()
  const row = db
    .prepare('SELECT token, user_id, expires_at FROM api_sessions WHERE token = ?')
    .get(token) as Row | undefined
  if (!row) return null
  if (row.expires_at < nowIso()) {
    db.prepare('DELETE FROM api_sessions WHERE token = ?').run(token)
    return null
  }
  // Sliding window: renova last_used_at; expires_at fica fixo até logout.
  db.prepare('UPDATE api_sessions SET last_used_at = ? WHERE token = ?').run(nowIso(), token)
  return usersRepo.getUserById(row.user_id)
}

export function destroyApiSession(token: string): void {
  getDb().prepare('DELETE FROM api_sessions WHERE token = ?').run(token)
}

export function purgeExpiredSessions(): number {
  const r = getDb().prepare('DELETE FROM api_sessions WHERE expires_at < ?').run(nowIso())
  return r.changes
}
