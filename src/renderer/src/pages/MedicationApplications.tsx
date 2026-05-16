/**
 * Sala de medicação: aplicação ambulatorial de medicamentos.
 * Lista do dia + modal de aplicação rápida (paciente, medicamento,
 * dose, via, opcional baixa de estoque).
 */
import { useEffect, useState } from 'react'
import { PageHeader } from '@renderer/components/PageHeader'
import { Button } from '@renderer/components/ui/Button'
import { Modal } from '@renderer/components/ui/Modal'
import { Field, Input, Select } from '@renderer/components/ui/Field'
import { formatDateTimeBr } from '@renderer/lib/utils'
import type {
  Medication,
  MedicationApplicationInput,
  MedicationApplicationWithRefs,
  MedicationLot,
  Patient,
  Professional
} from '@shared/types'

const ROUTES = ['IM', 'EV', 'SC', 'VO', 'SL', 'IN', 'TÓPICA', 'RETAL', 'NEB']

export function MedicationApplicationsPage(): React.JSX.Element {
  const [items, setItems] = useState<MedicationApplicationWithRefs[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)

  const load = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const today = new Date().toISOString().slice(0, 10)
      setItems(await window.api.medicationApplications.list({ fromDate: today }))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const handleDelete = async (id: number): Promise<void> => {
    if (!window.confirm('Excluir esta aplicação?')) return
    await window.api.medicationApplications.delete(id)
    await load()
  }

  return (
    <>
      <PageHeader
        title="Sala de medicação"
        subtitle="Aplicação ambulatorial de medicamentos"
        eyebrow="Clínico"
        actions={<Button onClick={() => setShowNew(true)}>+ Aplicar medicamento</Button>}
      />
      <section className="p-6 space-y-4">
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="text-sm text-slate-500">Carregando…</div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            Nenhuma aplicação hoje.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-4 py-3">Hora</th>
                  <th className="px-4 py-3">Paciente</th>
                  <th className="px-4 py-3">Medicamento</th>
                  <th className="px-4 py-3">Dose / Via</th>
                  <th className="px-4 py-3">Profissional</th>
                  <th className="px-4 py-3">Lote</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {formatDateTimeBr(a.appliedAt)}
                    </td>
                    <td className="px-4 py-2">{a.patientName}</td>
                    <td className="px-4 py-2">{a.medicationName}</td>
                    <td className="px-4 py-2 text-xs">
                      {a.dose} {a.route ? `· ${a.route}` : ''}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-600">
                      {a.professionalName ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-600">{a.lotNumber ?? '—'}</td>
                    <td className="px-4 py-2 text-right">
                      <Button variant="ghost" onClick={() => void handleDelete(a.id)}>
                        Excluir
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showNew ? (
        <NewApplicationModal
          onClose={() => setShowNew(false)}
          onSaved={() => {
            setShowNew(false)
            void load()
          }}
        />
      ) : null}
    </>
  )
}

function NewApplicationModal({
  onClose,
  onSaved
}: {
  onClose: () => void
  onSaved: () => void
}): React.JSX.Element {
  const [patient, setPatient] = useState<Patient | null>(null)
  const [patientSearch, setPatientSearch] = useState('')
  const [patientResults, setPatientResults] = useState<Patient[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [professionalId, setProfessionalId] = useState('')
  const [medications, setMedications] = useState<Medication[]>([])
  const [medicationId, setMedicationId] = useState('')
  const [medicationName, setMedicationName] = useState('')
  const [lots, setLots] = useState<MedicationLot[]>([])
  const [lotId, setLotId] = useState('')
  const [decrementStock, setDecrementStock] = useState(false)
  const [dose, setDose] = useState('')
  const [route, setRoute] = useState('IM')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void window.api.professionals.list().then(setProfessionals)
    void window.api.pharmacy.listMedications().then(setMedications)
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

  useEffect(() => {
    if (!medicationId) {
      setLots([])
      setLotId('')
      return
    }
    void window.api.pharmacy.listLots(Number(medicationId)).then((all) => {
      setLots(all.filter((l) => l.quantity > 0))
    })
  }, [medicationId])

  const handleMedicationChange = (id: string): void => {
    setMedicationId(id)
    const m = medications.find((x) => String(x.id) === id)
    if (m) setMedicationName(`${m.name}${m.dosage ? ' ' + m.dosage : ''}`)
  }

  const submit = async (): Promise<void> => {
    setError(null)
    if (!patient) return setError('Selecione o paciente.')
    if (!medicationName.trim()) return setError('Informe o medicamento.')
    if (!dose.trim()) return setError('Informe a dose.')
    setSaving(true)
    try {
      const input: MedicationApplicationInput = {
        patientId: patient.id,
        professionalId: professionalId ? Number(professionalId) : null,
        medicationId: medicationId ? Number(medicationId) : null,
        medicationName: medicationName.trim(),
        dose: dose.trim(),
        route,
        lotId: lotId ? Number(lotId) : null,
        notes: notes.trim() || null,
        decrementStock: decrementStock && !!medicationId && !!lotId
      }
      await window.api.medicationApplications.create(input)
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open title="Aplicar medicamento" onClose={onClose} size="lg">
      {error ? (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      <div className="space-y-3">
        <Field label="Paciente" required>
          {patient ? (
            <div className="flex items-center justify-between rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
              <span>{patient.fullName}</span>
              <Button variant="outline" onClick={() => setPatient(null)}>
                Trocar
              </Button>
            </div>
          ) : (
            <Input
              placeholder="Buscar por nome, CPF ou CNS…"
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
            />
          )}
        </Field>
        {!patient && patientResults.length > 0 ? (
          <div className="-mt-2 max-h-40 overflow-auto rounded-md border border-slate-200 bg-white">
            {patientResults.map((p) => (
              <button
                key={p.id}
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-cyan-50"
                onClick={() => {
                  setPatient(p)
                  setPatientResults([])
                  setPatientSearch('')
                }}
              >
                {p.fullName}{' '}
                {p.cpf ? <span className="text-xs text-slate-500">CPF {p.cpf}</span> : null}
              </button>
            ))}
          </div>
        ) : null}

        <Field label="Profissional">
          <Select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
            <option value="">—</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Medicamento (do estoque)">
            <Select value={medicationId} onChange={(e) => handleMedicationChange(e.target.value)}>
              <option value="">— digitar manualmente —</option>
              {medications.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.dosage ?? ''} {m.form ? `(${m.form})` : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Nome / descrição" required>
            <Input
              value={medicationName}
              onChange={(e) => setMedicationName(e.target.value)}
              placeholder="Ex.: Dipirona 500mg"
            />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Dose" required>
            <Input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="1 g, 1 amp" />
          </Field>
          <Field label="Via">
            <Select value={route} onChange={(e) => setRoute(e.target.value)}>
              {ROUTES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Lote (se baixar estoque)">
            <Select value={lotId} onChange={(e) => setLotId(e.target.value)} disabled={!medicationId}>
              <option value="">—</option>
              {lots.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.lotNumber} · qtd {l.quantity}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={decrementStock}
            onChange={(e) => setDecrementStock(e.target.checked)}
            disabled={!medicationId || !lotId}
          />
          Baixar 1 unidade do estoque automaticamente
        </label>

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
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? 'Salvando…' : 'Aplicar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
