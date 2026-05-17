/**
 * Formulário para admitir paciente em um leito específico.
 *
 * Usado tanto a partir do mapa de leitos (com leito pré-selecionado) quanto
 * da lista de internações (com paciente pré-selecionado, escolhendo leito).
 */
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@renderer/components/ui/Button'
import { Field, Input, Select, Textarea } from '@renderer/components/ui/Field'
import { CodePicker } from '@renderer/components/CodePicker'
import { ageFromBirthDate, formatCpf } from '@renderer/lib/utils'
import {
  ADMISSION_TYPE_LABELS,
  type AdmissionType,
  type BedWithRefs,
  type Patient,
  type Professional
} from '@shared/types'

interface Props {
  bed?: BedWithRefs
  /** Pré-seleciona um paciente (ex.: vindo da página do paciente). */
  patientId?: number
  onCancel: () => void
  onSuccess: () => void
}

export function AdmitPatientForm({
  bed,
  patientId,
  onCancel,
  onSuccess
}: Props): React.JSX.Element {
  const [patientQuery, setPatientQuery] = useState('')
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(patientId ?? null)

  const [freeBeds, setFreeBeds] = useState<BedWithRefs[]>([])
  const [selectedBedId, setSelectedBedId] = useState<number | null>(bed?.id ?? null)

  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [attendingProfId, setAttendingProfId] = useState<number | null>(null)

  const [admissionType, setAdmissionType] = useState<AdmissionType>('eletiva')
  const [origin, setOrigin] = useState('')
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [cid10, setCid10] = useState('')
  const [notes, setNotes] = useState('')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const profs = await window.api.professionals.list(true)
      setProfessionals(profs)
      if (!bed) {
        const beds = await window.api.beds.listFree()
        setFreeBeds(beds)
      }
      if (patientId != null) {
        const p = await window.api.patients.get(patientId)
        if (p) setPatients([p])
      }
    })()
  }, [bed, patientId])

  useEffect(() => {
    const q = patientQuery.trim()
    if (q.length < 2) {
      if (patientId == null) setPatients([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const rows = await window.api.patients.search(q)
        if (!cancelled) setPatients(rows)
      } catch {
        // ignora — busca client-side só
      }
    })()
    return () => {
      cancelled = true
    }
  }, [patientQuery, patientId])

  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === selectedPatientId) ?? null,
    [patients, selectedPatientId]
  )

  const submit = async (): Promise<void> => {
    if (busy) return
    if (selectedPatientId == null) {
      setError('Selecione o paciente.')
      return
    }
    if (selectedBedId == null) {
      setError('Selecione o leito.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await window.api.admissions.admit({
        patientId: selectedPatientId,
        bedId: selectedBedId,
        attendingProfessionalId: attendingProfId,
        admissionType,
        admissionOrigin: origin.trim() || null,
        chiefComplaint: chiefComplaint.trim() || null,
        admissionDiagnosis: diagnosis.trim() || null,
        admissionCid10: cid10.trim() || null,
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

      {bed ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          Leito de destino: <span className="font-semibold">{bed.code}</span> · {bed.wardName}
          {bed.roomName ? ` · ${bed.roomName}` : ''}
        </div>
      ) : (
        <Field label="Leito" required>
          <Select
            value={selectedBedId ?? ''}
            onChange={(e) => setSelectedBedId(e.target.value ? Number(e.target.value) : null)}
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
      )}

      {patientId == null ? (
        <>
          <Field label="Paciente" required hint="Digite parte do nome, CPF ou CNS para buscar">
            <Input
              value={patientQuery}
              onChange={(e) => setPatientQuery(e.target.value)}
              placeholder="Buscar paciente…"
              autoFocus
            />
          </Field>
          {/* Lista FORA do <Field> — <Field> renderiza <label>, e cliques em
              <li> dentro de <label> são redirecionados pro input. */}
          {patients.length > 0 ? (
            <div className="-mt-2 max-h-44 overflow-y-auto rounded-md border border-slate-200">
              {patients.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`block w-full cursor-pointer border-b border-slate-100 px-3 py-1.5 text-left text-sm last:border-b-0 hover:bg-slate-50 ${
                    p.id === selectedPatientId ? 'bg-cyan-50' : ''
                  }`}
                  onClick={() => setSelectedPatientId(p.id)}
                >
                  <div className="font-medium text-slate-800">{p.fullName}</div>
                  <div className="text-[11px] text-slate-500">
                    {p.cpf ? `CPF ${formatCpf(p.cpf)}` : 'sem CPF'}
                    {p.birthDate ? ` · ${ageFromBirthDate(p.birthDate)} anos` : ''}
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      {selectedPatient ? (
        <div className="rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-900">
          <span className="font-semibold">{selectedPatient.fullName}</span>
          {selectedPatient.cpf ? ` · CPF ${formatCpf(selectedPatient.cpf)}` : ''}
          {selectedPatient.birthDate
            ? ` · ${ageFromBirthDate(selectedPatient.birthDate)} anos`
            : ''}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Tipo de admissão" required>
          <Select
            value={admissionType}
            onChange={(e) => setAdmissionType(e.target.value as AdmissionType)}
          >
            {(Object.keys(ADMISSION_TYPE_LABELS) as AdmissionType[]).map((t) => (
              <option key={t} value={t}>
                {ADMISSION_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Médico responsável">
          <Select
            value={attendingProfId ?? ''}
            onChange={(e) => setAttendingProfId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— A definir —</option>
            {professionals
              .filter((p) => p.category === 'medico' || !p.category)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                  {p.specialty ? ` · ${p.specialty}` : ''}
                </option>
              ))}
          </Select>
        </Field>
      </div>

      <Field label="Origem (PS, ambulatório, transferência…)">
        <Input value={origin} onChange={(e) => setOrigin(e.target.value)} maxLength={200} />
      </Field>

      <Field label="Queixa principal">
        <Textarea
          value={chiefComplaint}
          onChange={(e) => setChiefComplaint(e.target.value)}
          rows={2}
        />
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
        <Field label="Hipótese diagnóstica">
          <Textarea value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} rows={2} />
        </Field>
        <Field label="CID-10">
          <CodePicker catalog="cid10" value={cid10} onChange={setCid10} placeholder="CID ou diagnóstico" />
        </Field>
      </div>

      <Field label="Observações">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </Field>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? 'Admitindo…' : 'Admitir paciente'}
        </Button>
      </div>
    </form>
  )
}
