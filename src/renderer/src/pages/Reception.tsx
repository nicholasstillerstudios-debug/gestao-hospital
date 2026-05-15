import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@renderer/components/PageHeader'
import { Button } from '@renderer/components/ui/Button'
import { Field, Input, Select } from '@renderer/components/ui/Field'
import { Modal } from '@renderer/components/ui/Modal'
import { StatusBadge, TriageBadge } from '@renderer/components/ui/Badge'
import { FlowSteps, SectionHeader } from '@renderer/components/ui/FlowSteps'
import { FlowIcons } from '@renderer/components/ui/flowIcons'
import { buildLocalIso, formatDateTimeBr, todayIso } from '@renderer/lib/utils'
import type { AppointmentWithRefs, Patient, Professional } from '@shared/types'

export function ReceptionPage(): React.JSX.Element {
  const [appointments, setAppointments] = useState<AppointmentWithRefs[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [loading, setLoading] = useState(true)
  const [walkInOpen, setWalkInOpen] = useState(false)
  const navigate = useNavigate()

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const [appts, profs] = await Promise.all([
        window.api.appointments.listForDay(todayIso()),
        window.api.professionals.list(true)
      ])
      setAppointments(appts)
      setProfessionals(profs)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const refresh = setInterval(() => void load(), 20_000)
    return () => clearInterval(refresh)
  }, [load])

  const { agendados, semTriagem, jaTriados, finalizados } = useMemo(() => {
    const ag: AppointmentWithRefs[] = []
    const st: AppointmentWithRefs[] = []
    const jt: AppointmentWithRefs[] = []
    const fz: AppointmentWithRefs[] = []
    for (const a of appointments) {
      if (a.status === 'agendado') ag.push(a)
      else if (a.status === 'aguardando' && !a.triageColor) st.push(a)
      else if (a.status === 'aguardando' || a.status === 'em_atendimento') jt.push(a)
      else fz.push(a)
    }
    ag.sort((x, y) => x.scheduledAt.localeCompare(y.scheduledAt))
    st.sort((x, y) =>
      (x.checkedInAt ?? x.scheduledAt).localeCompare(y.checkedInAt ?? y.scheduledAt)
    )
    return { agendados: ag, semTriagem: st, jaTriados: jt, finalizados: fz }
  }, [appointments])

  const handleCheckIn = async (id: number): Promise<void> => {
    try {
      await window.api.appointments.checkIn(id)
      await load()
    } catch (err) {
      alert((err as Error).message)
    }
  }

  return (
    <>
      <PageHeader
        title="Recepção"
        subtitle="Acolhimento do paciente — check-in, encaixe e direcionamento à triagem"
        actions={
          <>
            <Button
              onClick={() => setWalkInOpen(true)}
              className="bg-cyan-700 text-white hover:bg-cyan-800"
              title="Cadastrar paciente que chegou sem agendamento e enviá-lo direto à triagem"
            >
              + Encaixe (walk-in)
            </Button>
            <Button variant="outline" onClick={() => navigate('/pacientes/novo')}>
              + Novo paciente
            </Button>
            <Button variant="outline" onClick={() => navigate('/agenda')}>
              Agenda completa
            </Button>
            <Button variant="outline" onClick={() => void load()}>
              Atualizar
            </Button>
          </>
        }
      />
      <section className="p-6 space-y-6">
        <FlowSteps
          title="Fluxo da recepção"
          steps={[
            {
              title: 'Chegada',
              description: 'Recepcionista busca o paciente por nome, CPF ou CNS.',
              tone: 'cyan',
              icon: FlowIcons.arrival
            },
            {
              title: 'Check-in / Encaixe',
              description: 'Clica Check-in (se agendado) ou + Encaixe (walk-in).',
              tone: 'cyan',
              icon: FlowIcons.classify
            },
            {
              title: 'Aguardando triagem',
              description: 'Paciente cai automaticamente na fila da enfermagem.',
              tone: 'amber',
              icon: FlowIcons.triage
            },
            {
              title: 'Triagem Manchester',
              description: 'Enfermagem classifica em 4 passos guiados.',
              tone: 'violet',
              icon: FlowIcons.triage
            },
            {
              title: 'Atendimento',
              description: 'Paciente entra na Fila ordenada por prioridade e o médico atende.',
              tone: 'emerald',
              icon: FlowIcons.attend
            }
          ]}
        />

        {/* Agendados sem check-in */}
        <CardSection
          title="Agendados — aguardando check-in"
          count={agendados.length}
          tone="amber"
          empty="Nenhum agendamento sem check-in para hoje."
          loading={loading}
        >
          {agendados.map((a) => (
            <li
              key={a.id}
              className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50/50 p-4 shadow-sm border-l-4 border-l-amber-400 sm:flex-row sm:items-center"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-slate-500">
                    {a.scheduledAt.slice(11, 16)}
                  </span>
                  <span className="text-base font-semibold text-slate-800">
                    {a.patient.fullName}
                  </span>
                  <StatusBadge status={a.status} />
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {a.professional.fullName}
                  {a.professional.specialty ? ` — ${a.professional.specialty}` : ''}
                </div>
                {a.reason ? (
                  <div className="mt-1 truncate text-sm text-slate-700">Motivo: {a.reason}</div>
                ) : null}
              </div>
              <Button
                onClick={() => void handleCheckIn(a.id)}
                className="shrink-0 bg-emerald-600 text-white hover:bg-emerald-700"
                size="md"
                title="Marca chegada e envia o paciente para a fila de triagem"
              >
                Check-in
              </Button>
            </li>
          ))}
        </CardSection>

        {/* Sem triagem (aguardando enfermagem) */}
        <CardSection
          title="Aguardando triagem"
          count={semTriagem.length}
          tone="cyan"
          empty="Ninguém aguardando triagem agora."
          loading={loading}
          hint="Enfermagem deve abrir o módulo Triagem (sidebar) para classificar"
        >
          {semTriagem.map((a) => (
            <li
              key={a.id}
              className="flex flex-col gap-3 rounded-lg border border-cyan-200 bg-cyan-50/50 p-4 shadow-sm border-l-4 border-l-cyan-500 sm:flex-row sm:items-center"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-semibold text-slate-800">
                    {a.patient.fullName}
                  </span>
                  <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                    Sem triagem
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  Check-in {a.checkedInAt ? formatDateTimeBr(a.checkedInAt) : '—'} •{' '}
                  {a.professional.fullName}
                </div>
                {a.reason ? (
                  <div className="mt-1 truncate text-sm text-slate-700">Motivo: {a.reason}</div>
                ) : null}
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/triagem')}>
                Ir para Triagem
              </Button>
            </li>
          ))}
        </CardSection>

        {/* Já triados / em atendimento */}
        <CardSection
          title="Triados / em atendimento"
          count={jaTriados.length}
          tone="emerald"
          empty="Nenhum paciente triado ainda hoje."
          loading={loading}
        >
          {jaTriados.map((a) => (
            <li
              key={a.id}
              className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">{a.patient.fullName}</span>
                  <TriageBadge color={a.triageColor} />
                  <StatusBadge status={a.status} />
                </div>
                <div className="text-xs text-slate-500">{a.professional.fullName}</div>
              </div>
            </li>
          ))}
        </CardSection>

        {/* Finalizados */}
        {finalizados.length > 0 ? (
          <CardSection title="Finalizados / cancelados" count={finalizados.length} tone="slate">
            {finalizados.map((a) => (
              <li
                key={a.id}
                className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm sm:flex-row sm:items-center"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-700">{a.patient.fullName}</span>
                    <StatusBadge status={a.status} />
                  </div>
                </div>
              </li>
            ))}
          </CardSection>
        ) : null}
      </section>
      <WalkInModal
        open={walkInOpen}
        professionals={professionals}
        onClose={() => setWalkInOpen(false)}
        onSaved={() => {
          setWalkInOpen(false)
          void load()
        }}
      />
    </>
  )
}

function CardSection({
  title,
  count,
  tone,
  empty,
  hint,
  loading,
  children
}: {
  title: string
  count: number
  tone: 'amber' | 'cyan' | 'emerald' | 'violet' | 'slate'
  empty?: string
  hint?: string
  loading?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <SectionHeader title={title} count={count} tone={tone} hint={hint} />
      <div className="mt-3">
        {loading ? (
          <div className="rounded-md bg-slate-50 p-6 text-center text-sm text-slate-500">
            Carregando…
          </div>
        ) : count === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50/40 p-6 text-center text-sm text-slate-500">
            {empty ?? 'Nada por aqui.'}
          </div>
        ) : (
          <ul className="space-y-2">{children}</ul>
        )}
      </div>
    </div>
  )
}

function WalkInModal({
  open,
  professionals,
  onClose,
  onSaved
}: {
  open: boolean
  professionals: Professional[]
  onClose: () => void
  onSaved: () => void
}): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Patient[]>([])
  const [patientId, setPatientId] = useState<number | null>(null)
  const [patientName, setPatientName] = useState('')
  const [professionalId, setProfessionalId] = useState<number | ''>('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()
  const wasOpen = useRef(false)

  // Reseta o formulário ao abrir/fechar. Não depende de `professionals` para evitar
  // que o auto-refresh do parent (a cada 20s gera nova referência do array) sobrescreva
  // a escolha do usuário no meio do preenchimento.
  useEffect(() => {
    if (!open && wasOpen.current) {
      setQuery('')
      setResults([])
      setPatientId(null)
      setPatientName('')
      setProfessionalId('')
      setReason('')
      setError(null)
    } else if (open && !wasOpen.current) {
      // Inicialização única ao abrir o modal.
      setProfessionalId(professionals[0]?.id ?? '')
    }
    wasOpen.current = open
  }, [open, professionals])

  useEffect(() => {
    if (!open || query.length < 2) {
      setResults([])
      return
    }
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const r = await window.api.patients.search(query)
        if (!cancelled) setResults(r.slice(0, 8))
      } catch {
        if (!cancelled) setResults([])
      }
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [open, query])

  const submit = async (): Promise<void> => {
    if (!patientId) {
      setError('Selecione um paciente.')
      return
    }
    if (!professionalId) {
      setError('Selecione um profissional.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const now = new Date()
      const yyyy = now.getFullYear()
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const dd = String(now.getDate()).padStart(2, '0')
      const hh = String(now.getHours()).padStart(2, '0')
      const mi = String(now.getMinutes()).padStart(2, '0')
      const scheduledAt = buildLocalIso(`${yyyy}-${mm}-${dd}`, `${hh}:${mi}`)
      const created = await window.api.appointments.create({
        patientId,
        professionalId: Number(professionalId),
        scheduledAt,
        durationMin: 30,
        reason: reason.trim() || null,
        notes: null
      })
      // Faz check-in imediato — paciente cai em "Aguardando triagem".
      await window.api.appointments.checkIn(created.id)
      onSaved()
    } catch (err) {
      setError((err as Error).message || 'Erro ao adicionar encaixe.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Encaixe (walk-in) — adicionar à fila">
      <div className="space-y-4">
        <div className="flex items-start gap-2.5 rounded-md border border-cyan-200 bg-cyan-50 p-3 text-xs text-cyan-900">
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
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <span>
            Use quando o paciente chegou <strong>sem agendamento prévio</strong>. O atendimento é
            criado com o horário atual e check-in automático — paciente vai direto para
            &quot;Aguardando triagem&quot;.
          </span>
        </div>

        <Field label="Paciente">
          {patientId ? (
            <div className="flex items-center justify-between rounded-md bg-emerald-50 px-3 py-2 text-sm ring-1 ring-emerald-200">
              <span className="font-medium text-emerald-800">{patientName}</span>
              <button
                type="button"
                className="text-xs text-emerald-700 underline"
                onClick={() => {
                  setPatientId(null)
                  setPatientName('')
                  setQuery('')
                }}
              >
                trocar
              </button>
            </div>
          ) : (
            <>
              <Input
                placeholder="Buscar por nome, CPF ou CNS"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
              {results.length > 0 ? (
                <ul className="mt-1 max-h-48 overflow-auto rounded-md border border-slate-200 bg-white text-sm shadow-sm">
                  {results.map((p) => (
                    <li
                      key={p.id}
                      className="cursor-pointer border-b border-slate-100 px-3 py-2 last:border-0 hover:bg-cyan-50"
                      onClick={() => {
                        setPatientId(p.id)
                        setPatientName(p.fullName)
                        setResults([])
                      }}
                    >
                      <div className="font-medium text-slate-800">{p.fullName}</div>
                      <div className="text-xs text-slate-500">
                        {p.cpf ? `CPF ${p.cpf}` : p.cns ? `CNS ${p.cns}` : 'sem documento'}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : query.length >= 2 ? (
                <div className="mt-1 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-xs text-slate-600">
                  Nenhum paciente encontrado.{' '}
                  <button
                    type="button"
                    className="font-medium text-cyan-700 underline"
                    onClick={() => navigate('/pacientes/novo')}
                  >
                    Cadastrar novo paciente
                  </button>
                </div>
              ) : null}
            </>
          )}
        </Field>

        <Field label="Profissional">
          <Select
            value={professionalId}
            onChange={(e) => setProfessionalId(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">Selecione…</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
                {p.specialty ? ` — ${p.specialty}` : ''}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Motivo / queixa (opcional)">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="ex.: dor abdominal, febre, troca de receita"
          />
        </Field>

        {error ? (
          <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">
            {error}
          </div>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={saving || !patientId || !professionalId}
            className="bg-cyan-700 text-white hover:bg-cyan-800"
          >
            {saving ? 'Adicionando…' : 'Adicionar à fila'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
