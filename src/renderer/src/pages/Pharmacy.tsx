import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { PageHeader } from '@renderer/components/PageHeader'
import { ErrorBoundary } from '@renderer/components/ErrorBoundary'
import { Button } from '@renderer/components/ui/Button'
import { Field, Input, Select, Textarea } from '@renderer/components/ui/Field'
import { Modal } from '@renderer/components/ui/Modal'
import { cn, formatDateBr, formatDateTimeBr } from '@renderer/lib/utils'
import { useAuth } from '@renderer/stores/auth'
import type {
  Dispensation,
  DispensationItemInput,
  Medication,
  MedicationLot,
  MedicationStock,
  Patient,
  StockMovement,
  StockMovementType
} from '@shared/types'

function TabPanel({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <ErrorBoundary>{children}</ErrorBoundary>
}

export function PharmacyPage(): React.JSX.Element {
  const tabs = [
    { to: '/farmacia', label: 'Estoque', exact: true },
    { to: '/farmacia/medicamentos', label: 'Medicamentos', exact: false },
    { to: '/farmacia/movimentacoes', label: 'Movimentações', exact: false },
    { to: '/farmacia/dispensar', label: 'Dispensar', exact: false },
    { to: '/farmacia/dispensacoes', label: 'Dispensações', exact: false }
  ]
  return (
    <>
      <PageHeader
        title="Farmácia"
        subtitle="Cadastro de medicamentos, estoque por lotes, dispensação e relatórios"
      />
      <div className="px-6 pt-4">
        <nav className="flex flex-wrap gap-2 border-b border-slate-200">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.exact}
              className={({ isActive }) =>
                cn(
                  'px-3 py-2 text-sm font-medium',
                  isActive
                    ? 'border-b-2 border-[var(--color-ubs-primary)] text-[var(--color-ubs-primary-dark)]'
                    : 'text-slate-500 hover:text-slate-700'
                )
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="p-6">
        <Routes>
          <Route
            index
            element={
              <TabPanel>
                <StockTab />
              </TabPanel>
            }
          />
          <Route
            path="medicamentos"
            element={
              <TabPanel>
                <MedicationsTab />
              </TabPanel>
            }
          />
          <Route
            path="movimentacoes"
            element={
              <TabPanel>
                <MovementsTab />
              </TabPanel>
            }
          />
          <Route
            path="dispensar"
            element={
              <TabPanel>
                <DispenseTab />
              </TabPanel>
            }
          />
          <Route
            path="dispensacoes"
            element={
              <TabPanel>
                <DispensationsTab />
              </TabPanel>
            }
          />
          <Route path="*" element={<Navigate to="/farmacia" replace />} />
        </Routes>
      </div>
    </>
  )
}

/* -------------------- Aba Estoque -------------------- */

function StockTab(): React.JSX.Element {
  const [stock, setStock] = useState<MedicationStock[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'todos' | 'baixo' | 'vencendo'>('todos')
  const [lotsTarget, setLotsTarget] = useState<MedicationStock | null>(null)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const r = await window.api.pharmacy.listStock()
      setStock(r)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return stock.filter((m) => {
      if (filter === 'baixo' && !m.belowMin) return false
      if (filter === 'vencendo' && !m.expiringSoon) return false
      if (!q) return true
      return (
        m.name.toLowerCase().includes(q) || (m.activeIngredient?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [stock, search, filter])

  const summary = useMemo(() => {
    return {
      total: stock.length,
      baixo: stock.filter((s) => s.belowMin).length,
      vencendo: stock.filter((s) => s.expiringSoon && s.totalQuantity > 0).length
    }
  }, [stock])

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <SummaryCard label="Medicamentos ativos" value={summary.total} tone="default" />
        <SummaryCard
          label="Abaixo do estoque mínimo"
          value={summary.baixo}
          tone={summary.baixo > 0 ? 'warn' : 'default'}
        />
        <SummaryCard
          label="Lote vencendo (≤90 dias)"
          value={summary.vencendo}
          tone={summary.vencendo > 0 ? 'warn' : 'default'}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por nome ou princípio ativo…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-72"
        />
        <Select
          value={filter}
          onChange={(e) => setFilter(e.target.value as 'todos' | 'baixo' | 'vencendo')}
          className="w-56"
        >
          <option value="todos">Todos</option>
          <option value="baixo">Apenas abaixo do mínimo</option>
          <option value="vencendo">Apenas com lote vencendo</option>
        </Select>
        <div className="ml-auto">
          <Button variant="outline" onClick={() => void load()}>
            Atualizar
          </Button>
        </div>
      </div>
      {loading ? (
        <div className="rounded-md bg-white p-6 text-center text-slate-500 shadow-sm">
          Carregando…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-md bg-white p-10 text-center text-slate-500 shadow-sm">
          Nenhum medicamento encontrado.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md bg-white shadow-sm ring-1 ring-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-2">Medicamento</th>
                <th className="px-3 py-2">Apresentação</th>
                <th className="px-3 py-2">Estoque</th>
                <th className="px-3 py-2">Mínimo</th>
                <th className="px-3 py-2">Próx. validade</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((m) => (
                <tr key={m.id}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800">{m.name}</div>
                    {m.activeIngredient ? (
                      <div className="text-xs text-slate-500">{m.activeIngredient}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {[m.dosage, m.form].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        'font-mono text-sm',
                        m.belowMin ? 'text-red-700 font-bold' : 'text-slate-800'
                      )}
                    >
                      {m.totalQuantity} {m.unit}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-600">{m.minStock}</td>
                  <td className="px-3 py-2 text-xs">
                    {m.nextExpiry ? (
                      <span
                        className={
                          m.expiringSoon ? 'text-orange-700 font-medium' : 'text-slate-600'
                        }
                      >
                        {formatDateBr(m.nextExpiry)}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => setLotsTarget(m)}>
                      Lotes
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {lotsTarget ? (
        <LotsModal
          medication={lotsTarget}
          onClose={() => setLotsTarget(null)}
          onChanged={() => {
            setLotsTarget(null)
            void load()
          }}
        />
      ) : null}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  tone
}: {
  label: string
  value: number
  tone: 'default' | 'warn'
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'rounded-md bg-white p-4 shadow-sm ring-1',
        tone === 'warn' ? 'ring-orange-300' : 'ring-slate-200'
      )}
    >
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div
        className={cn(
          'mt-1 text-3xl font-semibold',
          tone === 'warn' ? 'text-orange-700' : 'text-slate-800'
        )}
      >
        {value}
      </div>
    </div>
  )
}

/* -------------------- Modal de lotes -------------------- */

function LotsModal({
  medication,
  onClose,
  onChanged
}: {
  medication: MedicationStock
  onClose: () => void
  onChanged: () => void
}): React.JSX.Element {
  const user = useAuth((s) => s.user)
  const canEdit = user?.role === 'admin' || user?.role === 'farmacia'
  const [lots, setLots] = useState<MedicationLot[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showAdjust, setShowAdjust] = useState<MedicationLot | null>(null)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const r = await window.api.pharmacy.listLots(medication.id)
      setLots(r)
    } finally {
      setLoading(false)
    }
  }, [medication.id])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <Modal
      open
      size="xl"
      title={`Lotes — ${medication.name}`}
      onClose={onClose}
      footer={
        <>
          {canEdit ? (
            <Button variant="outline" onClick={() => setShowAdd(true)}>
              + Novo lote (entrada)
            </Button>
          ) : null}
          <Button onClick={onClose}>Fechar</Button>
        </>
      }
    >
      {loading ? (
        <div className="p-6 text-center text-sm text-slate-500">Carregando…</div>
      ) : lots.length === 0 ? (
        <div className="p-6 text-center text-sm text-slate-500">
          Sem lotes cadastrados. Use “+ Novo lote” para registrar uma entrada.
        </div>
      ) : (
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-2 py-2">Lote</th>
              <th className="px-2 py-2">Fabricante</th>
              <th className="px-2 py-2">Validade</th>
              <th className="px-2 py-2">Quantidade</th>
              <th className="px-2 py-2">Entrada</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lots.map((l) => (
              <tr key={l.id}>
                <td className="px-2 py-2 font-mono text-xs">{l.lotNumber}</td>
                <td className="px-2 py-2">{l.manufacturer ?? '—'}</td>
                <td className="px-2 py-2 text-xs">{formatDateBr(l.expiresAt)}</td>
                <td className="px-2 py-2 font-mono">
                  {l.quantity} <span className="text-xs text-slate-500">/ {l.entryQuantity}</span>
                </td>
                <td className="px-2 py-2 text-xs text-slate-500">{formatDateBr(l.createdAt)}</td>
                <td className="px-2 py-2 text-right">
                  {canEdit && l.quantity > 0 ? (
                    <Button size="sm" variant="outline" onClick={() => setShowAdjust(l)}>
                      Saída/Perda
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {showAdd ? (
        <AddLotModal
          medication={medication}
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false)
            void load()
            onChanged()
          }}
        />
      ) : null}
      {showAdjust ? (
        <MovementModal
          medication={medication}
          lot={showAdjust}
          onClose={() => setShowAdjust(null)}
          onSaved={() => {
            setShowAdjust(null)
            void load()
            onChanged()
          }}
        />
      ) : null}
    </Modal>
  )
}

function AddLotModal({
  medication,
  onClose,
  onSaved
}: {
  medication: Medication
  onClose: () => void
  onSaved: () => void
}): React.JSX.Element {
  const [lotNumber, setLotNumber] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [source, setSource] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    try {
      const qty = Number(quantity)
      if (!Number.isFinite(qty) || qty <= 0) throw new Error('Quantidade inválida.')
      await window.api.pharmacy.addLot({
        medicationId: medication.id,
        lotNumber,
        manufacturer: manufacturer || null,
        expiresAt,
        entryQuantity: Math.floor(qty),
        entryUnitCost: unitCost ? Number(unitCost.replace(',', '.')) : null,
        entrySource: source || null
      })
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      title={`Entrada de lote — ${medication.name}`}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar entrada'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Número do lote" required>
          <Input value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} />
        </Field>
        <Field label="Fabricante">
          <Input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
        </Field>
        <Field label="Validade" required>
          <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        </Field>
        <Field label={`Quantidade (${medication.unit})`} required>
          <Input
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </Field>
        <Field label="Custo unitário (R$)">
          <Input
            inputMode="decimal"
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
          />
        </Field>
        <Field label="Fonte (compra/transferência/doação)">
          <Input value={source} onChange={(e) => setSource(e.target.value)} />
        </Field>
      </div>
      {error ? (
        <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      ) : null}
    </Modal>
  )
}

function MovementModal({
  medication,
  lot,
  onClose,
  onSaved
}: {
  medication: Medication
  lot: MedicationLot
  onClose: () => void
  onSaved: () => void
}): React.JSX.Element {
  const [type, setType] = useState<'saida' | 'perda' | 'ajuste'>('saida')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    try {
      const qty = Number(quantity)
      if (!Number.isFinite(qty) || qty <= 0) throw new Error('Quantidade inválida.')
      await window.api.pharmacy.addMovement({
        medicationId: medication.id,
        lotId: lot.id,
        type,
        quantity: Math.floor(qty),
        reason: reason || null
      })
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      title={`${medication.name} — lote ${lot.lotNumber}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? 'Salvando…' : 'Registrar'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Tipo de movimentação" required>
          <Select
            value={type}
            onChange={(e) => setType(e.target.value as 'saida' | 'perda' | 'ajuste')}
          >
            <option value="saida">Saída (uso interno, transferência)</option>
            <option value="perda">Perda (vencimento, quebra, contaminação)</option>
            <option value="ajuste">Ajuste de estoque (entrada via correção)</option>
          </Select>
        </Field>
        <Field label={`Quantidade (saldo atual: ${lot.quantity} ${medication.unit})`} required>
          <Input
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </Field>
        <Field label="Motivo / observação">
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        {error ? (
          <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">
            {error}
          </div>
        ) : null}
      </div>
    </Modal>
  )
}

/* -------------------- Aba Medicamentos -------------------- */

function MedicationsTab(): React.JSX.Element {
  const user = useAuth((s) => s.user)
  const canEdit = user?.role === 'admin' || user?.role === 'farmacia'
  const [meds, setMeds] = useState<Medication[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [editing, setEditing] = useState<Medication | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const r = await window.api.pharmacy.listMedications(includeInactive)
      setMeds(r)
    } finally {
      setLoading(false)
    }
  }, [includeInactive])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return meds
    return meds.filter(
      (m) =>
        m.name.toLowerCase().includes(q) || (m.activeIngredient?.toLowerCase().includes(q) ?? false)
    )
  }, [meds, search])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-72"
        />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
          />
          Incluir inativos
        </label>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => void load()}>
            Atualizar
          </Button>
          {canEdit ? <Button onClick={() => setCreating(true)}>+ Novo medicamento</Button> : null}
        </div>
      </div>
      {loading ? (
        <div className="rounded-md bg-white p-6 text-center text-slate-500 shadow-sm">
          Carregando…
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md bg-white shadow-sm ring-1 ring-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2">Princípio ativo</th>
                <th className="px-3 py-2">Apresentação</th>
                <th className="px-3 py-2">Mín.</th>
                <th className="px-3 py-2">REMUME</th>
                <th className="px-3 py-2">Ativo</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((m) => (
                <tr key={m.id}>
                  <td className="px-3 py-2 font-medium text-slate-800">{m.name}</td>
                  <td className="px-3 py-2 text-slate-600">{m.activeIngredient ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {[m.dosage, m.form, m.route].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{m.minStock}</td>
                  <td className="px-3 py-2 text-xs">{m.isRemume ? 'Sim' : '—'}</td>
                  <td className="px-3 py-2 text-xs">{m.active ? 'Sim' : 'Não'}</td>
                  <td className="px-3 py-2 text-right">
                    {canEdit ? (
                      <Button size="sm" variant="outline" onClick={() => setEditing(m)}>
                        Editar
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {creating ? (
        <MedicationModal
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false)
            void load()
          }}
        />
      ) : null}
      {editing ? (
        <MedicationModal
          medication={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void load()
          }}
        />
      ) : null}
    </div>
  )
}

function MedicationModal({
  medication,
  onClose,
  onSaved
}: {
  medication?: Medication
  onClose: () => void
  onSaved: () => void
}): React.JSX.Element {
  const [name, setName] = useState(medication?.name ?? '')
  const [activeIngredient, setActiveIngredient] = useState(medication?.activeIngredient ?? '')
  const [dosage, setDosage] = useState(medication?.dosage ?? '')
  const [form, setForm] = useState(medication?.form ?? '')
  const [route, setRoute] = useState(medication?.route ?? '')
  const [unit, setUnit] = useState(medication?.unit ?? 'comprimido')
  const [isRemume, setIsRemume] = useState(medication?.isRemume ?? false)
  const [minStock, setMinStock] = useState(String(medication?.minStock ?? 0))
  const [active, setActive] = useState(medication?.active ?? true)
  const [notes, setNotes] = useState(medication?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name,
        activeIngredient: activeIngredient || null,
        dosage: dosage || null,
        form: form || null,
        route: route || null,
        unit,
        isRemume,
        minStock: Math.max(0, Math.floor(Number(minStock) || 0)),
        active,
        notes: notes || null
      }
      if (medication) {
        await window.api.pharmacy.updateMedication(medication.id, payload)
      } else {
        await window.api.pharmacy.createMedication(payload)
      }
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      size="lg"
      title={medication ? `Editar ${medication.name}` : 'Novo medicamento'}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Nome comercial / DCB" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Princípio ativo">
          <Input value={activeIngredient} onChange={(e) => setActiveIngredient(e.target.value)} />
        </Field>
        <Field label="Dosagem" hint="Ex.: 500 mg, 250 mg/5 ml">
          <Input value={dosage} onChange={(e) => setDosage(e.target.value)} />
        </Field>
        <Field label="Forma" hint="Ex.: comprimido, suspensão, ampola">
          <Input value={form} onChange={(e) => setForm(e.target.value)} />
        </Field>
        <Field label="Via">
          <Input value={route} onChange={(e) => setRoute(e.target.value)} />
        </Field>
        <Field label="Unidade de estoque" required>
          <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
        </Field>
        <Field label="Estoque mínimo">
          <Input
            inputMode="numeric"
            value={minStock}
            onChange={(e) => setMinStock(e.target.value)}
          />
        </Field>
        <div className="flex flex-col gap-1 text-sm">
          <label className="mt-6 flex items-center gap-2">
            <input
              type="checkbox"
              checked={isRemume}
              onChange={(e) => setIsRemume(e.target.checked)}
            />
            REMUME (relação municipal)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Ativo no catálogo
          </label>
        </div>
      </div>
      <Field label="Observações" className="mt-3">
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      {error ? (
        <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      ) : null}
    </Modal>
  )
}

/* -------------------- Aba Movimentações -------------------- */

const MOVEMENT_LABEL: Record<StockMovementType, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
  ajuste: 'Ajuste',
  perda: 'Perda',
  dispensacao: 'Dispensação'
}

function MovementsTab(): React.JSX.Element {
  const [moves, setMoves] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const r = await window.api.pharmacy.listMovements({ limit: 200 })
      setMoves(r)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-700">Últimas movimentações</h2>
        <div className="ml-auto">
          <Button variant="outline" onClick={() => void load()}>
            Atualizar
          </Button>
        </div>
      </div>
      {loading ? (
        <div className="rounded-md bg-white p-6 text-center text-slate-500 shadow-sm">
          Carregando…
        </div>
      ) : moves.length === 0 ? (
        <div className="rounded-md bg-white p-10 text-center text-slate-500 shadow-sm">
          Sem movimentações registradas.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md bg-white shadow-sm ring-1 ring-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Medicamento</th>
                <th className="px-3 py-2">Lote</th>
                <th className="px-3 py-2">Qtd</th>
                <th className="px-3 py-2">Paciente</th>
                <th className="px-3 py-2">Motivo</th>
                <th className="px-3 py-2">Por</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {moves.map((m) => (
                <tr key={m.id}>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {formatDateTimeBr(m.createdAt)}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <MovementBadge type={m.type} />
                  </td>
                  <td className="px-3 py-2">{m.medicationName}</td>
                  <td className="px-3 py-2 font-mono text-xs">{m.lotNumber ?? '—'}</td>
                  <td className="px-3 py-2 font-mono">{m.quantity}</td>
                  <td className="px-3 py-2 text-slate-600">{m.patientName ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">{m.reason ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{m.performedByName ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function MovementBadge({ type }: { type: StockMovementType }): React.JSX.Element {
  const tone =
    type === 'entrada'
      ? 'bg-emerald-100 text-emerald-700'
      : type === 'dispensacao'
        ? 'bg-sky-100 text-sky-700'
        : type === 'perda'
          ? 'bg-red-100 text-red-700'
          : type === 'ajuste'
            ? 'bg-amber-100 text-amber-800'
            : 'bg-slate-100 text-slate-700'
  return (
    <span className={cn('rounded px-2 py-0.5 text-xs font-medium', tone)}>
      {MOVEMENT_LABEL[type]}
    </span>
  )
}

/* -------------------- Aba Dispensar -------------------- */

function DispenseTab(): React.JSX.Element {
  const user = useAuth((s) => s.user)
  const canEdit = user?.role === 'admin' || user?.role === 'farmacia'

  const [patientQuery, setPatientQuery] = useState('')
  const [patientResults, setPatientResults] = useState<Patient[]>([])
  const [patient, setPatient] = useState<Patient | null>(null)

  const [stock, setStock] = useState<MedicationStock[]>([])
  const [items, setItems] = useState<DispensationItemInput[]>([])
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void window.api.pharmacy.listStock().then(setStock)
  }, [])

  // Busca paciente
  useEffect(() => {
    let cancelled = false
    if (!patientQuery.trim()) {
      setPatientResults([])
      return
    }
    const t = setTimeout(() => {
      void window.api.patients.search(patientQuery).then((r) => {
        if (!cancelled) setPatientResults(r.slice(0, 8))
      })
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [patientQuery])

  const addItem = (): void => {
    setItems((prev) => [...prev, { medicationId: 0, quantity: 1, lotId: null }])
  }
  const removeItem = (idx: number): void => {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }
  const updateItem = (idx: number, patch: Partial<DispensationItemInput>): void => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  const submit = async (): Promise<void> => {
    if (!patient) {
      setError('Selecione um paciente.')
      return
    }
    if (items.length === 0 || items.some((it) => !it.medicationId || !it.quantity)) {
      setError('Adicione ao menos um item com medicamento e quantidade.')
      return
    }
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const result = await window.api.pharmacy.dispense({
        patientId: patient.id,
        prescriptionId: null,
        notes: notes || null,
        items
      })
      setSuccess(`Dispensação #${result.id} salva. ${result.items.length} itens registrados.`)
      setItems([])
      setNotes('')
      // Recarrega estoque
      void window.api.pharmacy.listStock().then(setStock)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (!canEdit) {
    return (
      <div className="rounded-md bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200">
        Apenas usuários com papel <b>Administrador</b> ou <b>Farmácia</b> podem dispensar.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <div className="rounded-md bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">1. Paciente</h3>
          {patient ? (
            <div className="flex items-center justify-between rounded bg-slate-50 px-3 py-2 text-sm">
              <div>
                <div className="font-medium text-slate-800">{patient.fullName}</div>
                <div className="text-xs text-slate-500">{patient.cpf ?? 'CPF não informado'}</div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setPatient(null)
                  setItems([])
                }}
              >
                Trocar
              </Button>
            </div>
          ) : (
            <>
              <Input
                placeholder="Buscar paciente por nome, CPF ou CNS…"
                value={patientQuery}
                onChange={(e) => setPatientQuery(e.target.value)}
              />
              {patientResults.length > 0 ? (
                <ul className="mt-2 divide-y divide-slate-100 rounded ring-1 ring-slate-200">
                  {patientResults.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                        onClick={() => {
                          setPatient(p)
                          setPatientQuery('')
                          setPatientResults([])
                        }}
                      >
                        <div className="font-medium text-slate-800">{p.fullName}</div>
                        <div className="text-xs text-slate-500">{p.cpf ?? 'CPF —'}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </div>

      </div>

      <div className="flex flex-col gap-4">
        <div className="rounded-md bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">2. Itens a dispensar</h3>
            <Button size="sm" variant="outline" onClick={addItem}>
              + Adicionar item
            </Button>
          </div>
          {items.length === 0 ? (
            <div className="text-xs text-slate-500">
              Adicione os medicamentos a dispensar usando o botão acima.
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {items.map((it, idx) => {
                const med = stock.find((m) => m.id === it.medicationId)
                return (
                  <li
                    key={idx}
                    className="flex flex-wrap items-end gap-2 rounded border border-slate-200 p-2"
                  >
                    <Field label="Medicamento" className="flex-1">
                      <Select
                        value={String(it.medicationId)}
                        onChange={(e) =>
                          updateItem(idx, { medicationId: Number(e.target.value), lotId: null })
                        }
                      >
                        <option value="0">Selecione…</option>
                        {stock
                          .filter((m) => m.totalQuantity > 0 || m.id === it.medicationId)
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                              {m.dosage ? ` ${m.dosage}` : ''} — {m.totalQuantity} {m.unit}
                            </option>
                          ))}
                      </Select>
                    </Field>
                    <Field label="Quantidade" className="w-28">
                      <Input
                        inputMode="numeric"
                        value={String(it.quantity)}
                        onChange={(e) =>
                          updateItem(idx, { quantity: Math.max(1, Number(e.target.value) || 0) })
                        }
                      />
                    </Field>
                    {med ? (
                      <div className="text-xs text-slate-500">
                        Estoque: <b>{med.totalQuantity}</b> {med.unit}
                      </div>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => removeItem(idx)}
                      title="Remover item"
                    >
                      Remover
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
          <Field label="Observações" className="mt-3">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>

        {error ? (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-200">
            {success}
          </div>
        ) : null}

        <Button onClick={() => void submit()} disabled={saving || !patient || items.length === 0}>
          {saving ? 'Dispensando…' : 'Confirmar dispensação'}
        </Button>
      </div>
    </div>
  )
}

/* -------------------- Aba Dispensações -------------------- */

function DispensationsTab(): React.JSX.Element {
  const [list, setList] = useState<Dispensation[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const r = await window.api.pharmacy.listDispensations({ limit: 100 })
      setList(r)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-700">Últimas dispensações</h2>
        <div className="ml-auto">
          <Button variant="outline" onClick={() => void load()}>
            Atualizar
          </Button>
        </div>
      </div>
      {loading ? (
        <div className="rounded-md bg-white p-6 text-center text-slate-500 shadow-sm">
          Carregando…
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-md bg-white p-10 text-center text-slate-500 shadow-sm">
          Nenhuma dispensação registrada.
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map((d) => (
            <li key={d.id} className="rounded-md bg-white p-3 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-800">{d.patientName}</div>
                  <div className="text-xs text-slate-500">
                    {formatDateTimeBr(d.dispensedAt)}
                    {d.performedByName ? ` • ${d.performedByName}` : ''}
                    {d.prescriptionId ? ` • receita #${d.prescriptionId}` : ''}
                  </div>
                </div>
                <div className="text-xs text-slate-500">#{d.id}</div>
              </div>
              <ul className="mt-2 divide-y divide-slate-100 text-sm">
                {d.items.map((it, i) => (
                  <li key={i} className="flex items-center justify-between py-1">
                    <span className="text-slate-700">
                      {it.medicationName}
                      {it.lotNumber ? (
                        <span className="ml-2 font-mono text-xs text-slate-500">
                          lote {it.lotNumber}
                        </span>
                      ) : null}
                    </span>
                    <span className="font-mono text-sm">{it.quantity}</span>
                  </li>
                ))}
              </ul>
              {d.notes ? <div className="mt-2 text-xs text-slate-500">Obs: {d.notes}</div> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
