import { describe, it, expect } from 'vitest'
import {
  ageFromBirthDate,
  buildLocalIso,
  formatCpf,
  formatDateBr,
  formatDateTimeBr
} from '../src/renderer/src/lib/utils'

describe('formatCpf', () => {
  it('formata CPFs com 11 dígitos', () => {
    expect(formatCpf('12345678909')).toBe('123.456.789-09')
    expect(formatCpf('123.456.789-09')).toBe('123.456.789-09')
  })

  it('retorna os dígitos sem máscara se incompleto', () => {
    expect(formatCpf('12345')).toBe('12345')
  })

  it('trata nulo/vazio', () => {
    expect(formatCpf('')).toBe('')
    expect(formatCpf(null)).toBe('')
    expect(formatCpf(undefined)).toBe('')
  })
})

describe('formatDateBr', () => {
  it('converte ISO yyyy-MM-dd para dd/MM/yyyy', () => {
    expect(formatDateBr('1985-03-12')).toBe('12/03/1985')
    expect(formatDateBr('2026-04-24T09:00:00')).toBe('24/04/2026')
  })

  it('retorna string vazia para entradas nulas', () => {
    expect(formatDateBr(null)).toBe('')
    expect(formatDateBr(undefined)).toBe('')
    expect(formatDateBr('')).toBe('')
  })
})

describe('formatDateTimeBr', () => {
  it('retorna a data e hora formatadas em pt-BR', () => {
    const formatted = formatDateTimeBr('2026-04-24T09:00:00')
    expect(formatted).toMatch(/24\/04\/2026/)
    expect(formatted).toMatch(/09:00/)
  })
})

describe('ageFromBirthDate', () => {
  it('calcula idade considerando se o aniversário já passou no ano', () => {
    // Stub Date.now via mock no teste unitário é complexo; usamos casos reais
    const now = new Date()
    const thisYear = now.getFullYear()
    // Aniversário de 30 anos "exatamente hoje"
    const iso = `${thisYear - 30}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    expect(ageFromBirthDate(iso)).toBe(30)
  })

  it('retorna null para input vazio/inválido', () => {
    expect(ageFromBirthDate(null)).toBeNull()
    expect(ageFromBirthDate(undefined)).toBeNull()
    expect(ageFromBirthDate('abc')).toBeNull()
  })
})

describe('buildLocalIso', () => {
  it('combina data e hora em ISO sem fuso', () => {
    expect(buildLocalIso('2026-04-24', '09:00')).toBe('2026-04-24T09:00:00')
  })
})
