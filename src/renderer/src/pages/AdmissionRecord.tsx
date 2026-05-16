import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '@renderer/components/PageHeader'
import { Button } from '@renderer/components/ui/Button'
import { Modal } from '@renderer/components/ui/Modal'
import { TransferAdmissionForm } from '@renderer/components/hospital/TransferAdmissionForm'
import { DischargeAdmissionForm } from '@renderer/components/hospital/DischargeAdmissionForm'
import { EvolutionForm } from '@renderer/components/hospital/EvolutionForm'
import { VitalSignsForm } from '@renderer/components/hospital/VitalSignsForm'
import { PrescriptionForm } from '@renderer/components/hospital/PrescriptionForm'
import { FluidBalanceForm } from '@renderer/components/hospital/FluidBalanceForm'
import { useAuth } from '@renderer/stores/auth'
import { ageFromBirthDate, formatCpf, formatDateBr, formatDateTimeBr } from '@renderer/lib/utils'
import {
  ADMISSION_STATUS_LABELS,
  ADMISSION_TYPE_LABELS,
  BED_MOVEMENT_ACTION_LABELS,
  DISCHARGE_TYPE_LABELS,
  EVOLUTION_AUTHOR_ROLE_LABELS,
  MAR_STATUS_LABELS,
  MEDICATION_ROUTE_LABELS,
  PRESCRIPTION_STATUS_LABELS,
  SEX_LABELS,
  type AdmissionEvolutionWithRefs,
  type AdmissionPrescriptionItem,
  type AdmissionPrescriptionWithItems,
  type AdmissionVitalSignsWithRefs,
  type AdmissionWithRefs,
  type BedMovement,
  type EvolutionAuthorRole,
  type FluidBalanceEntryWithRefs,
  type FluidBalanceSummary,
  type MarStatus,
  type MedicationAdministrationWithRefs,
  type PrescriptionStatus
} from '@shared/types'

type Tab = 'identificacao' | 'movimentacoes' | 'evolucao' | 'sinais-vitais' | 'prescricao' | 'balanco'

export function AdmissionRecordPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>()
  const admissionId = Number(id)
  const [admission, setAdmission] = useState<AdmissionWithRefs | null>(null)
  const [movements, setMovements] = useState<BedMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('identificacao')
  const [showTransfer, setShowTransfer] = useState(false)
  const [showDischarge, setShowDischarge] = useState(false)
  const [evolutions, setEvolutions] = useState<AdmissionEvolutionWithRefs[]>([])
  const [vitals, setVitals] = useState<AdmissionVitalSignsWithRefs[]>([])
  const [showEvolutionForm, setShowEvolutionForm] = useState(false)
  const [editingEvolution, setEditingEvolution] = useState<AdmissionEvolutionWithRefs | null>(null)
  const [showVitalsForm, setShowVitalsForm] = useState(false)
  const [prescriptions, setPrescriptions] = useState<AdmissionPrescriptionWithItems[]>([])
  const [mar, setMar] = useState<MedicationAdministrationWithRefs[]>([])
  const [showPrescriptionForm, setShowPrescriptionForm] = useState(false)
  const [fluidEntries, setFluidEntries] = useState<FluidBalanceEntryWithRefs[]>([])
  const [fluidSummary, setFluidSummary] = useState<FluidBalanceSummary | null>(null)
  const [showFluidForm, setShowFluidForm] = useState(false)
  const user = useAuth((s) => s.user)
  const canWrite = user?.role === 'admin' || user?.role === 'medico' || user?.role === 'enfermagem'
  const canPrescribe = user?.role === 'admin' || user?.role === 'medico'

  const load = useCallback(async (): Promise<void> => {
    if (!Number.isFinite(admissionId)) {
      setError('ID de internação inválido.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [a, m, e, v, p, mr, fl, fs] = await Promise.all([
        window.api.admissions.get(admissionId),
        window.api.admissions.listMovements(admissionId),
        window.api.evolutions.listForAdmission(admissionId),
        window.api.vitalSigns.listForAdmission(admissionId),
        window.api.hospitalPrescriptions.listForAdmission(admissionId),
        window.api.mar.listForAdmission(admissionId),
        window.api.fluidBalance.listForAdmission(admissionId),
        window.api.fluidBalance.getSummary(admissionId)
      ])
      setAdmission(a)
      setMovements(m)
      setEvolutions(e)
      setVitals(v)
      setPrescriptions(p)
      setMar(mr)
      setFluidEntries(fl)
      setFluidSummary(fs)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [admissionId])

  useEffect(() => {
    void load()
  }, [load])

  const age = useMemo(
    () => (admission ? ageFromBirthDate(admission.patient.birthDate) : null),
    [admission]
  )

  if (loading) {
    return (
      <>
        <PageHeader title="Internação" eyebrow="Hospital" />
        <section className="p-6 text-center text-slate-500">Carregando…</section>
      </>
    )
  }

  if (error || !admission) {
    return (
      <>
        <PageHeader title="Internação" eyebrow="Hospital" />
        <section className="p-6">
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error ?? 'Internação não encontrada.'}
          </div>
          <Link to="/internacoes" className="mt-3 inline-block text-sm text-cyan-700 underline">
            ← Voltar para a lista
          </Link>
        </section>
      </>
    )
  }

  const isActive = admission.status === 'ativa'

  return (
    <>
      <PageHeader
        title={admission.patient.fullName}
        subtitle={`Internação #${admission.id} · ${ADMISSION_STATUS_LABELS[admission.status]}`}
        eyebrow="Internação hospitalar"
        actions={
          <>
            <Link to="/internacoes">
              <Button variant="outline">Voltar</Button>
            </Link>
            <Link to={`/imprimir/aih/${admission.id}`}>
              <Button variant="outline">Imprimir AIH</Button>
            </Link>
            {!isActive ? (
              <Link to={`/imprimir/alta/${admission.id}`}>
                <Button variant="outline">Resumo de alta</Button>
              </Link>
            ) : null}
            {isActive ? (
              <>
                <Button variant="outline" onClick={() => setShowTransfer(true)}>
                  Transferir
                </Button>
                <Button variant="danger" onClick={() => setShowDischarge(true)}>
                  Alta / Óbito
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <section className="px-6 pt-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Stat label="Sexo" value={SEX_LABELS[admission.patient.sex]} />
          <Stat
            label="Idade"
            value={age != null ? `${age} anos` : '—'}
            sub={admission.patient.birthDate ? formatDateBr(admission.patient.birthDate) : null}
          />
          <Stat
            label="Documento"
            value={
              admission.patient.cpf
                ? formatCpf(admission.patient.cpf)
                : (admission.patient.cns ?? '—')
            }
            sub={admission.patient.cpf ? 'CPF' : admission.patient.cns ? 'CNS' : null}
          />
          <Stat
            label="Leito atual"
            value={admission.currentBed ? `Leito ${admission.currentBed.code}` : '—'}
            sub={admission.currentBed?.wardName ?? null}
          />
        </div>
      </section>

      <nav className="border-b border-slate-200 px-6 pt-4">
        <ul className="flex gap-2 text-sm">
          {(
            [
              { id: 'identificacao', label: 'Identificação' },
              { id: 'evolucao', label: `Evolução (${evolutions.length})` },
              { id: 'sinais-vitais', label: `Sinais vitais (${vitals.length})` },
              { id: 'balanco', label: `Balanço hídrico (${fluidEntries.length})` },
              { id: 'movimentacoes', label: 'Movimentações' },
              {
                id: 'prescricao',
                label: `Prescrição & MAR (${prescriptions.length})`
              }
            ] as Array<{ id: Tab; label: string }>
          ).map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setTab(t.id)}
                className={`-mb-px border-b-2 px-3 py-2 transition-colors ${
                  tab === t.id
                    ? 'border-[var(--color-ubs-primary)] font-semibold text-[var(--color-ubs-primary-dark)]'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <section className="p-6">
        {tab === 'identificacao' ? <IdentificationTab a={admission} /> : null}
        {tab === 'movimentacoes' ? <MovementsTab movements={movements} /> : null}
        {tab === 'evolucao' ? (
          <EvolutionsTab
            evolutions={evolutions}
            canWrite={canWrite && isActive}
            currentUserId={user?.id ?? null}
            userRole={user?.role ?? null}
            onCreate={() => {
              setEditingEvolution(null)
              setShowEvolutionForm(true)
            }}
            onEdit={(ev) => {
              setEditingEvolution(ev)
              setShowEvolutionForm(true)
            }}
            onDelete={async (ev) => {
              if (!window.confirm('Remover esta evolução do prontuário?')) return
              try {
                await window.api.evolutions.delete(ev.id)
                void load()
              } catch (err) {
                alert((err as Error).message)
              }
            }}
          />
        ) : null}
        {tab === 'sinais-vitais' ? (
          <VitalSignsTab
            vitals={vitals}
            canWrite={canWrite && isActive}
            currentUserId={user?.id ?? null}
            userRole={user?.role ?? null}
            onCreate={() => setShowVitalsForm(true)}
            onDelete={async (v) => {
              if (!window.confirm('Remover este registro de sinais vitais?')) return
              try {
                await window.api.vitalSigns.delete(v.id)
                void load()
              } catch (err) {
                alert((err as Error).message)
              }
            }}
          />
        ) : null}
        {tab === 'balanco' ? (
          <FluidBalanceTab
            entries={fluidEntries}
            summary={fluidSummary}
            canWrite={canWrite && isActive}
            currentUserId={user?.id ?? null}
            userRole={user?.role ?? null}
            onCreate={() => setShowFluidForm(true)}
            onDelete={async (entry) => {
              if (!window.confirm('Remover este lançamento do balanço hídrico?')) return
              try {
                await window.api.fluidBalance.delete(entry.id)
                void load()
              } catch (err) {
                alert((err as Error).message)
              }
            }}
          />
        ) : null}
        {tab === 'prescricao' ? (
          <PrescriptionsTab
            prescriptions={prescriptions}
            mar={mar}
            canPrescribe={canPrescribe && isActive}
            canCheck={canWrite && isActive}
            onCreate={() => setShowPrescriptionForm(true)}
            onSetPrescriptionStatus={async (rxId, status) => {
              try {
                await window.api.hospitalPrescriptions.setStatus(rxId, status)
                void load()
              } catch (err) {
                alert((err as Error).message)
              }
            }}
            onSetItemStatus={async (itemId, status) => {
              try {
                await window.api.hospitalPrescriptions.setItemStatus(itemId, status)
                void load()
              } catch (err) {
                alert((err as Error).message)
              }
            }}
            onCheck={async (id, status) => {
              try {
                await window.api.mar.check(id, { status })
                void load()
              } catch (err) {
                alert((err as Error).message)
              }
            }}
            onRevert={async (id) => {
              if (!window.confirm('Reverter a checagem desta dose para aprazado?')) return
              try {
                await window.api.mar.revert(id)
                void load()
              } catch (err) {
                alert((err as Error).message)
              }
            }}
          />
        ) : null}
      </section>

      <Modal
        open={showTransfer}
        title="Transferir paciente"
        onClose={() => setShowTransfer(false)}
        size="lg"
      >
        <TransferAdmissionForm
          admissionId={admission.id}
          currentBedId={admission.currentBed?.id ?? null}
          onCancel={() => setShowTransfer(false)}
          onSuccess={() => {
            setShowTransfer(false)
            void load()
          }}
        />
      </Modal>

      <Modal
        open={showDischarge}
        title="Encerrar internação"
        onClose={() => setShowDischarge(false)}
        size="lg"
      >
        <DischargeAdmissionForm
          admissionId={admission.id}
          patientName={admission.patient.fullName}
          onCancel={() => setShowDischarge(false)}
          onSuccess={() => {
            setShowDischarge(false)
            void load()
          }}
        />
      </Modal>

      <Modal
        open={showEvolutionForm}
        title={editingEvolution ? 'Editar evolução' : 'Nova evolução'}
        onClose={() => setShowEvolutionForm(false)}
        size="lg"
      >
        {showEvolutionForm ? (
          <EvolutionForm
            admissionId={admission.id}
            initial={editingEvolution}
            defaultRole={defaultRoleForUser(user?.role)}
            onCancel={() => setShowEvolutionForm(false)}
            onSuccess={() => {
              setShowEvolutionForm(false)
              setEditingEvolution(null)
              void load()
            }}
          />
        ) : null}
      </Modal>

      <Modal
        open={showVitalsForm}
        title="Registrar sinais vitais"
        onClose={() => setShowVitalsForm(false)}
        size="lg"
      >
        {showVitalsForm ? (
          <VitalSignsForm
            admissionId={admission.id}
            onCancel={() => setShowVitalsForm(false)}
            onSuccess={() => {
              setShowVitalsForm(false)
              void load()
            }}
          />
        ) : null}
      </Modal>

      <Modal
        open={showPrescriptionForm}
        title="Nova prescrição hospitalar"
        onClose={() => setShowPrescriptionForm(false)}
        size="xl"
      >
        {showPrescriptionForm ? (
          <PrescriptionForm
            admissionId={admission.id}
            onCancel={() => setShowPrescriptionForm(false)}
            onSuccess={() => {
              setShowPrescriptionForm(false)
              void load()
            }}
          />
        ) : null}
      </Modal>

      <Modal
        open={showFluidForm}
        title="Registrar balanço hídrico"
        onClose={() => setShowFluidForm(false)}
        size="md"
      >
        {showFluidForm ? (
          <FluidBalanceForm
            admissionId={admission.id}
            onCancel={() => setShowFluidForm(false)}
            onSuccess={() => {
              setShowFluidForm(false)
              void load()
            }}
          />
        ) : null}
      </Modal>
    </>
  )
}

function defaultRoleForUser(role: string | undefined): EvolutionAuthorRole {
  if (role === 'enfermagem') return 'enfermagem'
  if (role === 'medico') return 'medico'
  return 'medico'
}

function Stat({
  label,
  value,
  sub
}: {
  label: string
  value: string | null
  sub?: string | null
}): React.JSX.Element {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="text-sm font-medium text-slate-800">{value ?? '—'}</div>
      {sub ? <div className="text-[11px] text-slate-500">{sub}</div> : null}
    </div>
  )
}

function IdentificationTab({ a }: { a: AdmissionWithRefs }): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card title="Dados da admissão">
        <Row label="Tipo" value={ADMISSION_TYPE_LABELS[a.admissionType]} />
        <Row label="Admissão" value={formatDateTimeBr(a.admittedAt)} />
        <Row label="Origem" value={a.admissionOrigin ?? '—'} />
        <Row
          label="Médico responsável"
          value={
            a.attendingProfessional
              ? `${a.attendingProfessional.fullName}${
                  a.attendingProfessional.specialty ? ` · ${a.attendingProfessional.specialty}` : ''
                }`
              : '—'
          }
        />
        <Row label="Queixa principal" value={a.chiefComplaint ?? '—'} />
        <Row
          label="Hipótese diagnóstica"
          value={a.admissionDiagnosis ?? '—'}
          sub={a.admissionCid10 ? `CID-10: ${a.admissionCid10}` : null}
        />
        {a.notes ? <Row label="Observações" value={a.notes} /> : null}
      </Card>

      {a.status !== 'ativa' ? (
        <Card title="Saída">
          <Row
            label="Tipo de saída"
            value={a.dischargeType ? DISCHARGE_TYPE_LABELS[a.dischargeType] : '—'}
          />
          <Row label="Data" value={a.dischargeAt ? formatDateTimeBr(a.dischargeAt) : '—'} />
          <Row
            label="Resumo"
            value={a.dischargeSummary ?? '—'}
            sub={a.dischargeCid10 ? `CID-10: ${a.dischargeCid10}` : null}
          />
        </Card>
      ) : (
        <Card title="Leito atual">
          {a.currentBed ? (
            <>
              <Row label="Setor" value={a.currentBed.wardName} />
              {a.currentBed.roomName ? <Row label="Quarto" value={a.currentBed.roomName} /> : null}
              <Row label="Leito" value={a.currentBed.code} />
            </>
          ) : (
            <p className="text-sm text-slate-500">Sem leito atribuído.</p>
          )}
        </Card>
      )}
    </div>
  )
}

function Card({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="rounded-md border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-200 px-4 py-2.5">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </header>
      <div className="space-y-2 p-4 text-sm">{children}</div>
    </div>
  )
}

function Row({
  label,
  value,
  sub
}: {
  label: string
  value: string
  sub?: string | null
}): React.JSX.Element {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="whitespace-pre-wrap text-slate-800">{value}</div>
      {sub ? <div className="text-[11px] text-slate-500">{sub}</div> : null}
    </div>
  )
}

function MovementsTab({ movements }: { movements: BedMovement[] }): React.JSX.Element {
  if (movements.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
        Nenhuma movimentação registrada.
      </div>
    )
  }
  return (
    <ol className="relative space-y-3 border-l-2 border-slate-200 pl-5">
      {movements.map((m) => (
        <li key={m.id} className="relative">
          <span className="absolute -left-[9px] mt-1 inline-block h-3 w-3 rounded-full bg-cyan-500 ring-2 ring-white" />
          <div className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-slate-800">
                {BED_MOVEMENT_ACTION_LABELS[m.action]}
              </span>
              <span className="text-xs text-slate-500">{formatDateTimeBr(m.createdAt)}</span>
            </div>
            <div className="mt-1 text-xs text-slate-600">
              {m.action === 'transferencia' && m.fromBedCode && m.bedCode ? (
                <>
                  De Leito {m.fromBedCode} → Leito {m.bedCode}
                  {m.wardName ? ` · ${m.wardName}` : ''}
                </>
              ) : m.bedCode ? (
                <>
                  Leito {m.bedCode}
                  {m.wardName ? ` · ${m.wardName}` : ''}
                </>
              ) : (
                (m.wardName ?? '—')
              )}
            </div>
            {m.reason ? <div className="mt-1 text-xs text-slate-500">{m.reason}</div> : null}
            {m.notes ? <div className="mt-1 text-xs text-slate-500">{m.notes}</div> : null}
            {m.performedByName ? (
              <div className="mt-1 text-[11px] text-slate-400">por {m.performedByName}</div>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  )
}

interface EvolutionsTabProps {
  evolutions: AdmissionEvolutionWithRefs[]
  canWrite: boolean
  currentUserId: number | null
  userRole: string | null
  onCreate: () => void
  onEdit: (ev: AdmissionEvolutionWithRefs) => void
  onDelete: (ev: AdmissionEvolutionWithRefs) => void
}

function EvolutionsTab({
  evolutions,
  canWrite,
  currentUserId,
  userRole,
  onCreate,
  onEdit,
  onDelete
}: EvolutionsTabProps): React.JSX.Element {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700">
          Evoluções clínicas
          <span className="ml-2 text-xs font-normal text-slate-500">({evolutions.length})</span>
        </h3>
        {canWrite ? (
          <Button size="sm" onClick={onCreate}>
            + Nova evolução
          </Button>
        ) : null}
      </div>

      {evolutions.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
          Nenhuma evolução registrada.
          {canWrite ? ' Use "+ Nova evolução" para começar.' : ''}
        </div>
      ) : (
        <ul className="space-y-3">
          {evolutions.map((ev) => {
            const canEdit =
              canWrite && (userRole === 'admin' || ev.createdByUserId === currentUserId)
            return (
              <li key={ev.id} className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-2">
                  <div>
                    <span className="text-sm font-semibold text-slate-800">
                      {EVOLUTION_AUTHOR_ROLE_LABELS[ev.authorRole]}
                    </span>
                    {ev.professionalName ? (
                      <span className="ml-2 text-xs text-slate-600">
                        · {ev.professionalName}
                        {ev.professionalSpecialty ? ` (${ev.professionalSpecialty})` : ''}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">
                      {formatDateTimeBr(ev.evolutionAt)}
                    </span>
                    {canEdit ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onEdit(ev)}
                          className="text-xs text-cyan-700 hover:underline"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(ev)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Remover
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="mt-2 space-y-2 text-sm">
                  {ev.freeText ? (
                    <div className="whitespace-pre-wrap text-slate-800">{ev.freeText}</div>
                  ) : (
                    <>
                      {ev.subjective ? (
                        <SoapBlock label="S — Subjetivo" value={ev.subjective} />
                      ) : null}
                      {ev.objective ? (
                        <SoapBlock label="O — Objetivo" value={ev.objective} />
                      ) : null}
                      {ev.assessment ? (
                        <SoapBlock label="A — Avaliação" value={ev.assessment} />
                      ) : null}
                      {ev.plan ? <SoapBlock label="P — Plano" value={ev.plan} /> : null}
                    </>
                  )}
                </div>
                {ev.createdByUserName && ev.createdByUserName !== ev.professionalName ? (
                  <div className="mt-2 text-[11px] text-slate-400">
                    Registrado por {ev.createdByUserName}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function SoapBlock({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="whitespace-pre-wrap text-slate-800">{value}</div>
    </div>
  )
}

interface VitalSignsTabProps {
  vitals: AdmissionVitalSignsWithRefs[]
  canWrite: boolean
  currentUserId: number | null
  userRole: string | null
  onCreate: () => void
  onDelete: (v: AdmissionVitalSignsWithRefs) => void
}

function VitalSignsTab({
  vitals,
  canWrite,
  currentUserId,
  userRole,
  onCreate,
  onDelete
}: VitalSignsTabProps): React.JSX.Element {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700">
          Sinais vitais
          <span className="ml-2 text-xs font-normal text-slate-500">({vitals.length})</span>
        </h3>
        {canWrite ? (
          <Button size="sm" onClick={onCreate}>
            + Nova aferição
          </Button>
        ) : null}
      </div>

      {vitals.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
          Nenhuma aferição registrada.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Quando</th>
                <th className="px-3 py-2 font-semibold tabular-nums">PA</th>
                <th className="px-3 py-2 font-semibold tabular-nums">FC</th>
                <th className="px-3 py-2 font-semibold tabular-nums">FR</th>
                <th className="px-3 py-2 font-semibold tabular-nums">Tax</th>
                <th className="px-3 py-2 font-semibold tabular-nums">SatO₂</th>
                <th className="px-3 py-2 font-semibold tabular-nums">Dor</th>
                <th className="px-3 py-2 font-semibold tabular-nums">HGT</th>
                <th className="px-3 py-2 font-semibold">Por</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vitals.map((v) => {
                const canRemove =
                  canWrite && (userRole === 'admin' || v.createdByUserId === currentUserId)
                return (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-600">
                      {formatDateTimeBr(v.measuredAt)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {v.systolicBp != null && v.diastolicBp != null
                        ? `${v.systolicBp}/${v.diastolicBp}`
                        : (v.systolicBp ?? v.diastolicBp ?? '—')}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{v.heartRate ?? '—'}</td>
                    <td className="px-3 py-2 tabular-nums">{v.respiratoryRate ?? '—'}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {v.temperatureC != null ? v.temperatureC.toFixed(1) : '—'}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {v.oxygenSaturation != null ? `${v.oxygenSaturation}%` : '—'}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{v.painScore ?? '—'}</td>
                    <td className="px-3 py-2 tabular-nums">{v.bloodGlucose ?? '—'}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {v.professionalName ?? v.createdByUserName ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {canRemove ? (
                        <button
                          type="button"
                          onClick={() => onDelete(v)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Remover
                        </button>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

interface FluidBalanceTabProps {
  entries: FluidBalanceEntryWithRefs[]
  summary: FluidBalanceSummary | null
  canWrite: boolean
  currentUserId: number | null
  userRole: string | null
  onCreate: () => void
  onDelete: (entry: FluidBalanceEntryWithRefs) => void
}

function FluidBalanceTab({
  entries,
  summary,
  canWrite,
  currentUserId,
  userRole,
  onCreate,
  onDelete
}: FluidBalanceTabProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      {summary && (summary.totalIn > 0 || summary.totalOut > 0) ? (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-center">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
              Total entradas
            </div>
            <div className="mt-1 text-lg font-bold text-emerald-800 tabular-nums">
              {summary.totalIn.toLocaleString('pt-BR')} mL
            </div>
          </div>
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-center">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">
              Total saídas
            </div>
            <div className="mt-1 text-lg font-bold text-rose-800 tabular-nums">
              {summary.totalOut.toLocaleString('pt-BR')} mL
            </div>
          </div>
          <div
            className={`rounded-md border p-3 text-center ${
              summary.balance >= 0
                ? 'border-sky-200 bg-sky-50'
                : 'border-amber-200 bg-amber-50'
            }`}
          >
            <div
              className={`text-[11px] font-semibold uppercase tracking-wide ${
                summary.balance >= 0 ? 'text-sky-700' : 'text-amber-700'
              }`}
            >
              Saldo total
            </div>
            <div
              className={`mt-1 text-lg font-bold tabular-nums ${
                summary.balance >= 0 ? 'text-sky-800' : 'text-amber-800'
              }`}
            >
              {summary.balance >= 0 ? '+' : ''}
              {summary.balance.toLocaleString('pt-BR')} mL
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700">
          Lançamentos
          <span className="ml-2 text-xs font-normal text-slate-500">({entries.length})</span>
        </h3>
        {canWrite ? (
          <Button size="sm" onClick={onCreate}>
            + Novo lançamento
          </Button>
        ) : null}
      </div>

      {entries.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
          Nenhum lançamento registrado.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Horário</th>
                <th className="px-3 py-2 font-semibold">Tipo</th>
                <th className="px-3 py-2 font-semibold">Líquido</th>
                <th className="px-3 py-2 font-semibold tabular-nums">Volume</th>
                <th className="px-3 py-2 font-semibold">Registrado por</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((e) => {
                const canRemove =
                  canWrite && (userRole === 'admin' || e.createdByUserId === currentUserId)
                return (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-600">
                      {formatDateTimeBr(e.recordedAt)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          e.type === 'entrada'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {e.type === 'entrada' ? 'Entrada' : 'Saída'}
                      </span>
                    </td>
                    <td className="px-3 py-2">{e.subtype}</td>
                    <td className="px-3 py-2 tabular-nums font-medium">
                      {e.volumeMl.toLocaleString('pt-BR')} mL
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {e.professionalName ?? e.createdByUserName ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {canRemove ? (
                        <button
                          type="button"
                          onClick={() => onDelete(e)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Remover
                        </button>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function PrescriptionsTab({
  prescriptions,
  mar,
  canPrescribe,
  canCheck,
  onCreate,
  onSetPrescriptionStatus,
  onSetItemStatus,
  onCheck,
  onRevert
}: {
  prescriptions: AdmissionPrescriptionWithItems[]
  mar: MedicationAdministrationWithRefs[]
  canPrescribe: boolean
  canCheck: boolean
  onCreate: () => void
  onSetPrescriptionStatus: (id: number, status: PrescriptionStatus) => void
  onSetItemStatus: (itemId: number, status: PrescriptionStatus) => void
  onCheck: (id: number, status: MarStatus) => void
  onRevert: (id: number) => void
}): React.JSX.Element {
  const marByItem = useMemo(() => {
    const map = new Map<number, MedicationAdministrationWithRefs[]>()
    for (const m of mar) {
      const arr = map.get(m.prescriptionItemId) ?? []
      arr.push(m)
      map.set(m.prescriptionItemId, arr)
    }
    return map
  }, [mar])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-800">Prescrições</h3>
        {canPrescribe ? (
          <Button variant="primary" size="sm" onClick={onCreate}>
            + Nova prescrição
          </Button>
        ) : null}
      </div>

      {prescriptions.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          Nenhuma prescrição registrada nesta internação.
        </div>
      ) : (
        prescriptions.map((rx) => (
          <PrescriptionCard
            key={rx.id}
            rx={rx}
            marByItem={marByItem}
            canPrescribe={canPrescribe}
            canCheck={canCheck}
            onSetPrescriptionStatus={onSetPrescriptionStatus}
            onSetItemStatus={onSetItemStatus}
            onCheck={onCheck}
            onRevert={onRevert}
          />
        ))
      )}
    </div>
  )
}

function PrescriptionCard({
  rx,
  marByItem,
  canPrescribe,
  canCheck,
  onSetPrescriptionStatus,
  onSetItemStatus,
  onCheck,
  onRevert
}: {
  rx: AdmissionPrescriptionWithItems
  marByItem: Map<number, MedicationAdministrationWithRefs[]>
  canPrescribe: boolean
  canCheck: boolean
  onSetPrescriptionStatus: (id: number, status: PrescriptionStatus) => void
  onSetItemStatus: (itemId: number, status: PrescriptionStatus) => void
  onCheck: (id: number, status: MarStatus) => void
  onRevert: (id: number) => void
}): React.JSX.Element {
  return (
    <div className="rounded-md border border-slate-200 bg-white">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 px-4 py-2">
        <div className="text-sm">
          <span className="font-semibold text-slate-800">
            Prescrição #{rx.id} ·{' '}
            <span
              className={
                rx.status === 'ativa'
                  ? 'text-emerald-700'
                  : rx.status === 'suspensa'
                    ? 'text-amber-700'
                    : 'text-slate-500'
              }
            >
              {PRESCRIPTION_STATUS_LABELS[rx.status]}
            </span>
          </span>
          <span className="ml-3 text-slate-500">
            {formatDateTimeBr(rx.prescribedAt)}
            {rx.prescribedByProfessionalName
              ? ` · ${rx.prescribedByProfessionalName}`
              : rx.createdByUserName
                ? ` · ${rx.createdByUserName}`
                : ''}
          </span>
        </div>
        {canPrescribe && rx.status === 'ativa' ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onSetPrescriptionStatus(rx.id, 'suspensa')}
              className="text-xs text-amber-700 hover:underline"
            >
              Suspender
            </button>
            <button
              type="button"
              onClick={() => onSetPrescriptionStatus(rx.id, 'cancelada')}
              className="text-xs text-red-700 hover:underline"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => onSetPrescriptionStatus(rx.id, 'finalizada')}
              className="text-xs text-slate-700 hover:underline"
            >
              Finalizar
            </button>
          </div>
        ) : null}
      </div>

      {rx.notes ? (
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-600">
          {rx.notes}
        </div>
      ) : null}

      <div className="divide-y divide-slate-100">
        {rx.items.map((item) => (
          <PrescriptionItemRow
            key={item.id}
            item={item}
            mar={marByItem.get(item.id) ?? []}
            canPrescribe={canPrescribe}
            canCheck={canCheck && rx.status === 'ativa'}
            onSetItemStatus={onSetItemStatus}
            onCheck={onCheck}
            onRevert={onRevert}
          />
        ))}
      </div>
    </div>
  )
}

function PrescriptionItemRow({
  item,
  mar,
  canPrescribe,
  canCheck,
  onSetItemStatus,
  onCheck,
  onRevert
}: {
  item: AdmissionPrescriptionItem
  mar: MedicationAdministrationWithRefs[]
  canPrescribe: boolean
  canCheck: boolean
  onSetItemStatus: (itemId: number, status: PrescriptionStatus) => void
  onCheck: (id: number, status: MarStatus) => void
  onRevert: (id: number) => void
}): React.JSX.Element {
  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-slate-800">
            {item.medicationName}
            {item.ifNecessary ? (
              <span className="ml-2 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700">
                SOS
              </span>
            ) : null}
            {item.status !== 'ativa' ? (
              <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                {PRESCRIPTION_STATUS_LABELS[item.status]}
              </span>
            ) : null}
          </div>
          <div className="text-xs text-slate-600">
            {item.dose} · {MEDICATION_ROUTE_LABELS[item.route]} · {item.frequencyLabel}
            {item.intervalHours != null ? ` · a cada ${item.intervalHours}h` : ''}
            {item.durationDays != null ? ` · ${item.durationDays}d` : ''}
          </div>
          {item.notes ? <div className="mt-1 text-xs text-slate-500">{item.notes}</div> : null}
        </div>
        {canPrescribe && item.status === 'ativa' ? (
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => onSetItemStatus(item.id, 'suspensa')}
              className="text-amber-700 hover:underline"
            >
              Suspender
            </button>
            <button
              type="button"
              onClick={() => onSetItemStatus(item.id, 'finalizada')}
              className="text-slate-700 hover:underline"
            >
              Finalizar
            </button>
          </div>
        ) : null}
      </div>

      {mar.length > 0 ? (
        <div className="mt-2 overflow-x-auto rounded border border-slate-100">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-2 py-1.5 text-left">Aprazado</th>
                <th className="px-2 py-1.5 text-left">Status</th>
                <th className="px-2 py-1.5 text-left">Admin. em</th>
                <th className="px-2 py-1.5 text-left">Por</th>
                <th className="px-2 py-1.5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {mar.map((m) => (
                <tr key={m.id} className="border-t border-slate-100">
                  <td className="px-2 py-1.5 text-slate-700">{formatDateTimeBr(m.scheduledAt)}</td>
                  <td className="px-2 py-1.5">
                    <MarStatusBadge status={m.status} />
                  </td>
                  <td className="px-2 py-1.5 text-slate-600">
                    {m.administeredAt ? formatDateTimeBr(m.administeredAt) : '—'}
                  </td>
                  <td className="px-2 py-1.5 text-slate-600">
                    {m.administeredByProfessionalName ?? m.administeredByUserName ?? '—'}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {canCheck && m.status === 'aprazado' ? (
                      <span className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onCheck(m.id, 'administrado')}
                          className="text-emerald-700 hover:underline"
                        >
                          Administrar
                        </button>
                        <button
                          type="button"
                          onClick={() => onCheck(m.id, 'recusado')}
                          className="text-amber-700 hover:underline"
                        >
                          Recusou
                        </button>
                        <button
                          type="button"
                          onClick={() => onCheck(m.id, 'omitido')}
                          className="text-slate-500 hover:underline"
                        >
                          Omitir
                        </button>
                      </span>
                    ) : canCheck && m.status !== 'suspenso' ? (
                      <button
                        type="button"
                        onClick={() => onRevert(m.id)}
                        className="text-slate-500 hover:underline"
                      >
                        Reverter
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : item.ifNecessary ? (
        <div className="mt-2 text-xs italic text-slate-500">Item SOS — sem aprazamento fixo.</div>
      ) : (
        <div className="mt-2 text-xs italic text-slate-500">Sem doses aprazadas.</div>
      )}
    </div>
  )
}

function MarStatusBadge({ status }: { status: MarStatus }): React.JSX.Element {
  const styles: Record<MarStatus, string> = {
    aprazado: 'bg-slate-100 text-slate-700',
    administrado: 'bg-emerald-100 text-emerald-800',
    recusado: 'bg-amber-100 text-amber-800',
    omitido: 'bg-orange-100 text-orange-800',
    suspenso: 'bg-slate-200 text-slate-600'
  }
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles[status]}`}
    >
      {MAR_STATUS_LABELS[status]}
    </span>
  )
}
