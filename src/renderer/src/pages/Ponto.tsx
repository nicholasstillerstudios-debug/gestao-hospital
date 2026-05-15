/**
 * Ponto eletrônico — registro e visualização de batidas dos profissionais.
 *  - seletor de profissional + intervalo (default: mês atual)
 *  - registro de nova batida (entrada/saída/intervalo)
 *  - lista de batidas com remoção
 *  - resumo diário (horas trabalhadas, pausa, consistência)
 */
import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@renderer/components/PageHeader'
import { Button } from '@renderer/components/ui/Button'
import { Modal } from '@renderer/components/ui/Modal'
import { Field, Input, Select, Textarea } from '@renderer/components/ui/Field'
import { formatDateTimeBr } from '@renderer/lib/utils'
import {
  TIMECLOCK_ENTRY_TYPE_LABELS,
  type Professional,
  type TimeclockDaySummary,
  type TimeclockEntryType,
  type TimeclockEntryWithRefs
} from '@shared/types'

function firstDayOfMonthIso(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}

function lastDayOfMonthIso(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = d.getMonth()
  const last = new Date(y, m + 1, 0)
  const mm = String(m + 1).padStart(2, '0')
  const dd = String(last.getDate()).padStart(2, '0')
  return `${y}-${mm}-${dd}`
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}h ${String(m).padStart(2, '0')}min`
}

const ENTRY_TYPES: TimeclockEntryType[] = [
  'entrada',
  'saida',
  'intervalo_inicio',
  'intervalo_fim'
]

export function PontoPage(): React.JSX.Element {
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [professionalId, setProfessionalId] = useState<number | null>(null)
  const [fromDate, setFromDate] = useState<string>(firstDayOfMonthIso())
  const [toDate, setToDate] = useState<string>(lastDayOfMonthIso())
  const [entries, setEntries] = useState<TimeclockEntryWithRefs[]>([])
  const [summaries, setSummaries] = useState<TimeclockDaySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [entryType, setEntryType] = useState<TimeclockEntryType>('entrada')
  const [recordedAt, setRecordedAt] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void window.api.professionals.list(true).then((list) => {
      setProfessionals(list)
      if (list.length > 0 && professionalId == null) {
        setProfessionalId(list[0].id)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const load = useMemo(
    () =>
      async (): Promise<void> => {
        setLoading(true)
        try {
          const filter = {
            professionalId: professionalId ?? undefined,
            fromDate: `${fromDate}T00:00:00`,
            toDate: `${toDate}T23:59:59`
          }
          const [es, sums] = await Promise.all([
            window.api.timeclock.listEntries(filter),
            professionalId
              ? window.api.timeclock.getDaySummaries(
                  professionalId,
                  `${fromDate}T00:00:00`,
                  `${toDate}T23:59:59`
                )
              : Promise.resolve([])
          ])
          setEntries(es)
          setSummaries(sums)
        } finally {
          setLoading(false)
        }
      },
    [professionalId, fromDate, toDate]
  )

  useEffect(() => {
    void load()
  }, [load])

  function openModal(): void {
    if (!professionalId) return
    setEntryType('entrada')
    // Default = agora (local). HTML datetime-local format.
    const now = new Date()
    const tzOffset = now.getTimezoneOffset() * 60000
    setRecordedAt(new Date(now.getTime() - tzOffset).toISOString().slice(0, 16))
    setNotes('')
    setError(null)
    setModalOpen(true)
  }

  async function submit(): Promise<void> {
    if (!professionalId) return
    setError(null)
    try {
      const isoAt = recordedAt ? new Date(recordedAt).toISOString() : undefined
      await window.api.timeclock.createEntry({
        professionalId,
        type: entryType,
        recordedAt: isoAt,
        notes: notes.trim() || null
      })
      setModalOpen(false)
      await load()
    } catch (err) {
      setError((err as Error).message || 'Erro ao registrar batida.')
    }
  }

  async function removeEntry(id: number): Promise<void> {
    if (!confirm('Excluir esta batida? A operação é auditada.')) return
    try {
      await window.api.timeclock.deleteEntry(id)
      await load()
    } catch (err) {
      alert((err as Error).message || 'Erro ao excluir.')
    }
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Ponto eletrônico"
        subtitle="Registro de jornada dos profissionais"
        actions={
          <Button onClick={openModal} disabled={!professionalId}>
            + Bater ponto
          </Button>
        }
      />

      <div className="mt-4 grid grid-cols-1 gap-3 rounded-lg bg-white p-4 ring-1 ring-slate-200 md:grid-cols-3">
        <Field label="Profissional">
          <Select
            value={professionalId ?? ''}
            onChange={(e) => setProfessionalId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— Selecione —</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
                {p.specialty ? ` — ${p.specialty}` : ''}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="De">
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </Field>
        <Field label="Até">
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </Field>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-slate-500">Carregando…</p>
      ) : (
        <>
          <section className="mt-6">
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Resumo por dia</h3>
            {summaries.length === 0 ? (
              <p className="text-sm text-slate-500">Sem batidas no período.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg ring-1 ring-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Data</th>
                      <th className="px-3 py-2">Batidas</th>
                      <th className="px-3 py-2">Trabalhado</th>
                      <th className="px-3 py-2">Pausa</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaries.map((s) => (
                      <tr key={s.date} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium text-slate-800">{s.date}</td>
                        <td className="px-3 py-2 text-slate-600">{s.entries.length}</td>
                        <td className="px-3 py-2 text-slate-700">
                          {formatMinutes(s.workedMinutes)}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {formatMinutes(s.breakMinutes)}
                        </td>
                        <td className="px-3 py-2">
                          {s.consistent ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                              Consistente
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                              Inconsistente
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="mt-6">
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Batidas</h3>
            {entries.length === 0 ? (
              <p className="text-sm text-slate-500">Sem batidas no período.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg ring-1 ring-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Quando</th>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Profissional</th>
                      <th className="px-3 py-2">Notas</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-slate-800">
                          {formatDateTimeBr(e.recordedAt)}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {TIMECLOCK_ENTRY_TYPE_LABELS[e.type]}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{e.professionalName}</td>
                        <td className="px-3 py-2 text-slate-600">{e.notes ?? '—'}</td>
                        <td className="px-3 py-2 text-right">
                          <Button variant="ghost" onClick={() => void removeEntry(e.id)}>
                            Excluir
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      <Modal
        open={modalOpen}
        title="Registrar batida"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void submit()}>Registrar</Button>
          </>
        }
      >
        <div className="space-y-3">
          {error ? (
            <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-200">
              {error}
            </div>
          ) : null}
          <Field label="Tipo">
            <Select
              value={entryType}
              onChange={(e) => setEntryType(e.target.value as TimeclockEntryType)}
            >
              {ENTRY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TIMECLOCK_ENTRY_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Data/hora">
            <Input
              type="datetime-local"
              value={recordedAt}
              onChange={(e) => setRecordedAt(e.target.value)}
            />
          </Field>
          <Field label="Observação (opcional)">
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex.: batida retroativa por esquecimento — justificativa…"
            />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
