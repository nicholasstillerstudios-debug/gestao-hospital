import bcrypt from 'bcryptjs'
import { getDb } from '../db'
import { logAudit } from '../audit'
import type { AuthUser, User, UserRole } from '@shared/types'

interface UserRow {
  id: number
  username: string
  password_hash: string
  full_name: string
  role: UserRole
  active: number
  must_change_password: number
  created_at: string
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    role: row.role,
    active: row.active === 1,
    createdAt: row.created_at
  }
}

function toAuthUser(row: UserRow): AuthUser {
  return {
    ...toUser(row),
    mustChangePassword: row.must_change_password === 1
  }
}

export function verifyLogin(username: string, password: string): AuthUser | null {
  const row = getDb()
    .prepare('SELECT * FROM users WHERE username = ? AND active = 1')
    .get(username) as UserRow | undefined
  if (!row) return null
  if (!bcrypt.compareSync(password, row.password_hash)) return null
  return toAuthUser(row)
}

export function listUsers(): User[] {
  const rows = getDb().prepare('SELECT * FROM users ORDER BY full_name').all() as UserRow[]
  return rows.map(toUser)
}

export function createUser(params: {
  username: string
  password: string
  fullName: string
  role: UserRole
}): User {
  const hash = bcrypt.hashSync(params.password, 10)
  const result = getDb()
    .prepare(
      `INSERT INTO users (username, password_hash, full_name, role, active, must_change_password)
       VALUES (?, ?, ?, ?, 1, 1)`
    )
    .run(params.username, hash, params.fullName, params.role)
  const row = getDb()
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(result.lastInsertRowid) as UserRow
  logAudit({
    action: 'create',
    entity: 'user',
    entityId: row.id,
    details: { username: row.username, role: row.role }
  })
  return toUser(row)
}

export function updateUser(id: number, params: { fullName?: string; role?: UserRole }): User {
  const db = getDb()
  const current = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
  if (!current) throw new Error('Usuário não encontrado')
  db.prepare(
    'UPDATE users SET full_name = COALESCE(?, full_name), role = COALESCE(?, role) WHERE id = ?'
  ).run(params.fullName ?? null, params.role ?? null, id)
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow
  logAudit({ action: 'update', entity: 'user', entityId: id, details: params })
  return toUser(row)
}

export function setUserActive(id: number, active: boolean): void {
  getDb()
    .prepare('UPDATE users SET active = ? WHERE id = ?')
    .run(active ? 1 : 0, id)
  logAudit({ action: active ? 'activate' : 'deactivate', entity: 'user', entityId: id })
}

export function resetPassword(id: number, newPassword: string): void {
  const hash = bcrypt.hashSync(newPassword, 10)
  getDb()
    .prepare('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?')
    .run(hash, id)
  logAudit({ action: 'reset-password', entity: 'user', entityId: id })
}

export function changePassword(id: number, oldPassword: string, newPassword: string): void {
  const db = getDb()
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
  if (!row) throw new Error('Usuário não encontrado')
  if (!bcrypt.compareSync(oldPassword, row.password_hash)) {
    throw Object.assign(new Error('Senha atual incorreta.'), { code: 'WRONG_PASSWORD' })
  }
  const hash = bcrypt.hashSync(newPassword, 10)
  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(
    hash,
    id
  )
  logAudit({ action: 'change-password', entity: 'user', entityId: id })
}

export function getUserById(id: number): AuthUser | null {
  const row = getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
  return row ? toAuthUser(row) : null
}
