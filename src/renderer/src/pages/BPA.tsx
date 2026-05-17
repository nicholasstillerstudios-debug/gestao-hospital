/**
 * BPA — Produção SUS:
 *  - lista de registros do mês selecionado
 *  - novo registro manual (paciente, profissional, código SIGTAP, data)
 *  - consolidação mensal (fecha o mês, totaliza)
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@renderer/components/PageHeader'
import { Button } from '@renderer/components/ui/Button'
import { Modal } from '@renderer/components/ui/Modal'
import { Input, Field } from '@renderer/components/ui/Field'
import { CodePicker } from '@renderer/components/CodePicker'
import { formatDateTimeBr } from '@renderer/lib/utils'
import type {
  BpaConsolidation,
  BpaRecordInput,
  BpaRecordWithRefs,
  Patient,
  Professional
} from '@shared/types'

const STATUS_LABELS: Record<string, string> = {
  aberto: 'Aberto',
  fechado: 'Fechado',
  exportado: 'Exportado'
}

const today = new Date()
const DEFAULT_YEAR = today.getFullYear()
const DEFAULT_MONTH = today.getMonth() + 1

export function BPAPage(): React.JSX.Element {
  const navigate = useNavigate()
  const [year, setYear] = useState(DEFAULT_YEAR)
  const [month, setMonth] = useState(DEFAULT_MONTH)
  const [records, setRecords] = useState<BpaRecordWithRefs[]>([])
  const [consolidations, setConsolidations] = useState<BpaConsolidation[]>([])
  const [summary, setSummary] = useState<{
    period: string
    totalRecords: number
    totalProcedures: number
    byProcedure: { code: string; name: string; count: number; total: number }[]
    consolidation: BpaConsolidation | null
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)

  const load = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const [recs, cons, summ] = await Promise.all([
        window.api.bpa.listRecords({ year, month }),
        window.api.bpa.listConsolidations(),
        window.api.bpa.getSummary(year, month)
      ])
      setRecords(recs)
      setConsolidations(cons)
      setSummary(summ)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [year, month]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleExportFile = async (): Promise<void> => {
    setError(null)
    try {
      const r = await window.api.bpa.exportFile(year, month)
      if (r.saved && r.path) {
        window.alert(
          `Arquivo BPA-MAGNÉTICO gerado:\n${r.path}\n\n${r.lineCount} linha(s) tipo 03 (BPA-I).`
        )
      }
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const handleConsolidate = async (): Promise<void> => {
    if (
      !window.confirm(
        `Consolidar competência ${String(month).padStart(2, '0')}/${year}? ` +
          'Após consolidar, os registros não podem mais ser excluídos.'
      )
    )
      return
    setError(null)
    try {
      await window.api.bpa.consolidate(year, month)
      await load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <>
      <PageHeader
        title="BPA — Produção SUS"
        subtitle="Boletim de Produção Ambulatorial"
        eyebrow="SUS"
        actions={
          <>
            <Button variant="outline" onClick={() => setShowNew(true)}>
              + Registro
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/imprimir/bpa/${year}/${month}`)}
            >
              Imprimir BPA-I
            </Button>
            <Button variant="outline" onClick={() => void handleExportFile()}>
              Exportar .bpa
            </Button>
            <Button onClick={() => void handleConsolidate()}>Consolidar mês</Button>
          </>
        }
      />
      <section className="p-6">
        {error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Field label="Ano">
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value) || DEFAULT_YEAR)}
              className="w-28"
            />
          </Field>
          <Field label="Mês">
            <select
              className="block rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {[
                'Janeiro',
                'Fevereiro',
                'Março',
                'Abril',
                'Maio',
                'Junho',
                'Julho',
                'Agosto',
                'Setembro',
                'Outubro',
                'Novembro',
                'Dezembro'
              ].map((m, i) => (
                <option key={i} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {summary ? (
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="Registros" value={summary.totalRecords} />
            <Stat label="Procedimentos (qtd)" value={summary.totalProcedures} />
            <Stat
              label="Status"
              value={
                summary.consolidation ? STATUS_LABELS[summary.consolidation.status] : 'Sem consolidar'
              }
            />
          </div>
        ) : null}

        {loading ? (
          <div className="text-sm text-slate-500">Carregando…</div>
        ) : (
          <>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Registros do período</h3>
            {records.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                Nenhum registro no período.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Código</th>
                      <th className="px-4 py-3">Procedimento</th>
                      <th className="px-4 py-3">Paciente</th>
                      <th className="px-4 py-3">Profissional</th>
                      <th className="px-4 py-3 text-right">Qtd</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {records.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {r.procedureDate.slice(0, 10)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-700">
                          {r.procedureCode}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{r.procedureName}</td>
                        <td className="px-4 py-3 text-slate-700">{r.patientName ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-700">{r.professionalName ?? '—'}</td>
                        <td className="px-4 py-3 text-right font-mono">{r.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {summary && summary.byProcedure.length > 0 ? (
              <>
                <h3 className="mb-2 mt-6 text-sm font-semibold text-slate-700">
                  Resumo por procedimento
                </h3>
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      <tr>
                        <th className="px-4 py-3">Código</th>
                        <th className="px-4 py-3">Procedimento</th>
                        <th className="px-4 py-3 text-right">Registros</th>
                        <th className="px-4 py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {summary.byProcedure.map((p) => (
                        <tr key={p.code}>
                          <td className="px-4 py-3 font-mono text-xs">{p.code}</td>
                          <td className="px-4 py-3 text-slate-700">{p.name}</td>
                          <td className="px-4 py-3 text-right font-mono">{p.count}</td>
                          <td className="px-4 py-3 text-right font-mono">{p.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}

            {consolidations.length > 0 ? (
              <>
                <h3 className="mb-2 mt-6 text-sm font-semibold text-slate-700">
                  Histórico de consolidações
                </h3>
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      <tr>
                        <th className="px-4 py-3">Competência</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Registros</th>
                        <th className="px-4 py-3 text-right">Procedimentos</th>
                        <th className="px-4 py-3">Gerado em</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {consolidations.map((c) => (
                        <tr key={c.id}>
                          <td className="px-4 py-3 font-mono">
                            {String(c.month).padStart(2, '0')}/{c.year}
                          </td>
                          <td className="px-4 py-3 text-xs">{STATUS_LABELS[c.status]}</td>
                          <td className="px-4 py-3 text-right font-mono">{c.totalRecords}</td>
                          <td className="px-4 py-3 text-right font-mono">{c.totalProcedures}</td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {c.generatedAt ? formatDateTimeBr(c.generatedAt) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </>
        )}
      </section>

      {showNew ? (
        <NewBpaRecordModal
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

function Stat({ label, value }: { label: string; value: number | string }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  )
}

// ─────────────────────────────────────────────── NewBpaRecordModal ──────

function NewBpaRecordModal({
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
  const [procedureCode, setProcedureCode] = useState('')
  const [procedureName, setProcedureName] = useState('')
  const [procedureDate, setProcedureDate] = useState(new Date().toISOString().slice(0, 10))
  const [quantity, setQuantity] = useState('1')
  const [cid10, setCid10] = useState('')
  const [notes, setNotes] = useState('')
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

  const handleSubmit = async (): Promise<void> => {
    setError(null)
    if (!procedureCode.trim()) return setError('Informe o código SIGTAP.')
    if (!procedureName.trim()) return setError('Informe o nome do procedimento.')
    setSaving(true)
    try {
      const input: BpaRecordInput = {
        patientId: patient?.id ?? null,
        professionalId: professionalId ? Number(professionalId) : null,
        procedureCode: procedureCode.trim(),
        procedureName: procedureName.trim(),
        procedureDate,
        quantity: Number(quantity) || 1,
        cid10: cid10.trim() || null,
        notes: notes.trim() || null
      }
      await window.api.bpa.createRecord(input)
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open title="Novo registro BPA" onClose={onClose} size="lg">
      {error ? (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      <div className="space-y-3">
        <Field label="Paciente (opcional)">
          {patient ? (
            <div className="flex items-center justify-between rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
              <span>{patient.fullName}</span>
              <Button variant="outline" onClick={() => setPatient(null)}>
                Trocar
              </Button>
            </div>
          ) : (
            <>
              <Input
                placeholder="Buscar por nome, CPF ou CNS…"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
              />
              {patientResults.length > 0 ? (
                <div className="mt-2 max-h-36 overflow-y-auto rounded-md border border-slate-200 bg-white">
                  {patientResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
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
            </>
          )}
        </Field>

        <Field label="Profissional">
          <select
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={professionalId}
            onChange={(e) => setProfessionalId(e.target.value)}
          >
            <option value="">—</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Código SIGTAP">
            <CodePicker
              catalog="sigtap"
              value={procedureCode}
              onChange={setProcedureCode}
              onPick={(_code, name) => {
                if (!procedureName.trim()) setProcedureName(name)
              }}
              placeholder="Código ou nome do procedimento"
            />
          </Field>
          <Field label="Quantidade">
            <Input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Nome do procedimento">
          <Input
            value={procedureName}
            onChange={(e) => setProcedureName(e.target.value)}
            placeholder="Consulta médica em atenção básica"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Data">
            <Input
              type="date"
              value={procedureDate}
              onChange={(e) => setProcedureDate(e.target.value)}
            />
          </Field>
          <Field label="CID-10 (opcional)">
            <CodePicker catalog="cid10" value={cid10} onChange={setCid10} placeholder="CID ou diagnóstico" />
          </Field>
        </div>

        <Field label="Observações">
          <textarea
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Salvando…' : 'Registrar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
