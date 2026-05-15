import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@renderer/components/PageHeader'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Field'
import { ageFromBirthDate, formatCpf, formatDateBr } from '@renderer/lib/utils'
import type { Patient } from '@shared/types'

export function PatientsPage(): React.JSX.Element {
  const [patients, setPatients] = useState<Patient[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async (): Promise<void> => {
    setLoading(true)
    try {
      const rows = await window.api.patients.list()
      setPatients(rows)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return patients
    return patients.filter((p) => {
      return (
        p.fullName.toLowerCase().includes(q) ||
        (p.cpf ?? '').includes(q) ||
        (p.cns ?? '').includes(q)
      )
    })
  }, [patients, query])

  return (
    <>
      <PageHeader
        title="Pacientes"
        subtitle="Cadastro de pacientes da unidade"
        actions={
          <>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const r = await window.api.exports.patientsCsv()
                  if (r.saved && r.path) alert(`Pacientes exportados em:\n${r.path}`)
                } catch (err) {
                  alert((err as Error).message)
                }
              }}
              title="Baixa a lista completa em CSV (UTF-8 com BOM, abre no Excel)"
            >
              Exportar CSV
            </Button>
            <Link to="/pacientes/novo">
              <Button>+ Novo paciente</Button>
            </Link>
          </>
        }
      />
      <section className="p-6">
        <div className="mb-4 flex items-center gap-3">
          <Input
            placeholder="Buscar por nome, CPF ou CNS… (Ctrl+K)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full max-w-md"
            data-shortcut="patient-search"
            autoFocus
          />
          <span className="text-xs text-slate-500">
            {filtered.length} de {patients.length} paciente(s)
          </span>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Nome</th>
                <th className="px-4 py-2.5 font-semibold">CPF</th>
                <th className="px-4 py-2.5 font-semibold">Nascimento</th>
                <th className="px-4 py-2.5 font-semibold">Idade</th>
                <th className="px-4 py-2.5 font-semibold">Telefone</th>
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
                  <td colSpan={6} className="p-6 text-center text-slate-400">
                    Nenhum paciente encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{p.fullName}</td>
                    <td className="px-4 py-2.5 text-slate-600">{formatCpf(p.cpf) || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-600">{formatDateBr(p.birthDate)}</td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {ageFromBirthDate(p.birthDate) ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{p.phone ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        to={`/pacientes/${p.id}`}
                        className="text-sm text-[var(--color-ubs-primary-dark)] hover:underline"
                      >
                        Ver prontuário →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
