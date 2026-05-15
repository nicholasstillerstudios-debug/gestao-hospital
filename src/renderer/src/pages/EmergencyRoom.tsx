/**
 * Pronto-Socorro: lista de atendimentos ativos com classificação de risco,
 * triagem Manchester (5 cores) e desfecho.
 */
import { useEffect, useState } from 'react'
import { PageHeader } from '@renderer/components/PageHeader'
import { Button } from '@renderer/components/ui/Button'
import { Modal } from '@renderer/components/ui/Modal'
import { Input, Field } from '@renderer/components/ui/Field'
import { formatDateTimeBr } from '@renderer/lib/utils'
import {
  ER_ARRIVAL_MODE_LABELS,
  ER_VISIT_STATUS_LABELS,
  TRIAGE_COLOR_LABELS,
  TRIAGE_TARGET_MINUTES,
  type ErArrivalMode,
  type ErVisitStatus,
  type ErVisitWithRefs,
  type ErTriageInput,
  type Patient,
  type TriageColor
} from '@shared/types'

const COLOR_CLASSES: Record<TriageColor, string> = {
  vermelho: 'bg-red-600 text-white',
  laranja: 'bg-orange-500 text-white',
  amarelo: 'bg-yellow-400 text-slate-900',
  verde: 'bg-green-500 text-white',
  azul: 'bg-sky-500 text-white'
}

function ColorBadge({ color }: { color: TriageColor | null }): React.JSX.Element {
  if (!color) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-200 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
        Sem triagem
      </span>
    )
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${COLOR_CLASSES[color]}`}
      title={TRIAGE_COLOR_LABELS[color]}
    >
      {color.charAt(0).toUpperCase() + color.slice(1)}
    </span>
  )
}

export function EmergencyRoomPage(): React.JSX.Element {
  const [visits, setVisits] = useState<ErVisitWithRefs[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [triagingVisit, setTriagingVisit] = useState<ErVisitWithRefs | null>(null)
  const [closingVisit, setClosingVisit] = useState<ErVisitWithRefs | null>(null)

  const load = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const data = await window.api.er.listVisits(true)
      setVisits(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <>
      <PageHeader
        title="Pronto-Socorro"
        subtitle="Classificação de risco, atendimento e desfecho"
        eyebrow="Emergência"
        actions={<Button onClick={() => setShowNew(true)}>+ Nova chegada</Button>}
      />
      <section className="p-6">
        {error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="text-sm text-slate-500">Carregando…</div>
        ) : visits.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
            Sem atendimentos no PS. Clique em <strong>+ Nova chegada</strong> para registrar.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-4 py-3">Cor</th>
                  <th className="px-4 py-3">Paciente</th>
                  <th className="px-4 py-3">Queixa</th>
                  <th className="px-4 py-3">Chegada</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visits.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <ColorBadge color={v.latestTriageColor} />
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{v.patientName}</td>
                    <td className="px-4 py-3 text-slate-700">{v.chiefComplaint}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {formatDateTimeBr(v.arrivedAt)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">
                      {ER_VISIT_STATUS_LABELS[v.status]}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-2">
                        {!v.closedAt && v.status !== 'em_atendimento' ? (
                          <Button variant="outline" onClick={() => setTriagingVisit(v)}>
                            Triar
                          </Button>
                        ) : null}
                        {!v.closedAt && v.latestTriageColor ? (
                          <Button variant="outline" onClick={() => setClosingVisit(v)}>
                            Encerrar
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showNew ? (
        <NewVisitModal
          onClose={() => setShowNew(false)}
          onSaved={() => {
            setShowNew(false)
            void load()
          }}
        />
      ) : null}

      {triagingVisit ? (
        <TriageModal
          visit={triagingVisit}
          onClose={() => setTriagingVisit(null)}
          onSaved={() => {
            setTriagingVisit(null)
            void load()
          }}
        />
      ) : null}

      {closingVisit ? (
        <CloseVisitModal
          visit={closingVisit}
          onClose={() => setClosingVisit(null)}
          onSaved={() => {
            setClosingVisit(null)
            void load()
          }}
        />
      ) : null}
    </>
  )
}

// ─────────────────────────────────────────────────── NewVisitModal ──────

function NewVisitModal({
  onClose,
  onSaved
}: {
  onClose: () => void
  onSaved: () => void
}): React.JSX.Element {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Patient[]>([])
  const [selected, setSelected] = useState<Patient | null>(null)
  const [arrivalMode, setArrivalMode] = useState<ErArrivalMode>('proprio')
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (search.trim().length < 2) {
      setResults([])
      return
    }
    let cancelled = false
    void window.api.patients.search(search).then((r) => {
      if (!cancelled) setResults(r)
    })
    return () => {
      cancelled = true
    }
  }, [search])

  const handleSubmit = async (): Promise<void> => {
    setError(null)
    if (!selected) {
      setError('Selecione um paciente.')
      return
    }
    if (!chiefComplaint.trim()) {
      setError('Informe a queixa principal.')
      return
    }
    setSaving(true)
    try {
      await window.api.er.createVisit({
        patientId: selected.id,
        arrivalMode,
        chiefComplaint: chiefComplaint.trim(),
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
    <Modal open title="Nova chegada ao PS" onClose={onClose} size="lg">
      {error ? (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      <div className="space-y-4">
        <Field label="Paciente">
          {selected ? (
            <div className="flex items-center justify-between rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
              <span>{selected.fullName}</span>
              <Button variant="outline" onClick={() => setSelected(null)}>
                Trocar
              </Button>
            </div>
          ) : (
            <>
              <Input
                placeholder="Buscar por nome, CPF ou CNS…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {results.length > 0 ? (
                <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-slate-200 bg-white">
                  {results.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                      onClick={() => {
                        setSelected(p)
                        setResults([])
                        setSearch('')
                      }}
                    >
                      <div className="font-medium">{p.fullName}</div>
                      <div className="text-xs text-slate-500">
                        {p.cpf ?? 'sem CPF'} · {p.birthDate}
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </Field>

        <Field label="Modo de chegada">
          <select
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={arrivalMode}
            onChange={(e) => setArrivalMode(e.target.value as ErArrivalMode)}
          >
            {(Object.entries(ER_ARRIVAL_MODE_LABELS) as [ErArrivalMode, string][]).map(
              ([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              )
            )}
          </select>
        </Field>

        <Field label="Queixa principal">
          <Input
            placeholder="Ex.: Dor torácica há 2 horas, dispneia, febre…"
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
          />
        </Field>

        <Field label="Observações (opcional)">
          <textarea
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Salvando…' : 'Registrar chegada'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ──────────────────────────────────────────────────── TriageModal ───────

function TriageModal({
  visit,
  onClose,
  onSaved
}: {
  visit: ErVisitWithRefs
  onClose: () => void
  onSaved: () => void
}): React.JSX.Element {
  const [color, setColor] = useState<TriageColor>('amarelo')
  const [discriminator, setDiscriminator] = useState('')
  const [systolic, setSystolic] = useState('')
  const [diastolic, setDiastolic] = useState('')
  const [hr, setHr] = useState('')
  const [rr, setRr] = useState('')
  const [temp, setTemp] = useState('')
  const [sat, setSat] = useState('')
  const [pain, setPain] = useState('')
  const [glasgow, setGlasgow] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const target = TRIAGE_TARGET_MINUTES[color]

  const num = (s: string): number | null => {
    const v = s.trim()
    if (!v) return null
    const n = Number(v.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }

  const handleSubmit = async (): Promise<void> => {
    setError(null)
    setSaving(true)
    try {
      const input: ErTriageInput = {
        visitId: visit.id,
        color,
        discriminator: discriminator.trim() || null,
        systolicBp: num(systolic),
        diastolicBp: num(diastolic),
        heartRate: num(hr),
        respiratoryRate: num(rr),
        temperatureC: num(temp),
        oxygenSaturation: num(sat),
        painScore: num(pain),
        glasgow: num(glasgow),
        notes: notes.trim() || null
      }
      await window.api.er.createTriage(input)
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open title={`Triagem — ${visit.patientName}`} onClose={onClose} size="lg">
      {error ? (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      <div className="space-y-4">
        <Field label="Classificação de risco">
          <div className="grid grid-cols-5 gap-2">
            {(Object.keys(TRIAGE_COLOR_LABELS) as TriageColor[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`rounded-md px-2 py-2 text-xs font-semibold ${COLOR_CLASSES[c]} ${
                  color === c ? 'ring-4 ring-slate-900/30' : 'opacity-70 hover:opacity-100'
                }`}
              >
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </button>
            ))}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Tempo máximo de espera: <strong>{target} min</strong> ({TRIAGE_COLOR_LABELS[color]})
          </div>
        </Field>

        <Field label="Discriminador / motivo">
          <Input
            placeholder="Ex.: Dor torácica + irradiação MSE"
            value={discriminator}
            onChange={(e) => setDiscriminator(e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="PA sistólica">
            <Input value={systolic} onChange={(e) => setSystolic(e.target.value)} />
          </Field>
          <Field label="PA diastólica">
            <Input value={diastolic} onChange={(e) => setDiastolic(e.target.value)} />
          </Field>
          <Field label="FC">
            <Input value={hr} onChange={(e) => setHr(e.target.value)} />
          </Field>
          <Field label="FR">
            <Input value={rr} onChange={(e) => setRr(e.target.value)} />
          </Field>
          <Field label="T (°C)">
            <Input value={temp} onChange={(e) => setTemp(e.target.value)} />
          </Field>
          <Field label="SatO₂ (%)">
            <Input value={sat} onChange={(e) => setSat(e.target.value)} />
          </Field>
          <Field label="Dor (0-10)">
            <Input value={pain} onChange={(e) => setPain(e.target.value)} />
          </Field>
          <Field label="Glasgow (3-15)">
            <Input value={glasgow} onChange={(e) => setGlasgow(e.target.value)} />
          </Field>
        </div>

        <Field label="Observações">
          <textarea
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Salvando…' : 'Registrar triagem'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ────────────────────────────────────────────────── CloseVisitModal ─────

function CloseVisitModal({
  visit,
  onClose,
  onSaved
}: {
  visit: ErVisitWithRefs
  onClose: () => void
  onSaved: () => void
}): React.JSX.Element {
  const [outcome, setOutcome] = useState<ErVisitStatus>('alta')
  const [summary, setSummary] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const OUTCOMES: ErVisitStatus[] = ['alta', 'internado', 'transferido', 'evasao', 'obito']

  const handleSubmit = async (): Promise<void> => {
    setError(null)
    setSaving(true)
    try {
      await window.api.er.closeVisit({
        visitId: visit.id,
        outcome: outcome as 'alta' | 'internado' | 'transferido' | 'evasao' | 'obito',
        outcomeSummary: summary.trim() || null
      })
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  // Para encerrar é necessário primeiro mover para em_atendimento
  const handleStartAttendance = async (): Promise<void> => {
    setError(null)
    setSaving(true)
    try {
      await window.api.er.setStatus(visit.id, 'em_atendimento')
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (visit.status === 'triado') {
    return (
      <Modal open title={`Iniciar atendimento — ${visit.patientName}`} onClose={onClose}>
        {error ? (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        ) : null}
        <p className="mb-4 text-sm text-slate-600">
          Marque o atendimento como iniciado antes de encerrar com desfecho.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void handleStartAttendance()} disabled={saving}>
            Iniciar atendimento
          </Button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open title={`Encerrar atendimento — ${visit.patientName}`} onClose={onClose}>
      {error ? (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      <div className="space-y-4">
        <Field label="Desfecho">
          <select
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as ErVisitStatus)}
          >
            {OUTCOMES.map((s) => (
              <option key={s} value={s}>
                {ER_VISIT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Resumo do atendimento">
          <textarea
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            rows={3}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Condutas, exames realizados, evolução…"
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Salvando…' : 'Encerrar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
