/**
 * Repositório de leitos hospitalares.
 *
 * Um leito pertence a um setor (`ward_id`). O `status` reflete o estado
 * operacional (livre, ocupado, em higienização, manutenção, bloqueado,
 * reservado). Quando ocupado, `current_admission_id` aponta para a
 * internação ativa.
 *
 * Mudanças de status feitas pelo módulo de internação (admitir, transferir,
 * dar alta) são feitas pelo `repositories/admissions.ts` dentro de uma
 * transação. Este módulo trata o CRUD do leito e mudanças manuais de
 * status (ex.: pôr em higienização ou manutenção).
 */

import { getDb } from '../db'
import { logAudit } from '../audit'
import type {
  Bed,
  BedInput,
  BedKind,
  BedStatus,
  BedWithRefs,
  WardKind,
  WardOccupancySummary
} from '@shared/types'
import { listWards } from './wards'

interface Row {
  id: number
  ward_id: number
  room_id: number | null
  code: string
  kind: BedKind
  status: BedStatus
  sex_restriction: 'M' | 'F' | null
  current_admission_id: number | null
  notes: string | null
  active: number
  created_at: string
  updated_at: string
}

interface RowWithRefs extends Row {
  ward_name: string
  ward_kind: WardKind
  room_name: string | null
  admission_id: number | null
  patient_id: number | null
  patient_full_name: string | null
  patient_sex: 'M' | 'F' | 'O' | null
  patient_birth_date: string | null
  admitted_at: string | null
  attending_professional_name: string | null
  admission_diagnosis: string | null
}

const TRANSITIONABLE_STATUSES: BedStatus[] = [
  'livre',
  'higienizacao',
  'manutencao',
  'bloqueado',
  'reservado'
]

function toModel(row: Row): Bed {
  return {
    id: row.id,
    wardId: row.ward_id,
    roomId: row.room_id,
    code: row.code,
    kind: row.kind,
    status: row.status,
    sexRestriction: row.sex_restriction,
    currentAdmissionId: row.current_admission_id,
    notes: row.notes,
    active: row.active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function toModelWithRefs(row: RowWithRefs): BedWithRefs {
  return {
    ...toModel(row),
    wardName: row.ward_name,
    wardKind: row.ward_kind,
    roomName: row.room_name,
    admission:
      row.admission_id != null
        ? {
            id: row.admission_id,
            patientId: row.patient_id ?? 0,
            patientName: row.patient_full_name ?? '',
            patientSex: (row.patient_sex ?? 'O') as 'M' | 'F' | 'O',
            patientBirthDate: row.patient_birth_date ?? '',
            admittedAt: row.admitted_at ?? '',
            attendingProfessionalName: row.attending_professional_name,
            admissionDiagnosis: row.admission_diagnosis
          }
        : null
  }
}

const SELECT_WITH_REFS = `
  SELECT b.*,
         w.name AS ward_name,
         w.kind AS ward_kind,
         r.name AS room_name,
         a.id AS admission_id,
         a.patient_id,
         p.full_name AS patient_full_name,
         p.sex AS patient_sex,
         p.birth_date AS patient_birth_date,
         a.admitted_at,
         pr.full_name AS attending_professional_name,
         a.admission_diagnosis
    FROM beds b
    JOIN wards w ON w.id = b.ward_id
    LEFT JOIN rooms r ON r.id = b.room_id
    LEFT JOIN admissions a ON a.id = b.current_admission_id AND a.status = 'ativa'
    LEFT JOIN patients p ON p.id = a.patient_id
    LEFT JOIN professionals pr ON pr.id = a.attending_professional_id
`

export function listBeds(activeOnly = false): Bed[] {
  const sql = activeOnly
    ? 'SELECT * FROM beds WHERE active = 1 ORDER BY ward_id, code'
    : 'SELECT * FROM beds ORDER BY ward_id, code'
  return (getDb().prepare(sql).all() as Row[]).map(toModel)
}

export function listBedsWithRefs(): BedWithRefs[] {
  const rows = getDb().prepare(`${SELECT_WITH_REFS} ORDER BY w.name, b.code`).all() as RowWithRefs[]
  return rows.map(toModelWithRefs)
}

export function listBedsForWard(wardId: number): BedWithRefs[] {
  const rows = getDb()
    .prepare(`${SELECT_WITH_REFS} WHERE b.ward_id = ? ORDER BY b.code`)
    .all(wardId) as RowWithRefs[]
  return rows.map(toModelWithRefs)
}

export function listFreeBeds(): BedWithRefs[] {
  const rows = getDb()
    .prepare(
      `${SELECT_WITH_REFS}
       WHERE b.status = 'livre' AND b.active = 1
       ORDER BY w.name, b.code`
    )
    .all() as RowWithRefs[]
  return rows.map(toModelWithRefs)
}

export function getBed(id: number): Bed | null {
  const row = getDb().prepare('SELECT * FROM beds WHERE id = ?').get(id) as Row | undefined
  return row ? toModel(row) : null
}

export function getBedWithRefs(id: number): BedWithRefs | null {
  const row = getDb().prepare(`${SELECT_WITH_REFS} WHERE b.id = ?`).get(id) as
    | RowWithRefs
    | undefined
  return row ? toModelWithRefs(row) : null
}

export function createBed(input: BedInput): Bed {
  const code = input.code.trim()
  if (!code) {
    throw Object.assign(new Error('Código do leito é obrigatório.'), { code: 'BED_CODE_REQUIRED' })
  }
  const db = getDb()
  const result = db
    .prepare(
      `INSERT INTO beds (ward_id, room_id, code, kind, sex_restriction, notes, active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.wardId,
      input.roomId ?? null,
      code,
      input.kind ?? 'standard',
      input.sexRestriction ?? null,
      input.notes?.trim() || null,
      input.active === false ? 0 : 1
    )
  const row = db.prepare('SELECT * FROM beds WHERE id = ?').get(result.lastInsertRowid) as Row
  logAudit({ action: 'create', entity: 'bed', entityId: row.id, details: { code: row.code } })
  return toModel(row)
}

/**
 * Atualiza um leito. Em leito ocupado, bloqueia mudanças de campos que
 * quebram invariantes da internação ativa: `ward_id`, `kind` e
 * `sex_restriction`. Código, sala e observações seguem editáveis (são
 * meta-dados sem efeito clínico). Para mudar setor/tipo/sexo de um leito
 * ocupado, dê alta ou transfira o paciente antes.
 */
export function updateBed(id: number, input: BedInput): Bed {
  const code = input.code.trim()
  if (!code) {
    throw Object.assign(new Error('Código do leito é obrigatório.'), { code: 'BED_CODE_REQUIRED' })
  }
  const db = getDb()
  const current = db.prepare('SELECT * FROM beds WHERE id = ?').get(id) as Row | undefined
  if (!current) {
    throw Object.assign(new Error('Leito não encontrado.'), { code: 'BED_NOT_FOUND' })
  }
  if (current.status === 'ocupado') {
    const newKind = input.kind ?? 'standard'
    const newSexRestriction = input.sexRestriction ?? null
    const changingWard = input.wardId !== current.ward_id
    const changingKind = newKind !== current.kind
    const changingSex = newSexRestriction !== current.sex_restriction
    if (changingWard || changingKind || changingSex) {
      throw Object.assign(
        new Error(
          'Leito ocupado: setor, tipo e restrição de sexo não podem mudar enquanto há paciente internado. Dê alta ou transfira antes.'
        ),
        { code: 'BED_OCCUPIED' }
      )
    }
  }
  db.prepare(
    `UPDATE beds
        SET ward_id = ?, room_id = ?, code = ?, kind = ?,
            sex_restriction = ?, notes = ?,
            updated_at = datetime('now')
      WHERE id = ?`
  ).run(
    input.wardId,
    input.roomId ?? null,
    code,
    input.kind ?? 'standard',
    input.sexRestriction ?? null,
    input.notes?.trim() || null,
    id
  )
  const row = db.prepare('SELECT * FROM beds WHERE id = ?').get(id) as Row
  logAudit({ action: 'update', entity: 'bed', entityId: id })
  return toModel(row)
}

/**
 * Ativa/desativa um leito. Desativar leito ocupado é proibido — o paciente
 * sumiria do mapa (que filtra `active = 0`) enquanto continuaria com
 * `current_admission_id` apontando para ele. Dê alta ou transfira antes
 * de desativar.
 */
export function setBedActive(id: number, active: boolean): void {
  const db = getDb()
  const current = db.prepare('SELECT status FROM beds WHERE id = ?').get(id) as
    | { status: BedStatus }
    | undefined
  if (!current) {
    throw Object.assign(new Error('Leito não encontrado.'), { code: 'BED_NOT_FOUND' })
  }
  if (!active && current.status === 'ocupado') {
    throw Object.assign(
      new Error('Leito ocupado: dê alta ou transfira o paciente antes de desativar.'),
      { code: 'BED_OCCUPIED' }
    )
  }
  db.prepare(`UPDATE beds SET active = ?, updated_at = datetime('now') WHERE id = ?`).run(
    active ? 1 : 0,
    id
  )
  logAudit({ action: active ? 'activate' : 'deactivate', entity: 'bed', entityId: id })
}

/**
 * Muda o status manual do leito (higienização, manutenção, bloqueio,
 * reserva, ou liberação para `livre`). Não pode ser usada para mudar para
 * `'ocupado'` — isso só ocorre via `admitPatient` em `admissions.ts`.
 */
export function setBedStatus(id: number, status: BedStatus, reason: string | null = null): Bed {
  if (status === 'ocupado') {
    throw Object.assign(new Error('Leito só pode ficar ocupado via admissão de paciente.'), {
      code: 'BED_STATUS_INVALID'
    })
  }
  if (!TRANSITIONABLE_STATUSES.includes(status)) {
    throw Object.assign(new Error(`Status de leito inválido: ${status}`), {
      code: 'BED_STATUS_INVALID'
    })
  }
  const db = getDb()
  const current = db.prepare('SELECT * FROM beds WHERE id = ?').get(id) as Row | undefined
  if (!current) {
    throw Object.assign(new Error('Leito não encontrado.'), { code: 'BED_NOT_FOUND' })
  }
  if (current.status === 'ocupado') {
    throw Object.assign(
      new Error('Leito está ocupado — dê alta no paciente antes de mudar o status.'),
      { code: 'BED_OCCUPIED' }
    )
  }
  db.prepare(
    `UPDATE beds
        SET status = ?, current_admission_id = NULL, updated_at = datetime('now')
      WHERE id = ?`
  ).run(status, id)
  const row = db.prepare('SELECT * FROM beds WHERE id = ?').get(id) as Row
  logAudit({
    action: 'set_status',
    entity: 'bed',
    entityId: id,
    details: { from: current.status, to: status, reason }
  })
  return toModel(row)
}

/**
 * Remove um leito — só permitido se não houver internação ativa nele e
 * nenhum movimento histórico apontar para ele com FK não-nula. Como
 * `bed_movements.bed_id` tem `ON DELETE SET NULL`, a remoção é segura,
 * mas exigimos que esteja livre.
 */
export function deleteBed(id: number): void {
  const db = getDb()
  const row = db.prepare('SELECT status FROM beds WHERE id = ?').get(id) as
    | { status: BedStatus }
    | undefined
  if (!row) {
    throw Object.assign(new Error('Leito não encontrado.'), { code: 'BED_NOT_FOUND' })
  }
  if (row.status === 'ocupado') {
    throw Object.assign(new Error('Leito ocupado — não pode ser removido.'), {
      code: 'BED_OCCUPIED'
    })
  }
  db.prepare('DELETE FROM beds WHERE id = ?').run(id)
  logAudit({ action: 'delete', entity: 'bed', entityId: id })
}

/**
 * Resumo do mapa de leitos por setor (usado na página /leitos).
 * Inclui apenas setores ativos e leitos ativos — leitos desativados
 * (`active = 0`) não entram em total/livres/ocupados, senão a equipe vê
 * capacidade fantasma e tenta admitir em leitos que `admitPatient` recusa.
 */
export function listOccupancyByWard(): WardOccupancySummary[] {
  const wards = listWards(true)
  const allBeds = listBedsWithRefs()
  return wards.map((ward) => {
    const beds = allBeds.filter((b) => b.wardId === ward.id && b.active)
    const ocupado = beds.filter((b) => b.status === 'ocupado').length
    const livre = beds.filter((b) => b.status === 'livre').length
    const outros = beds.length - ocupado - livre
    return { ward, total: beds.length, ocupado, livre, outros, beds }
  })
}
