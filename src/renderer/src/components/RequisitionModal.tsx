import { useState } from 'react'
import { Button } from '@renderer/components/ui/Button'
import { Field, Input, Select, Textarea } from '@renderer/components/ui/Field'
import { Modal } from '@renderer/components/ui/Modal'
import type { RequisitionInput, RequisitionType } from '@shared/types'
import { REQUISITION_TYPE_LABELS } from '@shared/types'

const TYPES: RequisitionType[] = ['laboratorio', 'imagem', 'procedimento', 'encaminhamento']

export function RequisitionModal(props: {
  open: boolean
  patientId: number
  attendanceId: number | null
  professionalId: number
  onClose: () => void
  onSaved: (id: number) => void
}): React.JSX.Element | null {
  const { open, patientId, attendanceId, professionalId, onClose, onSaved } = props
  const [type, setType] = useState<RequisitionType>('laboratorio')
  const [items, setItems] = useState<string[]>([''])
  const [observations, setObservations] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const updateItem = (idx: number, value: string): void => {
    setItems((current) => current.map((it, i) => (i === idx ? value : it)))
  }
  const addItem = (): void => setItems((current) => [...current, ''])
  const removeItem = (idx: number): void =>
    setItems((current) => current.filter((_, i) => i !== idx))

  const submit = async (): Promise<void> => {
    setError(null)
    setSaving(true)
    try {
      const input: RequisitionInput = {
        patientId,
        attendanceId,
        professionalId,
        type,
        items: items.map((s) => s.trim()).filter((s) => s.length > 0),
        observations: observations.trim() ? observations.trim() : null
      }
      const created = await window.api.requisitions.create(input)
      onSaved(created.id)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Nova requisição" size="lg">
      <div className="space-y-3">
        <Field label="Tipo">
          <Select value={type} onChange={(e) => setType(e.target.value as RequisitionType)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {REQUISITION_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>
        <div>
          <div className="mb-1 text-xs font-medium text-slate-600">Itens *</div>
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  value={item}
                  onChange={(e) => updateItem(idx, e.target.value)}
                  placeholder={
                    type === 'laboratorio'
                      ? 'Ex.: Hemograma completo'
                      : type === 'imagem'
                        ? 'Ex.: Raio-X de tórax PA e perfil'
                        : type === 'procedimento'
                          ? 'Ex.: Curativo simples'
                          : 'Ex.: Cardiologia (avaliar dor torácica)'
                  }
                />
                {items.length > 1 ? (
                  <Button size="sm" variant="ghost" onClick={() => removeItem(idx)}>
                    ✕
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
          <div className="mt-2">
            <Button size="sm" variant="outline" onClick={addItem}>
              + Adicionar item
            </Button>
          </div>
        </div>
        <Field label="Observações / hipótese diagnóstica">
          <Textarea
            rows={3}
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            placeholder="Justificativa clínica, sinais e sintomas, urgência…"
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
