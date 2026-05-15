import { describe, it, expect } from 'vitest'
import {
  isValidBirthDate,
  isValidCns,
  isValidCpf,
  onlyDigits,
  validatePatient
} from '../src/shared/validators'

describe('onlyDigits', () => {
  it('remove tudo que não é dígito', () => {
    expect(onlyDigits('123.456.789-09')).toBe('12345678909')
    expect(onlyDigits('  abc 42 ')).toBe('42')
    expect(onlyDigits('')).toBe('')
    expect(onlyDigits(null)).toBe('')
    expect(onlyDigits(undefined)).toBe('')
  })
})

describe('isValidCpf', () => {
  it('aceita CPFs válidos (com e sem máscara)', () => {
    expect(isValidCpf('12345678909')).toBe(true)
    expect(isValidCpf('123.456.789-09')).toBe(true)
    // CPFs válidos gerados com a mesma fórmula
    expect(isValidCpf('529.982.247-25')).toBe(true)
  })

  it('rejeita CPFs com dígitos verificadores errados', () => {
    expect(isValidCpf('12345678900')).toBe(false)
    expect(isValidCpf('123.456.789-08')).toBe(false)
  })

  it('rejeita sequências de dígitos repetidos', () => {
    expect(isValidCpf('00000000000')).toBe(false)
    expect(isValidCpf('11111111111')).toBe(false)
    expect(isValidCpf('99999999999')).toBe(false)
  })

  it('rejeita comprimento diferente de 11', () => {
    expect(isValidCpf('123')).toBe(false)
    expect(isValidCpf('123456789091234')).toBe(false)
    expect(isValidCpf('')).toBe(false)
    expect(isValidCpf(null)).toBe(false)
    expect(isValidCpf(undefined)).toBe(false)
  })
})

/**
 * Gera um CNS válido de prefixo 7/8/9 (a soma ponderada precisa ser
 * divisível por 11). Preenchemos os 14 primeiros dígitos e ajustamos
 * o último para zerar o resto da soma mod 11.
 */
function buildValidCns(prefix: '7' | '8' | '9', middle: string): string {
  if (middle.length !== 13) throw new Error('middle deve ter 13 dígitos')
  const base = prefix + middle
  let sum = 0
  for (let i = 0; i < 14; i++) sum += Number(base.charAt(i)) * (15 - i)
  const last = (11 - (sum % 11)) % 11
  if (last === 10) {
    // Caso 10 não caiba em 1 dígito, ajuste o penúltimo e recalcule — para
    // os testes é suficiente escolher middle onde isso não acontece.
    throw new Error('escolha outro middle')
  }
  return base + String(last)
}

describe('isValidCns', () => {
  it('aceita CNS provisório (prefixo 8) com dígito verificador correto', () => {
    const cns = buildValidCns('8', '1234567890123')
    expect(cns).toHaveLength(15)
    expect(isValidCns(cns)).toBe(true)
  })

  it('rejeita CNS com comprimento inválido', () => {
    expect(isValidCns('12345')).toBe(false)
    expect(isValidCns('')).toBe(false)
    expect(isValidCns(null)).toBe(false)
  })

  it('rejeita CNS com prefixo inválido (3, 4, 5, 6, 0)', () => {
    expect(isValidCns('000000000000000')).toBe(false)
    expect(isValidCns('300000000000000')).toBe(false)
    expect(isValidCns('400000000000000')).toBe(false)
    expect(isValidCns('500000000000000')).toBe(false)
    expect(isValidCns('600000000000000')).toBe(false)
  })

  it('rejeita CNS com prefixo válido mas dígito verificador errado', () => {
    const cns = buildValidCns('8', '1234567890123')
    // Altera o último dígito para invalidar
    const broken = cns.slice(0, 14) + (cns.charAt(14) === '0' ? '1' : '0')
    expect(isValidCns(broken)).toBe(false)
  })
})

describe('isValidBirthDate', () => {
  const fixedNow = new Date('2026-04-24T12:00:00Z')

  it('aceita datas passadas válidas', () => {
    expect(isValidBirthDate('1985-03-12', fixedNow)).toBe(true)
    expect(isValidBirthDate('2000-01-01', fixedNow)).toBe(true)
    expect(isValidBirthDate('2026-04-23', fixedNow)).toBe(true)
  })

  it('rejeita datas no futuro', () => {
    expect(isValidBirthDate('2026-04-25', fixedNow)).toBe(false)
    expect(isValidBirthDate('2050-01-01', fixedNow)).toBe(false)
  })

  it('rejeita formato inválido', () => {
    expect(isValidBirthDate('12/03/1985', fixedNow)).toBe(false)
    expect(isValidBirthDate('1985-3-12', fixedNow)).toBe(false)
    expect(isValidBirthDate('', fixedNow)).toBe(false)
    expect(isValidBirthDate(null, fixedNow)).toBe(false)
  })

  it('rejeita datas impossíveis (mês/dia fora do range)', () => {
    expect(isValidBirthDate('1985-13-01', fixedNow)).toBe(false)
    expect(isValidBirthDate('1985-02-30', fixedNow)).toBe(false)
    expect(isValidBirthDate('1899-12-31', fixedNow)).toBe(false)
  })
})

describe('validatePatient', () => {
  it('retorna lista vazia quando paciente é válido', () => {
    const errors = validatePatient({
      fullName: 'Maria da Silva Souza',
      cpf: '12345678909',
      cns: null,
      birthDate: '1985-03-12'
    })
    expect(errors).toEqual([])
  })

  it('exige nome com pelo menos 3 caracteres', () => {
    const errors = validatePatient({
      fullName: 'Jo',
      cpf: null,
      cns: null,
      birthDate: '1985-03-12'
    })
    expect(errors).toHaveLength(1)
    expect(errors[0].field).toBe('fullName')
  })

  it('rejeita CPF inválido quando informado', () => {
    const errors = validatePatient({
      fullName: 'Maria',
      cpf: '11111111111',
      cns: null,
      birthDate: '1985-03-12'
    })
    expect(errors.some((e) => e.field === 'cpf')).toBe(true)
  })

  it('aceita CPF vazio/null', () => {
    const errors = validatePatient({
      fullName: 'Maria',
      cpf: '',
      cns: null,
      birthDate: '1985-03-12'
    })
    expect(errors).toEqual([])
  })

  it('rejeita data de nascimento inválida', () => {
    const errors = validatePatient({
      fullName: 'Maria',
      cpf: null,
      cns: null,
      birthDate: '2999-01-01'
    })
    expect(errors.some((e) => e.field === 'birthDate')).toBe(true)
  })
})
