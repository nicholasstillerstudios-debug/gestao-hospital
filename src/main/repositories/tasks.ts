import { getDb } from '../db'
import { logAudit } from '../audit'
import { getCurrentUser } from '../session'
import { BrowserWindow } from 'electron'
import type {
  InternalTaskInput,
  InternalTaskWithRefs,
  TaskPriority,
  TaskStatus,
  UserRole
} from '@shared/types'

interface Row {
  id: number
  title: string
  description: string | null
  from_user_id: number | null
  from_user_name: string | null
  to_user_id: number | null
  to_user_name: string | null
  to_role: UserRole | null
  patient_id: number | null
  patient_name: string | null
  completed_by_user_id: number | null
  priority: TaskPriority
  status: TaskStatus
  due_at: string | null
  completed_at: string | null
  completed_by_name: string | null
  completion_notes: string | null
  created_at: string
}

function toTask(r: Row): InternalTaskWithRefs {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    fromUserId: r.from_user_id,
    fromUserName: r.from_user_name,
    toUserId: r.to_user_id,
    toUserName: r.to_user_name,
    toRole: r.to_role,
    patientId: r.patient_id,
    patientName: r.patient_name,
    priority: r.priority,
    status: r.status,
    dueAt: r.due_at,
    completedAt: r.completed_at,
    completedByUserId: r.completed_by_user_id,
    completedByName: r.completed_by_name,
    completionNotes: r.completion_notes,
    createdAt: r.created_at
  }
}

const SELECT = `SELECT t.*, pat.full_name AS patient_name, u.full_name AS to_user_name
  FROM internal_tasks t
  LEFT JOIN patients pat ON pat.id = t.patient_id
  LEFT JOIN users u ON u.id = t.to_user_id`

export function list(filter?: { status?: TaskStatus }): InternalTaskWithRefs[] {
  const where = filter?.status ? 'WHERE t.status = ?' : ''
  const params = filter?.status ? [filter.status] : []
  const rows = getDb()
    .prepare(
      `${SELECT} ${where}
       ORDER BY
         CASE t.status WHEN 'pendente' THEN 0 WHEN 'em_andamento' THEN 1 ELSE 2 END,
         CASE t.priority WHEN 'urgente' THEN 0 WHEN 'alta' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
         t.created_at DESC
       LIMIT 300`
    )
    .all(...params) as Row[]
  return rows.map(toTask)
}

export function listForMe(userId: number, role: UserRole): InternalTaskWithRefs[] {
  const rows = getDb()
    .prepare(
      `${SELECT}
       WHERE (t.to_user_id = ? OR (t.to_user_id IS NULL AND t.to_role = ?))
         AND t.status IN ('pendente','em_andamento')
       ORDER BY
         CASE t.priority WHEN 'urgente' THEN 0 WHEN 'alta' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
         t.created_at DESC`
    )
    .all(userId, role) as Row[]
  return rows.map(toTask)
}

export function countPending(userId: number, role: UserRole): number {
  const r = getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM internal_tasks
       WHERE (to_user_id = ? OR (to_user_id IS NULL AND to_role = ?))
         AND status IN ('pendente','em_andamento')`
    )
    .get(userId, role) as { n: number }
  return r.n
}

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
}

export function create(input: InternalTaskInput): InternalTaskWithRefs {
  const user = getCurrentUser()
  if (!input.toUserId && !input.toRole) {
    throw Object.assign(new Error('Informe destinatário (usuário ou função).'), {
      code: 'MISSING_RECIPIENT'
    })
  }
  const r = getDb()
    .prepare(
      `INSERT INTO internal_tasks
        (title, description, from_user_id, from_user_name, to_user_id, to_role,
         patient_id, priority, due_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.title.trim(),
      input.description?.trim() || null,
      user?.id ?? null,
      user?.fullName ?? null,
      input.toUserId ?? null,
      input.toRole ?? null,
      input.patientId ?? null,
      input.priority ?? 'normal',
      input.dueAt ?? null
    )
  logAudit({ action: 'create', entity: 'internal_task', entityId: Number(r.lastInsertRowid) })
  const task = getById(Number(r.lastInsertRowid))!
  broadcast('tasks:on-new', task)
  return task
}

function getById(id: number): InternalTaskWithRefs | null {
  const row = getDb().prepare(`${SELECT} WHERE t.id = ?`).get(id) as Row | undefined
  return row ? toTask(row) : null
}

export function updateStatus(
  id: number,
  status: TaskStatus,
  completionNotes?: string | null
): InternalTaskWithRefs {
  const user = getCurrentUser()
  const completed = status === 'concluida' || status === 'cancelada'
  getDb()
    .prepare(
      `UPDATE internal_tasks SET
        status = ?,
        completed_at = ${completed ? `datetime('now')` : 'NULL'},
        completed_by_user_id = ?,
        completed_by_name = ?,
        completion_notes = ?
       WHERE id = ?`
    )
    .run(
      status,
      completed ? user?.id ?? null : null,
      completed ? user?.fullName ?? null : null,
      completionNotes ?? null,
      id
    )
  logAudit({
    action: 'update',
    entity: 'internal_task',
    entityId: id,
    details: { status }
  })
  return getById(id)!
}

export function remove(id: number): void {
  getDb().prepare('DELETE FROM internal_tasks WHERE id = ?').run(id)
  logAudit({ action: 'delete', entity: 'internal_task', entityId: id })
}
