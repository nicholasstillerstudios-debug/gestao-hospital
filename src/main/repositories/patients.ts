import { getDb } from '../db'
import { logAudit, listAuditByEntity } from '../audit'
import type { AnonymizeResult, Patient, PatientDataExport, PatientInput } from '@shared/types'
import { validatePatient } from '@shared/validators'
import { app } from 'electron'

function ensureValid(input: PatientInput): void {
  const errors = validatePatient({
    fullName: input.fullName,
    cpf: input.cpf,
    cns: input.cns,
    birthDate: input.birthDate
  })
  if (errors.length > 0) {
    const err = new Error(errors.map((e) => e.message).join(' ')) as Error & { code?: string }
    err.code = 'VALIDATION_ERROR'
    throw err
  }
}

interface Row {
  id: number
  full_name: string
  cpf: string | null
  cns: string | null
  birth_date: string
  sex: 'M' | 'F' | 'O'
  phone: string | null
  email: string | null
  mother_name: string | null
  race: string | null
  address_street: string | null
  address_number: string | null
  address_complement: string | null
  address_neighborhood: string | null
  address_city: string | null
  address_state: string | null
  address_zip: string | null
  address_ibge: string | null
  notes: string | null
  anonymized_at: string | null
  created_at: string
  updated_at: string
}

function toModel(row: Row): Patient {
  return {
    id: row.id,
    fullName: row.full_name,
    cpf: row.cpf,
    cns: row.cns,
    birthDate: row.birth_date,
    sex: row.sex,
    phone: row.phone,
    email: row.email,
    motherName: row.mother_name,
    race: row.race,
    addressStreet: row.address_street,
    addressNumber: row.address_number,
    addressComplement: row.address_complement,
    addressNeighborhood: row.address_neighborhood,
    addressCity: row.address_city,
    addressState: row.address_state,
    addressZip: row.address_zip,
    addressIbge: row.address_ibge,
    notes: row.notes,
    anonymizedAt: row.anonymized_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function normalize(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

export function listPatients(): Patient[] {
  return (getDb().prepare('SELECT * FROM patients ORDER BY full_name').all() as Row[]).map(toModel)
}

export function searchPatients(query: string, limit = 50): Patient[] {
  // CPF e CNS são armazenados como dígitos puros (sem formatação). Se o
  // usuário digitar "111.222.333-96" ou "111 222 333 96", removemos os
  // separadores para casar. A busca por nome continua com a string original.
  const raw = query.trim()
  const nameQ = `%${raw}%`
  const digitsOnly = raw.replace(/\D/g, '')
  const docQ = digitsOnly.length > 0 ? `%${digitsOnly}%` : nameQ
  const rows = getDb()
    .prepare(
      `SELECT * FROM patients
        WHERE full_name LIKE ? COLLATE NOCASE
           OR IFNULL(cpf, '') LIKE ?
           OR IFNULL(cns, '') LIKE ?
        ORDER BY full_name
        LIMIT ?`
    )
    .all(nameQ, docQ, docQ, limit) as Row[]
  return rows.map(toModel)
}

export function getPatient(id: number): Patient | null {
  const row = getDb().prepare('SELECT * FROM patients WHERE id = ?').get(id) as Row | undefined
  return row ? toModel(row) : null
}

export function createPatient(input: PatientInput): Patient {
  ensureValid(input)
  const db = getDb()
  const result = db
    .prepare(
      `INSERT INTO patients (
        full_name, cpf, cns, birth_date, sex, phone, email, mother_name, race,
        address_street, address_number, address_complement, address_neighborhood,
        address_city, address_state, address_zip, address_ibge, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.fullName.trim(),
      normalize(input.cpf),
      normalize(input.cns),
      input.birthDate,
      input.sex,
      normalize(input.phone),
      normalize(input.email),
      normalize(input.motherName),
      normalize(input.race),
      normalize(input.addressStreet),
      normalize(input.addressNumber),
      normalize(input.addressComplement),
      normalize(input.addressNeighborhood),
      normalize(input.addressCity),
      normalize(input.addressState),
      normalize(input.addressZip),
      normalize(input.addressIbge),
      normalize(input.notes)
    )
  const row = db.prepare('SELECT * FROM patients WHERE id = ?').get(result.lastInsertRowid) as Row
  logAudit({
    action: 'create',
    entity: 'patient',
    entityId: row.id,
    details: { fullName: row.full_name }
  })
  return toModel(row)
}

export function updatePatient(id: number, input: PatientInput): Patient {
  ensureValid(input)
  const db = getDb()
  db.prepare(
    `UPDATE patients SET
       full_name = ?, cpf = ?, cns = ?, birth_date = ?, sex = ?,
       phone = ?, email = ?, mother_name = ?, race = ?,
       address_street = ?, address_number = ?, address_complement = ?,
       address_neighborhood = ?, address_city = ?, address_state = ?, address_zip = ?,
       address_ibge = ?, notes = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    input.fullName.trim(),
    normalize(input.cpf),
    normalize(input.cns),
    input.birthDate,
    input.sex,
    normalize(input.phone),
    normalize(input.email),
    normalize(input.motherName),
    normalize(input.race),
    normalize(input.addressStreet),
    normalize(input.addressNumber),
    normalize(input.addressComplement),
    normalize(input.addressNeighborhood),
    normalize(input.addressCity),
    normalize(input.addressState),
    normalize(input.addressZip),
    normalize(input.addressIbge),
    normalize(input.notes),
    id
  )
  const row = db.prepare('SELECT * FROM patients WHERE id = ?').get(id) as Row
  logAudit({
    action: 'update',
    entity: 'patient',
    entityId: id,
    details: { fullName: row.full_name }
  })
  return toModel(row)
}

export function deletePatient(id: number): void {
  getDb().prepare('DELETE FROM patients WHERE id = ?').run(id)
  logAudit({ action: 'delete', entity: 'patient', entityId: id })
}

/**
 * Coleta os dados pessoais associados ao paciente (cadastro e linhas de
 * auditoria que referenciam o paciente). Usado para cumprir o direito de
 * portabilidade da LGPD (art. 18, V).
 */
export function exportPatientData(id: number): PatientDataExport {
  const patient = getPatient(id)
  if (!patient) {
    const err = new Error('Paciente não encontrado.') as Error & { code?: string }
    err.code = 'NOT_FOUND'
    throw err
  }

  const auditLog = listAuditByEntity('patient', id)

  logAudit({
    action: 'export-data',
    entity: 'patient',
    entityId: id,
    details: {
      reason: 'lgpd-portability',
      counts: { auditLog: auditLog.length }
    }
  })

  return {
    exportedAt: new Date().toISOString(),
    source: { app: app.getName(), version: app.getVersion() },
    patient,
    auditLog
  }
}

const ANONYMIZED_PREFIX = 'Paciente anonimizado'

/**
 * Anonimiza permanentemente os dados pessoais do paciente, mantendo o registro
 * para preservar a integridade da auditoria e dos atendimentos já realizados.
 * Cancela agendamentos futuros e remove campos identificáveis (PII).
 */
export function anonymizePatient(id: number): AnonymizeResult {
  const existing = getPatient(id)
  if (!existing) {
    const err = new Error('Paciente não encontrado.') as Error & { code?: string }
    err.code = 'NOT_FOUND'
    throw err
  }
  if (existing.anonymizedAt) {
    const err = new Error('Paciente já foi anonimizado anteriormente.') as Error & { code?: string }
    err.code = 'ALREADY_ANONYMIZED'
    throw err
  }

  const db = getDb()
  const tx = db.transaction(() => {
    const cancelled = db
      .prepare(
        `UPDATE appointments
            SET status = 'cancelado', updated_at = datetime('now')
          WHERE patient_id = ? AND status IN ('agendado','aguardando')`
      )
      .run(id).changes

    db.prepare(
      `UPDATE patients SET
         full_name = ?,
         cpf = NULL,
         cns = NULL,
         phone = NULL,
         email = NULL,
         mother_name = NULL,
         address_street = NULL,
         address_number = NULL,
         address_complement = NULL,
         address_neighborhood = NULL,
         address_city = NULL,
         address_state = NULL,
         address_zip = NULL,
         address_ibge = NULL,
         notes = NULL,
         anonymized_at = datetime('now'),
         updated_at = datetime('now')
       WHERE id = ?`
    ).run(`${ANONYMIZED_PREFIX} #${id}`, id)

    return cancelled
  })

  const cancelledCount = tx() as number

  const updated = getPatient(id)!
  logAudit({
    action: 'anonymize',
    entity: 'patient',
    entityId: id,
    details: { appointmentsCancelled: cancelledCount }
  })

  return {
    patientId: id,
    anonymizedAt: updated.anonymizedAt!,
    appointmentsCancelled: cancelledCount
  }
}
