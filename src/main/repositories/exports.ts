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

