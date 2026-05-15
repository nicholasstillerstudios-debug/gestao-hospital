import bcrypt from 'bcryptjs'
import { getDb } from '../db'
import { logAudit } from '../audit'
import type { AuthUser, User, UserRole } from '@shared/types'

const PASSWORD_MIN_LENGTH = 8
const USERNAME_REGEX = /^[a-z][a-z0-9._-]{2,31}$/i

function assertPasswordStrong(pw: string): void {
  if (typeof pw !== 'string' || pw.length < PASSWORD_MIN_LENGTH) {
    throw Object.assign(
      new Error(`A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`),
      { code: 'PASSWORD_TOO_SHORT' }
    )
  }
  // Heurística básica — exige letra + dígito para evitar "12345678".
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) {
    throw Object.assign(new Error('A senha deve conter letras e números.'), {
      code: 'PASSWORD_TOO_WEAK'
    })
  }
}

function assertUsernameValid(username: string): void {
  if (!USERNAME_REGEX.test(username)) {
    throw Object.assign(
      new Error(
        'Usuário inválido. Use 3–32 caracteres começando com letra; aceita letras, dígitos, ponto, traço e sublinhado.'
      ),
      { code: 'USERNAME_INVALID' }
    )
  }
}

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
  const username = params.username.trim().toLowerCase()
  const fullName = params.fullName.trim()
  if (!fullName) {
    throw Object.assign(new Error('Nome completo é obrigatório.'), { code: 'FULLNAME_REQUIRED' })
  }
  assertUsernameValid(username)
  assertPasswordStrong(params.password)

  const db = getDb()
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as
    | { id: number }
    | undefined
  if (existing) {
    throw Object.assign(new Error(`Usuário "${username}" já existe.`), {
      code: 'USERNAME_TAKEN'
    })
  }

  const hash = bcrypt.hashSync(params.password, 10)
  const result = db
    .prepare(
      `INSERT INTO users (username, password_hash, full_name, role, active, must_change_password)
       VALUES (?, ?, ?, ?, 1, 1)`
    )
    .run(username, hash, fullName, params.role)
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid) as UserRow
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

export function setUserActive(id: number, active: boolean, actorUserId?: number | null): void {
  if (!active && actorUserId != null && actorUserId === id) {
    throw Object.assign(new Error('Você não pode desativar sua própria conta.'), {
      code: 'CANNOT_DEACTIVATE_SELF'
    })
  }
  // Não permitir deixar o sistema sem nenhum admin ativo: se for o último
  // admin ativo, recusa a desativação / mudança que removeria o papel.
  if (!active) {
    const db = getDb()
    const target = db.prepare('SELECT role, active FROM users WHERE id = ?').get(id) as
      | { role: UserRole; active: number }
      | undefined
    if (target && target.role === 'admin' && target.active === 1) {
      const others = db
        .prepare(
          "SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1 AND id != ?"
        )
        .get(id) as { n: number }
      if (others.n === 0) {
        throw Object.assign(
          new Error('Não é possível desativar o último administrador ativo do sistema.'),
          { code: 'LAST_ADMIN' }
        )
      }
    }
  }
  getDb()
    .prepare('UPDATE users SET active = ? WHERE id = ?')
    .run(active ? 1 : 0, id)
  logAudit({ action: active ? 'activate' : 'deactivate', entity: 'user', entityId: id })
}

export function resetPassword(id: number, newPassword: string): void {
  assertPasswordStrong(newPassword)
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
  assertPasswordStrong(newPassword)
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
