/**
 * Atestados e declarações — lista + cadastro rápido. Impressão usa a
 * página /imprimir/atestado-doc/:id (gerada em Print.tsx).
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@renderer/components/PageHeader'
import { Button } from '@renderer/components/ui/Button'
import { Modal } from '@renderer/components/ui/Modal'
import { Field, Input, Select } from '@renderer/components/ui/Field'
import { CodePicker } from '@renderer/components/CodePicker'
import { formatDateTimeBr } from '@renderer/lib/utils'
import {
  ATTESTATION_KIND_LABELS,
  type AttestationInput,
  type AttestationKind,
  type AttestationWithRefs,
  type Patient,
  type Professional
} from '@shared/types'

export function AttestationsPage(): React.JSX.Element {
  const navigate = useNavigate()
  const [items, setItems] = useState<AttestationWithRefs[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)

  const load = async (): Promise<void> => {
    setLoading(true)
    try {
      setItems(await window.api.attestations.list(200))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
  }, [])

  const remove = async (id: number): Promise<void> => {
    if (!window.confirm('Excluir este atestado?')) return
    await window.api.attestations.delete(id)
    await load()
  }

  return (
    <>
      <PageHeader
        title="Atestados / Declarações"
        subtitle="Modelos prontos: atestado médico, comparecimento, acompanhante, aptidão"
        eyebrow="Clínico"
        actions={<Button onClick={() => setShowNew(true)}>+ Emitir documento</Button>}
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
            Nenhum documento emitido.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-4 py-3">Emitido em</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Paciente</th>
                  <th className="px-4 py-3">Profissional</th>
                  <th className="px-4 py-3">CID / Dias</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {formatDateTimeBr(a.issuedAt)}
                    </td>
                    <td className="px-4 py-2 text-xs">{ATTESTATION_KIND_LABELS[a.kind]}</td>
                    <td className="px-4 py-2">{a.patientName}</td>
                    <td className="px-4 py-2 text-xs text-slate-600">
                      {a.professionalName ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-600">
                      {a.cid10 ? <span className="font-mono">{a.cid10}</span> : '—'}
                      {a.days ? ` · ${a.days} dia(s)` : ''}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          variant="outline"
                          onClick={() => navigate(`/imprimir/atestado-doc/${a.id}`)}
                        >
                          Imprimir
                        </Button>
                        <Button variant="ghost" onClick={() => void remove(a.id)}>
                          Excluir
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showNew ? (
        <NewAttestationModal
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

function NewAttestationModal({
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
  const [kind, setKind] = useState<AttestationKind>('medico')
  const [days, setDays] = useState('1')
  const [cid10, setCid10] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [bodyText, setBodyText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void window.api.professionals.list().then(setProfessionals)
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

  const submit = async (): Promise<void> => {
    setError(null)
    if (!patient) return setError('Selecione o paciente.')
    setSaving(true)
    try {
      const input: AttestationInput = {
        patientId: patient.id,
        professionalId: professionalId ? Number(professionalId) : null,
        kind,
        days: kind === 'medico' && days ? Number(days) : null,
        cid10: cid10.trim() || null,
        startDate: startDate || null,
        endDate: null,
        bodyText: bodyText.trim() || null
      }
      await window.api.attestations.create(input)
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open title="Emitir atestado / declaração" onClose={onClose} size="lg">
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
                {p.fullName}
              </button>
            ))}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Profissional emissor">
            <Select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
              <option value="">—</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tipo" required>
            <Select value={kind} onChange={(e) => setKind(e.target.value as AttestationKind)}>
              {(Object.keys(ATTESTATION_KIND_LABELS) as AttestationKind[]).map((k) => (
                <option key={k} value={k}>
                  {ATTESTATION_KIND_LABELS[k]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Data início">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          {kind === 'medico' ? (
            <Field label="Dias de afastamento">
              <Input
                type="number"
                min={1}
                max={365}
                value={days}
                onChange={(e) => setDays(e.target.value.replace(/\D/g, ''))}
              />
            </Field>
          ) : (
            <div />
          )}
          <Field label="CID-10 (opcional)">
            <CodePicker catalog="cid10" value={cid10} onChange={setCid10} />
          </Field>
        </div>

        <Field label={kind === 'custom' ? 'Texto do documento' : 'Observações'}>
          <textarea
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            rows={kind === 'custom' ? 5 : 2}
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            placeholder={
              kind === 'custom'
                ? 'Texto completo a ser impresso (substitui o modelo padrão).'
                : 'Observações adicionais para o atestado.'
            }
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? 'Emitindo…' : 'Emitir'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
