import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@renderer/components/PageHeader'
import { Button } from '@renderer/components/ui/Button'
import { TriageBadge } from '@renderer/components/ui/Badge'
import { FlowSteps, SectionHeader } from '@renderer/components/ui/FlowSteps'
import { FlowIcons } from '@renderer/components/ui/flowIcons'
import { TriageManchesterModal } from '@renderer/components/TriageManchesterModal'
import { formatDateTimeBr, todayIso } from '@renderer/lib/utils'
import { MANCHESTER_TARGETS, type ManchesterColor } from '@shared/manchester'
import type { AppointmentWithRefs } from '@shared/types'

const COLOR_BORDER: Record<ManchesterColor, string> = {
  vermelho: 'border-l-red-600',
  laranja: 'border-l-orange-500',
  amarelo: 'border-l-yellow-400',
  verde: 'border-l-emerald-500',
  azul: 'border-l-sky-500'
}

const COLOR_TINT: Record<ManchesterColor, string> = {
  vermelho: 'bg-red-50',
  laranja: 'bg-orange-50',
  amarelo: 'bg-yellow-50',
  verde: 'bg-emerald-50',
  azul: 'bg-sky-50'
}

function tsOf(a: AppointmentWithRefs): number {
  return Date.parse(a.checkedInAt ?? a.scheduledAt)
}

function formatElapsed(ms: number): string {
  if (ms < 0) ms = 0
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  if (m < 60) return `${m}m ${s.toString().padStart(2, '0')}s`
  const h = Math.floor(m / 60)
  return `${h}h ${(m % 60).toString().padStart(2, '0')}m`
}

interface WaitInfo {
  elapsed: string
  status: 'na' | 'ok' | 'warning' | 'overdue'
  label: string
}

function getWaitInfo(a: AppointmentWithRefs, now: number): WaitInfo {
  const ts = tsOf(a)
  const elapsedMs = now - ts
  const color = (a.triageColor ?? null) as ManchesterColor | null
  if (!color) return { elapsed: formatElapsed(elapsedMs), status: 'na', label: 'Sem triagem' }
  const target = MANCHESTER_TARGETS[color]
  if (target.minutes === 0)
    return { elapsed: formatElapsed(elapsedMs), status: 'overdue', label: 'Imediato' }
  const ratio = elapsedMs / (target.minutes * 60 * 1000)
  let status: WaitInfo['status'] = 'ok'
  if (ratio >= 1) status = 'overdue'
  else if (ratio >= 0.75) status = 'warning'
  return {
    elapsed: formatElapsed(elapsedMs),
    status,
    label: `Alvo: ${target.minutes} min`
  }
}

const STATUS_PILL: Record<WaitInfo['status'], string> = {
  na: 'bg-slate-100 text-slate-600 ring-slate-200',
  ok: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  overdue: 'bg-red-50 text-red-700 ring-red-200'
}

export function TriagePage(): React.JSX.Element {
  const [queue, setQueue] = useState<AppointmentWithRefs[]>([])
  const [loading, setLoading] = useState(true)
  const [target, setTarget] = useState<AppointmentWithRefs | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const navigate = useNavigate()

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const r = await window.api.appointments.queue(todayIso())
      setQueue(r)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const refresh = setInterval(() => void load(), 15_000)
    const tick = setInterval(() => setNow(Date.now()), 1_000)
    return () => {
      clearInterval(refresh)
      clearInterval(tick)
    }
  }, [load])

  const { pending, triaged } = useMemo(() => {
    const pendingArr = queue.filter((a) => !a.triageColor)
    const triagedArr = queue.filter((a) => !!a.triageColor)
    pendingArr.sort((a, b) => tsOf(a) - tsOf(b))
    const order: Record<ManchesterColor, number> = {
      vermelho: 0,
      laranja: 1,
      amarelo: 2,
      verde: 3,
      azul: 4
    }
    triagedArr.sort((a, b) => {
      const ca = a.triageColor as ManchesterColor
      const cb = b.triageColor as ManchesterColor
      const da = order[ca] ?? 99
      const db = order[cb] ?? 99
      if (da !== db) return da - db
      return tsOf(a) - tsOf(b)
    })
    return { pending: pendingArr, triaged: triagedArr }
  }, [queue])

  return (
    <>
      <PageHeader
        title="Triagem (Manchester)"
        subtitle="Classifique cada paciente em 4 passos guiados — vitais, queixa, discriminadores e cor final"
        actions={
          <>
            <Button variant="outline" onClick={() => navigate('/fila')}>
              Ver fila completa
            </Button>
            <Button variant="outline" onClick={() => void load()}>
              Atualizar
            </Button>
          </>
        }
      />
      <section className="p-6 space-y-6">
        <FlowSteps
          title="Como funciona a triagem Manchester"
          steps={[
            {
              title: 'Check-in',
              description: 'Paciente faz check-in na Recepção e entra na fila da enfermagem.',
              tone: 'cyan',
              icon: FlowIcons.arrival
            },
            {
              title: 'Aguardando triagem',
              description: 'Aparece logo abaixo. Enfermagem abre clicando em Triar agora.',
              tone: 'amber',
              icon: FlowIcons.triage
            },
            {
              title: '4 passos guiados',
              description: 'Vitais → queixa → discriminadores → resumo com cor sugerida.',
              tone: 'violet',
              icon: FlowIcons.classify
            },
            {
              title: 'Cronômetro Manchester',
              description: 'Vermelho 0min · laranja 10 · amarelo 60 · verde 120 · azul 240.',
              tone: 'emerald',
              icon: FlowIcons.queue
            },
            {
              title: 'Fila por prioridade',
              description: 'Após salvar, paciente entra na Fila ordenada da urgência maior.',
              tone: 'emerald',
              icon: FlowIcons.attend
            }
          ]}
        />

        {/* Aguardando triagem */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <SectionHeader
            title="Aguardando triagem"
            count={pending.length}
            tone="amber"
            hint="Pacientes com check-in hoje sem cor Manchester definida"
          />
          <div className="mt-3">
            {loading ? (
              <div className="rounded-md bg-slate-50 p-6 text-center text-sm text-slate-500">
                Carregando…
              </div>
            ) : pending.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-300 bg-slate-50/40 p-8 text-center text-sm text-slate-500">
                Nenhum paciente aguardando triagem.
              </div>
            ) : (
              <ul className="space-y-3">
                {pending.map((a) => {
                  const wait = getWaitInfo(a, now)
                  return (
                    <li
                      key={a.id}
                      className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50/40 p-4 shadow-sm border-l-4 border-l-amber-400 sm:flex-row sm:items-center"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-semibold text-slate-800">
                            {a.patient.fullName}
                          </span>
                          <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                            Sem triagem
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 tabular-nums ${STATUS_PILL[wait.status]}`}
                          >
                            aguardando há {wait.elapsed}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {a.professional.fullName}
                          {a.professional.specialty ? ` — ${a.professional.specialty}` : ''} •
                          check-in {formatDateTimeBr(a.checkedInAt ?? a.scheduledAt)}
                        </div>
                        {a.reason ? (
                          <div className="mt-1 truncate text-sm text-slate-700">
                            Motivo: {a.reason}
                          </div>
                        ) : null}
                      </div>
                      <Button
                        onClick={() => setTarget(a)}
                        className="shrink-0 bg-cyan-700 text-white hover:bg-cyan-800"
                        size="md"
                      >
                        Triar agora
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Já triados */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <SectionHeader
            title="Já triados hoje"
            count={triaged.length}
            tone="emerald"
            hint="Ordenados por prioridade Manchester (vermelho → azul)"
          />
          <div className="mt-3">
            {triaged.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-300 bg-slate-50/40 p-8 text-center text-sm text-slate-500">
                Ninguém triado ainda hoje.
              </div>
            ) : (
              <ul className="space-y-3">
                {triaged.map((a) => {
                  const color = a.triageColor as ManchesterColor
                  const wait = getWaitInfo(a, now)
                  return (
                    <li
                      key={a.id}
                      className={`flex flex-col gap-3 rounded-lg border border-slate-200 ${COLOR_TINT[color]} p-4 shadow-sm border-l-4 ${COLOR_BORDER[color]} sm:flex-row sm:items-center`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-semibold text-slate-800">
                            {a.patient.fullName}
                          </span>
                          <TriageBadge color={a.triageColor} />
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 tabular-nums ${STATUS_PILL[wait.status]}`}
                            title={wait.label}
                          >
                            {wait.elapsed} • {wait.label}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {a.professional.fullName}
                          {a.professional.specialty ? ` — ${a.professional.specialty}` : ''}
                        </div>
                        {a.reason ? (
                          <div className="mt-1 truncate text-sm text-slate-700">
                            Motivo: {a.reason}
                          </div>
                        ) : null}
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setTarget(a)}>
                        Re-triar
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </section>
      {target ? (
        <TriageManchesterModal
          appointment={target}
          onClose={() => setTarget(null)}
          onSaved={() => {
            setTarget(null)
            void load()
          }}
        />
      ) : null}
    </>
  )
}
