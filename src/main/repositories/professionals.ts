import { getDb } from '../db'
import { logAudit } from '../audit'
import type { Professional } from '@shared/types'

interface Row {
  id: number
  full_name: string
  cpf: string | null
  cns: string | null
  category: string | null
  cbo_code: string | null
  cbo_name: string | null
  council_type: string | null
  council_number: string | null
  council_uf: string | null
  council_expires_at: string | null
  specialty: string | null
  email: string | null
  phone: string | null
  active: number
  created_at: string
}

function toModel(row: Row): Professional {
  return {
    id: row.id,
    fullName: row.full_name,
    cpf: row.cpf,
    cns: row.cns,
    category: row.category,
    cboCode: row.cbo_code,
    cboName: row.cbo_name,
    councilType: row.council_type,
    councilNumber: row.council_number,
    councilUf: row.council_uf,
    councilExpiresAt: row.council_expires_at,
    specialty: row.specialty,
    email: row.email,
    phone: row.phone,
    active: row.active === 1,
    createdAt: row.created_at
  }
}

export function listProfessionals(activeOnly = false): Professional[] {
  const sql = activeOnly
    ? 'SELECT * FROM professionals WHERE active = 1 ORDER BY full_name'
    : 'SELECT * FROM professionals ORDER BY full_name'
  return (getDb().prepare(sql).all() as Row[]).map(toModel)
}

export function getProfessional(id: number): Professional | null {
  const row = getDb().prepare('SELECT * FROM professionals WHERE id = ?').get(id) as Row | undefined
  return row ? toModel(row) : null
}

export type ProfessionalInput = Omit<Professional, 'id' | 'createdAt' | 'active'> & {
  active?: boolean
}

export function createProfessional(input: ProfessionalInput): Professional {
  const db = getDb()
  const result = db
    .prepare(
      `INSERT INTO professionals (
         full_name, cpf, cns, category, cbo_code, cbo_name,
         council_type, council_number, council_uf, council_expires_at,
         specialty, email, phone, active
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.fullName,
      input.cpf,
      input.cns,
      input.category,
      input.cboCode,
      input.cboName,
      input.councilType,
      input.councilNumber,
      input.councilUf,
      input.councilExpiresAt,
      input.specialty,
      input.email,
      input.phone,
      input.active === false ? 0 : 1
    )
  const row = db
    .prepare('SELECT * FROM professionals WHERE id = ?')
    .get(result.lastInsertRowid) as Row
  logAudit({ action: 'create', entity: 'professional', entityId: row.id })
  return toModel(row)
}

export function updateProfessional(id: number, input: ProfessionalInput): Professional {
  const db = getDb()
  db.prepare(
    `UPDATE professionals
        SET full_name = ?, cpf = ?, cns = ?, category = ?, cbo_code = ?, cbo_name = ?,
            council_type = ?, council_number = ?, council_uf = ?, council_expires_at = ?,
            specialty = ?, email = ?, phone = ?
      WHERE id = ?`
  ).run(
    input.fullName,
    input.cpf,
    input.cns,
    input.category,
    input.cboCode,
    input.cboName,
    input.councilType,
    input.councilNumber,
    input.councilUf,
    input.councilExpiresAt,
    input.specialty,
    input.email,
    input.phone,
    id
  )
  const row = db.prepare('SELECT * FROM professionals WHERE id = ?').get(id) as Row
  logAudit({ action: 'update', entity: 'professional', entityId: id })
  return toModel(row)
}

export function setProfessionalActive(id: number, active: boolean): void {
  getDb()
    .prepare('UPDATE professionals SET active = ? WHERE id = ?')
    .run(active ? 1 : 0, id)
  logAudit({
    action: active ? 'activate' : 'deactivate',
    entity: 'professional',
    entityId: id
  })
}
