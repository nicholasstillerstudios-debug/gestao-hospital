import { useState } from 'react'
import { Button } from '@renderer/components/ui/Button'
import { Field, Input, Select, Textarea } from '@renderer/components/ui/Field'
import { DISCHARGE_TYPE_LABELS, type DischargeType } from '@shared/types'

interface Props {
  admissionId: number
  patientName: string
  onCancel: () => void
  onSuccess: () => void
}

export function DischargeAdmissionForm({
  admissionId,
  patientName,
  onCancel,
  onSuccess
}: Props): React.JSX.Element {
  const [dischargeType, setDischargeType] = useState<DischargeType>('alta_melhora')
  const [summary, setSummary] = useState('')
  const [cid10, setCid10] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isObito = dischargeType === 'obito'

  const submit = async (): Promise<void> => {
    if (busy) return
    if (isObito) {
      const ok = window.confirm(
        `Confirma o registro de ÓBITO de ${patientName}? Esta ação é irreversível.`
      )
      if (!ok) return
    }
    setBusy(true)
    setError(null)
    try {
      await window.api.admissions.discharge({
        admissionId,
        dischargeType,
        dischargeSummary: summary.trim() || null,
        dischargeCid10: cid10.trim() || null,
        notes: notes.trim() || null
      })
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

      <Field label="Tipo de saída" required>
        <Select
          value={dischargeType}
          onChange={(e) => setDischargeType(e.target.value as DischargeType)}
        >
          {(Object.keys(DISCHARGE_TYPE_LABELS) as DischargeType[]).map((t) => (
            <option key={t} value={t}>
              {DISCHARGE_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label={isObito ? 'Resumo / circunstância do óbito' : 'Resumo de alta'}
        hint={
          isObito
            ? 'Hora, causa imediata, intercorrências'
            : 'Evolução, condutas, orientações para acompanhamento'
        }
      >
        <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} />
      </Field>

      <Field label="CID-10 final" hint="Se aplicável">
        <Input value={cid10} onChange={(e) => setCid10(e.target.value)} maxLength={10} />
      </Field>

      <Field label="Observações internas">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </Field>

      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        Ao confirmar, a internação será encerrada e o leito ficará em <strong>higienização</strong>.
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" variant={isObito ? 'danger' : 'primary'} disabled={busy}>
          {busy ? 'Salvando…' : isObito ? 'Registrar óbito' : 'Confirmar saída'}
        </Button>
      </div>
    </form>
  )
}
