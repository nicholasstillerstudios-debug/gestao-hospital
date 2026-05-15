import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@renderer/components/PageHeader'
import { Button } from '@renderer/components/ui/Button'
import { Modal } from '@renderer/components/ui/Modal'
import { Field, Input, Select, Textarea } from '@renderer/components/ui/Field'
import {
  BED_KIND_LABELS,
  BED_STATUS_LABELS,
  WARD_KIND_LABELS,
  type Bed,
  type BedKind,
  type Ward,
  type WardKind
} from '@shared/types'

export function WardsAdminPage(): React.JSX.Element {
  const [wards, setWards] = useState<Ward[]>([])
  const [beds, setBeds] = useState<Bed[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingWard, setEditingWard] = useState<Ward | 'new' | null>(null)
  const [editingBed, setEditingBed] = useState<Bed | { wardId: number; isNew: true } | null>(null)

  const load = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const [w, b] = await Promise.all([window.api.wards.list(false), window.api.beds.list(false)])
      setWards(w)
      setBeds(b)
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
        title="Setores e leitos"
        subtitle="Cadastro da topologia hospitalar"
        eyebrow="Hospital · Administração"
        actions={
          <>
            <Link to="/leitos">
              <Button variant="outline">Mapa de leitos</Button>
            </Link>
            <Button onClick={() => setEditingWard('new')}>+ Novo setor</Button>
          </>
        }
      />
      <section className="space-y-4 p-6">
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
            {error}
          </div>
        ) : null}
        {loading ? (
          <div className="rounded-md border border-slate-200 bg-white p-6 text-center text-slate-500">
            Carregando…
          </div>
        ) : wards.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <p className="text-sm font-semibold text-slate-700">Nenhum setor cadastrado.</p>
            <p className="mt-1 text-xs text-slate-500">
              Comece criando um setor (ex.: &ldquo;Clínica Médica&rdquo;, &ldquo;UTI Adulto&rdquo;).
            </p>
            <Button className="mt-3" onClick={() => setEditingWard('new')}>
              + Novo setor
            </Button>
          </div>
        ) : (
          wards.map((ward) => {
            const wardBeds = beds.filter((b) => b.wardId === ward.id)
            return (
              <div key={ward.id} className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-800">
                      {ward.name}
                      {!ward.active ? (
                        <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] uppercase text-slate-600">
                          Inativo
                        </span>
                      ) : null}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {WARD_KIND_LABELS[ward.kind]}
                      {ward.code ? ` · cód. ${ward.code}` : ''}
                      {ward.floor ? ` · ${ward.floor}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingBed({ wardId: ward.id, isNew: true })}
                    >
                      + Novo leito
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingWard(ward)}>
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await window.api.wards.setActive(ward.id, !ward.active)
                          void load()
                        } catch (err) {
                          alert((err as Error).message)
                        }
                      }}
                    >
                      {ward.active ? 'Desativar' : 'Ativar'}
                    </Button>
                  </div>
                </header>
                {wardBeds.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-slate-500">
                    Nenhum leito cadastrado.
                  </div>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-2 font-semibold">Código</th>
                        <th className="px-4 py-2 font-semibold">Tipo</th>
                        <th className="px-4 py-2 font-semibold">Status</th>
                        <th className="px-4 py-2 font-semibold">Restrição</th>
                        <th className="px-4 py-2 font-semibold">Ativo</th>
                        <th className="px-4 py-2 font-semibold"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {wardBeds.map((bed) => (
                        <tr key={bed.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-medium tabular-nums">{bed.code}</td>
                          <td className="px-4 py-2 text-slate-700">{BED_KIND_LABELS[bed.kind]}</td>
                          <td className="px-4 py-2 text-slate-700">
                            {BED_STATUS_LABELS[bed.status]}
                          </td>
                          <td className="px-4 py-2 text-slate-700">{bed.sexRestriction ?? '—'}</td>
                          <td className="px-4 py-2 text-slate-700">{bed.active ? 'Sim' : 'Não'}</td>
                          <td className="px-4 py-2 text-right">
                            <Button size="sm" variant="ghost" onClick={() => setEditingBed(bed)}>
                              Editar
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })
        )}
      </section>

      <Modal
        open={editingWard != null}
        title={editingWard === 'new' ? 'Novo setor' : 'Editar setor'}
        onClose={() => setEditingWard(null)}
        size="md"
      >
        {editingWard != null ? (
          <WardForm
            ward={editingWard === 'new' ? null : editingWard}
            onCancel={() => setEditingWard(null)}
            onSuccess={() => {
              setEditingWard(null)
              void load()
            }}
          />
        ) : null}
      </Modal>

      <Modal
        open={editingBed != null}
        title={
          editingBed && 'isNew' in editingBed
            ? 'Novo leito'
            : editingBed
              ? `Editar leito ${(editingBed as Bed).code}`
              : 'Leito'
        }
        onClose={() => setEditingBed(null)}
        size="md"
      >
        {editingBed != null ? (
          <BedForm
            wards={wards}
            value={editingBed}
            onCancel={() => setEditingBed(null)}
            onSuccess={() => {
              setEditingBed(null)
              void load()
            }}
          />
        ) : null}
      </Modal>
    </>
  )
}

interface WardFormProps {
  ward: Ward | null
  onCancel: () => void
  onSuccess: () => void
}

function WardForm({ ward, onCancel, onSuccess }: WardFormProps): React.JSX.Element {
  const [name, setName] = useState(ward?.name ?? '')
  const [code, setCode] = useState(ward?.code ?? '')
  const [kind, setKind] = useState<WardKind>(ward?.kind ?? 'enfermaria')
  const [floor, setFloor] = useState(ward?.floor ?? '')
  const [notes, setNotes] = useState(ward?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (): Promise<void> => {
    if (busy) return
    if (!name.trim()) {
      setError('Informe o nome do setor.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const payload = {
        name: name.trim(),
        code: code.trim() || null,
        kind,
        floor: floor.trim() || null,
        notes: notes.trim() || null
      }
      if (ward) {
        await window.api.wards.update(ward.id, payload)
      } else {
        await window.api.wards.create(payload)
      }
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
      <Field label="Nome" required>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoFocus />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Tipo" required>
          <Select value={kind} onChange={(e) => setKind(e.target.value as WardKind)}>
            {(Object.keys(WARD_KIND_LABELS) as WardKind[]).map((k) => (
              <option key={k} value={k}>
                {WARD_KIND_LABELS[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Andar / localização">
          <Input value={floor} onChange={(e) => setFloor(e.target.value)} maxLength={50} />
        </Field>
      </div>
      <Field label="Código interno" hint="Opcional">
        <Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={20} />
      </Field>
      <Field label="Observações">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </Field>
      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? 'Salvando…' : ward ? 'Salvar' : 'Criar'}
        </Button>
      </div>
    </form>
  )
}

interface BedFormProps {
  wards: Ward[]
  value: Bed | { wardId: number; isNew: true }
  onCancel: () => void
  onSuccess: () => void
}

function BedForm({ wards, value, onCancel, onSuccess }: BedFormProps): React.JSX.Element {
  const isNew = 'isNew' in value
  const [wardId, setWardId] = useState<number>(isNew ? value.wardId : value.wardId)
  const [code, setCode] = useState(isNew ? '' : value.code)
  const [kind, setKind] = useState<BedKind>(isNew ? 'standard' : value.kind)
  const [sexRestriction, setSexRestriction] = useState<'M' | 'F' | ''>(
    isNew ? '' : (value.sexRestriction ?? '')
  )
  const [notes, setNotes] = useState(isNew ? '' : (value.notes ?? ''))
  const [active, setActive] = useState(isNew ? true : value.active)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (): Promise<void> => {
    if (busy) return
    if (!code.trim()) {
      setError('Informe o código do leito.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const payload = {
        wardId,
        code: code.trim(),
        kind,
        sexRestriction: (sexRestriction || null) as 'M' | 'F' | null,
        notes: notes.trim() || null,
        active
      }
      if (isNew) {
        await window.api.beds.create(payload)
      } else {
        await window.api.beds.update(value.id, payload)
      }
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
      <Field label="Setor" required>
        <Select value={wardId} onChange={(e) => setWardId(Number(e.target.value))}>
          {wards.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Código" required hint="Ex.: 101A, 12, UTI-3">
          <Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={20} autoFocus />
        </Field>
        <Field label="Tipo" required>
          <Select value={kind} onChange={(e) => setKind(e.target.value as BedKind)}>
            {(Object.keys(BED_KIND_LABELS) as BedKind[]).map((k) => (
              <option key={k} value={k}>
                {BED_KIND_LABELS[k]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Restrição de sexo" hint="Opcional">
          <Select
            value={sexRestriction}
            onChange={(e) => setSexRestriction(e.target.value as 'M' | 'F' | '')}
          >
            <option value="">— Sem restrição —</option>
            <option value="M">Masculino</option>
            <option value="F">Feminino</option>
          </Select>
        </Field>
        <Field label="Ativo">
          <Select value={active ? '1' : '0'} onChange={(e) => setActive(e.target.value === '1')}>
            <option value="1">Sim</option>
            <option value="0">Não</option>
          </Select>
        </Field>
      </div>
      <Field label="Observações">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </Field>
      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? 'Salvando…' : isNew ? 'Criar' : 'Salvar'}
        </Button>
      </div>
    </form>
  )
}
