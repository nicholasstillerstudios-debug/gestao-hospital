/**
 * Atestados e declarações emitidos por profissional. Independentes de
 * consulta/internação — qualquer paciente pode receber.
 */
import { getDb } from '../db'
import { logAudit } from '../audit'
import { getCurrentUser } from '../session'
import type {
  Attestation,
  AttestationInput,
  AttestationKind,
  AttestationWithRefs,
  Sex
} from '@shared/types'

interface Row {
  id: number
  patient_id: number
  professional_id: number | null
  kind: AttestationKind
  days: number | null
  cid10: string | null
  start_date: string | null
  end_date: string | null
  body_text: string | null
  notes: string | null
  issued_at: string
  created_by_user_id: number | null
  created_at: string
}

interface RowWithRefs extends Row {
  patient_name: string
  patient_cpf: string | null
  patient_cns: string | null
  patient_birth_date: string | null
  patient_sex: string | null
  professional_name: string | null
  professional_council_type: string | null
  professional_council_number: string | null
  professional_council_uf: string | null
}

function toAtt(r: Row): Attestation {
  return {
    id: r.id,
    patientId: r.patient_id,
    professionalId: r.professional_id,
    kind: r.kind,
    days: r.days,
    cid10: r.cid10,
    startDate: r.start_date,
    endDate: r.end_date,
    bodyText: r.body_text,
    notes: r.notes,
    issuedAt: r.issued_at,
    createdByUserId: r.created_by_user_id,
    createdAt: r.created_at
  }
}

function toRefs(r: RowWithRefs): AttestationWithRefs {
  return {
    ...toAtt(r),
    patientName: r.patient_name,
    patientCpf: r.patient_cpf,
    patientCns: r.patient_cns,
    patientBirthDate: r.patient_birth_date,
    patientSex: r.patient_sex === 'M' || r.patient_sex === 'F' || r.patient_sex === 'O'
      ? (r.patient_sex as Sex)
      : null,
    professionalName: r.professional_name,
    professionalCouncilType: r.professional_council_type,
    professionalCouncilNumber: r.professional_council_number,
    professionalCouncilUf: r.professional_council_uf
  }
}

const SELECT = `
  SELECT a.*,
         pat.full_name AS patient_name,
         pat.cpf       AS patient_cpf,
         pat.cns       AS patient_cns,
         pat.birth_date AS patient_birth_date,
         pat.sex       AS patient_sex,
         prof.full_name AS professional_name,
         prof.council_type AS professional_council_type,
         prof.council_number AS professional_council_number,
         prof.council_uf AS professional_council_uf
    FROM attestations a
    JOIN patients pat ON pat.id = a.patient_id
    LEFT JOIN professionals prof ON prof.id = a.professional_id
`

export function list(limit = 100): AttestationWithRefs[] {
  const rows = getDb()
    .prepare(`${SELECT} ORDER BY a.issued_at DESC LIMIT ?`)
    .all(limit) as RowWithRefs[]
  return rows.map(toRefs)
}

export function listForPatient(patientId: number): AttestationWithRefs[] {
  const rows = getDb()
    .prepare(`${SELECT} WHERE a.patient_id = ? ORDER BY a.issued_at DESC`)
    .all(patientId) as RowWithRefs[]
  return rows.map(toRefs)
}

export function get(id: number): AttestationWithRefs | null {
  const row = getDb().prepare(`${SELECT} WHERE a.id = ?`).get(id) as RowWithRefs | undefined
  return row ? toRefs(row) : null
}

export function create(input: AttestationInput): AttestationWithRefs {
  const userId = getCurrentUser()?.id ?? null
  const r = getDb()
    .prepare(
      `INSERT INTO attestations
        (patient_id, professional_id, kind, days, cid10,
         start_date, end_date, body_text, notes, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.patientId,
      input.professionalId ?? null,
      input.kind,
      input.days ?? null,
      input.cid10 ?? null,
      input.startDate ?? null,
      input.endDate ?? null,
      input.bodyText ?? null,
      input.notes ?? null,
      userId
    )
  logAudit({ action: 'create', entity: 'attestation', entityId: Number(r.lastInsertRowid) })
  return get(Number(r.lastInsertRowid))!
}

export function remove(id: number): void {
  getDb().prepare('DELETE FROM attestations WHERE id = ?').run(id)
  logAudit({ action: 'delete', entity: 'attestation', entityId: id })
}
