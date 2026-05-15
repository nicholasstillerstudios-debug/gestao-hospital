import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '@renderer/lib/utils'

interface FieldProps {
  label: React.ReactNode
  hint?: string
  error?: string
  required?: boolean
  className?: string
  children: React.ReactNode
}

export function Field({
  label,
  hint,
  error,
  required,
  className,
  children
}: FieldProps): React.JSX.Element {
  return (
    <label className={cn('flex flex-col gap-1 text-sm', className)}>
      <span className="font-medium text-slate-700">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      {children}
      {error ? (
        <span className="text-xs text-red-600">{error}</span>
      ) : hint ? (
        <span className="text-xs text-slate-500">{hint}</span>
      ) : null}
    </label>
  )
}

const inputBase =
  'rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-[var(--color-ubs-primary)] focus:ring-2 focus:ring-[var(--color-ubs-primary)]/30 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500'

export function Input({
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement>): React.JSX.Element {
  return <input {...rest} className={cn(inputBase, className)} />
}

export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>): React.JSX.Element {
  return (
    <select {...rest} className={cn(inputBase, 'pr-8', className)}>
      {children}
    </select>
  )
}

export function Textarea({
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>): React.JSX.Element {
  return <textarea {...rest} className={cn(inputBase, 'min-h-20 resize-y', className)} />
}
