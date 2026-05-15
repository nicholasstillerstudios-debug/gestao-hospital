/**
 * Lista geral de requisições (exames / encaminhamentos).
 *  - filtros por tipo e status
 *  - listagem combinando dados de todos os pacientes via listForPatient?
 *    (não existe um list global, então usamos listForPatient quando há paciente
 *     selecionado; sem paciente, exibimos as últimas via search → solicitamos
 *     ao usuário escolher um paciente).
 *
 * MVP: filtro por paciente (busca), filtro por tipo/status, ação de marcar
 * como realizada, e botão de nova requisição (RequisitionModal).
 */
import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '@renderer/components/PageHeader'
import { Button } from '@renderer/components/ui/Button'
import { Field, Input, Select } from '@renderer/components/ui/Field'
import { RequisitionModal } from '@renderer/components/RequisitionModal'
import { formatDateTimeBr } from '@renderer/lib/utils'
import {
  REQUISITION_TYPE_LABELS,
  type Patient,
  type Professional,
  type RequisitionStatus,
  type RequisitionType,
  type RequisitionWithRefs
} from '@shared/types'

const STATUS_LABELS: Record<RequisitionStatus, string> = {
  solicitada: 'Solicitada',
  realizada: 'Realizada',
  cancelada: 'Cancelada'
}

const STATUS_STYLES: Record<RequisitionStatus, string> = {
  solicitada: 'bg-amber-100 text-amber-800',
  realizada: 'bg-emerald-100 text-emerald-800',
  cancelada: 'bg-slate-200 text-slate-700'
}

export function ExamesPage(): React.JSX.Element {
  const [patientQuery, setPatientQuery] = useState('')
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [requisitions, setRequisitions] = useState<RequisitionWithRefs[]>([])
  const [typeFilter, setTypeFilter] = useState<'all' | RequisitionType>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | RequisitionStatus>('all')
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [professionalId, setProfessionalId] = useState<number | null>(null)

  useEffect(() => {
    void window.api.professionals.list(true).then((list) => {
      setProfessionals(list)
      if (list.length > 0) setProfessionalId(list[0].id)
    })
  }, [])

  const load = useCallback(
    async (pid: number): Promise<void> => {
      setLoading(true)
      try {
        const list = await window.api.requisitions.listForPatient(pid)
        setRequisitions(list)
      } finally {
        setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    if (selectedPatient) void load(selectedPatient.id)
  }, [selectedPatient, load])

  // Patient search (debounced)
  useEffect(() => {
    const q = patientQuery.trim()
    if (q.length < 2) {
      setPatients([])
      return
    }
    const handle = window.setTimeout(() => {
      void window.api.patients.search(q).then(setPatients)
    }, 250)
    return () => window.clearTimeout(handle)
  }, [patientQuery])

  const filtered = requisitions.filter((r) => {
    if (typeFilter !== 'all' && r.type !== typeFilter) return false
    if (statusFilter !== 'all' && r.status !== statusFilter) return false
    return true
  })

  async function markStatus(id: number, status: RequisitionStatus): Promise<void> {
    try {
      await window.api.requisitions.updateStatus(id, status)
      if (selectedPatient) await load(selectedPatient.id)
    } catch (err) {
      alert((err as Error).message || 'Erro ao atualizar status.')
    }
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Exames / Requisições"
        subtitle="Solicitações de exames laboratoriais, imagem, procedimentos e encaminhamentos"
        actions={
          <Button
            onClick={() => setModalOpen(true)}
            disabled={!selectedPatient || !professionalId}
          >
            + Nova requisição
          </Button>
        }
      />

      <div className="mt-4 grid grid-cols-1 gap-3 rounded-lg bg-white p-4 ring-1 ring-slate-200 md:grid-cols-4">
        <Field label="Buscar paciente">
          <Input
            placeholder="Nome ou CPF…"
            value={patientQuery}
            onChange={(e) => setPatientQuery(e.target.value)}
          />
        </Field>
        <Field label="Profissional solicitante">
          <Select
            value={professionalId ?? ''}
            onChange={(e) => setProfessionalId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— Selecione —</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tipo">
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'all' | RequisitionType)}
          >
            <option value="all">Todos</option>
            {(Object.keys(REQUISITION_TYPE_LABELS) as RequisitionType[]).map((t) => (
              <option key={t} value={t}>
                {REQUISITION_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | RequisitionStatus)}
          >
            <option value="all">Todos</option>
            {(Object.keys(STATUS_LABELS) as RequisitionStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {patients.length > 0 && !selectedPatient ? (
        <div className="mt-3 rounded-lg ring-1 ring-slate-200">
          {patients.slice(0, 8).map((p) => (
            <button
              key={p.id}
              type="button"
              className="block w-full border-b border-slate-100 px-4 py-2 text-left text-sm hover:bg-slate-50"
              onClick={() => {
                setSelectedPatient(p)
                setPatientQuery(p.fullName)
                setPatients([])
              }}
            >
              <div className="font-medium text-slate-800">{p.fullName}</div>
              <div className="text-xs text-slate-500">
                {p.cpf ?? 'sem CPF'} · {p.birthDate}
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {selectedPatient ? (
        <div className="mt-4 flex items-center justify-between rounded-lg bg-sky-50 px-4 py-2 text-sm ring-1 ring-sky-200">
          <span className="text-slate-700">
            Paciente: <strong>{selectedPatient.fullName}</strong>
          </span>
          <button
            type="button"
            className="text-xs text-sky-700 hover:underline"
            onClick={() => {
              setSelectedPatient(null)
              setRequisitions([])
              setPatientQuery('')
            }}
          >
            Trocar paciente
          </button>
        </div>
      ) : null}

      <section className="mt-6">
        {!selectedPatient ? (
          <p className="text-sm text-slate-500">
            Selecione um paciente acima para ver as requisições.
          </p>
        ) : loading ? (
          <p className="text-sm text-slate-500">Carregando…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma requisição encontrada.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg ring-1 ring-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Itens</th>
                  <th className="px-3 py-2">Profissional</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-800">{formatDateTimeBr(r.issuedAt)}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {REQUISITION_TYPE_LABELS[r.type]}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {r.items.slice(0, 3).join(', ')}
                      {r.items.length > 3 ? ` (+${r.items.length - 3})` : ''}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{r.professional.fullName}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status]}`}
                      >
                        {STATUS_LABELS[r.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {r.status === 'solicitada' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void markStatus(r.id, 'realizada')}
                        >
                          Marcar realizada
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedPatient && professionalId ? (
        <RequisitionModal
          open={modalOpen}
          patientId={selectedPatient.id}
          attendanceId={null}
          professionalId={professionalId}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false)
            void load(selectedPatient.id)
          }}
        />
      ) : null}
    </div>
  )
}
