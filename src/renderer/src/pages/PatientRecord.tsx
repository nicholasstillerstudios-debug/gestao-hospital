import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '@renderer/components/PageHeader'
import { Button } from '@renderer/components/ui/Button'
import { StatusBadge } from '@renderer/components/ui/Badge'
import { useAuth } from '@renderer/stores/auth'
import {
  ageFromBirthDate,
  formatCns,
  formatCpf,
  formatDateBr,
  formatDateTimeBr
} from '@renderer/lib/utils'
import type { AdmissionWithRefs, Patient } from '@shared/types'

export function PatientRecordPage(): React.JSX.Element {
  const { id } = useParams()
  const patientId = Number(id)
  const user = useAuth((s) => s.user)
  const [patient, setPatient] = useState<Patient | null>(null)
  const [admissions, setAdmissions] = useState<AdmissionWithRefs[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [anonymizing, setAnonymizing] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = async (): Promise<void> => {
    setLoading(true)
    try {
      const [p, adms] = await Promise.all([
        window.api.patients.get(patientId),
        window.api.admissions.listForPatient(patientId)
      ])
      setPatient(p)
      setAdmissions(adms)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      setLoading(true)
      try {
        const [p, adms] = await Promise.all([
          window.api.patients.get(patientId),
          window.api.admissions.listForPatient(patientId)
        ])
        if (cancelled) return
        setPatient(p)
        setAdmissions(adms)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [patientId])

  if (loading) return <div className="p-6 text-sm text-slate-500">Carregando…</div>
  if (!patient) return <div className="p-6 text-sm text-slate-500">Paciente não encontrado.</div>

  const age = ageFromBirthDate(patient.birthDate)
  const isAnonymized = patient.anonymizedAt != null
  const isAdmin = user?.role === 'admin'

  const exportData = async (): Promise<void> => {
    setExporting(true)
    setError(null)
    setNotice(null)
    try {
      const result = await window.api.patients.exportData(patientId)
      if (result.saved && result.path) {
        setNotice(`Dados exportados para ${result.path}.`)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setExporting(false)
    }
  }

  const anonymize = async (): Promise<void> => {
    const confirmed = window.confirm(
      'Atenção: a anonimização é permanente. Os dados pessoais (nome, CPF, CNS, contato e endereço) ' +
        'serão substituídos. As internações já realizadas são preservadas sem identificação. ' +
        'Tem certeza?'
    )
    if (!confirmed) return
    setAnonymizing(true)
    setError(null)
    setNotice(null)
    try {
      const result = await window.api.patients.anonymize(patientId)
      setNotice(`Paciente anonimizado em ${formatDateTimeBr(result.anonymizedAt)}.`)
      await reload()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setAnonymizing(false)
    }
  }

  return (
    <>
      <PageHeader
        title={patient.fullName}
        subtitle={
          isAnonymized
            ? `Paciente anonimizado em ${formatDateTimeBr(patient.anonymizedAt!)}`
            : `Prontuário do paciente${age != null ? ` • ${age} anos` : ''}`
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {!isAnonymized ? (
              <Link to={`/pacientes/${patient.id}/editar`}>
                <Button variant="outline">Editar dados</Button>
              </Link>
            ) : null}
            <Button
              variant="outline"
              onClick={() => void exportData()}
              disabled={exporting || anonymizing}
              title="Exporta um JSON com cadastro e auditoria — direito de portabilidade (LGPD art. 18, V)."
            >
              {exporting ? 'Exportando…' : 'Exportar dados (LGPD)'}
            </Button>
            {isAdmin && !isAnonymized ? (
              <Button
                variant="ghost"
                className="text-red-600 hover:bg-red-50"
                onClick={() => void anonymize()}
                disabled={exporting || anonymizing}
                title="Substitui os dados pessoais por marcadores anônimos, preservando trilha de auditoria — direito de eliminação (LGPD art. 18, VI)."
              >
                {anonymizing ? 'Anonimizando…' : 'Anonimizar paciente'}
              </Button>
            ) : null}
          </div>
        }
      />
      <section className="space-y-6 p-6">
        {notice ? (
          <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-200">
            {notice}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
            {error}
          </div>
        ) : null}
        {isAnonymized ? (
          <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
            Este paciente foi anonimizado em {formatDateTimeBr(patient.anonymizedAt!)}. Os dados
            pessoais foram removidos. O histórico de internações é mantido para fins de auditoria.
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <InfoCard title="Identificação">
            <Row label="CPF">{formatCpf(patient.cpf) || '—'}</Row>
            <Row label="CNS">{formatCns(patient.cns) || '—'}</Row>
            <Row label="Nascimento">{formatDateBr(patient.birthDate)}</Row>
            <Row label="Sexo">
              {patient.sex === 'F' ? 'Feminino' : patient.sex === 'M' ? 'Masculino' : 'Outro'}
            </Row>
            <Row label="Mãe">{patient.motherName || '—'}</Row>
          </InfoCard>
          <InfoCard title="Contato">
            <Row label="Telefone">{patient.phone || '—'}</Row>
            <Row label="E-mail">{patient.email || '—'}</Row>
          </InfoCard>
          <InfoCard title="Endereço">
            <Row label="Logradouro">
              {[patient.addressStreet, patient.addressNumber].filter(Boolean).join(', ') || '—'}
            </Row>
            <Row label="Bairro">{patient.addressNeighborhood || '—'}</Row>
            <Row label="Cidade/UF">
              {[patient.addressCity, patient.addressState].filter(Boolean).join(' / ') || '—'}
            </Row>
            <Row label="CEP">{patient.addressZip || '—'}</Row>
          </InfoCard>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Histórico de internações</h2>
            <span className="text-xs text-slate-500">{admissions.length}</span>
          </div>
          {admissions.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma internação registrada.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2">Admissão</th>
                  <th>Leito</th>
                  <th>Diagnóstico</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {admissions.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="py-2">{formatDateTimeBr(a.admittedAt)}</td>
                    <td>
                      {a.currentBed
                        ? `${a.currentBed.wardName} • ${a.currentBed.code}`
                        : '—'}
                    </td>
                    <td>{a.admissionDiagnosis ?? '—'}</td>
                    <td>
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="text-right">
                      <Link
                        className="text-[var(--color-ubs-primary-dark)] hover:underline"
                        to={`/internacoes/${a.id}`}
                      >
                        Abrir →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {patient.notes ? (
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Observações</h2>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{patient.notes}</p>
          </div>
        ) : null}

        <PatientAttachmentsSection patientId={patient.id} />
      </section>
    </>
  )
}

function PatientAttachmentsSection({ patientId }: { patientId: number }): React.JSX.Element {
  const [items, setItems] = useState<import('@shared/types').PatientAttachment[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async (): Promise<void> => {
    try {
      setItems(await window.api.attachments.list(patientId))
    } catch (err) {
      setError((err as Error).message)
    }
  }

  useEffect(() => {
    void load()
  }, [patientId]) // eslint-disable-line react-hooks/exhaustive-deps

  const upload = async (file: File, category: string): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const bytes = await file.arrayBuffer()
      await window.api.attachments.upload({
        patientId,
        fileName: file.name,
        mimeType: file.type || null,
        bytes,
        category: category || null,
        description: null
      })
      await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const openFile = async (id: number): Promise<void> => {
    try {
      await window.api.attachments.open(id)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const remove = async (id: number): Promise<void> => {
    if (!window.confirm('Excluir este anexo?')) return
    await window.api.attachments.delete(id)
    await load()
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Anexos do paciente</h2>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
          <input
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff,.tif,.doc,.docx,.txt,.rtf"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) {
                const cat = window.prompt('Categoria (opcional, ex: exame, receita, atestado):', '')
                void upload(f, cat ?? '')
              }
              e.target.value = ''
            }}
          />
          {busy ? 'Enviando…' : '+ Adicionar anexo'}
        </label>
      </div>
      {error ? (
        <div className="mb-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      ) : null}
      {items.length === 0 ? (
        <p className="text-xs text-slate-500">
          Nenhum anexo. PDF, imagem ou DOC até 25 MB. Arquivos ficam criptografados pelo sistema de
          arquivos do Windows na pasta do app.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm">
          {items.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-2">
              <div className="min-w-0">
                <div className="truncate font-medium text-slate-800">{a.fileName}</div>
                <div className="text-xs text-slate-500">
                  {(a.sizeBytes / 1024).toFixed(1)} KB
                  {a.category ? ` · ${a.category}` : ''}
                  {a.uploadedByName ? ` · enviado por ${a.uploadedByName}` : ''}
                  {a.uploadedAt ? ` · ${formatDateTimeBr(a.uploadedAt)}` : ''}
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => void openFile(a.id)}
                  className="rounded px-2 py-1 text-xs text-cyan-700 hover:bg-cyan-50"
                >
                  Abrir
                </button>
                <button
                  type="button"
                  onClick={() => void remove(a.id)}
                  className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function InfoCard({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <dl className="space-y-1.5 text-sm">{children}</dl>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-700">{children}</dd>
    </div>
  )
}
