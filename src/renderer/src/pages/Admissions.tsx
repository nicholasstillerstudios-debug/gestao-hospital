import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@renderer/components/PageHeader'
import { Button } from '@renderer/components/ui/Button'
import { Modal } from '@renderer/components/ui/Modal'
import { Input } from '@renderer/components/ui/Field'
import { ageFromBirthDate, formatCpf, formatDateTimeBr } from '@renderer/lib/utils'
import { AdmitPatientForm } from '@renderer/components/hospital/AdmitPatientForm'
import {
  ADMISSION_STATUS_LABELS,
  ADMISSION_TYPE_LABELS,
  DISCHARGE_TYPE_LABELS,
  type AdmissionStatus,
  type AdmissionWithRefs
} from '@shared/types'

type Tab = 'ativas' | 'historico'

export function AdmissionsPage(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('ativas')
  const [active, setActive] = useState<AdmissionWithRefs[]>([])
  const [history, setHistory] = useState<AdmissionWithRefs[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAdmit, setShowAdmit] = useState(false)

  const load = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const [a, h] = await Promise.all([
        window.api.admissions.listActive(),
        window.api.admissions.listRecentDischarges(100)
      ])
      setActive(a)
      setHistory(h)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const list = tab === 'ativas' ? active : history
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter((a) => {
      return (
        a.patient.fullName.toLowerCase().includes(q) ||
        (a.patient.cpf ?? '').includes(q) ||
        (a.patient.cns ?? '').includes(q) ||
        (a.admissionDiagnosis ?? '').toLowerCase().includes(q) ||
        (a.currentBed?.code ?? '').toLowerCase().includes(q) ||
        (a.currentBed?.wardName ?? '').toLowerCase().includes(q)
      )
    })
  }, [list, query])

  return (
    <>
      <PageHeader
        title="Internações"
        subtitle="Pacientes internados e histórico recente"
        eyebrow="Hospital"
        actions={
          <>
            <Link to="/leitos">
              <Button variant="outline">Mapa de leitos</Button>
            </Link>
            <Button onClick={() => setShowAdmit(true)}>+ Nova internação</Button>
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
          <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-sm">
            <button
              type="button"
              className={`rounded px-3 py-1.5 ${
                tab === 'ativas'
                  ? 'bg-[var(--color-ubs-primary)] text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              onClick={() => setTab('ativas')}
            >
              Ativas ({active.length})
            </button>
            <button
              type="button"
              className={`rounded px-3 py-1.5 ${
                tab === 'historico'
                  ? 'bg-[var(--color-ubs-primary)] text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              onClick={() => setTab('historico')}
            >
              Histórico ({history.length})
            </button>
          </div>
          <Input
            placeholder="Buscar por nome, CPF, CNS, leito, diagnóstico…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full max-w-md"
          />
          <span className="text-xs text-slate-500">
            {filtered.length} de {list.length}
          </span>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Paciente</th>
                <th className="px-4 py-2.5 font-semibold">Leito</th>
                <th className="px-4 py-2.5 font-semibold">Tipo</th>
                <th className="px-4 py-2.5 font-semibold">Admissão</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">
                    Carregando…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    {tab === 'ativas'
                      ? 'Nenhuma internação ativa no momento.'
                      : 'Nenhuma internação encerrada recentemente.'}
                  </td>
                </tr>
              ) : (
                filtered.map((a) => <Row key={a.id} a={a} />)
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal open={showAdmit} title="Nova internação" onClose={() => setShowAdmit(false)} size="lg">
        <AdmitPatientForm
          onCancel={() => setShowAdmit(false)}
          onSuccess={() => {
            setShowAdmit(false)
            void load()
          }}
        />
      </Modal>
    </>
  )
}

function Row({ a }: { a: AdmissionWithRefs }): React.JSX.Element {
  const age = ageFromBirthDate(a.patient.birthDate)
  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-2.5">
        <div className="font-medium text-slate-900">{a.patient.fullName}</div>
        <div className="text-[11px] text-slate-500">
          {a.patient.cpf ? `CPF ${formatCpf(a.patient.cpf)}` : 'sem CPF'}
          {age != null ? ` · ${age} anos` : ''}
          {a.patient.sex ? ` · ${a.patient.sex}` : ''}
        </div>
      </td>
      <td className="px-4 py-2.5">
        {a.currentBed ? (
          <>
            <div className="text-sm text-slate-800">Leito {a.currentBed.code}</div>
            <div className="text-[11px] text-slate-500">
              {a.currentBed.wardName}
              {a.currentBed.roomName ? ` · ${a.currentBed.roomName}` : ''}
            </div>
          </>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-sm text-slate-700">
        {ADMISSION_TYPE_LABELS[a.admissionType]}
      </td>
      <td className="px-4 py-2.5 text-sm text-slate-700">
        <div>{formatDateTimeBr(a.admittedAt)}</div>
        {a.attendingProfessional ? (
          <div className="text-[11px] text-slate-500">{a.attendingProfessional.fullName}</div>
        ) : null}
      </td>
      <td className="px-4 py-2.5">
        <StatusPill status={a.status} />
        {a.status !== 'ativa' && a.dischargeType ? (
          <div className="mt-0.5 text-[11px] text-slate-500">
            {DISCHARGE_TYPE_LABELS[a.dischargeType]}
            {a.dischargeAt ? ` · ${formatDateTimeBr(a.dischargeAt)}` : ''}
          </div>
        ) : null}
      </td>
      <td className="px-4 py-2.5 text-right">
        <Link to={`/internacoes/${a.id}`}>
          <Button size="sm" variant="outline">
            Abrir
          </Button>
        </Link>
      </td>
    </tr>
  )
}

const STATUS_PILL: Record<AdmissionStatus, string> = {
  ativa: 'bg-emerald-100 text-emerald-800',
  alta: 'bg-sky-100 text-sky-800',
  obito: 'bg-slate-800 text-white',
  transferencia: 'bg-indigo-100 text-indigo-800',
  evasao: 'bg-amber-100 text-amber-800'
}

function StatusPill({ status }: { status: AdmissionStatus }): React.JSX.Element {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_PILL[status]}`}
    >
      {ADMISSION_STATUS_LABELS[status]}
    </span>
  )
}
