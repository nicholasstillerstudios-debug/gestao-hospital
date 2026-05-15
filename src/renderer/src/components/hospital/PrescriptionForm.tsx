import { useEffect, useState } from 'react'
import { Button } from '@renderer/components/ui/Button'
import { Field, Input, Select, Textarea } from '@renderer/components/ui/Field'
import {
  MEDICATION_ROUTE_LABELS,
  type AdmissionPrescriptionInput,
  type AdmissionPrescriptionItemInput,
  type Medication,
  type MedicationRoute,
  type Professional
} from '@shared/types'

interface Props {
  admissionId: number
  onCancel: () => void
  onSuccess: () => void
}

interface DraftItem {
  medicationId: number | ''
  medicationName: string
  dose: string
  route: MedicationRoute
  frequencyLabel: string
  intervalHours: string
  durationDays: string
  ifNecessary: boolean
  notes: string
}

function emptyItem(): DraftItem {
  return {
    medicationId: '',
    medicationName: '',
    dose: '',
    route: 'oral',
    frequencyLabel: '',
    intervalHours: '',
    durationDays: '',
    ifNecessary: false,
    notes: ''
  }
}

function numberOrNull(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const cleaned = trimmed.replace(',', '.')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/**
 * Formulário de criação de prescrição hospitalar. Médico monta a
 * prescrição com 1+ items; cada item pode (a) referenciar um medicamento
 * do catálogo (autopreenche o nome), ou (b) usar texto livre. Items com
 * intervalo geram aprazamento automático do MAR no backend.
 */
export function PrescriptionForm({ admissionId, onCancel, onSuccess }: Props): React.JSX.Element {
  const [items, setItems] = useState<DraftItem[]>([emptyItem()])
  const [notes, setNotes] = useState('')
  const [professionalId, setProfessionalId] = useState<number | ''>('')
  const [medications, setMedications] = useState<Medication[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void window.api.pharmacy
      .listMedications(true)
      .then(setMedications)
      .catch(() => undefined)
    void window.api.professionals
      .list(true)
      .then(setProfessionals)
      .catch(() => undefined)
  }, [])

  const updateItem = (idx: number, patch: Partial<DraftItem>): void => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  const submit = async (): Promise<void> => {
    if (busy) return
    if (items.length === 0) {
      setError('Adicione pelo menos um item.')
      return
    }
    const built: AdmissionPrescriptionItemInput[] = []
    for (const [idx, it] of items.entries()) {
      if (!it.medicationName.trim() || !it.dose.trim() || !it.frequencyLabel.trim()) {
        setError(`Item ${idx + 1}: medicamento, dose e frequência são obrigatórios.`)
        return
      }
      built.push({
        medicationId: it.medicationId === '' ? null : Number(it.medicationId),
        medicationName: it.medicationName.trim(),
        dose: it.dose.trim(),
        route: it.route,
        frequencyLabel: it.frequencyLabel.trim(),
        intervalHours: numberOrNull(it.intervalHours),
        durationDays: numberOrNull(it.durationDays),
        ifNecessary: it.ifNecessary,
        notes: it.notes.trim() || null
      })
    }
    setBusy(true)
    setError(null)
    try {
      const payload: AdmissionPrescriptionInput = {
        admissionId,
        prescribedByProfessionalId: professionalId === '' ? null : Number(professionalId),
        notes: notes.trim() || null,
        items: built
      }
      await window.api.hospitalPrescriptions.create(payload)
      onSuccess()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <Field label="Médico prescritor" hint="Opcional — quem assina">
        <Select
          value={professionalId}
          onChange={(e) => setProfessionalId(e.target.value === '' ? '' : Number(e.target.value))}
        >
          <option value="">— Selecione —</option>
          {professionals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName}
              {p.councilNumber ? ` · ${p.councilType ?? ''} ${p.councilNumber}` : ''}
            </option>
          ))}
        </Select>
      </Field>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-700">
            Items da prescrição ({items.length})
          </h4>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setItems((prev) => [...prev, emptyItem()])}
            disabled={busy}
          >
            + Adicionar item
          </Button>
        </div>

        {items.map((it, idx) => (
          <div key={idx} className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-semibold text-slate-600">Item {idx + 1}</span>
              {items.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-xs text-red-600 hover:underline"
                  disabled={busy}
                >
                  Remover item
                </button>
              ) : null}
            </div>

            <Field
              label="Medicamento (catálogo)"
              hint="Ou deixe vazio e escreva manualmente abaixo"
            >
              <Select
                value={it.medicationId}
                onChange={(e) => {
                  const v = e.target.value === '' ? '' : Number(e.target.value)
                  const med = medications.find((m) => m.id === v)
                  updateItem(idx, {
                    medicationId: v,
                    medicationName: med ? med.name : it.medicationName
                  })
                }}
              >
                <option value="">— Texto livre —</option>
                {medications.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.dosage ? ` ${m.dosage}` : ''}
                    {m.form ? ` · ${m.form}` : ''}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Nome do medicamento" required>
              <Input
                value={it.medicationName}
                onChange={(e) => updateItem(idx, { medicationName: e.target.value })}
                placeholder="Ex.: Dipirona 500mg"
                required
              />
            </Field>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Dose" required>
                <Input
                  value={it.dose}
                  onChange={(e) => updateItem(idx, { dose: e.target.value })}
                  placeholder="Ex.: 1 g"
                  required
                />
              </Field>
              <Field label="Via" required>
                <Select
                  value={it.route}
                  onChange={(e) => updateItem(idx, { route: e.target.value as MedicationRoute })}
                >
                  {(Object.keys(MEDICATION_ROUTE_LABELS) as MedicationRoute[]).map((k) => (
                    <option key={k} value={k}>
                      {MEDICATION_ROUTE_LABELS[k]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Frequência (descrição)" required>
                <Input
                  value={it.frequencyLabel}
                  onChange={(e) => updateItem(idx, { frequencyLabel: e.target.value })}
                  placeholder="Ex.: 8/8h, 1x ao dia, S/N"
                  required
                />
              </Field>
              <Field
                label="Intervalo (h)"
                hint="Habilita aprazamento automático do MAR (deixe vazio para SOS)"
              >
                <Input
                  inputMode="decimal"
                  value={it.intervalHours}
                  onChange={(e) => updateItem(idx, { intervalHours: e.target.value })}
                  placeholder="8"
                  disabled={it.ifNecessary}
                />
              </Field>
              <Field label="Duração (dias)" hint="Padrão 7 dias se vazio">
                <Input
                  inputMode="decimal"
                  value={it.durationDays}
                  onChange={(e) => updateItem(idx, { durationDays: e.target.value })}
                  placeholder="7"
                />
              </Field>
              <Field label="Se necessário (SOS)" hint="Sem aprazamento fixo">
                <label className="inline-flex items-center gap-1.5 pt-2 text-sm">
                  <input
                    type="checkbox"
                    checked={it.ifNecessary}
                    onChange={(e) => updateItem(idx, { ifNecessary: e.target.checked })}
                    className="h-3.5 w-3.5"
                  />
                  Item SOS / PRN
                </label>
              </Field>
            </div>

            <Field label="Observações">
              <Textarea
                value={it.notes}
                onChange={(e) => updateItem(idx, { notes: e.target.value })}
                rows={2}
              />
            </Field>
          </div>
        ))}
      </div>

      <Field label="Observações gerais da prescrição">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </Field>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar prescrição'}
        </Button>
      </div>
    </form>
  )
}
