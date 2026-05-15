import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@renderer/components/PageHeader'
import { Button } from '@renderer/components/ui/Button'
import { Modal } from '@renderer/components/ui/Modal'
import { Field, Input, Select } from '@renderer/components/ui/Field'
import { ageFromBirthDate, formatDateTimeBr } from '@renderer/lib/utils'
import { AdmitPatientForm } from '@renderer/components/hospital/AdmitPatientForm'
import { TransferAdmissionForm } from '@renderer/components/hospital/TransferAdmissionForm'
import { DischargeAdmissionForm } from '@renderer/components/hospital/DischargeAdmissionForm'
import {
  BED_STATUS_LABELS,
  WARD_KIND_LABELS,
  type BedStatus,
  type BedWithRefs,
  type WardOccupancySummary
} from '@shared/types'

const STATUS_STYLES: Record<BedStatus, string> = {
  livre: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  ocupado: 'border-rose-200 bg-rose-50 text-rose-900',
  higienizacao: 'border-amber-200 bg-amber-50 text-amber-900',
  manutencao: 'border-slate-300 bg-slate-100 text-slate-700',
  bloqueado: 'border-red-300 bg-red-100 text-red-800',
  reservado: 'border-indigo-200 bg-indigo-50 text-indigo-900'
}

const STATUS_DOT: Record<BedStatus, string> = {
  livre: 'bg-emerald-500',
  ocupado: 'bg-rose-500',
  higienizacao: 'bg-amber-500',
  manutencao: 'bg-slate-400',
  bloqueado: 'bg-red-600',
  reservado: 'bg-indigo-500'
}

const MANUAL_STATUSES: BedStatus[] = [
  'livre',
  'higienizacao',
  'manutencao',
  'bloqueado',
  'reservado'
]

export function BedsPage(): React.JSX.Element {
  const [summary, setSummary] = useState<WardOccupancySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [admitFor, setAdmitFor] = useState<BedWithRefs | null>(null)
  const [statusFor, setStatusFor] = useState<BedWithRefs | null>(null)
  const [transferFor, setTransferFor] = useState<BedWithRefs | null>(null)
  const [dischargeFor, setDischargeFor] = useState<BedWithRefs | null>(null)

  const load = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const data = await window.api.beds.occupancyByWard()
      setSummary(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const totals = summary.reduce(
    (acc, s) => {
      acc.total += s.total
      acc.ocupado += s.ocupado
      acc.livre += s.livre
      acc.outros += s.outros
      return acc
    },
    { total: 0, ocupado: 0, livre: 0, outros: 0 }
  )

  return (
    <>
      <PageHeader
        title="Mapa de leitos"
        subtitle="Visão por setor — clique em um leito para ações"
        eyebrow="Hospital"
        actions={
          <>
            <Link to="/leitos/setores">
              <Button variant="outline">Setores e leitos</Button>
            </Link>
            <Link to="/internacoes">
              <Button variant="outline">Internações</Button>
            </Link>
          </>
        }
      />
      <section className="p-6">
        {error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
            {error}
          </div>
        ) : null}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard label="Leitos totais" value={totals.total} tone="slate" />
          <SummaryCard label="Ocupados" value={totals.ocupado} tone="rose" />
          <SummaryCard label="Livres" value={totals.livre} tone="emerald" />
          <SummaryCard
            label="Em higienização/manutenção/bloqueio"
            value={totals.outros}
            tone="amber"
          />
        </div>

        {loading ? (
          <div className="rounded-md border border-slate-200 bg-white p-6 text-center text-slate-500">
            Carregando…
          </div>
        ) : summary.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-6">
            {summary.map((ward) => (
              <WardSection
                key={ward.ward.id}
                summary={ward}
                onAdmit={setAdmitFor}
                onStatus={setStatusFor}
                onTransfer={setTransferFor}
                onDischarge={setDischargeFor}
              />
            ))}
          </div>
        )}
      </section>

      <Modal
        open={admitFor != null}
        title={`Admitir paciente — Leito ${admitFor?.code ?? ''}`}
        onClose={() => setAdmitFor(null)}
        size="lg"
      >
        {admitFor ? (
          <AdmitPatientForm
            bed={admitFor}
            onCancel={() => setAdmitFor(null)}
            onSuccess={() => {
              setAdmitFor(null)
              void load()
            }}
          />
        ) : null}
      </Modal>

      <Modal
        open={statusFor != null}
        title={`Alterar status — Leito ${statusFor?.code ?? ''}`}
        onClose={() => setStatusFor(null)}
        size="md"
      >
        {statusFor ? (
          <BedStatusForm
            bed={statusFor}
            onCancel={() => setStatusFor(null)}
            onSuccess={() => {
              setStatusFor(null)
              void load()
            }}
          />
        ) : null}
      </Modal>

      <Modal
        open={transferFor != null}
        title={`Transferir paciente — Leito ${transferFor?.code ?? ''}`}
        onClose={() => setTransferFor(null)}
        size="lg"
      >
        {transferFor && transferFor.admission ? (
          <TransferAdmissionForm
            admissionId={transferFor.admission.id}
            currentBedId={transferFor.id}
            onCancel={() => setTransferFor(null)}
            onSuccess={() => {
              setTransferFor(null)
              void load()
            }}
          />
        ) : null}
      </Modal>

      <Modal
        open={dischargeFor != null}
        title={`Encerrar internação — Leito ${dischargeFor?.code ?? ''}`}
        onClose={() => setDischargeFor(null)}
        size="lg"
      >
        {dischargeFor && dischargeFor.admission ? (
          <DischargeAdmissionForm
            admissionId={dischargeFor.admission.id}
            patientName={dischargeFor.admission.patientName}
            onCancel={() => setDischargeFor(null)}
            onSuccess={() => {
              setDischargeFor(null)
              void load()
            }}
          />
        ) : null}
      </Modal>
    </>
  )
}

interface SummaryCardProps {
  label: string
  value: number
  tone: 'slate' | 'rose' | 'emerald' | 'amber'
}

function SummaryCard({ label, value, tone }: SummaryCardProps): React.JSX.Element {
  const ringClass = {
    slate: 'ring-slate-200 bg-white',
    rose: 'ring-rose-200 bg-rose-50',
    emerald: 'ring-emerald-200 bg-emerald-50',
    amber: 'ring-amber-200 bg-amber-50'
  }[tone]
  const valueClass = {
    slate: 'text-slate-900',
    rose: 'text-rose-700',
    emerald: 'text-emerald-700',
    amber: 'text-amber-700'
  }[tone]
  return (
    <div className={`rounded-lg p-4 ring-1 ${ringClass}`}>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${valueClass}`}>{value}</div>
    </div>
  )
}

function EmptyState(): React.JSX.Element {
  return (
    <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <p className="text-sm font-semibold text-slate-700">Nenhum setor cadastrado.</p>
      <p className="mt-1 text-xs text-slate-500">
        Configure setores (alas) e leitos em{' '}
        <Link className="text-cyan-700 underline" to="/leitos/setores">
          Setores e leitos
        </Link>
        .
      </p>
    </div>
  )
}

interface WardSectionProps {
  summary: WardOccupancySummary
  onAdmit: (bed: BedWithRefs) => void
  onStatus: (bed: BedWithRefs) => void
  onTransfer: (bed: BedWithRefs) => void
  onDischarge: (bed: BedWithRefs) => void
}

function WardSection({
  summary,
  onAdmit,
  onStatus,
  onTransfer,
  onDischarge
}: WardSectionProps): React.JSX.Element {
  const { ward, beds } = summary
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-slate-800">{ward.name}</h2>
          <p className="text-xs text-slate-500">
            {WARD_KIND_LABELS[ward.kind]}
            {ward.floor ? ` · ${ward.floor}` : ''}
            {ward.code ? ` · cód. ${ward.code}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-600">
          <span className="rounded-full bg-slate-100 px-2 py-0.5">
            {summary.total} leito{summary.total === 1 ? '' : 's'}
          </span>
          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-800">
            {summary.ocupado} ocupado{summary.ocupado === 1 ? '' : 's'}
          </span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">
            {summary.livre} livre{summary.livre === 1 ? '' : 's'}
          </span>
        </div>
      </header>
      {beds.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-slate-500">
          Setor sem leitos. Cadastre em{' '}
          <Link to="/leitos/setores" className="text-cyan-700 underline">
            Setores e leitos
          </Link>
          .
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {beds.map((bed) => (
            <BedCard
              key={bed.id}
              bed={bed}
              onAdmit={() => onAdmit(bed)}
              onStatus={() => onStatus(bed)}
              onTransfer={() => onTransfer(bed)}
              onDischarge={() => onDischarge(bed)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

interface BedCardProps {
  bed: BedWithRefs
  onAdmit: () => void
  onStatus: () => void
  onTransfer: () => void
  onDischarge: () => void
}

function BedCard({
  bed,
  onAdmit,
  onStatus,
  onTransfer,
  onDischarge
}: BedCardProps): React.JSX.Element {
  const occupied = bed.status === 'ocupado' && bed.admission
  return (
    <li
      className={`flex flex-col rounded-md border p-3 text-sm shadow-sm ${STATUS_STYLES[bed.status]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_DOT[bed.status]}`} />
            <span className="font-semibold tabular-nums">Leito {bed.code}</span>
          </div>
          <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide opacity-70">
            {BED_STATUS_LABELS[bed.status]}
          </div>
        </div>
        {!bed.active ? (
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
            Inativo
          </span>
        ) : null}
      </div>
      {occupied && bed.admission ? (
        <div className="mt-3 flex-1 space-y-1 rounded bg-white/70 p-2 text-xs text-slate-800 ring-1 ring-rose-100">
          <div className="font-medium text-slate-900">{bed.admission.patientName}</div>
          <div className="text-[11px] text-slate-600">
            {bed.admission.patientSex}
            {bed.admission.patientBirthDate
              ? ` · ${ageFromBirthDate(bed.admission.patientBirthDate)} anos`
              : ''}
          </div>
          <div className="text-[11px] text-slate-600">
            Internado em {formatDateTimeBr(bed.admission.admittedAt)}
          </div>
          {bed.admission.attendingProfessionalName ? (
            <div className="text-[11px] text-slate-600">
              Resp.: {bed.admission.attendingProfessionalName}
            </div>
          ) : null}
          {bed.admission.admissionDiagnosis ? (
            <div className="line-clamp-2 text-[11px] text-slate-600">
              <span className="font-medium">HD:</span> {bed.admission.admissionDiagnosis}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 flex-1 text-xs text-slate-600">
          {bed.roomName ? <div>Quarto: {bed.roomName}</div> : null}
          {bed.notes ? <div className="line-clamp-2">{bed.notes}</div> : null}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {!occupied && bed.status === 'livre' && bed.active ? (
          <Button size="sm" onClick={onAdmit} className="flex-1">
            Admitir
          </Button>
        ) : null}
        {occupied && bed.admission ? (
          <>
            <Link to={`/internacoes/${bed.admission.id}`} className="flex-1">
              <Button size="sm" variant="outline" className="w-full">
                Abrir
              </Button>
            </Link>
            <Button size="sm" variant="outline" onClick={onTransfer}>
              Transferir
            </Button>
            <Button size="sm" variant="danger" onClick={onDischarge}>
              Alta/Óbito
            </Button>
          </>
        ) : null}
        {!occupied ? (
          <Button size="sm" variant="ghost" onClick={onStatus}>
            Status
          </Button>
        ) : null}
      </div>
    </li>
  )
}

interface BedStatusFormProps {
  bed: BedWithRefs
  onCancel: () => void
  onSuccess: () => void
}

function BedStatusForm({ bed, onCancel, onSuccess }: BedStatusFormProps): React.JSX.Element {
  const [status, setStatus] = useState<BedStatus>(
    bed.status === 'ocupado' ? 'higienizacao' : bed.status
  )
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await window.api.beds.setStatus(bed.id, status, reason.trim() || null)
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
      <Field label="Novo status" required>
        <Select value={status} onChange={(e) => setStatus(e.target.value as BedStatus)}>
          {MANUAL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {BED_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Motivo / observação" hint="Opcional — registrado no log de auditoria">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
      </Field>
      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </form>
  )
}
