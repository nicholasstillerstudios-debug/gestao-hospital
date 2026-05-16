/**
 * Centro Cirúrgico: lista de cirurgias agendadas/em curso/concluídas,
 * com criação de cirurgia, time-out checklist e OPME.
 */
import { useEffect, useState } from 'react'
import { PageHeader } from '@renderer/components/PageHeader'
import { Button } from '@renderer/components/ui/Button'
import { Modal } from '@renderer/components/ui/Modal'
import { Input, Field } from '@renderer/components/ui/Field'
import { formatDateTimeBr } from '@renderer/lib/utils'
import {
  ANESTHESIA_TYPE_LABELS,
  SURGERY_PRIORITY_LABELS,
  SURGERY_STATUS_LABELS,
  type AnesthesiaType,
  type Patient,
  type Professional,
  type SurgeryInput,
  type SurgeryOpme,
  type SurgeryPriority,
  type SurgeryStatus,
  type SurgeryTimeOutItem,
  type SurgeryWithRefs,
  type SurgicalRoom
} from '@shared/types'

const STATUS_COLORS: Record<SurgeryStatus, string> = {
  agendada: 'bg-slate-200 text-slate-800',
  aguardando: 'bg-amber-200 text-amber-900',
  em_curso: 'bg-blue-600 text-white',
  concluida: 'bg-green-600 text-white',
  cancelada: 'bg-slate-300 text-slate-600 line-through',
  suspensa: 'bg-orange-200 text-orange-900'
}

export function SurgicalCenterPage(): React.JSX.Element {
  const [surgeries, setSurgeries] = useState<SurgeryWithRefs[]>([])
  const [rooms, setRooms] = useState<SurgicalRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [showRoom, setShowRoom] = useState(false)
  const [openSurgery, setOpenSurgery] = useState<SurgeryWithRefs | null>(null)

  const load = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const [sur, rs] = await Promise.all([
        window.api.surgery.listSurgeries(),
        window.api.surgery.listRooms(false)
      ])
      setSurgeries(sur)
      setRooms(rs)
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
        title="Centro Cirúrgico"
        subtitle="Agenda, time-out de segurança e rastreio de OPME"
        eyebrow="Cirurgia"
        actions={
          <>
            <Button variant="outline" onClick={() => setShowRoom(true)}>
              + Sala
            </Button>
            <Button onClick={() => setShowNew(true)} disabled={rooms.length === 0}>
              + Agendar cirurgia
            </Button>
          </>
        }
      />
      <section className="p-6">
        {error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
            {error}
          </div>
        ) : null}
        {rooms.length === 0 ? (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            Cadastre ao menos uma sala cirúrgica para começar.
          </div>
        ) : null}

        {loading ? (
          <div className="text-sm text-slate-500">Carregando…</div>
        ) : surgeries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
            Sem cirurgias agendadas. Clique em <strong>+ Agendar cirurgia</strong>.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Paciente</th>
                  <th className="px-4 py-3">Procedimento</th>
                  <th className="px-4 py-3">Sala</th>
                  <th className="px-4 py-3">Cirurgião</th>
                  <th className="px-4 py-3">Agendado</th>
                  <th className="px-4 py-3 text-right">Time-out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {surgeries.map((s) => (
                  <tr
                    key={s.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => setOpenSurgery(s)}
                  >
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[s.status]}`}
                      >
                        {SURGERY_STATUS_LABELS[s.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{s.patientName}</td>
                    <td className="px-4 py-3 text-slate-700">{s.procedureName}</td>
                    <td className="px-4 py-3 text-slate-700">{s.roomName ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{s.surgeonName ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {formatDateTimeBr(s.scheduledStart)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs">
                      {s.timeOutCompleted ? (
                        <span className="text-green-700">✓ concluído</span>
                      ) : (
                        <span className="text-slate-500">pendente</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showNew ? (
        <NewSurgeryModal
          rooms={rooms}
          onClose={() => setShowNew(false)}
          onSaved={() => {
            setShowNew(false)
            void load()
          }}
        />
      ) : null}

      {showRoom ? (
        <NewRoomModal
          onClose={() => setShowRoom(false)}
          onSaved={() => {
            setShowRoom(false)
            void load()
          }}
        />
      ) : null}

      {openSurgery ? (
        <SurgeryDetailModal
          surgery={openSurgery}
          onClose={() => setOpenSurgery(null)}
          onChanged={() => {
            setOpenSurgery(null)
            void load()
          }}
        />
      ) : null}
    </>
  )
}

// ─────────────────────────────────────────────────── NewRoomModal ───────

function NewRoomModal({
  onClose,
  onSaved
}: {
  onClose: () => void
  onSaved: () => void
}): React.JSX.Element {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [floor, setFloor] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (): Promise<void> => {
    setError(null)
    setSaving(true)
    try {
      await window.api.surgery.createRoom({
        name: name.trim(),
        code: code.trim() || null,
        floor: floor.trim() || null
      })
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }
  return (
    <Modal open title="Nova sala cirúrgica" onClose={onClose}>
      {error ? (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      <div className="space-y-3">
        <Field label="Nome">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sala 01" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Código (opcional)">
            <Input value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
          <Field label="Andar (opcional)">
            <Input value={floor} onChange={(e) => setFloor(e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Salvando…' : 'Criar sala'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ───────────────────────────────────────────────── NewSurgeryModal ──────

function NewSurgeryModal({
  rooms,
  onClose,
  onSaved
}: {
  rooms: SurgicalRoom[]
  onClose: () => void
  onSaved: () => void
}): React.JSX.Element {
  const [patient, setPatient] = useState<Patient | null>(null)
  const [patientSearch, setPatientSearch] = useState('')
  const [patientResults, setPatientResults] = useState<Patient[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [procedureName, setProcedureName] = useState('')
  const [procedureCid10, setProcedureCid10] = useState('')
  const [roomId, setRoomId] = useState<string>(rooms[0]?.id?.toString() ?? '')
  const [surgeonId, setSurgeonId] = useState<string>('')
  const [anesthetistId, setAnesthetistId] = useState<string>('')
  const [scheduledStart, setScheduledStart] = useState('')
  const [scheduledEnd, setScheduledEnd] = useState('')
  const [priority, setPriority] = useState<SurgeryPriority>('eletiva')
  const [anesthesiaType, setAnesthesiaType] = useState<AnesthesiaType>('geral')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void window.api.professionals.list().then(setProfessionals)
  }, [])

  useEffect(() => {
    if (patientSearch.trim().length < 2) {
      setPatientResults([])
      return
    }
    let cancelled = false
    void window.api.patients.search(patientSearch).then((r) => {
      if (!cancelled) setPatientResults(r)
    })
    return () => {
      cancelled = true
    }
  }, [patientSearch])

  const handleSubmit = async (): Promise<void> => {
    setError(null)
    if (!patient) return setError('Selecione um paciente.')
    if (!procedureName.trim()) return setError('Informe o procedimento.')
    if (!scheduledStart || !scheduledEnd) return setError('Informe início e fim previstos.')
    setSaving(true)
    try {
      const input: SurgeryInput = {
        patientId: patient.id,
        roomId: roomId ? Number(roomId) : null,
        surgeonProfessionalId: surgeonId ? Number(surgeonId) : null,
        anesthetistProfessionalId: anesthetistId ? Number(anesthetistId) : null,
        scheduledStart: new Date(scheduledStart).toISOString(),
        scheduledEnd: new Date(scheduledEnd).toISOString(),
        procedureName: procedureName.trim(),
        procedureCid10: procedureCid10.trim() || null,
        anesthesiaType,
        priority,
        notes: notes.trim() || null
      }
      await window.api.surgery.createSurgery(input)
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open title="Agendar cirurgia" onClose={onClose} size="lg">
      {error ? (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      <div className="space-y-3">
        <Field label="Paciente">
          {patient ? (
            <div className="flex items-center justify-between rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
              <span>{patient.fullName}</span>
              <Button variant="outline" onClick={() => setPatient(null)}>
                Trocar
              </Button>
            </div>
          ) : (
            <>
              <Input
                placeholder="Buscar por nome, CPF ou CNS…"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
              />
              {patientResults.length > 0 ? (
                <div className="mt-2 max-h-36 overflow-y-auto rounded-md border border-slate-200 bg-white">
                  {patientResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                      onClick={() => {
                        setPatient(p)
                        setPatientResults([])
                        setPatientSearch('')
                      }}
                    >
                      {p.fullName} <span className="text-xs text-slate-500">{p.cpf}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </Field>

        <Field label="Procedimento">
          <Input
            value={procedureName}
            onChange={(e) => setProcedureName(e.target.value)}
            placeholder="Ex.: Apendicectomia"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="CID-10 (opcional)">
            <Input value={procedureCid10} onChange={(e) => setProcedureCid10(e.target.value)} />
          </Field>
          <Field label="Sala">
            <select
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            >
              <option value="">— sem sala —</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Cirurgião">
            <select
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={surgeonId}
              onChange={(e) => setSurgeonId(e.target.value)}
            >
              <option value="">—</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Anestesista">
            <select
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={anesthetistId}
              onChange={(e) => setAnesthetistId(e.target.value)}
            >
              <option value="">—</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Início previsto">
            <Input
              type="datetime-local"
              value={scheduledStart}
              onChange={(e) => setScheduledStart(e.target.value)}
            />
          </Field>
          <Field label="Fim previsto">
            <Input
              type="datetime-local"
              value={scheduledEnd}
              onChange={(e) => setScheduledEnd(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Prioridade">
            <select
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={priority}
              onChange={(e) => setPriority(e.target.value as SurgeryPriority)}
            >
              {(Object.entries(SURGERY_PRIORITY_LABELS) as [SurgeryPriority, string][]).map(
                ([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                )
              )}
            </select>
          </Field>
          <Field label="Anestesia">
            <select
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={anesthesiaType}
              onChange={(e) => setAnesthesiaType(e.target.value as AnesthesiaType)}
            >
              {(Object.entries(ANESTHESIA_TYPE_LABELS) as [AnesthesiaType, string][]).map(
                ([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                )
              )}
            </select>
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
            {saving ? 'Salvando…' : 'Agendar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ──────────────────────────────────────────────── SurgeryDetailModal ────

function SurgeryDetailModal({
  surgery,
  onClose,
  onChanged
}: {
  surgery: SurgeryWithRefs
  onClose: () => void
  onChanged: () => void
}): React.JSX.Element {
  const [timeOut, setTimeOut] = useState<SurgeryTimeOutItem[]>([])
  const [opme, setOpme] = useState<SurgeryOpme[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [opmeDescription, setOpmeDescription] = useState('')
  const [opmeQty, setOpmeQty] = useState('1')
  const [opmeLot, setOpmeLot] = useState('')

  const load = async (): Promise<void> => {
    try {
      const [t, o] = await Promise.all([
        window.api.surgery.listTimeOut(surgery.id),
        window.api.surgery.listOpme(surgery.id)
      ])
      setTimeOut(t)
      setOpme(o)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  useEffect(() => {
    void load()
  }, [surgery.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleItem = async (item: SurgeryTimeOutItem): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await window.api.surgery.checkTimeOutItem(item.id, !item.checked)
      await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const allChecked = timeOut.length > 0 && timeOut.every((t) => t.checked)

  const handleStart = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await window.api.surgery.startSurgery(surgery.id)
      onChanged()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const handleFinish = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await window.api.surgery.finishSurgery(surgery.id)
      onChanged()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const handleCancel = async (): Promise<void> => {
    const reason = window.prompt('Motivo do cancelamento:')
    if (!reason) return
    setBusy(true)
    setError(null)
    try {
      await window.api.surgery.cancelSurgery(surgery.id, reason)
      onChanged()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const handleAddOpme = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await window.api.surgery.addOpme({
        surgeryId: surgery.id,
        description: opmeDescription.trim(),
        lotNumber: opmeLot.trim() || null,
        quantity: Number(opmeQty) || 1
      })
      setOpmeDescription('')
      setOpmeLot('')
      setOpmeQty('1')
      await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open title={`${surgery.procedureName} — ${surgery.patientName}`} onClose={onClose} size="xl">
      {error ? (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-4">
        <div>
          <div className="font-semibold text-slate-700">Status</div>
          <div>{SURGERY_STATUS_LABELS[surgery.status]}</div>
        </div>
        <div>
          <div className="font-semibold text-slate-700">Sala</div>
          <div>{surgery.roomName ?? '—'}</div>
        </div>
        <div>
          <div className="font-semibold text-slate-700">Cirurgião</div>
          <div>{surgery.surgeonName ?? '—'}</div>
        </div>
        <div>
          <div className="font-semibold text-slate-700">Anestesia</div>
          <div>{surgery.anesthesiaType ? ANESTHESIA_TYPE_LABELS[surgery.anesthesiaType] : '—'}</div>
        </div>
      </div>

      <h3 className="mb-2 text-sm font-semibold text-slate-700">
        Time-out — Checklist WHO Surgical Safety
      </h3>
      <ul className="mb-4 divide-y divide-slate-100 rounded-md border border-slate-200 bg-white">
        {timeOut.map((item) => (
          <li key={item.id} className="flex items-center gap-3 px-3 py-2">
            <input
              type="checkbox"
              checked={item.checked}
              onChange={() => void toggleItem(item)}
              disabled={busy || surgery.status !== 'agendada'}
              className="h-4 w-4"
            />
            <span className={`text-sm ${item.checked ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
              {item.item}
            </span>
          </li>
        ))}
      </ul>

      <div className="mb-4 flex flex-wrap gap-2">
        {surgery.status === 'agendada' || surgery.status === 'aguardando' ? (
          <Button
            onClick={() => void handleStart()}
            disabled={busy || !allChecked}
            title={!allChecked ? 'Complete o time-out antes de iniciar' : undefined}
          >
            ▶ Iniciar cirurgia
          </Button>
        ) : null}
        {surgery.status === 'em_curso' ? (
          <Button onClick={() => void handleFinish()} disabled={busy}>
            ✓ Concluir
          </Button>
        ) : null}
        {(surgery.status === 'agendada' || surgery.status === 'aguardando') ? (
          <Button variant="outline" onClick={() => void handleCancel()} disabled={busy}>
            Cancelar
          </Button>
        ) : null}
      </div>

      <h3 className="mb-2 text-sm font-semibold text-slate-700">OPME — materiais usados</h3>
      <div className="mb-2 flex gap-2">
        <Input
          placeholder="Descrição"
          value={opmeDescription}
          onChange={(e) => setOpmeDescription(e.target.value)}
        />
        <Input
          placeholder="Lote"
          value={opmeLot}
          onChange={(e) => setOpmeLot(e.target.value)}
          className="w-32"
        />
        <Input
          type="number"
          min="1"
          value={opmeQty}
          onChange={(e) => setOpmeQty(e.target.value)}
          className="w-20"
        />
        <Button onClick={() => void handleAddOpme()} disabled={busy || !opmeDescription.trim()}>
          Adicionar
        </Button>
      </div>
      {opme.length > 0 ? (
        <ul className="space-y-1 text-xs text-slate-700">
          {opme.map((o) => (
            <li key={o.id} className="flex justify-between rounded border border-slate-200 bg-white px-3 py-1">
              <span>
                {o.quantity}× {o.description}
                {o.lotNumber ? ` · lote ${o.lotNumber}` : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-500">Nenhum OPME registrado.</p>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => {
            const w = window.open(`#/imprimir/cirurgia/${surgery.id}`, '_blank')
            if (!w) window.location.hash = `#/imprimir/cirurgia/${surgery.id}`
          }}
        >
          Folha de sala
        </Button>
        <Button variant="outline" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </Modal>
  )
}
