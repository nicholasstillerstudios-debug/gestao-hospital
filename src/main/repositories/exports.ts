import { getDb } from '../db'
import { logAudit } from '../audit'

/**
 * Quoting CSV no padrão RFC 4180 + BOM UTF-8 no início pra Excel BR.
 *
 * Mitigação de CSV/formula injection: células que começam com `=`, `+`, `-`,
 * `@`, TAB ou CR são prefixadas com aspa simples para que o Excel as trate
 * como texto e não como fórmula (ex.: nome "=cmd|...").
 */
function csvCell(value: string | number | null | undefined): string {
  if (value == null) return ''
  const isNumber = typeof value === 'number'
  let str = String(value)
  // Não prefixa números (ex.: -5 deve continuar sendo -5, não '-5).
  if (!isNumber && str.length > 0 && /^[=+\-@\t\r]/.test(str)) {
    str = "'" + str
  }
  if (/[",\n;]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

function csvLine(cells: Array<string | number | null | undefined>): string {
  return cells.map(csvCell).join(';')
}

export function exportPatientsCsv(): string {
  const rows = getDb()
    .prepare(
      `SELECT id, full_name, cpf, cns, birth_date, sex, phone, email, mother_name,
              address_street, address_number, address_complement,
              address_neighborhood, address_city, address_state, address_zip,
              anonymized_at, created_at
       FROM patients
       ORDER BY full_name COLLATE NOCASE`
    )
    .all() as Array<Record<string, string | number | null>>

  const header = csvLine([
    'id',
    'nome',
    'cpf',
    'cns',
    'data_nascimento',
    'sexo',
    'telefone',
    'email',
    'mae',
    'logradouro',
    'numero',
    'complemento',
    'bairro',
    'municipio',
    'uf',
    'cep',
    'anonimizado_em',
    'cadastrado_em'
  ])

  const lines = rows.map((r) =>
    csvLine([
      r.id,
      r.full_name,
      r.cpf,
      r.cns,
      r.birth_date,
      r.sex,
      r.phone,
      r.email,
      r.mother_name,
      r.address_street,
      r.address_number,
      r.address_complement,
      r.address_neighborhood,
      r.address_city,
      r.address_state,
      r.address_zip,
      r.anonymized_at,
      r.created_at
    ])
  )

  logAudit({ action: 'export', entity: 'patient', details: { count: rows.length, format: 'csv' } })
  return '\ufeff' + [header, ...lines].join('\r\n') + '\r\n'
}

export function exportAppointmentsCsv(startIso: string, endIso: string): string {
  const rows = getDb()
    .prepare(
      `SELECT a.id, a.scheduled_at, a.duration_min, a.status,
              p.full_name AS patient_name, p.cpf AS patient_cpf, p.cns AS patient_cns,
              pr.full_name AS professional_name, pr.specialty AS professional_specialty,
              a.reason, a.triage_color, a.checked_in_at, a.started_at, a.ended_at,
              a.created_at
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       JOIN professionals pr ON pr.id = a.professional_id
       WHERE date(a.scheduled_at) >= date(?) AND date(a.scheduled_at) <= date(?)
       ORDER BY a.scheduled_at`
    )
    .all(startIso, endIso) as Array<Record<string, string | number | null>>

  const header = csvLine([
    'id',
    'data_hora',
    'duracao_min',
    'status',
    'paciente',
    'paciente_cpf',
    'paciente_cns',
    'profissional',
    'especialidade',
    'motivo',
    'triagem',
    'check_in',
    'iniciado_em',
    'encerrado_em',
    'criado_em'
  ])

  const lines = rows.map((r) =>
    csvLine([
      r.id,
      r.scheduled_at,
      r.duration_min,
      r.status,
      r.patient_name,
      r.patient_cpf,
      r.patient_cns,
      r.professional_name,
      r.professional_specialty,
      r.reason,
      r.triage_color,
      r.checked_in_at,
      r.started_at,
      r.ended_at,
      r.created_at
    ])
  )

  logAudit({
    action: 'export',
    entity: 'appointment',
    details: { count: rows.length, format: 'csv', startIso, endIso }
  })
  return '\ufeff' + [header, ...lines].join('\r\n') + '\r\n'
}

