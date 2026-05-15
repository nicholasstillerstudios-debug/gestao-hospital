import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader } from '@renderer/components/PageHeader'
import { Button } from '@renderer/components/ui/Button'
import { Field, Input, Select, Textarea } from '@renderer/components/ui/Field'
import { Modal } from '@renderer/components/ui/Modal'
import { StatusBadge } from '@renderer/components/ui/Badge'
import { buildLocalIso, formatDateBr, todayIso } from '@renderer/lib/utils'
import type { AppointmentWithRefs, Patient, Professional } from '@shared/types'

export function ConsultasPage(): React.JSX.Element {
  const [date, setDate] = useState(todayIso())
  const [appointments, setAppointments] = useState<AppointmentWithRefs[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [loading, setLoading] = useState(true)
  const [filterProf, setFilterProf] = useState<string>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const navigate = useNavigate()

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const [appts, profs] = await Promise.all([
        window.api.appointments.listForDay(date),
        window.api.professionals.list(true)
      ])
      setAppointments(appts)
      setProfessionals(profs)
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    if (filterProf === 'all') return appointments
    return appointments.filter((a) => a.professional.id === Number(filterProf))
  }, [appointments, filterProf])

  const handleCheckIn = async (id: number): Promise<void> => {
    try {
      await window.api.appointments.checkIn(id)
      await load()
    } catch (err) {
      alert((err as Error).message)
    }
  }

  const handleCancel = async (id: number): Promise<void> => {
    const reason = window.prompt('Motivo do cancelamento?')
    if (reason === null) return
    try {
      await window.api.appointments.cancel(id, reason || null)
      await load()
    } catch (err) {
      alert((err as Error).message)
    }
  }

  const handleMarkAbsent = async (id: number): Promise<void> => {
    if (!window.confirm('Marcar esta consulta como falta do paciente?')) return
    try {
      await window.api.appointments.updateStatus(id, 'faltou')
      await load()
    } catch (err) {
      alert((err as Error).message)
    }
  }

  return (
    <>
      <PageHeader
        title="Agenda"
        subtitle={`Agendamentos de ${formatDateBr(date)}`}
        actions={
          <>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value || todayIso())}
            />
            <Select value={filterProf} onChange={(e) => setFilterProf(e.target.value)}>
              <option value="all">Todos profissionais</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
            </Select>
            <Button
              variant="outline"
              onClick={async () => {
                const start = window.prompt('Data inicial (AAAA-MM-DD):', date)
                if (!start) return
                const end = window.prompt('Data final (AAAA-MM-DD):', start)
                if (!end) return
                try {
                  const r = await window.api.exports.appointmentsCsv(start, end)
                  if (r.saved && r.path) alert(`Agenda exportada em:\n${r.path}`)
                } catch (err) {
                  alert((err as Error).message)
                }
              }}
              title="Exporta agendamentos no intervalo escolhido em CSV"
            >
              Exportar CSV
            </Button>
            <Button onClick={() => setModalOpen(true)}>+ Agendar</Button>
          </>
        }
      />

      <section className="p-6">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Horário</th>
                <th className="px-4 py-2.5 font-semibold">Paciente</th>
                <th className="px-4 py-2.5 font-semibold">Profissional</th>
                <th className="px-4 py-2.5 font-semibold">Motivo</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">
                    Carregando…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">
                    Nenhum agendamento para esta data.
                  </td>
                </tr>
              ) : (
                filtered.map((a) => {
                  const time = a.scheduledAt.slice(11, 16)
                  return (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-mono text-slate-700">{time}</td>
                      <td className="px-4 py-2.5 text-slate-800">
                        <Link
                          to={`/pacientes/${a.patient.id}`}
                          className="hover:text-cyan-700 hover:underline"
                          title="Abrir prontuário"
                        >
                          {a.patient.fullName}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {a.professional.fullName}
                        {a.professional.specialty ? (
                          <span className="ml-1 text-xs text-slate-400">
                            ({a.professional.specialty})
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{a.reason ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={a.status} />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          {a.status === 'agendado' ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => void handleCheckIn(a.id)}
                            >
                              Check-in
                            </Button>
                          ) : null}
                          {a.status === 'aguardando' || a.status === 'em_atendimento' ? (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => navigate(`/atendimento/${a.id}`)}
                            >
                              Atender
                            </Button>
                          ) : null}
                          {a.status === 'agendado' || a.status === 'aguardando' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void handleMarkAbsent(a.id)}
                            >
                              Falta
                            </Button>
                          ) : null}
                          {a.status !== 'cancelado' &&
                          a.status !== 'concluido' &&
                          a.status !== 'faltou' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void handleCancel(a.id)}
                            >
                              Cancelar
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <AppointmentModal
        open={modalOpen}
        defaultDate={date}
        professionals={professionals}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          setModalOpen(false)
          void load()
        }}
      />
    </>
  )
}

function AppointmentModal({
  open,
  defaultDate,
  professionals,
  onClose,
  onSaved
}: {
  open: boolean
  defaultDate: string
  professionals: Professional[]
  onClose: () => void
  onSaved: () => void
}): React.JSX.Element {
  const [patientQuery, setPatientQuery] = useState('')
  const [results, setResults] = useState<Patient[]>([])
  const [patientId, setPatientId] = useState<number | null>(null)
  const [patientName, setPatientName] = useState('')
  const [professionalId, setProfessionalId] = useState<number | ''>('')
  const [date, setDate] = useState(defaultDate)
  const [time, setTime] = useState('08:00')
  const [duration, setDuration] = useState(30)
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDate(defaultDate)
  }, [defaultDate])

  useEffect(() => {
    if (!open) {
      setPatientQuery('')
      setPatientId(null)
      setPatientName('')
      setProfessionalId('')
      setTime('08:00')
      setDuration(30)
      setReason('')
      setNotes('')
      setError(null)
    }
  }, [open])

  useEffect(() => {
    if (patientQuery.length < 2) {
      setResults([])
      return
    }
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const r = await window.api.patients.search(patientQuery)
        if (!cancelled) setResults(r)
      } catch {
        if (!cancelled) setResults([])
      }
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [patientQuery])

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    if (!patientId) {
      setError('Selecione um paciente.')
      return
    }
    if (!professionalId) {
      setError('Selecione um profissional.')
      return
    }
    setSaving(true)
    try {
      await window.api.appointments.create({
        patientId,
        professionalId: Number(professionalId),
        scheduledAt: buildLocalIso(date, time),
        durationMin: Number(duration),
        reason: reason.trim() || null,
        notes: notes.trim() || null
      })
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      title="Novo agendamento"
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} type="button">
            Cancelar
          </Button>
          <Button type="submit" form="appointment-form" disabled={saving}>
            {saving ? 'Agendando…' : 'Agendar'}
          </Button>
        </>
      }
    >
      <form id="appointment-form" onSubmit={submit} className="space-y-3">
        <Field
          label="Paciente"
          required
          hint={patientId ? `Selecionado: ${patientName}` : undefined}
        >
          <Input
            placeholder="Buscar por nome / CPF / CNS…"
            value={patientQuery}
            onChange={(e) => {
              setPatientQuery(e.target.value)
              setPatientId(null)
            }}
          />
        </Field>
        {/* Lista FORA do <Field> — <Field> usa <label>, e cliques em <li>
            dentro de <label> são redirecionados para o input (HTML spec). */}
        {patientQuery.length >= 2 && results.length > 0 && !patientId ? (
          <div className="-mt-2 max-h-40 overflow-y-auto rounded-md border border-slate-200 bg-white text-sm shadow">
            {results.map((p) => (
              <button
                key={p.id}
                type="button"
                className="block w-full cursor-pointer px-3 py-1.5 text-left hover:bg-slate-50"
                onClick={() => {
                  setPatientId(p.id)
                  setPatientName(p.fullName)
                  setPatientQuery(p.fullName)
                  setResults([])
                }}
              >
                <span className="font-medium">{p.fullName}</span>
                {p.cpf ? <span className="ml-2 text-xs text-slate-500">CPF {p.cpf}</span> : null}
              </button>
            ))}
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data" required>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <Field label="Hora" required>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Profissional" required>
            <Select
              value={professionalId}
              onChange={(e) => setProfessionalId(e.target.value ? Number(e.target.value) : '')}
              required
            >
              <option value="">Selecione…</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName} {p.specialty ? `— ${p.specialty}` : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Duração (min)">
            <Input
              type="number"
              min={5}
              max={240}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value) || 30)}
            />
          </Field>
        </div>
        <Field label="Motivo do atendimento">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <Field label="Observações">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {error ? (
          <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">
            {error}
          </div>
        ) : null}
      </form>
    </Modal>
  )
}
