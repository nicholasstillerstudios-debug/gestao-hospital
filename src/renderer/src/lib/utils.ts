import type { UserRole } from '@shared/types'

export function cn(...args: Array<string | false | null | undefined>): string {
  return args.filter(Boolean).join(' ')
}

export function formatCpf(value: string | null | undefined): string {
  if (!value) return ''
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length !== 11) return digits
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

export function formatCns(value: string | null | undefined): string {
  if (!value) return ''
  const digits = value.replace(/\D/g, '').slice(0, 15)
  if (digits.length !== 15) return digits
  return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7, 11)} ${digits.slice(11)}`
}

export function formatDateBr(iso: string | null | undefined): string {
  if (!iso) return ''
  // Accept YYYY-MM-DD or ISO datetime
  const dateOnly = iso.length >= 10 ? iso.slice(0, 10) : iso
  const [y, m, d] = dateOnly.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

export function formatDateTimeBr(iso: string | null | undefined): string {
  if (!iso) return ''
  const normalized = iso.replace(' ', 'T')
  const date = new Date(
    normalized.endsWith('Z')
      ? normalized
      : normalized + (normalized.includes('T') ? '' : 'T00:00:00')
  )
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function todayIso(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function ageFromBirthDate(iso: string | null | undefined): number | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - date.getFullYear()
  const mDiff = now.getMonth() - date.getMonth()
  if (mDiff < 0 || (mDiff === 0 && now.getDate() < date.getDate())) age--
  return age
}

import { USER_ROLE_LABELS } from '@shared/types'

export function roleLabel(role: UserRole): string {
  return USER_ROLE_LABELS[role] ?? String(role)
}

/**
 * Constrói um ISO "yyyy-MM-ddTHH:mm:00" tratando o input como horário local.
 * É o formato aceito por `datetime('now')` / SQLite quando comparado com `date()`.
 */
export function buildLocalIso(dateIso: string, time: string): string {
  return `${dateIso}T${time}:00`
}
