/**
 * Centro Cirúrgico: salas, agenda cirúrgica, time-out (WHO SSC) e OPME.
 *
 * Conflito de sala: ao agendar, valida que não há outra cirurgia
 * sobreposta no intervalo (start, end] na mesma sala. Cirurgia pode ser
 * adiada / cancelada antes do início; em curso (`em_curso`) registra
 * actual_start; concluída registra actual_end.
 */

import { getDb } from '../db'
import { logAudit } from '../audit'
import { getCurrentUser } from '../session'
import type {
  Surgery,
  SurgeryWithRefs,
  SurgeryInput,
  SurgeryStatus,
  SurgeryPriority,
  AnesthesiaType,
  SurgeryTimeOutItem,
  SurgeryOpme,
  SurgeryOpmeInput,
  SurgicalRoom,
  SurgicalRoomInput
} from '@shared/types'
import { TIME_OUT_DEFAULT_CHECKLIST } from '@shared/types'

// ─────────────────────────────────────────────────────────── rooms ──────

interface RoomRow {
  id: number
  name: string
  code: string | null
  floor: string | null
  active: number
  notes: string | null
  created_at: string
  updated_at: string
}

function toRoom(r: RoomRow): SurgicalRoom {
  return {
    id: r.id,
    name: r.name,
    code: r.code,
    floor: r.floor,
    active: r.active === 1,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}

export function listRooms(activeOnly = false): SurgicalRoom[] {
  const sql = activeOnly
    ? 'SELECT * FROM surgical_rooms WHERE active = 1 ORDER BY name'
    : 'SELECT * FROM surgical_rooms ORDER BY name'
  const rows = getDb().prepare(sql).all() as RoomRow[]
  return rows.map(toRoom)
}

export function createRoom(input: SurgicalRoomInput): SurgicalRoom {
  if (!input.name?.trim()) {
    throw Object.assign(new Error('Nome da sala é obrigatório.'), { code: 'ROOM_NAME_REQUIRED' })
  }
  const db = getDb()
  const result = db
    .prepare(
      `INSERT INTO surgical_rooms (name, code, floor, notes) VALUES (?, ?, ?, ?)`
    )
    .run(
      input.name.trim(),
      input.code?.trim() || null,
      input.floor?.trim() || null,
      input.notes?.trim() || null
    )
  const id = Number(result.lastInsertRowid)
  logAudit({ action: 'create', entity: 'surgical_room', entityId: id })
  const row = db.prepare('SELECT * FROM surgical_rooms WHERE id = ?').get(id) as RoomRow
  return toRoom(row)
}

export function updateRoom(id: number, input: SurgicalRoomInput): SurgicalRoom {
  const db = getDb()
  const exists = db.prepare('SELECT id FROM surgical_rooms WHERE id = ?').get(id)
  if (!exists) {
    throw Object.assign(new Error('Sala não encontrada.'), { code: 'ROOM_NOT_FOUND' })
  }
  db.prepare(
    `UPDATE surgical_rooms
       SET name = ?, code = ?, floor = ?, notes = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    input.name.trim(),
    input.code?.trim() || null,
    input.floor?.trim() || null,
    input.notes?.trim() || null,
    id
  )
  logAudit({ action: 'update', entity: 'surgical_room', entityId: id })
  const row = db.prepare('SELECT * FROM surgical_rooms WHERE id = ?').get(id) as RoomRow
  return toRoom(row)
}

export function setRoomActive(id: number, active: boolean): SurgicalRoom {
  const db = getDb()
  db.prepare(
    `UPDATE surgical_rooms SET active = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(active ? 1 : 0, id)
  logAudit({ action: 'update', entity: 'surgical_room', entityId: id, details: { active } })
  const row = db.prepare('SELECT * FROM surgical_rooms WHERE id = ?').get(id) as RoomRow | undefined
  if (!row) {
    throw Object.assign(new Error('Sala não encontrada.'), { code: 'ROOM_NOT_FOUND' })
  }
  return toRoom(row)
}

// ─────────────────────────────────────────────────────── surgeries ──────

interface SurgeryRow {
  id: number
  patient_id: number
  room_id: number | null
  admission_id: number | null
  surgeon_professional_id: number | null
  anesthetist_professional_id: number | null
  scheduled_start: string
  scheduled_end: string
  actual_start: string | null
  actual_end: string | null
  procedure_name: string
  procedure_cid10: string | null
  anesthesia_type: string | null
  priority: string
  status: string
  time_out_completed: number
  time_out_at: string | null
  notes: string | null
  cancel_reason: string | null
  description: string | null
  created_by_user_id: number | null
  created_at: string
  updated_at: string
}

interface SurgeryRowWithRefs extends SurgeryRow {
  patient_name: string
  patient_cpf: string | null
  room_name: string | null
  surgeon_name: string | null
  anesthetist_name: string | null
}

function toSurgery(r: SurgeryRow): Surgery {
  return {
    id: r.id,
    patientId: r.patient_id,
    roomId: r.room_id,
    admissionId: r.admission_id,
    surgeonProfessionalId: r.surgeon_professional_id,
    anesthetistProfessionalId: r.anesthetist_professional_id,
    scheduledStart: r.scheduled_start,
    scheduledEnd: r.scheduled_end,
    actualStart: r.actual_start,
    actualEnd: r.actual_end,
    procedureName: r.procedure_name,
    procedureCid10: r.procedure_cid10,
    anesthesiaType: (r.anesthesia_type as AnesthesiaType | null) ?? null,
    priority: r.priority as SurgeryPriority,
    status: r.status as SurgeryStatus,
    timeOutCompleted: r.time_out_completed === 1,
    timeOutAt: r.time_out_at,
    notes: r.notes,
    cancelReason: r.cancel_reason,
    description: r.description,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}

function toSurgeryWithRefs(r: SurgeryRowWithRefs): SurgeryWithRefs {
  return {
    ...toSurgery(r),
    patientName: r.patient_name,
    patientCpf: r.patient_cpf,
    roomName: r.room_name,
    surgeonName: r.surgeon_name,
    anesthetistName: r.anesthetist_name
  }
}

const SELECT_SURGERY = `
  SELECT s.*,
         p.full_name AS patient_name,
         p.cpf       AS patient_cpf,
         r.name      AS room_name,
         pr.full_name AS surgeon_name,
         pa.full_name AS anesthetist_name
    FROM surgeries s
    JOIN patients p ON p.id = s.patient_id
    LEFT JOIN surgical_rooms r ON r.id = s.room_id
    LEFT JOIN professionals pr ON pr.id = s.surgeon_professional_id
    LEFT JOIN professionals pa ON pa.id = s.anesthetist_professional_id
`

export function listSurgeries(options?: {
  status?: SurgeryStatus
  fromDate?: string
  toDate?: string
}): SurgeryWithRefs[] {
  const where: string[] = []
  const params: (string | number)[] = []
  if (options?.status) {
    where.push('s.status = ?')
    params.push(options.status)
  }
  if (options?.fromDate) {
    where.push("s.scheduled_start >= ?")
    params.push(options.fromDate)
  }
  if (options?.toDate) {
    where.push("s.scheduled_start <= ?")
    params.push(options.toDate)
  }
  const sql = `${SELECT_SURGERY}
    ${where.length > 0 ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY s.scheduled_start DESC`
  const rows = getDb().prepare(sql).all(...params) as SurgeryRowWithRefs[]
  return rows.map(toSurgeryWithRefs)
}

export function getSurgery(id: number): SurgeryWithRefs | null {
  const row = getDb()
    .prepare(`${SELECT_SURGERY} WHERE s.id = ?`)
    .get(id) as SurgeryRowWithRefs | undefined
  return row ? toSurgeryWithRefs(row) : null
}

function validateScheduleSlot(
  db: ReturnType<typeof getDb>,
  roomId: number | null,
  start: string,
  end: string,
  excludeSurgeryId?: number
): void {
  if (!Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end))) {
    throw Object.assign(new Error('Datas inválidas.'), { code: 'SURGERY_DATE_INVALID' })
  }
  if (Date.parse(end) <= Date.parse(start)) {
    throw Object.assign(new Error('Fim previsto deve ser depois do início.'), {
      code: 'SURGERY_DATE_RANGE'
    })
  }
  if (roomId == null) return

  const conflict = db
    .prepare(
      `SELECT id FROM surgeries
        WHERE room_id = ?
          AND status NOT IN ('cancelada','concluida','suspensa')
          AND id != COALESCE(?, -1)
          AND NOT (scheduled_end <= ? OR scheduled_start >= ?)
        LIMIT 1`
    )
    .get(roomId, excludeSurgeryId ?? null, start, end) as { id: number } | undefined
  if (conflict) {
    throw Object.assign(
      new Error(`Conflito de agenda: sala já reservada (cirurgia #${conflict.id}).`),
      { code: 'SURGERY_ROOM_CONFLICT' }
    )
  }
}

export function createSurgery(input: SurgeryInput): SurgeryWithRefs {
  if (!input.procedureName?.trim()) {
    throw Object.assign(new Error('Procedimento é obrigatório.'), {
      code: 'SURGERY_PROCEDURE_REQUIRED'
    })
  }
  const db = getDb()
  validateScheduleSlot(db, input.roomId ?? null, input.scheduledStart, input.scheduledEnd)

  const user = getCurrentUser()
  const tx = db.transaction((): number => {
    const result = db
      .prepare(
        `INSERT INTO surgeries
           (patient_id, room_id, admission_id, surgeon_professional_id, anesthetist_professional_id,
            scheduled_start, scheduled_end, procedure_name, procedure_cid10,
            anesthesia_type, priority, notes, created_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.patientId,
        input.roomId ?? null,
        input.admissionId ?? null,
        input.surgeonProfessionalId ?? null,
        input.anesthetistProfessionalId ?? null,
        input.scheduledStart,
        input.scheduledEnd,
        input.procedureName.trim(),
        input.procedureCid10?.trim() || null,
        input.anesthesiaType ?? null,
        input.priority,
        input.notes?.trim() || null,
        user?.id ?? null
      )
    const id = Number(result.lastInsertRowid)
    // Cria o checklist time-out padrão (WHO SSC).
    const insertItem = db.prepare(
      `INSERT INTO surgery_timeout_items (surgery_id, item) VALUES (?, ?)`
    )
    for (const item of TIME_OUT_DEFAULT_CHECKLIST) {
      insertItem.run(id, item)
    }
    return id
  })

  const id = tx()
  logAudit({ action: 'create', entity: 'surgery', entityId: id })
  return getSurgery(id)!
}

export function setSurgeryStatus(id: number, status: SurgeryStatus): SurgeryWithRefs {
  const db = getDb()
  db.prepare(
    `UPDATE surgeries SET status = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(status, id)
  logAudit({ action: 'update', entity: 'surgery', entityId: id, details: { status } })
  return getSurgery(id)!
}

export function startSurgery(id: number): SurgeryWithRefs {
  const db = getDb()
  const row = db.prepare('SELECT * FROM surgeries WHERE id = ?').get(id) as SurgeryRow | undefined
  if (!row) {
    throw Object.assign(new Error('Cirurgia não encontrada.'), { code: 'SURGERY_NOT_FOUND' })
  }
  if (row.time_out_completed !== 1) {
    throw Object.assign(new Error('Time-out (checklist de segurança) ainda não concluído.'), {
      code: 'SURGERY_TIMEOUT_PENDING'
    })
  }
  if (row.status !== 'agendada' && row.status !== 'aguardando') {
    throw Object.assign(
      new Error(`Cirurgia em status "${row.status}" não pode ser iniciada.`),
      { code: 'SURGERY_INVALID_STATE' }
    )
  }
  db.prepare(
    `UPDATE surgeries
       SET status = 'em_curso', actual_start = datetime('now'), updated_at = datetime('now')
     WHERE id = ?`
  ).run(id)
  logAudit({ action: 'update', entity: 'surgery', entityId: id, details: { status: 'em_curso' } })
  return getSurgery(id)!
}

export function finishSurgery(id: number, notes?: string | null): SurgeryWithRefs {
  const db = getDb()
  const row = db.prepare('SELECT status FROM surgeries WHERE id = ?').get(id) as
    | { status: string }
    | undefined
  if (!row) {
    throw Object.assign(new Error('Cirurgia não encontrada.'), { code: 'SURGERY_NOT_FOUND' })
  }
  if (row.status !== 'em_curso') {
    throw Object.assign(new Error('Apenas cirurgia em curso pode ser concluída.'), {
      code: 'SURGERY_INVALID_STATE'
    })
  }
  db.prepare(
    `UPDATE surgeries
       SET status = 'concluida', actual_end = datetime('now'),
           notes = COALESCE(?, notes), updated_at = datetime('now')
     WHERE id = ?`
  ).run(notes?.trim() || null, id)
  logAudit({ action: 'update', entity: 'surgery', entityId: id, details: { status: 'concluida' } })
  return getSurgery(id)!
}

export function cancelSurgery(id: number, reason: string): SurgeryWithRefs {
  if (!reason?.trim()) {
    throw Object.assign(new Error('Motivo do cancelamento é obrigatório.'), {
      code: 'CANCEL_REASON_REQUIRED'
    })
  }
  const db = getDb()
  db.prepare(
    `UPDATE surgeries
       SET status = 'cancelada', cancel_reason = ?, updated_at = datetime('now')
     WHERE id = ? AND status NOT IN ('em_curso','concluida')`
  ).run(reason.trim(), id)
  logAudit({ action: 'update', entity: 'surgery', entityId: id, details: { status: 'cancelada' } })
  return getSurgery(id)!
}

/** Atualiza a descrição cirúrgica (texto livre da Folha de Sala). */
export function setSurgeryDescription(id: number, description: string): SurgeryWithRefs {
  const db = getDb()
  db.prepare(
    `UPDATE surgeries SET description = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(description?.trim() || null, id)
  logAudit({ action: 'update', entity: 'surgery_description', entityId: id })
  const r = getSurgery(id)
  if (!r) throw new Error('Cirurgia não encontrada.')
  return r
}

// ────────────────────────────────────────────────────── time-out ────────

interface TimeOutRow {
  id: number
  surgery_id: number
  item: string
  checked: number
  checked_at: string | null
  checked_by_user_id: number | null
  notes: string | null
}

function toTimeOut(r: TimeOutRow): SurgeryTimeOutItem {
  return {
    id: r.id,
    surgeryId: r.surgery_id,
    item: r.item,
    checked: r.checked === 1,
    checkedAt: r.checked_at,
    checkedByUserId: r.checked_by_user_id,
    notes: r.notes
  }
}

export function listTimeOutItems(surgeryId: number): SurgeryTimeOutItem[] {
  const rows = getDb()
    .prepare(`SELECT * FROM surgery_timeout_items WHERE surgery_id = ? ORDER BY id`)
    .all(surgeryId) as TimeOutRow[]
  return rows.map(toTimeOut)
}

export function checkTimeOutItem(itemId: number, checked: boolean, notes?: string | null): void {
  const db = getDb()
  const user = getCurrentUser()
  const item = db
    .prepare(`SELECT surgery_id FROM surgery_timeout_items WHERE id = ?`)
    .get(itemId) as { surgery_id: number } | undefined
  if (!item) {
    throw Object.assign(new Error('Item de time-out não encontrado.'), {
      code: 'TIMEOUT_ITEM_NOT_FOUND'
    })
  }
  db.prepare(
    `UPDATE surgery_timeout_items
       SET checked = ?,
           checked_at = CASE WHEN ? = 1 THEN datetime('now') ELSE NULL END,
           checked_by_user_id = CASE WHEN ? = 1 THEN ? ELSE NULL END,
           notes = ?
     WHERE id = ?`
  ).run(
    checked ? 1 : 0,
    checked ? 1 : 0,
    checked ? 1 : 0,
    user?.id ?? null,
    notes?.trim() || null,
    itemId
  )

  // Atualiza flag agregado time_out_completed na cirurgia.
  const total = db
    .prepare(`SELECT COUNT(*) AS n FROM surgery_timeout_items WHERE surgery_id = ?`)
    .get(item.surgery_id) as { n: number }
  const done = db
    .prepare(
      `SELECT COUNT(*) AS n FROM surgery_timeout_items WHERE surgery_id = ? AND checked = 1`
    )
    .get(item.surgery_id) as { n: number }
  const all = total.n > 0 && done.n === total.n
  db.prepare(
    `UPDATE surgeries
       SET time_out_completed = ?, time_out_at = CASE WHEN ? = 1 THEN datetime('now') ELSE NULL END,
           updated_at = datetime('now')
     WHERE id = ?`
  ).run(all ? 1 : 0, all ? 1 : 0, item.surgery_id)

  logAudit({
    action: 'update',
    entity: 'surgery_timeout',
    entityId: itemId,
    details: { surgeryId: item.surgery_id, checked }
  })
}

// ───────────────────────────────────────────────────────────── opme ─────

interface OpmeRow {
  id: number
  surgery_id: number
  description: string
  manufacturer: string | null
  lot_number: string | null
  serial_number: string | null
  quantity: number
  unit: string | null
  notes: string | null
  registered_by_user_id: number | null
  registered_at: string
}

function toOpme(r: OpmeRow): SurgeryOpme {
  return {
    id: r.id,
    surgeryId: r.surgery_id,
    description: r.description,
    manufacturer: r.manufacturer,
    lotNumber: r.lot_number,
    serialNumber: r.serial_number,
    quantity: r.quantity,
    unit: r.unit,
    notes: r.notes,
    registeredByUserId: r.registered_by_user_id,
    registeredAt: r.registered_at
  }
}

export function listOpme(surgeryId: number): SurgeryOpme[] {
  const rows = getDb()
    .prepare(`SELECT * FROM surgery_opme WHERE surgery_id = ? ORDER BY registered_at`)
    .all(surgeryId) as OpmeRow[]
  return rows.map(toOpme)
}

export function addOpme(input: SurgeryOpmeInput): SurgeryOpme {
  if (!input.description?.trim()) {
    throw Object.assign(new Error('Descrição do OPME é obrigatória.'), {
      code: 'OPME_DESCRIPTION_REQUIRED'
    })
  }
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw Object.assign(new Error('Quantidade deve ser positiva.'), {
      code: 'OPME_QUANTITY_INVALID'
    })
  }
  const db = getDb()
  const user = getCurrentUser()
  const result = db
    .prepare(
      `INSERT INTO surgery_opme
         (surgery_id, description, manufacturer, lot_number, serial_number,
          quantity, unit, notes, registered_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.surgeryId,
      input.description.trim(),
      input.manufacturer?.trim() || null,
      input.lotNumber?.trim() || null,
      input.serialNumber?.trim() || null,
      Math.floor(input.quantity),
      input.unit?.trim() || null,
      input.notes?.trim() || null,
      user?.id ?? null
    )
  const id = Number(result.lastInsertRowid)
  logAudit({ action: 'create', entity: 'surgery_opme', entityId: id })
  const row = db.prepare('SELECT * FROM surgery_opme WHERE id = ?').get(id) as OpmeRow
  return toOpme(row)
}

export function removeOpme(id: number): void {
  const db = getDb()
  db.prepare('DELETE FROM surgery_opme WHERE id = ?').run(id)
  logAudit({ action: 'delete', entity: 'surgery_opme', entityId: id })
}
