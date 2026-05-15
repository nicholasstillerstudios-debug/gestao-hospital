import { useEffect, useState } from 'react'
import { Button } from '@renderer/components/ui/Button'
import { Field, Input, Select, Textarea } from '@renderer/components/ui/Field'
import type { AdmissionVitalSignsInput, Professional } from '@shared/types'

interface Props {
  admissionId: number
  onCancel: () => void
  onSuccess: () => void
}

const numberOrNull = (raw: string): number | null => {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const cleaned = trimmed.replace(',', '.')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/**
 * Formulário de registro pontual de sinais vitais (PA, FC, FR, SatO2,
 * temperatura, dor 0–10, glicemia, peso, altura). Todos os campos são
 * opcionais — o operador preenche apenas o que aferiu. O backend valida
 * faixas plausíveis para evitar typo grosseiro (ex.: PA 1200).
 */
export function VitalSignsForm({ admissionId, onCancel, onSuccess }: Props): React.JSX.Element {
  const [systolic, setSystolic] = useState('')
  const [diastolic, setDiastolic] = useState('')
  const [heartRate, setHeartRate] = useState('')
  const [respiratoryRate, setRespiratoryRate] = useState('')
  const [temperature, setTemperature] = useState('')
  const [oxygenSat, setOxygenSat] = useState('')
  const [painScore, setPainScore] = useState('')
  const [bloodGlucose, setBloodGlucose] = useState('')
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [notes, setNotes] = useState('')
  const [professionalId, setProfessionalId] = useState<number | ''>('')
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void window.api.professionals
      .list(true)
      .then(setProfessionals)
      .catch(() => undefined)
  }, [])

  const submit = async (): Promise<void> => {
    if (busy) return
    const payload: AdmissionVitalSignsInput = {
      admissionId,
      professionalId: professionalId === '' ? null : professionalId,
      systolicBp: numberOrNull(systolic),
      diastolicBp: numberOrNull(diastolic),
      heartRate: numberOrNull(heartRate),
      respiratoryRate: numberOrNull(respiratoryRate),
      temperatureC: numberOrNull(temperature),
      oxygenSaturation: numberOrNull(oxygenSat),
      painScore: numberOrNull(painScore),
      bloodGlucose: numberOrNull(bloodGlucose),
      weightKg: numberOrNull(weight),
      heightCm: numberOrNull(height),
      notes: notes.trim() || null
    }
    setBusy(true)
    setError(null)
    try {
      await window.api.vitalSigns.create(payload)
      onSuccess()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="space-y-3"
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="PAS (mmHg)" hint="Sistólica">
          <Input
            inputMode="numeric"
            value={systolic}
            onChange={(e) => setSystolic(e.target.value)}
            maxLength={4}
            autoFocus
          />
        </Field>
        <Field label="PAD (mmHg)" hint="Diastólica">
          <Input
            inputMode="numeric"
            value={diastolic}
            onChange={(e) => setDiastolic(e.target.value)}
            maxLength={4}
          />
        </Field>
        <Field label="FC (bpm)">
          <Input
            inputMode="numeric"
            value={heartRate}
            onChange={(e) => setHeartRate(e.target.value)}
            maxLength={3}
          />
        </Field>
        <Field label="FR (irpm)">
          <Input
            inputMode="numeric"
            value={respiratoryRate}
            onChange={(e) => setRespiratoryRate(e.target.value)}
            maxLength={3}
          />
        </Field>
        <Field label="Temp (°C)">
          <Input
            inputMode="decimal"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
            maxLength={5}
            placeholder="36,5"
          />
        </Field>
        <Field label="SatO₂ (%)">
          <Input
            inputMode="numeric"
            value={oxygenSat}
            onChange={(e) => setOxygenSat(e.target.value)}
            maxLength={3}
          />
        </Field>
        <Field label="Dor (0–10)">
          <Input
            inputMode="numeric"
            value={painScore}
            onChange={(e) => setPainScore(e.target.value)}
            maxLength={2}
          />
        </Field>
        <Field label="Glicemia (mg/dL)">
          <Input
            inputMode="numeric"
            value={bloodGlucose}
            onChange={(e) => setBloodGlucose(e.target.value)}
            maxLength={4}
          />
        </Field>
        <Field label="Peso (kg)">
          <Input
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            maxLength={6}
            placeholder="70,5"
          />
        </Field>
        <Field label="Altura (cm)">
          <Input
            inputMode="numeric"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            maxLength={3}
          />
        </Field>
      </div>

      <Field label="Profissional" hint="Opcional — quem aferiu">
        <Select
          value={professionalId}
          onChange={(e) => setProfessionalId(e.target.value === '' ? '' : Number(e.target.value))}
        >
          <option value="">— Selecione —</option>
          {professionals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Observações">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </Field>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? 'Salvando…' : 'Registrar aferição'}
        </Button>
      </div>
    </form>
  )
}
