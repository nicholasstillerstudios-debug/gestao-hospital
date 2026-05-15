import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@renderer/lib/utils'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'
type Size = 'sm' | 'md' | 'lg'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const variants: Record<Variant, string> = {
  primary:
    'bg-[var(--color-ubs-primary)] text-white hover:bg-[var(--color-ubs-primary-dark)] disabled:bg-slate-400',
  secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200 disabled:bg-slate-50',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
  ghost: 'bg-transparent text-slate-700 hover:bg-slate-100',
  outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
}

const sizes: Record<Size, string> = {
  sm: 'text-xs px-2.5 py-1.5',
  md: 'text-sm px-3.5 py-2',
  lg: 'text-base px-5 py-2.5'
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...rest
}: Props): React.JSX.Element {
  return (
    <button
      type={type}
      {...rest}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ubs-primary)]/60 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
    />
  )
}
