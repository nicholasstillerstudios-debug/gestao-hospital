/**
 * SINAN — Notificações compulsórias.
 * Lista + cadastro + impressão da ficha + export CSV para o SINAN-NET.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@renderer/components/PageHeader'
import { Button } from '@renderer/components/ui/Button'
import { Modal } from '@renderer/components/ui/Modal'
import { CodePicker } from '@renderer/components/CodePicker'
import { Field, Input, Select } from '@renderer/components/ui/Field'
import { formatDateTimeBr } from '@renderer/lib/utils'
import {
  SINAN_COMMON_AGRAVOS,
  type Patient,
  type Professional,
  type SinanNotificationInput,
  type SinanNotificationWithRefs
} from '@shared/types'

export function SinanPage(): React.JSX.Element {
  const navigate = useNavigate()
  const [items, setItems] = useState<SinanNotificationWithRefs[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)

  const load = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      setItems(await window.api.sinan.list())
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const handleDelete = async (id: number): Promise<void> => {
    if (!window.confirm('Excluir notificação?')) return
    try {
      await window.api.sinan.delete(id)
      await load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const handleExport = async (): Promise<void> => {
    setError(null)
    setNotice(null)
    try {
      const r = await window.api.sinan.exportCsv()
      if (r.saved && r.path) {
        setNotice(`${r.count} notificação(ões) exportada(s) em ${r.path}.`)
        await load()
      }
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <>
      <PageHeader
        title="SINAN"
        subtitle="Notificações compulsórias (Sistema de Informação de Agravos de Notificação)"
        eyebrow="SUS"
        actions={
          <>
            <Button variant="outline" onClick={() => void handleExport()}>
              Exportar CSV
            </Button>
            <Button onClick={() => setShowNew(true)}>+ Nova notificação</Button>
          </>
        }
      />
      <section className="p-6 space-y-4">
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
            {notice}
          </div>
        ) : null}

        {loading ? (
          <div className="text-sm text-slate-500">Carregando…</div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            Nenhuma notificação registrada.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-4 py-3">Notificado em</th>
                  <th className="px-4 py-3">Agravo</th>
                  <th className="px-4 py-3">Paciente</th>
                  <th className="px-4 py-3">Profissional</th>
                  <th className="px-4 py-3">Exportado</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((n) => (
                  <tr key={n.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {formatDateTimeBr(n.notificadoEm)}
                    </td>
                    <td className="px-4 py-2">
                      <span className="font-mono text-xs">{n.agravoCid}</span> · {n.agravoName}
                    </td>
                    <td className="px-4 py-2">{n.patientName}</td>
                    <td className="px-4 py-2 text-xs text-slate-600">
                      {n.professionalName ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {n.exportedAt ? (
                        <span className="text-emerald-700">
                          ✓ {formatDateTimeBr(n.exportedAt)}
                        </span>
                      ) : (
                        <span className="text-slate-400">pendente</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          variant="outline"
                          onClick={() => navigate(`/imprimir/sinan/${n.id}`)}
                        >
                          Ficha
                        </Button>
                        <Button variant="ghost" onClick={() => void handleDelete(n.id)}>
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
        <NewSinanModal
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

function NewSinanModal({
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
  const [agravoCid, setAgravoCid] = useState(SINAN_COMMON_AGRAVOS[0].cid)
  const [agravoName, setAgravoName] = useState(SINAN_COMMON_AGRAVOS[0].name)
  const [sintomasIniciaisEm, setSintomasIniciaisEm] = useState('')
  const [classificacao, setClassificacao] = useState('')
  const [evolucao, setEvolucao] = useState('')
  const [observations, setObservations] = useState('')
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

  const handleAgravo = (cid: string): void => {
    const a = SINAN_COMMON_AGRAVOS.find((x) => x.cid === cid)
    setAgravoCid(cid)
    if (a) setAgravoName(a.name)
  }

  const submit = async (): Promise<void> => {
    setError(null)
    if (!patient) return setError('Selecione o paciente.')
    if (!agravoCid.trim() || !agravoName.trim()) return setError('Informe o agravo.')
    setSaving(true)
    try {
      const input: SinanNotificationInput = {
        patientId: patient.id,
        professionalId: professionalId ? Number(professionalId) : null,
        agravoCid: agravoCid.trim(),
        agravoName: agravoName.trim(),
        sintomasIniciaisEm: sintomasIniciaisEm || null,
        classificacao: classificacao.trim() || null,
        evolucao: evolucao.trim() || null,
        observations: observations.trim() || null
      }
      await window.api.sinan.create(input)
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open title="Nova notificação SINAN" onClose={onClose} size="lg">
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
                {p.fullName} {p.cpf ? <span className="text-xs text-slate-500">CPF {p.cpf}</span> : null}
              </button>
            ))}
          </div>
        ) : null}

        <Field label="Profissional notificador">
          <Select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
            <option value="">—</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Agravo (CID-10)" required>
            <Select value={agravoCid} onChange={(e) => handleAgravo(e.target.value)}>
              {SINAN_COMMON_AGRAVOS.map((a) => (
                <option key={a.cid} value={a.cid}>
                  {a.cid} — {a.name}
                </option>
              ))}
              <option value="">Outro (CID-10 customizado)</option>
            </Select>
          </Field>
          {!SINAN_COMMON_AGRAVOS.find((a) => a.cid === agravoCid) ? (
            <Field label="CID + nome">
              <CodePicker
                catalog="cid10"
                value={agravoCid}
                onChange={setAgravoCid}
                onPick={(code, name) => {
                  setAgravoCid(code)
                  setAgravoName(name)
                }}
                placeholder="Código ou diagnóstico"
              />
              <Input
                className="mt-1"
                value={agravoName}
                onChange={(e) => setAgravoName(e.target.value)}
                placeholder="Nome do agravo"
              />
            </Field>
          ) : (
            <Field label="Início dos sintomas">
              <Input
                type="date"
                value={sintomasIniciaisEm}
                onChange={(e) => setSintomasIniciaisEm(e.target.value)}
              />
            </Field>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Classificação (provável / confirmado / descartado)">
            <Input value={classificacao} onChange={(e) => setClassificacao(e.target.value)} />
          </Field>
          <Field label="Evolução">
            <Input value={evolucao} onChange={(e) => setEvolucao(e.target.value)} />
          </Field>
        </div>

        <Field label="Observações">
          <textarea
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            rows={2}
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? 'Salvando…' : 'Notificar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
