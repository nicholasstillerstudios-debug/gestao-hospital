import { useEffect, useState } from 'react'
import { Button } from '@renderer/components/ui/Button'
import { Field, Input, Select, Textarea } from '@renderer/components/ui/Field'
import type { BedWithRefs } from '@shared/types'

interface Props {
  admissionId: number
  currentBedId: number | null
  onCancel: () => void
  onSuccess: () => void
}

export function TransferAdmissionForm({
  admissionId,
  currentBedId,
  onCancel,
  onSuccess
}: Props): React.JSX.Element {
  const [freeBeds, setFreeBeds] = useState<BedWithRefs[]>([])
  const [toBedId, setToBedId] = useState<number | null>(null)
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const beds = await window.api.beds.listFree()
      setFreeBeds(beds.filter((b) => b.id !== currentBedId))
    })()
  }, [currentBedId])

  const submit = async (): Promise<void> => {
    if (busy) return
    if (toBedId == null) {
      setError('Selecione o leito de destino.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await window.api.admissions.transfer({
        admissionId,
        toBedId,
        reason: reason.trim() || null,
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
      <Field label="Leito de destino" required>
        <Select
          value={toBedId ?? ''}
          onChange={(e) => setToBedId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">— Selecione —</option>
          {freeBeds.map((b) => (
            <option key={b.id} value={b.id}>
              {b.wardName} · Leito {b.code}
              {b.roomName ? ` · ${b.roomName}` : ''}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Motivo da transferência" hint="Ex.: agravamento, alta de UTI, isolamento">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
      </Field>
      <Field label="Observações">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </Field>
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        Ao confirmar, o leito atual será posto em <strong>higienização</strong> e o leito de destino
        ficará <strong>ocupado</strong>.
      </div>
      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? 'Transferindo…' : 'Confirmar transferência'}
        </Button>
      </div>
    </form>
  )
}
