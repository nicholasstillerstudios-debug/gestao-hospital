import { useEffect, useState } from 'react'
import { PageHeader } from '@renderer/components/PageHeader'
import { Button } from '@renderer/components/ui/Button'
import { Field, Input } from '@renderer/components/ui/Field'
import { todayIso } from '@renderer/lib/utils'
import type { ProductionReportRow } from '@shared/types'

function startOfMonthIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

function addDays(dateIso: string, days: number): string {
  const d = new Date(dateIso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function ReportsPage(): React.JSX.Element {
  const [start, setStart] = useState(startOfMonthIso())
  const [end, setEnd] = useState(todayIso())
  const [rows, setRows] = useState<ProductionReportRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const r = await window.api.reports.production(start, addDays(end, 1))
      setRows(r)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totals = rows.reduce(
    (acc, r) => {
      acc.admissions += r.totalAdmissions
      acc.discharges += r.totalDischarges
      return acc
    },
    { admissions: 0, discharges: 0 }
  )

  return (
    <>
      <PageHeader
        title="Relatórios"
        subtitle="Produção hospitalar por profissional no período selecionado"
        actions={
          <>
            <Field label="De">
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field label="Até">
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </Field>
            <Button onClick={() => void load()}>Atualizar</Button>
          </>
        }
      />
      <section className="space-y-4 p-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <SummaryCard label="Admissões" value={totals.admissions} />
          <SummaryCard label="Altas" value={totals.discharges} tone="success" />
        </div>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Profissional</th>
                <th className="px-4 py-2.5 font-semibold">Especialidade</th>
                <th className="px-4 py-2.5 font-semibold text-right">Admissões</th>
                <th className="px-4 py-2.5 font-semibold text-right">Altas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-slate-400">
                    Carregando…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-slate-400">
                    Sem dados para o período.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.professionalId} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{r.professionalName}</td>
                    <td className="px-4 py-2.5 text-slate-600">{r.specialty ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right">{r.totalAdmissions}</td>
                    <td className="px-4 py-2.5 text-right text-emerald-700">{r.totalDischarges}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {error ? (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
            {error}
          </div>
        ) : null}
      </section>
    </>
  )
}

function SummaryCard({
  label,
  value,
  tone = 'default'
}: {
  label: string
  value: number
  tone?: 'default' | 'success' | 'warn' | 'danger'
}): React.JSX.Element {
  const tones: Record<typeof tone, string> = {
    default: 'text-slate-700',
    success: 'text-emerald-700',
    warn: 'text-amber-700',
    danger: 'text-rose-700'
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tones[tone]}`}>{value}</div>
    </div>
  )
}
