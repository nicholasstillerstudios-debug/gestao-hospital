import { useState } from 'react'
import { Button } from '@renderer/components/ui/Button'
import { Field, Input, Textarea } from '@renderer/components/ui/Field'
import { Modal } from '@renderer/components/ui/Modal'
import type { PrescriptionInput, PrescriptionItem } from '@shared/types'

const EMPTY_ITEM: PrescriptionItem = {
  medication: '',
  dose: null,
  via: null,
  posology: null,
  duration: null,
  quantity: null,
  notes: null
}

function ItemRow(props: {
  item: PrescriptionItem
  index: number
  onChange: (item: PrescriptionItem) => void
  onRemove: () => void
  removable: boolean
}): React.JSX.Element {
  const { item, index, onChange, onRemove, removable } = props
  const set = <K extends keyof PrescriptionItem>(key: K, value: string | null): void => {
    onChange({ ...item, [key]: value })
  }
  const opt = (v: string): string | null => (v.trim().length > 0 ? v : null)

  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold text-slate-600">Item {index + 1}</div>
        {removable ? (
          <Button size="sm" variant="ghost" onClick={onRemove}>
            Remover
          </Button>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field className="md:col-span-2" label="Medicamento *">
          <Input
            value={item.medication}
            onChange={(e) => set('medication', e.target.value)}
            placeholder="Ex.: Dipirona sódica"
          />
        </Field>
        <Field label="Apresentação / dose">
          <Input
            value={item.dose ?? ''}
            onChange={(e) => set('dose', opt(e.target.value))}
            placeholder="Ex.: 500 mg comprimido"
          />
        </Field>
        <Field label="Via">
          <Input
            value={item.via ?? ''}
            onChange={(e) => set('via', opt(e.target.value))}
            placeholder="Ex.: oral"
          />
        </Field>
        <Field label="Posologia">
          <Input
            value={item.posology ?? ''}
            onChange={(e) => set('posology', opt(e.target.value))}
            placeholder="Ex.: 1 cp 8/8h"
          />
        </Field>
        <Field label="Duração">
          <Input
            value={item.duration ?? ''}
            onChange={(e) => set('duration', opt(e.target.value))}
            placeholder="Ex.: 5 dias"
          />
        </Field>
        <Field label="Quantidade total">
          <Input
            value={item.quantity ?? ''}
            onChange={(e) => set('quantity', opt(e.target.value))}
            placeholder="Ex.: 15 cp"
          />
        </Field>
        <Field className="md:col-span-2" label="Observações">
          <Input
            value={item.notes ?? ''}
            onChange={(e) => set('notes', opt(e.target.value))}
            placeholder="Ex.: usar após as refeições"
          />
        </Field>
      </div>
    </div>
  )
}

export function PrescriptionModal(props: {
  open: boolean
  patientId: number
  attendanceId: number | null
  professionalId: number
  onClose: () => void
  onSaved: (id: number) => void
}): React.JSX.Element | null {
  const { open, patientId, attendanceId, professionalId, onClose, onSaved } = props
  const [items, setItems] = useState<PrescriptionItem[]>([{ ...EMPTY_ITEM }])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const updateItem = (idx: number, item: PrescriptionItem): void => {
    setItems((current) => current.map((it, i) => (i === idx ? item : it)))
  }
  const removeItem = (idx: number): void => {
    setItems((current) => current.filter((_, i) => i !== idx))
  }
  const addItem = (): void => {
    setItems((current) => [...current, { ...EMPTY_ITEM }])
  }

  const submit = async (): Promise<void> => {
    setError(null)
    setSaving(true)
    try {
      const input: PrescriptionInput = {
        patientId,
        attendanceId,
        professionalId,
        notes: notes.trim() ? notes.trim() : null,
        items: items.filter((it) => it.medication.trim().length > 0)
      }
      const created = await window.api.prescriptions.create(input)
      onSaved(created.id)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Novo receituário" size="lg">
      <div className="space-y-3">
        {items.map((item, idx) => (
          <ItemRow
            key={idx}
            item={item}
            index={idx}
            onChange={(it) => updateItem(idx, it)}
            onRemove={() => removeItem(idx)}
            removable={items.length > 1}
          />
        ))}
        <div>
          <Button size="sm" variant="outline" onClick={addItem}>
            + Adicionar medicamento
          </Button>
        </div>
        <Field label="Observações gerais">
          <Textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Orientações ao paciente, restrições, retorno…"
          />
        </Field>
        {error ? (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
            {error}
          </div>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar e abrir impressão'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
