import { cn } from '@renderer/lib/utils'

type StepTone = 'cyan' | 'amber' | 'emerald' | 'violet' | 'slate'

export interface FlowStep {
  title: string
  description: string
  tone?: StepTone
  icon?: React.ReactNode
}

const TONE_NUMBER: Record<StepTone, string> = {
  cyan: 'bg-cyan-600 text-white',
  amber: 'bg-amber-500 text-white',
  emerald: 'bg-emerald-600 text-white',
  violet: 'bg-violet-600 text-white',
  slate: 'bg-slate-500 text-white'
}

const TONE_BAR: Record<StepTone, string> = {
  cyan: 'bg-cyan-200',
  amber: 'bg-amber-200',
  emerald: 'bg-emerald-200',
  violet: 'bg-violet-200',
  slate: 'bg-slate-200'
}

/**
 * Banner de fluxo com etapas numeradas em cards. Substitui blocos densos
 * de texto explicativo por uma sequência visual fácil de escanear.
 */
export function FlowSteps({
  title,
  steps,
  className
}: {
  title?: string
  steps: FlowStep[]
  className?: string
}): React.JSX.Element {
  return (
    <section
      className={cn('rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5', className)}
      aria-label={title ?? 'Fluxo do módulo'}
    >
      {title ? (
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-600">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 text-cyan-600"
            aria-hidden
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          {title}
        </h3>
      ) : null}
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" role="list">
        {steps.map((step, idx) => {
          const tone = step.tone ?? 'cyan'
          const isLast = idx === steps.length - 1
          return (
            <li key={idx} className="relative rounded-lg bg-slate-50/70 p-3 ring-1 ring-slate-200">
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    'flex h-7 w-7 flex-none items-center justify-center rounded-full text-xs font-bold shadow-sm',
                    TONE_NUMBER[tone]
                  )}
                  aria-hidden
                >
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {step.icon ? (
                      <span className="text-slate-500" aria-hidden>
                        {step.icon}
                      </span>
                    ) : null}
                    <p className="text-sm font-semibold text-slate-800">{step.title}</p>
                  </div>
                  <p className="mt-0.5 text-xs leading-snug text-slate-600">{step.description}</p>
                </div>
              </div>
              {!isLast ? (
                <span
                  className={cn(
                    'pointer-events-none absolute right-0 top-1/2 hidden h-0.5 w-3 -translate-y-1/2 translate-x-full lg:block',
                    TONE_BAR[tone]
                  )}
                  aria-hidden
                />
              ) : null}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/**
 * Header de seção usado nas páginas de fluxo (Recepção, Triagem) — substitui
 * o `h2 + badge` solto por um cabeçalho estruturado com cor temática.
 */
export function SectionHeader({
  title,
  count,
  tone = 'slate',
  hint,
  description
}: {
  title: string
  count?: number
  tone?: StepTone
  hint?: string
  description?: string
}): React.JSX.Element {
  return (
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
      <div className="flex items-center gap-2">
        <span
          className={cn('inline-block h-2.5 w-2.5 flex-none rounded-full', TONE_BAR[tone])}
          aria-hidden
        />
        <h2 className="text-base font-semibold text-slate-800">{title}</h2>
        {typeof count === 'number' ? (
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-bold ring-1 ring-inset',
              tone === 'cyan'
                ? 'bg-cyan-50 text-cyan-700 ring-cyan-200'
                : tone === 'amber'
                  ? 'bg-amber-50 text-amber-700 ring-amber-200'
                  : tone === 'emerald'
                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                    : tone === 'violet'
                      ? 'bg-violet-50 text-violet-700 ring-violet-200'
                      : 'bg-slate-100 text-slate-600 ring-slate-200'
            )}
          >
            {count}
          </span>
        ) : null}
        {description ? <span className="text-xs text-slate-500">{description}</span> : null}
      </div>
      {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
    </header>
  )
}
