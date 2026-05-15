import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@renderer/components/PageHeader'
import { PrescriptionModal } from '@renderer/components/PrescriptionModal'
import { RequisitionModal } from '@renderer/components/RequisitionModal'
import { Button } from '@renderer/components/ui/Button'
import { Field, Select, Textarea } from '@renderer/components/ui/Field'
import { StatusBadge, TriageBadge } from '@renderer/components/ui/Badge'
import { ageFromBirthDate, formatCpf, formatDateBr, formatDateTimeBr } from '@renderer/lib/utils'
import { SOAP_TEMPLATES } from '@renderer/lib/soapTemplates'
import type { AppointmentWithRefs, Attendance } from '@shared/types'

export function AttendancePage(): React.JSX.Element {
  const { appointmentId } = useParams()
  const id = Number(appointmentId)
  const navigate = useNavigate()
  const [appointment, setAppointment] = useState<AppointmentWithRefs | null>(null)
  const [attendance, setAttendance] = useState<Attendance | null>(null)
  const [loading, setLoading] = useState(true)
  const [subjective, setSubjective] = useState('')
  const [objective, setObjective] = useState('')
  const [assessment, setAssessment] = useState('')
  const [plan, setPlan] = useState('')
  const [prescription, setPrescription] = useState('')
  const [history, setHistory] = useState<Attendance[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showRxModal, setShowRxModal] = useState(false)
  const [showReqModal, setShowReqModal] = useState(false)
  const [templateKey, setTemplateKey] = useState<string>('')

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const appt = await window.api.appointments.get(id)
      if (!appt) throw new Error('Agendamento não encontrado')
      setAppointment(appt)
      const att = await window.api.attendances.getByAppointment(id)
      if (att) {
        setAttendance(att)
        setSubjective(att.subjective ?? '')
        setObjective(att.objective ?? '')
        setAssessment(att.assessment ?? '')
        setPlan(att.plan ?? '')
        setPrescription(att.prescription ?? '')
      }
      const hist = await window.api.attendances.listForPatient(appt.patient.id)
      setHistory(hist.filter((h) => h.appointmentId !== id))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const startAttendance = async (): Promise<void> => {
    setError(null)
    try {
      const att = await window.api.attendances.start(id)
      setAttendance(att)
      await load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const save = async (): Promise<void> => {
    if (!attendance) return
    setSaving(true)
    try {
      const updated = await window.api.attendances.save(attendance.id, {
        subjective: subjective || null,
        objective: objective || null,
        assessment: assessment || null,
        plan: plan || null,
        prescription: prescription || null
      })
      setAttendance(updated)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const applyTemplate = (key: string): void => {
    setTemplateKey(key)
    if (!key) return
    const t = SOAP_TEMPLATES.find((x) => x.key === key)
    if (!t) return
    const append = (existing: string, snippet: string): string => {
      if (!snippet) return existing
      if (!existing.trim()) return snippet
      return `${existing.trimEnd()}\n\n${snippet}`
    }
    setSubjective((prev) => append(prev, t.subjective))
    setObjective((prev) => append(prev, t.objective))
    setAssessment((prev) => append(prev, t.assessment))
    setPlan((prev) => append(prev, t.plan))
    setPrescription((prev) => append(prev, t.prescription))
  }

  const loadPrevious = (): void => {
    if (history.length === 0) return
    const last = history[0]
    if (
      !confirm(
        `Trazer S/O/A/P do atendimento de ${formatDateBr(last.startedAt.slice(0, 10))}? O conte\u00fado \u00e9 anexado ao final dos campos atuais.`
      )
    )
      return
    const append = (existing: string, snippet: string | null): string => {
      if (!snippet) return existing
      const tag = `\n\n[\u00daltima consulta \u2014 ${formatDateBr(last.startedAt.slice(0, 10))}]\n${snippet}`
      return existing.trim() ? existing.trimEnd() + tag : tag.trim()
    }
    setSubjective((prev) => append(prev, last.subjective))
    setObjective((prev) => append(prev, last.objective))
    setAssessment((prev) => append(prev, last.assessment))
    setPlan((prev) => append(prev, last.plan))
  }

  const finish = async (): Promise<void> => {
    if (!attendance) return
    if (!confirm('Finalizar atendimento? A consulta será marcada como concluída.')) return
    setSaving(true)
    try {
      await window.api.attendances.finish(attendance.id, {
        subjective: subjective || null,
        objective: objective || null,
        assessment: assessment || null,
        plan: plan || null,
        prescription: prescription || null
      })
      navigate(`/pacientes/${appointment!.patient.id}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6 text-sm text-slate-500">Carregando…</div>
  if (!appointment) {
    return <div className="p-6 text-sm text-slate-500">Agendamento não encontrado.</div>
  }

  const age = ageFromBirthDate(appointment.patient.birthDate)

  return (
    <>
      <PageHeader
        title={`Atendimento — ${appointment.patient.fullName}`}
        subtitle={`${age != null ? `${age} anos` : ''}${formatCpf(appointment.patient.cpf) ? ` • CPF ${formatCpf(appointment.patient.cpf)}` : ''}`}
        actions={
          <>
            <Link to={`/pacientes/${appointment.patient.id}`}>
              <Button variant="outline">Ver prontuário</Button>
            </Link>
            <Button
              variant="outline"
              onClick={() => navigate(`/imprimir/ficha/${id}`)}
              title="Imprime a ficha de atendimento (S.O.A.P.)"
            >
              Imprimir ficha
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const raw = window.prompt('Quantos dias de afastamento?', '1')
                if (!raw) return
                const days = Math.max(1, Number.parseInt(raw, 10) || 1)
                const cid = window.prompt('CID-10 (opcional, ex.: J00):', '')
                const params = new URLSearchParams({ dias: String(days) })
                if (cid && cid.trim()) params.set('cid', cid.trim().toUpperCase())
                navigate(`/imprimir/atestado/${id}?${params.toString()}`)
              }}
              title="Gera atestado médico imprimível"
            >
              Atestado
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowRxModal(true)}
              disabled={!attendance}
              title={
                attendance ? 'Cria receituário formal estruturado' : 'Inicie o atendimento primeiro'
              }
            >
              Receituário
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowReqModal(true)}
              disabled={!attendance}
              title={
                attendance
                  ? 'Cria requisição (SADT/exames/encaminhamento)'
                  : 'Inicie o atendimento primeiro'
              }
            >
              Requisição
            </Button>
            <Button variant="ghost" onClick={() => navigate(-1)}>
              Voltar
            </Button>
          </>
        }
      />
      <section className="space-y-6 p-6">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs text-slate-500">Data / Profissional</div>
              <div className="text-sm font-medium text-slate-800">
                {formatDateTimeBr(appointment.scheduledAt)} • {appointment.professional.fullName}
                {appointment.professional.specialty
                  ? ` (${appointment.professional.specialty})`
                  : ''}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TriageBadge color={appointment.triageColor} />
              <StatusBadge status={appointment.status} />
            </div>
          </div>
          {appointment.reason ? (
            <p className="mt-3 text-sm text-slate-700">
              <strong>Motivo:</strong> {appointment.reason}
            </p>
          ) : null}
          {appointment.triageNotes ? (
            <p className="mt-1 text-sm text-slate-700">
              <strong>Triagem:</strong> {appointment.triageNotes}
            </p>
          ) : null}
        </div>

        {!attendance ? (
          <div className="flex items-center justify-between rounded-lg border border-dashed border-slate-300 bg-white p-5">
            <div>
              <div className="text-sm font-semibold text-slate-700">
                Este agendamento ainda não foi iniciado.
              </div>
              <div className="text-xs text-slate-500">
                Ao iniciar, o status muda para &quot;em atendimento&quot; e o registro clínico é
                criado.
              </div>
            </div>
            <Button onClick={() => void startAttendance()}>Iniciar atendimento</Button>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-700">Registro clínico (SOAP)</h2>
              <span className="text-xs text-slate-500">
                Iniciado em {formatDateTimeBr(attendance.startedAt)}
                {attendance.endedAt
                  ? ` • finalizado em ${formatDateTimeBr(attendance.endedAt)}`
                  : ''}
              </span>
            </div>

            {!attendance.endedAt ? (
              <div className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-cyan-100 bg-cyan-50/50 p-3">
                <Field label="Carregar template SOAP" className="flex-1 min-w-[260px]">
                  <Select value={templateKey} onChange={(e) => applyTemplate(e.target.value)}>
                    <option value="">Selecione um modelo (anexa ao final)…</option>
                    {SOAP_TEMPLATES.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button
                  variant="outline"
                  onClick={loadPrevious}
                  disabled={history.length === 0}
                  title={
                    history.length === 0
                      ? 'O paciente não tem atendimentos anteriores'
                      : 'Anexa S/O/A/P da última consulta deste paciente'
                  }
                >
                  Carregar última consulta
                </Button>
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Subjetivo (queixas / relato)">
                <Textarea
                  rows={4}
                  value={subjective}
                  onChange={(e) => setSubjective(e.target.value)}
                />
              </Field>
              <Field label="Objetivo (exame / sinais)">
                <Textarea
                  rows={4}
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                />
              </Field>
              <Field label="Avaliação / Hipóteses diagnósticas">
                <Textarea
                  rows={4}
                  value={assessment}
                  onChange={(e) => setAssessment(e.target.value)}
                />
              </Field>
              <Field label="Plano / Conduta">
                <Textarea rows={4} value={plan} onChange={(e) => setPlan(e.target.value)} />
              </Field>
              <Field className="md:col-span-2" label="Prescrição / Receituário">
                <Textarea
                  rows={4}
                  value={prescription}
                  onChange={(e) => setPrescription(e.target.value)}
                  placeholder="Ex.: Dipirona 500mg — 1 cp 6/6h por 3 dias…"
                />
              </Field>
            </div>

            {error ? (
              <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
                {error}
              </div>
            ) : null}

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => void save()} disabled={saving}>
                Salvar rascunho
              </Button>
              <Button
                onClick={() => void finish()}
                disabled={saving || Boolean(attendance.endedAt)}
              >
                {attendance.endedAt ? 'Atendimento já finalizado' : 'Finalizar atendimento'}
              </Button>
            </div>
          </div>
        )}

        {history.length > 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">
              Histórico anterior do paciente
            </h2>
            <ul className="space-y-3">
              {history.slice(0, 5).map((h) => (
                <li key={h.id} className="rounded-md border border-slate-200 p-3 text-sm">
                  <div className="text-xs text-slate-500">
                    {formatDateBr(h.startedAt.slice(0, 10))}
                  </div>
                  {h.assessment ? (
                    <p>
                      <strong>Hipótese:</strong> {h.assessment}
                    </p>
                  ) : null}
                  {h.plan ? (
                    <p>
                      <strong>Conduta:</strong> {h.plan}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <PrescriptionModal
        open={showRxModal}
        patientId={appointment.patient.id}
        attendanceId={attendance?.id ?? null}
        professionalId={appointment.professional.id}
        onClose={() => setShowRxModal(false)}
        onSaved={(rxId) => {
          setShowRxModal(false)
          navigate(`/imprimir/receituario/${rxId}`)
        }}
      />
      <RequisitionModal
        open={showReqModal}
        patientId={appointment.patient.id}
        attendanceId={attendance?.id ?? null}
        professionalId={appointment.professional.id}
        onClose={() => setShowReqModal(false)}
        onSaved={(reqId) => {
          setShowReqModal(false)
          navigate(`/imprimir/requisicao/${reqId}`)
        }}
      />
    </>
  )
}
