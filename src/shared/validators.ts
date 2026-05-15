/**
 * Validadores compartilhados entre main e renderer.
 * Sem dependências nativas — pode ser chamado dos dois lados.
 */

/** Remove tudo que não é dígito. */
export function onlyDigits(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '')
}

/**
 * Valida CPF pelos dois dígitos verificadores (algoritmo oficial da Receita Federal).
 * Rejeita sequências com todos os dígitos iguais (ex.: 111.111.111-11) e
 * tamanhos diferentes de 11 dígitos. Aceita a entrada com ou sem máscara.
 */
export function isValidCpf(value: string | null | undefined): boolean {
  const digits = onlyDigits(value)
  if (digits.length !== 11) return false
  if (/^(\d)\1{10}$/.test(digits)) return false

  const calc = (slice: string, factor: number): number => {
    let sum = 0
    for (let i = 0; i < slice.length; i++) {
      sum += Number(slice.charAt(i)) * (factor - i)
    }
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }

  const d1 = calc(digits.slice(0, 9), 10)
  if (d1 !== Number(digits.charAt(9))) return false
  const d2 = calc(digits.slice(0, 10), 11)
  if (d2 !== Number(digits.charAt(10))) return false
  return true
}

/**
 * Valida CNS (Cartão Nacional de Saúde) usando o algoritmo oficial do DATASUS.
 * Regras diferentes para CNS iniciando em 1/2 (definitivo) e 7/8/9 (provisório).
 */
export function isValidCns(value: string | null | undefined): boolean {
  const digits = onlyDigits(value)
  if (digits.length !== 15) return false
  const first = digits.charAt(0)
  let sum = 0
  for (let i = 0; i < 15; i++) {
    sum += Number(digits.charAt(i)) * (15 - i)
  }
  if (first === '1' || first === '2') {
    return sum % 11 === 0
  }
  if (first === '7' || first === '8' || first === '9') {
    return sum % 11 === 0
  }
  return false
}

/** Retorna true se `iso` for uma data yyyy-MM-dd válida e não futura. */
export function isValidBirthDate(iso: string | null | undefined, now: Date = new Date()): boolean {
  if (!iso) return false
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return false
  const [, yStr, mStr, dStr] = match
  const y = Number(yStr)
  const m = Number(mStr)
  const d = Number(dStr)
  if (y < 1900 || m < 1 || m > 12 || d < 1 || d > 31) return false
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return false
  }
  // Não permite data no futuro (comparação em UTC para ser determinística)
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  if (date.getTime() > today.getTime()) return false
  return true
}

export interface PatientValidationInput {
  fullName: string
  cpf?: string | null
  cns?: string | null
  birthDate: string
}

export interface ValidationError {
  field: string
  message: string
}

/**
 * Valida os campos-chave de um paciente. Retorna lista vazia quando tudo ok.
 * CPF e CNS são opcionais — mas se informados, precisam ser válidos.
 */
export function validatePatient(input: PatientValidationInput): ValidationError[] {
  const errors: ValidationError[] = []
  if (!input.fullName || input.fullName.trim().length < 3) {
    errors.push({ field: 'fullName', message: 'Informe o nome completo (mínimo 3 caracteres).' })
  }
  if (!isValidBirthDate(input.birthDate)) {
    errors.push({
      field: 'birthDate',
      message: 'Data de nascimento inválida ou no futuro.'
    })
  }
  if (input.cpf && input.cpf.trim() !== '' && !isValidCpf(input.cpf)) {
    errors.push({ field: 'cpf', message: 'CPF inválido.' })
  }
  if (input.cns && input.cns.trim() !== '' && !isValidCns(input.cns)) {
    errors.push({ field: 'cns', message: 'CNS inválido.' })
  }
  return errors
}
