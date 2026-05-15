import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader } from '@renderer/components/PageHeader'
import { Button } from '@renderer/components/ui/Button'
import { StatusBadge, TriageBadge } from '@renderer/components/ui/Badge'
import { CallPatientModal } from '@renderer/components/CallPatientModal'
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

export function QueuePage(): React.JSX.Element {
  const [queue, setQueue] = useState<AppointmentWithRefs[]>([])
  const [loading, setLoading] = useState(true)
  const [triageTarget, setTriageTarget] = useState<AppointmentWithRefs | null>(null)
  const [callTarget, setCallTarget] = useState<AppointmentWithRefs | null>(null)
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

  // Ordena por prioridade: cor > tempo de chegada
  const sorted = useMemo(() => {
    const order: Record<ManchesterColor, number> = {
      vermelho: 0,
      laranja: 1,
      amarelo: 2,
      verde: 3,
      azul: 4
    }
    return [...queue].sort((a, b) => {
      const ca = (a.triageColor ?? null) as ManchesterColor | null
      const cb = (b.triageColor ?? null) as ManchesterColor | null
      const da = ca ? order[ca] : 5
      const db = cb ? order[cb] : 5
      if (da !== db) return da - db
      return tsOf(a) - tsOf(b)
    })
  }, [queue])

  return (
    <>
      <PageHeader
        title="Fila de espera"
        subtitle="Pacientes aguardando — ordenados por prioridade Manchester e tempo de chegada"
        actions={
          <>
            <Button
              onClick={() => {
                void window.api.panel.open('/painel')
              }}
              title="Abre o painel público de chamada em uma janela em tela cheia"
              className="bg-cyan-700 text-white hover:bg-cyan-800"
            >
              Abrir painel de chamada
            </Button>
            <Button variant="outline" onClick={() => void load()}>
              Atualizar
            </Button>
          </>
        }
      />
      <section className="p-6">
        <div className="mb-4 flex items-start gap-2.5 rounded-md border border-cyan-200 bg-cyan-50 p-3 text-xs text-cyan-900">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mt-0.5 h-4 w-4 flex-none text-cyan-700"
            aria-hidden
          >
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
          <span>
            <strong>Dica:</strong> O botão verde &quot;Abrir painel de chamada&quot; abre uma tela
            cheia que você coloca em uma TV/monitor da recepção. Em cada paciente abaixo, use{' '}
            <strong>Triagem</strong> para classificar (Manchester), <strong>Chamar</strong> para
            anunciar no painel com voz, e <strong>Atender</strong> para iniciar a consulta.
          </span>
        </div>
        {loading ? (
          <div className="rounded-md bg-white p-6 text-center text-slate-500 shadow-sm">
            Carregando…
          </div>
        ) : sorted.length === 0 ? (
          <div className="rounded-md bg-white p-10 text-center text-slate-500 shadow-sm">
            Nenhum paciente aguardando no momento.
          </div>
        ) : (
          <ul className="space-y-3">
            {sorted.map((a, idx) => {
              const color = (a.triageColor ?? null) as ManchesterColor | null
              const wait = getWaitInfo(a, now)
              const borderClass = color ? COLOR_BORDER[color] : 'border-l-slate-300'
              const tintClass = color ? COLOR_TINT[color] : 'bg-white'
              return (
                <li
                  key={a.id}
                  className={`flex items-center gap-4 rounded-lg border border-slate-200 ${tintClass} p-4 shadow-sm border-l-4 ${borderClass}`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-slate-700 ring-1 ring-slate-200">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/pacientes/${a.patient.id}`}
                        className="text-base font-semibold text-slate-800 hover:text-cyan-700 hover:underline"
                        title="Abrir prontuário"
                      >
                        {a.patient.fullName}
                      </Link>
                      <TriageBadge color={a.triageColor} />
                      <StatusBadge status={a.status} />
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 tabular-nums ${STATUS_PILL[wait.status]}`}
                        title={wait.label}
                      >
                        {wait.elapsed} • {wait.label}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {a.professional.fullName}
                      {a.professional.specialty ? ` — ${a.professional.specialty}` : ''} • agendado{' '}
                      {formatDateTimeBr(a.scheduledAt)}
                      {a.checkedInAt ? ` • check-in ${formatDateTimeBr(a.checkedInAt)}` : ''}
                    </div>
                    {a.reason ? (
                      <div className="mt-1 truncate text-sm text-slate-700">Motivo: {a.reason}</div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTriageTarget(a)}
                      title="Classificar pelo protocolo de Manchester"
                    >
                      Triagem
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCallTarget(a)}
                      title="Anunciar este paciente no painel com voz"
                    >
                      Chamar
                    </Button>
                    <Button size="sm" onClick={() => navigate(`/atendimento/${a.id}`)}>
                      Atender
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
      {triageTarget ? (
        <TriageManchesterModal
          appointment={triageTarget}
          onClose={() => setTriageTarget(null)}
          onSaved={() => {
            setTriageTarget(null)
            void load()
          }}
        />
      ) : null}
      {callTarget ? (
        <CallPatientModal
          appointment={callTarget}
          onClose={() => setCallTarget(null)}
          onCalled={() => setCallTarget(null)}
        />
      ) : null}
    </>
  )
}
