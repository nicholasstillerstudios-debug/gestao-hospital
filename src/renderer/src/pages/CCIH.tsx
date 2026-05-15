/**
 * CCIH — Controle de Infecção Hospitalar:
 *   - notificação de casos de IRAS (corrente sanguínea, ITU, PAV, ISC, etc)
 *   - isolamentos ativos
 *   - indicadores agregados (total, por sítio, dispositivo, isolamentos)
 */
import { useEffect, useState } from 'react'
import { PageHeader } from '@renderer/components/PageHeader'
import { Button } from '@renderer/components/ui/Button'
import { Modal } from '@renderer/components/ui/Modal'
import { Input, Field } from '@renderer/components/ui/Field'
import { formatDateTimeBr } from '@renderer/lib/utils'
import {
  DEVICE_TYPE_LABELS,
  INFECTION_SITE_LABELS,
  ISOLATION_KIND_LABELS,
  type DeviceType,
  type InfectionSite,
  type IrasCaseInput,
  type IrasCaseWithRefs,
  type IrasIndicators,
  type Isolation,
  type Patient
} from '@shared/types'

type Tab = 'iras' | 'isolations' | 'indicators'

export function CCIHPage(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('iras')
  const [iras, setIras] = useState<IrasCaseWithRefs[]>([])
  const [isolations, setIsolations] = useState<Isolation[]>([])
  const [indicators, setIndicators] = useState<IrasIndicators | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNewIras, setShowNewIras] = useState(false)

  const load = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const [i, is, ind] = await Promise.all([
        window.api.ccih.listIras(),
        window.api.ccih.listActiveIsolations(),
        window.api.ccih.indicators()
      ])
      setIras(i)
      setIsolations(is)
      setIndicators(ind)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <>
      <PageHeader
        title="CCIH"
        subtitle="Vigilância de IRAS, isolamentos e indicadores"
        eyebrow="Controle de Infecção"
        actions={
          tab === 'iras' ? <Button onClick={() => setShowNewIras(true)}>+ Notificar IRAS</Button> : null
        }
      />
      <section className="p-6">
        {error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="mb-4 inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-sm">
          {(['iras', 'isolations', 'indicators'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded px-3 py-1.5 ${
                tab === t
                  ? 'bg-[var(--color-ubs-primary)] text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t === 'iras'
                ? `Casos IRAS (${iras.length})`
                : t === 'isolations'
                  ? `Isolamentos ativos (${isolations.length})`
                  : 'Indicadores'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-sm text-slate-500">Carregando…</div>
        ) : tab === 'iras' ? (
          <IrasTable cases={iras} onChange={load} />
        ) : tab === 'isolations' ? (
          <IsolationsTable isolations={isolations} onChange={load} />
        ) : (
          <IndicatorsView indicators={indicators} />
        )}
      </section>

      {showNewIras ? (
        <NewIrasModal
          onClose={() => setShowNewIras(false)}
          onSaved={() => {
            setShowNewIras(false)
            void load()
          }}
        />
      ) : null}
    </>
  )
}

// ──────────────────────────────────────────────────── IrasTable ─────────

function IrasTable({
  cases,
  onChange
}: {
  cases: IrasCaseWithRefs[]
  onChange: () => Promise<void>
}): React.JSX.Element {
  if (cases.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
        Nenhum caso IRAS notificado.
      </div>
    )
  }
  const handleDelete = async (id: number): Promise<void> => {
    if (!window.confirm('Excluir esta notificação IRAS?')) return
    await window.api.ccih.deleteIras(id)
    await onChange()
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
          <tr>
            <th className="px-4 py-3">Data</th>
            <th className="px-4 py-3">Paciente</th>
            <th className="px-4 py-3">Sítio</th>
            <th className="px-4 py-3">Microorganismo</th>
            <th className="px-4 py-3">Dispositivo</th>
            <th className="px-4 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {cases.map((c) => (
            <tr key={c.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-xs text-slate-500">{formatDateTimeBr(c.notificationDate)}</td>
              <td className="px-4 py-3 font-medium text-slate-900">{c.patientName}</td>
              <td className="px-4 py-3 text-slate-700">{INFECTION_SITE_LABELS[c.infectionSite]}</td>
              <td className="px-4 py-3 text-slate-700">{c.microorganism ?? '—'}</td>
              <td className="px-4 py-3 text-xs">
                {c.isDeviceAssociated && c.deviceType ? (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900">
                    {DEVICE_TYPE_LABELS[c.deviceType]}
                  </span>
                ) : (
                  <span className="text-slate-400">não</span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <Button variant="outline" onClick={() => void handleDelete(c.id)}>
                  Excluir
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ───────────────────────────────────────────────── IsolationsTable ──────

function IsolationsTable({
  isolations,
  onChange
}: {
  isolations: Isolation[]
  onChange: () => Promise<void>
}): React.JSX.Element {
  if (isolations.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
        Nenhum isolamento ativo.
      </div>
    )
  }
  const handleEnd = async (id: number): Promise<void> => {
    const reason = window.prompt('Motivo do encerramento do isolamento:')
    if (!reason) return
    await window.api.ccih.endIsolation(id, reason)
    await onChange()
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
          <tr>
            <th className="px-4 py-3">Início</th>
            <th className="px-4 py-3">Internação</th>
            <th className="px-4 py-3">Tipo</th>
            <th className="px-4 py-3">Motivo</th>
            <th className="px-4 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {isolations.map((i) => (
            <tr key={i.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-xs text-slate-500">{formatDateTimeBr(i.startedAt)}</td>
              <td className="px-4 py-3 text-slate-700">#{i.admissionId}</td>
              <td className="px-4 py-3 text-slate-700">{ISOLATION_KIND_LABELS[i.kind]}</td>
              <td className="px-4 py-3 text-slate-700">{i.reason}</td>
              <td className="px-4 py-3 text-right">
                <Button variant="outline" onClick={() => void handleEnd(i.id)}>
                  Encerrar
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ──────────────────────────────────────────────── IndicatorsView ────────

function IndicatorsView({
  indicators
}: {
  indicators: IrasIndicators | null
}): React.JSX.Element {
  if (!indicators) return <div className="text-sm text-slate-500">Sem dados.</div>
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Casos IRAS totais" value={indicators.totalCases} />
        <Stat
          label="Associados a dispositivo"
          value={indicators.deviceAssociated}
          hint="CVC, SVA, VM"
        />
        <Stat label="Isolamentos ativos" value={indicators.activeIsolations} />
        <Stat
          label="% device-associated"
          value={
            indicators.totalCases > 0
              ? Math.round((indicators.deviceAssociated / indicators.totalCases) * 100) + '%'
              : '—'
          }
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Por sítio de infecção</h3>
        <ul className="space-y-2">
          {(Object.keys(indicators.bySite) as InfectionSite[]).map((site) => (
            <li key={site} className="flex items-center justify-between text-sm">
              <span className="text-slate-700">{INFECTION_SITE_LABELS[site]}</span>
              <span className="font-mono text-slate-900">{indicators.bySite[site]}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  hint
}: {
  label: string
  value: number | string
  hint?: string
}): React.JSX.Element {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  )
}

// ──────────────────────────────────────────────────── NewIrasModal ──────

function NewIrasModal({
  onClose,
  onSaved
}: {
  onClose: () => void
  onSaved: () => void
}): React.JSX.Element {
  const [patient, setPatient] = useState<Patient | null>(null)
  const [patientSearch, setPatientSearch] = useState('')
  const [patientResults, setPatientResults] = useState<Patient[]>([])
  const [site, setSite] = useState<InfectionSite>('corrente_sanguinea')
  const [microorganism, setMicroorganism] = useState('')
  const [resistantProfile, setResistantProfile] = useState('')
  const [deviceAssociated, setDeviceAssociated] = useState(false)
  const [deviceType, setDeviceType] = useState<DeviceType>('cvc')
  const [cultureCollected, setCultureCollected] = useState(false)
  const [cultureDate, setCultureDate] = useState('')
  const [cultureResult, setCultureResult] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    if (!patient) return setError('Selecione um paciente.')
    setSaving(true)
    try {
      const input: IrasCaseInput = {
        patientId: patient.id,
        infectionSite: site,
        microorganism: microorganism.trim() || null,
        resistantProfile: resistantProfile.trim() || null,
        isDeviceAssociated: deviceAssociated,
        deviceType: deviceAssociated ? deviceType : null,
        cultureCollected,
        cultureCollectedAt: cultureCollected && cultureDate ? new Date(cultureDate).toISOString() : null,
        cultureResult: cultureResult.trim() || null,
        notes: notes.trim() || null
      }
      await window.api.ccih.createIras(input)
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open title="Notificar caso de IRAS" onClose={onClose} size="lg">
      {error ? (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      <div className="space-y-3">
        <Field label="Paciente">
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

        <Field label="Sítio de infecção">
          <select
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={site}
            onChange={(e) => setSite(e.target.value as InfectionSite)}
          >
            {(Object.entries(INFECTION_SITE_LABELS) as [InfectionSite, string][]).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Microorganismo">
            <Input
              value={microorganism}
              onChange={(e) => setMicroorganism(e.target.value)}
              placeholder="Ex.: K. pneumoniae"
            />
          </Field>
          <Field label="Perfil de resistência">
            <Input
              value={resistantProfile}
              onChange={(e) => setResistantProfile(e.target.value)}
              placeholder="Ex.: KPC, ESBL"
            />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={deviceAssociated}
            onChange={(e) => setDeviceAssociated(e.target.checked)}
          />
          Associada a dispositivo invasivo
        </label>
        {deviceAssociated ? (
          <Field label="Tipo de dispositivo">
            <select
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={deviceType}
              onChange={(e) => setDeviceType(e.target.value as DeviceType)}
            >
              {(Object.entries(DEVICE_TYPE_LABELS) as [DeviceType, string][]).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={cultureCollected}
            onChange={(e) => setCultureCollected(e.target.checked)}
          />
          Cultura coletada
        </label>
        {cultureCollected ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data da coleta">
              <Input
                type="datetime-local"
                value={cultureDate}
                onChange={(e) => setCultureDate(e.target.value)}
              />
            </Field>
            <Field label="Resultado">
              <Input
                value={cultureResult}
                onChange={(e) => setCultureResult(e.target.value)}
                placeholder="positivo / negativo / aguardando"
              />
            </Field>
          </div>
        ) : null}

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
            {saving ? 'Salvando…' : 'Notificar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
