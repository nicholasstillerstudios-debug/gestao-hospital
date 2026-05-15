import { cn } from '@renderer/lib/utils'
import type { AdmissionStatus } from '@shared/types'

const admissionStyles: Record<AdmissionStatus, string> = {
  ativa: 'bg-emerald-100 text-emerald-800',
  alta: 'bg-sky-100 text-sky-800',
  obito: 'bg-slate-300 text-slate-800',
  transferencia: 'bg-indigo-100 text-indigo-800',
  evasao: 'bg-rose-100 text-rose-800'
}

/**
 * Badge genérico para status. Aceita uma chave conhecida de internação
 * (mapeada para cor) ou um texto livre (com estilo neutro).
 */
export function StatusBadge({ status }: { status: AdmissionStatus | string }): React.JSX.Element {
  const known = (status as AdmissionStatus) in admissionStyles
  const className = known
    ? admissionStyles[status as AdmissionStatus]
    : 'bg-slate-100 text-slate-700'
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        className
      )}
    >
      {status}
    </span>
  )
}
