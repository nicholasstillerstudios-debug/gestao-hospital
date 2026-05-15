import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@renderer/components/PageHeader'
import { useAuth } from '@renderer/stores/auth'
import { todayIso } from '@renderer/lib/utils'
import type { DashboardStats } from '@shared/types'

interface Card {
  label: string
  value: number
  hint?: string
  tone?: 'default' | 'accent' | 'warn' | 'danger'
  to?: string
}

const toneClasses: Record<NonNullable<Card['tone']>, string> = {
  default: 'bg-white text-slate-800',
  accent: 'bg-[var(--color-ubs-primary)]/5 text-[var(--color-ubs-primary-dark)]',
  warn: 'bg-amber-50 text-amber-800',
  danger: 'bg-rose-50 text-rose-800'
}

export function DashboardPage(): React.JSX.Element {
  const user = useAuth((s) => s.user)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      try {
        const result = await window.api.reports.dashboard(todayIso())
        if (!cancelled) setStats(result)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    const t = setInterval(() => void load(), 30_000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [])

  const cards: Card[] = [
    {
      label: 'Pacientes cadastrados',
      value: stats?.patientsCount ?? 0,
      tone: 'default',
      to: '/pacientes'
    },
    {
      label: 'Profissionais ativos',
      value: stats?.professionalsActive ?? 0,
      tone: 'default'
    },
    {
      label: 'Internações ativas',
      value: stats?.activeAdmissions ?? 0,
      tone: 'accent',
      to: '/internacoes'
    },
    {
      label: 'Leitos livres',
      value: stats?.freeBeds ?? 0,
      hint:
        stats != null && stats.totalBeds > 0
          ? `de ${stats.totalBeds} leitos cadastrados`
          : undefined,
      tone: 'default',
      to: '/leitos'
    }
  ]

  return (
    <>
      <PageHeader
        title={`Olá, ${user?.fullName.split(' ')[0]}`}
        subtitle="Resumo operacional do hospital"
      />
      <section className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => {
          const content = (
            <div
              className={`rounded-xl border border-slate-200 p-5 shadow-sm transition hover:shadow ${toneClasses[c.tone ?? 'default']}`}
            >
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {c.label}
              </div>
              <div className="mt-2 text-3xl font-semibold">{loading ? '…' : c.value}</div>
              {c.hint ? <div className="mt-1 text-xs text-slate-500">{c.hint}</div> : null}
            </div>
          )
          return c.to ? (
            <Link key={c.label} to={c.to}>
              {content}
            </Link>
          ) : (
            <div key={c.label}>{content}</div>
          )
        })}
      </section>
    </>
  )
}
