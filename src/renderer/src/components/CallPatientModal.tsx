import { useEffect, useState } from 'react'
import { Modal } from '@renderer/components/ui/Modal'
import { Button } from '@renderer/components/ui/Button'
import { Field, Input } from '@renderer/components/ui/Field'
import type { AppointmentWithRefs } from '@shared/types'

interface Props {
  appointment: AppointmentWithRefs
  onClose: () => void
  onCalled: () => void
}

const LAST_ROOM_KEY = 'gestao-ubs.lastCallRoom'

export function CallPatientModal({ appointment, onClose, onCalled }: Props): React.JSX.Element {
  const [room, setRoom] = useState<string>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(LAST_ROOM_KEY) : null
    return saved ?? 'Consultório 1'
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      const el = document.getElementById('call-room-input') as HTMLInputElement | null
      el?.focus()
      el?.select()
    }, 50)
    return () => clearTimeout(t)
  }, [])

  const submit = async (): Promise<void> => {
    setError(null)
    const trimmed = room.trim()
    if (!trimmed) {
      setError('Informe o consultório / sala.')
      return
    }
    setSaving(true)
    try {
      await window.api.calls.create({
        patientId: appointment.patient.id,
        appointmentId: appointment.id,
        patientName: appointment.patient.fullName,
        room: trimmed,
        message: null
      })
      localStorage.setItem(LAST_ROOM_KEY, trimmed)
      onCalled()
    } catch (err) {
      setError((err as Error).message || 'Erro ao registrar chamada.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      title={`Chamar ${appointment.patient.fullName}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? 'Chamando…' : 'Chamar no painel'}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600">
        Esta ação anuncia o paciente no painel de chamada (tela grande da recepção) com voz em
        português e registra o evento no histórico.
      </p>
      <Field label="Consultório / sala" required>
        <Input
          id="call-room-input"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          placeholder="Ex.: Consultório 2, Sala Vermelha"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit()
          }}
        />
      </Field>
      {error ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}
    </Modal>
  )
}
