import { useState } from 'react'
import { Button } from '@renderer/components/ui/Button'
import { Field, Input, Select, Textarea } from '@renderer/components/ui/Field'
import {
  FLUID_INPUT_SUBTYPES,
  FLUID_OUTPUT_SUBTYPES,
  type FluidBalanceInput,
  type FluidBalanceType
} from '@shared/types'

interface Props {
  admissionId: number
  onCancel: () => void
  onSuccess: () => void
}

export function FluidBalanceForm({ admissionId, onCancel, onSuccess }: Props): React.JSX.Element {
  const [type, setType] = useState<FluidBalanceType>('entrada')
  const [subtype, setSubtype] = useState('')
  const [customSubtype, setCustomSubtype] = useState('')
  const [volume, setVolume] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const subtypes = type === 'entrada' ? FLUID_INPUT_SUBTYPES : FLUID_OUTPUT_SUBTYPES
  const resolvedSubtype = subtype === 'Outro' ? customSubtype : subtype

  const submit = async (): Promise<void> => {
    if (busy) return
    const vol = Number(volume.replace(',', '.'))
    if (!resolvedSubtype.trim()) {
      setError('Informe o tipo de líquido.')
      return
    }
    if (!Number.isFinite(vol) || vol <= 0) {
      setError('Volume deve ser um número positivo (em mL).')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const payload: FluidBalanceInput = {
        admissionId,
        type,
        subtype: resolvedSubtype.trim(),
        volumeMl: Math.round(vol),
        notes: notes.trim() || undefined
      }
      await window.api.fluidBalance.create(payload)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar lançamento.')
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Field label="Tipo">
        <Select value={type} onChange={(e) => { setType(e.target.value as FluidBalanceType); setSubtype('') }}>
          <option value="entrada">Entrada</option>
          <option value="saida">Saída</option>
        </Select>
      </Field>

      <Field label="Líquido">
        <Select value={subtype} onChange={(e) => setSubtype(e.target.value)}>
          <option value="">Selecione...</option>
          {subtypes.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
      </Field>

      {subtype === 'Outro' && (
        <Field label="Especifique">
          <Input
            value={customSubtype}
            onChange={(e) => setCustomSubtype(e.target.value)}
            placeholder="Descreva o líquido..."
          />
        </Field>
      )}

      <Field label="Volume (mL)">
        <Input
          type="number"
          min="1"
          max="99999"
          value={volume}
          onChange={(e) => setVolume(e.target.value)}
          placeholder="ex: 500"
        />
      </Field>

      <Field label="Observações">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Observações adicionais (opcional)..."
        />
      </Field>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2 justify-end pt-2">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button onClick={submit} disabled={busy}>
          {busy ? 'Salvando…' : 'Registrar'}
        </Button>
      </div>
    </div>
  )
}
