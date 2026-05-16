import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { PageHeader } from '@renderer/components/PageHeader'
import { ErrorBoundary } from '@renderer/components/ErrorBoundary'
import { Button } from '@renderer/components/ui/Button'
import { Field, Input, Select } from '@renderer/components/ui/Field'
import { Modal } from '@renderer/components/ui/Modal'
import { cn, formatDateTimeBr, roleLabel } from '@renderer/lib/utils'
import type {
  AppSettings,
  AuditLogEntry,
  BackupInfo,
  BrandingLogos,
  BrandingLogoSlot,
  Professional,
  ThemeMode,
  UnitType,
  User,
  UserRole
} from '@shared/types'
import {
  RUN_MODE_LABELS,
  UNIT_TYPE_LABELS,
  UNIT_TYPE_ORDER,
  USER_ROLE_DESCRIPTIONS
} from '@shared/types'
import type { RunMode } from '@shared/types'
import { useTheme, THEME_PRESETS, type ThemePreset } from '@renderer/stores/theme'
import { useUnit } from '@renderer/stores/unit'
import {
  COUNCIL_TYPES,
  PROFESSIONAL_CATEGORIES,
  UF_LIST,
  getCategoryDef,
  getCategoryLabel
} from '@shared/professionalCatalog'

function TabPanel({ children }: { children: ReactNode }): React.JSX.Element {
  return <ErrorBoundary>{children}</ErrorBoundary>
}

export function AdminPage(): React.JSX.Element {
  const tabs = [
    { to: '/admin', label: 'Usuários', exact: true },
    { to: '/admin/profissionais', label: 'Profissionais', exact: false },
    { to: '/admin/unidade', label: 'Unidade', exact: false },
    { to: '/admin/aparencia', label: 'Aparência', exact: false },
    { to: '/admin/timbrado', label: 'Timbrado', exact: false },
    { to: '/admin/auditoria', label: 'Auditoria', exact: false },
    { to: '/admin/backup', label: 'Backup', exact: false },
    { to: '/admin/rede', label: 'Rede', exact: false },
    { to: '/admin/sistema', label: 'Sistema', exact: false }
  ]
  return (
    <>
      <PageHeader title="Administração" subtitle="Usuários, profissionais, auditoria e backups" />
      <div className="px-6 pt-4">
        <nav className="flex gap-2 border-b border-slate-200">
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
                <UsersTab />
              </TabPanel>
            }
          />
          <Route
            path="profissionais"
            element={
              <TabPanel>
                <ProfessionalsTab />
              </TabPanel>
            }
          />
          <Route
            path="unidade"
            element={
              <TabPanel>
                <UnitTab />
              </TabPanel>
            }
          />
          <Route
            path="aparencia"
            element={
              <TabPanel>
                <AppearanceTab />
              </TabPanel>
            }
          />
          <Route
            path="timbrado"
            element={
              <TabPanel>
                <LetterheadTab />
              </TabPanel>
            }
          />
          <Route
            path="auditoria"
            element={
              <TabPanel>
                <AuditTab />
              </TabPanel>
            }
          />
          <Route
            path="backup"
            element={
              <TabPanel>
                <BackupTab />
              </TabPanel>
            }
          />
          <Route
            path="rede"
            element={
              <TabPanel>
                <NetworkTab />
              </TabPanel>
            }
          />
          <Route
            path="sistema"
            element={
              <TabPanel>
                <SystemTab />
              </TabPanel>
            }
          />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </div>
    </>
  )
}

function UsersTab(): React.JSX.Element {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ mode: 'create' | 'edit' | 'reset'; user?: User } | null>(
    null
  )

  const load = async (): Promise<void> => {
    setLoading(true)
    try {
      setUsers(await window.api.users.list())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const toggleActive = async (u: User): Promise<void> => {
    await window.api.users.setActive(u.id, !u.active)
    await load()
  }

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => setModal({ mode: 'create' })}>+ Novo usuário</Button>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Usuário</th>
              <th className="px-4 py-2.5">Nome</th>
              <th className="px-4 py-2.5">Perfil</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-400">
                  Carregando…
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-mono text-slate-700">{u.username}</td>
                  <td className="px-4 py-2.5">{u.fullName}</td>
                  <td className="px-4 py-2.5">{roleLabel(u.role)}</td>
                  <td className="px-4 py-2.5">
                    {u.active ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        Ativo
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                        Inativo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setModal({ mode: 'edit', user: u })}
                      >
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setModal({ mode: 'reset', user: u })}
                      >
                        Resetar senha
                      </Button>
                      <Button
                        size="sm"
                        variant={u.active ? 'ghost' : 'secondary'}
                        onClick={() => void toggleActive(u)}
                      >
                        {u.active ? 'Desativar' : 'Ativar'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {modal ? (
        <UserModal
          mode={modal.mode}
          user={modal.user}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null)
            void load()
          }}
        />
      ) : null}
    </>
  )
}

function UserModal({
  mode,
  user,
  onClose,
  onSaved
}: {
  mode: 'create' | 'edit' | 'reset'
  user?: User
  onClose: () => void
  onSaved: () => void
}): React.JSX.Element {
  const [username, setUsername] = useState(user?.username ?? '')
  const [fullName, setFullName] = useState(user?.fullName ?? '')
  const [role, setRole] = useState<UserRole>(user?.role ?? 'recepcao')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    try {
      if (mode === 'create') {
        if (password.length < 8) throw new Error('Senha mínima: 8 caracteres com letras e números.')
        await window.api.users.create({ username, password, fullName, role })
      } else if (mode === 'edit' && user) {
        await window.api.users.update(user.id, { fullName, role })
      } else if (mode === 'reset' && user) {
        if (password.length < 8) throw new Error('Senha mínima: 8 caracteres com letras e números.')
        await window.api.users.resetPassword(user.id, password)
      }
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const title =
    mode === 'create' ? 'Novo usuário' : mode === 'edit' ? 'Editar usuário' : 'Resetar senha'

  return (
    <Modal
      open
      title={title}
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
      <div className="flex flex-col gap-3">
        {mode === 'create' ? (
          <Field label="Usuário (login)" required>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} required />
          </Field>
        ) : null}
        {mode !== 'reset' ? (
          <>
            <Field label="Nome completo" required>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </Field>
            <Field label="Perfil de acesso" required hint={USER_ROLE_DESCRIPTIONS[role]}>
              <Select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                <option value="admin">Administrador(a) — acesso total</option>
                <option value="recepcao">Recepção — cadastro, agenda, check-in</option>
                <option value="enfermagem">
                  Enfermagem — triagem, sinais vitais, evolução, MAR
                </option>
                <option value="medico">Médico(a) — prescrição, cirurgia, alta</option>
                <option value="farmacia">Farmácia — estoque e dispensação</option>
              </Select>
            </Field>
          </>
        ) : null}
        {(mode === 'create' || mode === 'reset') && (
          <Field
            label={mode === 'reset' ? 'Nova senha' : 'Senha inicial'}
            required
            hint="Mínimo 8 caracteres, com letras e números. O usuário será obrigado a trocar no próximo login."
          >
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
        )}
        {error ? (
          <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">
            {error}
          </div>
        ) : null}
      </div>
    </Modal>
  )
}

function ProfessionalsTab(): React.JSX.Element {
  const [list, setList] = useState<Professional[]>([])
  const [modal, setModal] = useState<{
    mode: 'create' | 'edit'
    professional?: Professional
  } | null>(null)

  const load = async (): Promise<void> => {
    setList(await window.api.professionals.list(false))
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => setModal({ mode: 'create' })}>+ Novo profissional</Button>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Nome</th>
              <th className="px-4 py-2.5">Categoria</th>
              <th className="px-4 py-2.5">CBO</th>
              <th className="px-4 py-2.5">Conselho</th>
              <th className="px-4 py-2.5">Especialidade</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 font-medium">{p.fullName}</td>
                <td className="px-4 py-2.5 text-slate-600">{getCategoryLabel(p.category)}</td>
                <td className="px-4 py-2.5 text-slate-600">
                  {p.cboCode ? (
                    <span title={p.cboName ?? undefined}>{p.cboCode}</span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-slate-600">
                  {p.councilType ? (
                    <>
                      {p.councilType} {p.councilNumber ?? ''}
                      {p.councilUf ? `/${p.councilUf}` : ''}
                    </>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-slate-600">{p.specialty ?? '—'}</td>
                <td className="px-4 py-2.5">
                  {p.active ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      Ativo
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                      Inativo
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setModal({ mode: 'edit', professional: p })}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await window.api.professionals.setActive(p.id, !p.active)
                        await load()
                      }}
                    >
                      {p.active ? 'Desativar' : 'Ativar'}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal ? (
        <ProfessionalModal
          mode={modal.mode}
          professional={modal.professional}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null)
            void load()
          }}
        />
      ) : null}
    </>
  )
}

function ProfessionalModal({
  mode,
  professional,
  onClose,
  onSaved
}: {
  mode: 'create' | 'edit'
  professional?: Professional
  onClose: () => void
  onSaved: () => void
}): React.JSX.Element {
  const [fullName, setFullName] = useState(professional?.fullName ?? '')
  const [category, setCategory] = useState(professional?.category ?? '')
  const [cboCode, setCboCode] = useState(professional?.cboCode ?? '')
  const [cboName, setCboName] = useState(professional?.cboName ?? '')
  const [councilType, setCouncilType] = useState(professional?.councilType ?? '')
  const [councilNumber, setCouncilNumber] = useState(professional?.councilNumber ?? '')
  const [councilUf, setCouncilUf] = useState(professional?.councilUf ?? '')
  const [councilExpiresAt, setCouncilExpiresAt] = useState(professional?.councilExpiresAt ?? '')
  const [specialty, setSpecialty] = useState(professional?.specialty ?? '')
  const [cpf, setCpf] = useState(professional?.cpf ?? '')
  const [cns, setCns] = useState(professional?.cns ?? '')
  const [email, setEmail] = useState(professional?.email ?? '')
  const [phone, setPhone] = useState(professional?.phone ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleCategoryChange = (value: string): void => {
    setCategory(value)
    const def = getCategoryDef(value)
    if (def) {
      // Pré-preenche CBO e tipo de conselho com os sugeridos para a
      // categoria, sem sobrescrever se o usuário já tinha digitado algo
      // diferente. Em modo create os campos começam vazios então os
      // sugeridos sempre entram.
      if (def.cbo && !cboCode) {
        setCboCode(def.cbo.code)
        setCboName(def.cbo.name)
      }
      if (def.councilType && !councilType) {
        setCouncilType(def.councilType)
      }
    }
  }

  const submit = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    try {
      const payload = {
        fullName,
        cpf: cpf || null,
        cns: cns || null,
        category: category || null,
        cboCode: cboCode || null,
        cboName: cboName || null,
        councilType: councilType || null,
        councilNumber: councilNumber || null,
        councilUf: councilUf || null,
        councilExpiresAt: councilExpiresAt || null,
        specialty: specialty || null,
        email: email || null,
        phone: phone || null
      }
      if (mode === 'create') {
        await window.api.professionals.create(payload)
      } else if (professional) {
        await window.api.professionals.update(professional.id, payload)
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
      title={mode === 'create' ? 'Novo profissional' : 'Editar profissional'}
      onClose={onClose}
      size="lg"
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
      <div className="space-y-5">
        {/* Identificação */}
        <fieldset className="space-y-3 rounded-lg border border-slate-200 p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Identificação
          </legend>
          <div className="grid grid-cols-2 gap-3">
            <Field className="col-span-2" label="Nome completo" required>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </Field>
            <Field label="CPF">
              <Input value={cpf} onChange={(e) => setCpf(e.target.value.replace(/\D/g, ''))} />
            </Field>
            <Field label="CNS (Cartão SUS)" hint="Obrigatório para BPA-I SUS">
              <Input
                value={cns}
                onChange={(e) => setCns(e.target.value.replace(/\D/g, '').slice(0, 15))}
                placeholder="15 dígitos"
              />
            </Field>
            <Field label="Telefone">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Field className="col-span-2" label="E-mail">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
          </div>
        </fieldset>

        {/* Categoria + CBO */}
        <fieldset className="space-y-3 rounded-lg border border-slate-200 p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Categoria profissional
          </legend>
          <div className="grid grid-cols-2 gap-3">
            <Field className="col-span-2" label="Categoria">
              <Select value={category} onChange={(e) => handleCategoryChange(e.target.value)}>
                <option value="">— selecione —</option>
                {PROFESSIONAL_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="CBO (código)" className="col-span-1">
              <Input
                value={cboCode}
                onChange={(e) => setCboCode(e.target.value)}
                placeholder="ex.: 2251-25"
              />
            </Field>
            <Field label="CBO (descrição)" className="col-span-1">
              <Input
                value={cboName}
                onChange={(e) => setCboName(e.target.value)}
                placeholder="ex.: Médico clínico"
              />
            </Field>
            <Field className="col-span-2" label="Especialidade (livre)">
              <Input
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="ex.: Saúde da Família, Pediatria, Cardiologia…"
              />
            </Field>
          </div>
        </fieldset>

        {/* Conselho */}
        <fieldset className="space-y-3 rounded-lg border border-slate-200 p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Conselho de classe
          </legend>
          <div className="grid grid-cols-4 gap-3">
            <Field label="Tipo">
              <Select value={councilType} onChange={(e) => setCouncilType(e.target.value)}>
                <option value="">—</option>
                {COUNCIL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Número" className="col-span-2">
              <Input value={councilNumber} onChange={(e) => setCouncilNumber(e.target.value)} />
            </Field>
            <Field label="UF">
              <Select value={councilUf} onChange={(e) => setCouncilUf(e.target.value)}>
                <option value="">—</option>
                {UF_LIST.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </Select>
            </Field>
            <Field className="col-span-4" label="Validade do registro (opcional)">
              <Input
                type="date"
                value={councilExpiresAt ? councilExpiresAt.slice(0, 10) : ''}
                onChange={(e) => setCouncilExpiresAt(e.target.value)}
              />
            </Field>
          </div>
        </fieldset>

        {error ? (
          <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">
            {error}
          </div>
        ) : null}
      </div>
    </Modal>
  )
}

function AuditTab(): React.JSX.Element {
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [retentionInput, setRetentionInput] = useState<string>('0')
  const [savingSettings, setSavingSettings] = useState(false)
  const [purging, setPurging] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async (): Promise<void> => {
    setLoading(true)
    try {
      const [list, current] = await Promise.all([
        window.api.audit.list(300),
        window.api.settings.get()
      ])
      setEntries(list)
      setSettings(current)
      setRetentionInput(String(current.auditRetentionDays))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const saveRetention = async (): Promise<void> => {
    setSavingSettings(true)
    setError(null)
    setNotice(null)
    try {
      const value = Math.max(0, Number.parseInt(retentionInput, 10) || 0)
      const updated = await window.api.settings.update({ auditRetentionDays: value })
      setSettings(updated)
      setNotice(
        value === 0
          ? 'Política atualizada: retenção indefinida (logs nunca são apagados automaticamente).'
          : `Política atualizada: logs com mais de ${value} dia(s) serão apagados nas próximas execuções.`
      )
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSavingSettings(false)
    }
  }

  const runPurge = async (): Promise<void> => {
    setPurging(true)
    setError(null)
    setNotice(null)
    try {
      const result = await window.api.audit.purge()
      if (result.retentionDays === 0) {
        setNotice('Retenção está como indefinida — nada foi apagado.')
      } else {
        setNotice(
          `Purga executada: ${result.removed} linha(s) com mais de ${result.retentionDays} dia(s) removida(s).`
        )
      }
      await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPurging(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Política de retenção (LGPD)</h2>
        <p className="mt-1 text-xs text-slate-500">
          Define por quantos dias os logs de auditoria são preservados. A purga roda automaticamente
          a cada inicialização do sistema. Use <strong>0</strong> para retenção indefinida.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Field label="Retenção (dias)" className="w-40">
            <Input
              type="number"
              min={0}
              value={retentionInput}
              onChange={(e) => setRetentionInput(e.target.value)}
            />
          </Field>
          <Button onClick={() => void saveRetention()} disabled={savingSettings}>
            {savingSettings ? 'Salvando…' : 'Salvar política'}
          </Button>
          <Button variant="outline" onClick={() => void runPurge()} disabled={purging}>
            {purging ? 'Purgando…' : 'Purgar agora'}
          </Button>
          {settings ? (
            <span className="text-xs text-slate-500">
              Atual:{' '}
              {settings.auditRetentionDays === 0
                ? 'indefinida'
                : `${settings.auditRetentionDays} dia(s)`}
            </span>
          ) : null}
        </div>
        {notice ? (
          <div className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-200">
            {notice}
          </div>
        ) : null}
        {error ? (
          <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
            {error}
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Quando</th>
              <th className="px-4 py-2.5">Usuário</th>
              <th className="px-4 py-2.5">Ação</th>
              <th className="px-4 py-2.5">Entidade</th>
              <th className="px-4 py-2.5">Detalhes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-400">
                  Carregando…
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-400">
                  Nenhum evento registrado.
                </td>
              </tr>
            ) : (
              entries.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">
                    {formatDateTimeBr(e.createdAt)}
                  </td>
                  <td className="px-4 py-2 text-slate-700">{e.username ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-700">{e.action}</td>
                  <td className="px-4 py-2 text-slate-700">
                    {e.entity}
                    {e.entityId ? ` #${e.entityId}` : ''}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">{e.details ?? ''}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BackupTab(): React.JSX.Element {
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [info, setInfo] = useState<{ dbPath: string; version: string; name: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = async (): Promise<void> => {
    setLoading(true)
    try {
      const [bk, i] = await Promise.all([window.api.backup.list(), window.api.meta.appInfo()])
      setBackups(bk)
      setInfo(i)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const exportBackup = async (): Promise<void> => {
    setExporting(true)
    setError(null)
    setNotice(null)
    try {
      const result = await window.api.backup.export()
      if (result) await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setExporting(false)
    }
  }

  const restoreBackup = async (): Promise<void> => {
    setRestoring(true)
    setError(null)
    setNotice(null)
    try {
      const result = await window.api.backup.restore()
      if (result.restored) {
        setNotice(
          `Backup restaurado a partir de ${result.restoredFrom}. Snapshot do estado anterior: ${result.backupOfCurrent}. O app será reiniciado em instantes.`
        )
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Informações do sistema</h2>
        <dl className="mt-2 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">Versão</dt>
            <dd>{info?.version ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Banco de dados</dt>
            <dd className="font-mono text-xs text-slate-600">{info?.dbPath ?? '—'}</dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={() => void exportBackup()} disabled={exporting || restoring}>
            {exporting ? 'Exportando…' : 'Exportar backup agora'}
          </Button>
          <Button
            variant="outline"
            onClick={() => void restoreBackup()}
            disabled={exporting || restoring}
          >
            {restoring ? 'Restaurando…' : 'Restaurar backup…'}
          </Button>
          <Button variant="ghost" onClick={() => void load()} disabled={loading}>
            Atualizar lista
          </Button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Ao restaurar, o banco atual é primeiro salvo em um snapshot de segurança e o app é
          reiniciado automaticamente.
        </p>
        {notice ? (
          <div className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-200">
            {notice}
          </div>
        ) : null}
        {error ? (
          <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
            {error}
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Histórico de backups locais</h2>
        {backups.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhum backup exportado ainda. Use o botão acima para criar o primeiro.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {backups.map((b) => (
              <li
                key={b.path}
                className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2"
              >
                <div>
                  <div className="font-mono text-xs text-slate-600">{b.path}</div>
                  <div className="text-xs text-slate-500">
                    {formatDateTimeBr(b.createdAt)} • {(b.sizeBytes / 1024).toFixed(1)} KB
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <DriveCloudCard />
    </div>
  )
}

function DriveCloudCard(): React.JSX.Element {
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [autoEnabled, setAutoEnabled] = useState(false)
  const [status, setStatus] = useState<{
    configured: boolean
    connected: boolean
    folderId: string | null
    lastBackupAt: string | null
    autoEnabled: boolean
  } | null>(null)
  const [busy, setBusy] = useState<'idle' | 'saving' | 'connecting' | 'backup' | 'disconnect'>(
    'idle'
  )
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = async (): Promise<void> => {
    const [s, st] = await Promise.all([window.api.settings.get(), window.api.drive.status()])
    setClientId(s.driveClientId)
    setClientSecret(s.driveClientSecret)
    setAutoEnabled(s.driveAutoEnabled)
    setStatus(st)
  }

  useEffect(() => {
    void reload()
  }, [])

  const saveCreds = async (): Promise<void> => {
    setBusy('saving')
    setError(null)
    setNotice(null)
    try {
      await window.api.settings.update({
        driveClientId: clientId.trim(),
        driveClientSecret: clientSecret.trim(),
        driveAutoEnabled: autoEnabled
      })
      setNotice('Credenciais salvas.')
      await reload()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy('idle')
    }
  }

  const connect = async (): Promise<void> => {
    setBusy('connecting')
    setError(null)
    setNotice(null)
    try {
      await window.api.drive.connect()
      setNotice('Drive conectado.')
      await reload()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy('idle')
    }
  }

  const disconnect = async (): Promise<void> => {
    setBusy('disconnect')
    try {
      await window.api.drive.disconnect()
      await reload()
    } finally {
      setBusy('idle')
    }
  }

  const backupNow = async (): Promise<void> => {
    setBusy('backup')
    setError(null)
    setNotice(null)
    try {
      const r = await window.api.drive.backupNow()
      setNotice(`Backup enviado (${(r.size / 1024).toFixed(1)} KB).`)
      await reload()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy('idle')
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-700">Backup em nuvem (Google Drive)</h2>
      <p className="mt-1 max-w-2xl text-xs text-slate-600">
        Use credenciais OAuth do seu próprio projeto no{' '}
        <a
          href="https://console.cloud.google.com/apis/credentials"
          className="text-cyan-700 underline"
          target="_blank"
          rel="noreferrer"
        >
          Google Cloud Console
        </a>
        . Tipo: <em>Desktop app</em>. Escopo: <code className="rounded bg-slate-100 px-1">drive.file</code>.
        Os backups são enviados criptografados pelo HTTPS para uma pasta dedicada no seu Drive.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Client ID">
          <Input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="xxx.apps.googleusercontent.com"
          />
        </Field>
        <Field label="Client Secret">
          <Input
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
          />
        </Field>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={autoEnabled}
          onChange={(e) => setAutoEnabled(e.target.checked)}
        />
        Backup diário automático (a cada 24h se houver alteração)
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button onClick={() => void saveCreds()} disabled={busy !== 'idle'}>
          {busy === 'saving' ? 'Salvando…' : 'Salvar credenciais'}
        </Button>
        {status?.configured && !status?.connected ? (
          <Button variant="outline" onClick={() => void connect()} disabled={busy !== 'idle'}>
            {busy === 'connecting' ? 'Aguardando autorização no navegador…' : 'Conectar ao Drive'}
          </Button>
        ) : null}
        {status?.connected ? (
          <>
            <Button variant="outline" onClick={() => void backupNow()} disabled={busy !== 'idle'}>
              {busy === 'backup' ? 'Enviando…' : 'Enviar backup agora'}
            </Button>
            <Button variant="ghost" onClick={() => void disconnect()} disabled={busy !== 'idle'}>
              Desconectar
            </Button>
          </>
        ) : null}
      </div>

      {status ? (
        <div className="mt-3 text-xs text-slate-600">
          <strong>Status:</strong>{' '}
          {!status.configured
            ? 'sem credenciais'
            : !status.connected
              ? 'configurado mas não conectado'
              : 'conectado'}
          {status.lastBackupAt ? ` · último backup ${formatDateTimeBr(status.lastBackupAt)}` : ''}
        </div>
      ) : null}

      {notice ? (
        <div className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-200">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      ) : null}
    </div>
  )
}

function UnitTab(): React.JSX.Element {
  const setStoreUnitType = useUnit((s) => s.setUnitType)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [unitName, setUnitName] = useState('')
  const [unitCnes, setUnitCnes] = useState('')
  const [unitAddress, setUnitAddress] = useState('')
  const [unitPhone, setUnitPhone] = useState('')
  const [unitMunicipality, setUnitMunicipality] = useState('')
  const [unitCnpj, setUnitCnpj] = useState('')
  const [unitIbge, setUnitIbge] = useState('')
  const [unitOrgaoEmissor, setUnitOrgaoEmissor] = useState('')
  const [unitOrgaoDestino, setUnitOrgaoDestino] = useState<'M' | 'E'>('M')
  const [unitType, setUnitTypeState] = useState<UnitType>('hospital')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async (): Promise<void> => {
    setError(null)
    try {
      const current = await window.api.settings.get()
      setSettings(current)
      setUnitName(current.unitName)
      setUnitCnes(current.unitCnes)
      setUnitAddress(current.unitAddress)
      setUnitPhone(current.unitPhone)
      setUnitMunicipality(current.unitMunicipality)
      setUnitCnpj(current.unitCnpj)
      setUnitIbge(current.unitIbge)
      setUnitOrgaoEmissor(current.unitOrgaoEmissor)
      setUnitOrgaoDestino(current.unitOrgaoDestino)
      setUnitTypeState(current.unitType)
    } catch (err) {
      setError(`Não foi possível carregar os dados da unidade: ${(err as Error).message}`)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const submit = async (): Promise<void> => {
    setSaving(true)
    setNotice(null)
    setError(null)
    try {
      await window.api.settings.update({
        unitName,
        unitCnes,
        unitAddress,
        unitPhone,
        unitMunicipality,
        unitType,
        unitCnpj,
        unitIbge,
        unitOrgaoEmissor,
        unitOrgaoDestino
      })
      setStoreUnitType(unitType)
      setNotice('Dados da unidade atualizados.')
      await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (!settings) {
    return (
      <div className="space-y-3">
        <div className="text-sm text-slate-500">Carregando…</div>
        {error ? (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
            {error}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="mb-4 max-w-2xl text-sm text-slate-600">
        Estes dados aparecem no cabeçalho de todas as fichas, atestados, receituários e requisições
        impressas. Atualize aqui sempre que mudar de endereço, telefone ou CNES.
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Nome da unidade *">
          <Input
            value={unitName}
            onChange={(e) => setUnitName(e.target.value)}
            placeholder="Ex.: Hospital Municipal Dr. José da Silva"
          />
        </Field>
        <Field label="CNES">
          <Input
            value={unitCnes}
            onChange={(e) => setUnitCnes(e.target.value.replace(/\D/g, '').slice(0, 7))}
            placeholder="Ex.: 1234567"
          />
        </Field>
        <Field className="md:col-span-2" label="Endereço completo">
          <Input
            value={unitAddress}
            onChange={(e) => setUnitAddress(e.target.value)}
            placeholder="Rua, número, bairro, CEP"
          />
        </Field>
        <Field label="Telefone">
          <Input
            value={unitPhone}
            onChange={(e) => setUnitPhone(e.target.value)}
            placeholder="(00) 0000-0000"
          />
        </Field>
        <Field label="Município (UF)">
          <Input
            value={unitMunicipality}
            onChange={(e) => setUnitMunicipality(e.target.value)}
            placeholder="Ex.: São Paulo - SP"
          />
        </Field>
        <Field
          className="md:col-span-2"
          label="Tipo de unidade"
          hint="Define quais módulos aparecem no menu. Hospital habilita leitos, internações, PS, centro cirúrgico e CCIH."
        >
          <Select value={unitType} onChange={(e) => setUnitTypeState(e.target.value as UnitType)}>
            {UNIT_TYPE_ORDER.map((u) => (
              <option key={u} value={u}>
                {UNIT_TYPE_LABELS[u]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <fieldset className="mt-5 rounded-md border border-slate-200 p-3">
        <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
          Dados SUS (BPA-MAGNÉTICO)
        </legend>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="CNPJ do estabelecimento" hint="14 dígitos sem formatação">
            <Input
              value={unitCnpj}
              onChange={(e) => setUnitCnpj(e.target.value.replace(/\D/g, '').slice(0, 14))}
              placeholder="00000000000000"
            />
          </Field>
          <Field label="Código IBGE do município" hint="6 dígitos">
            <Input
              value={unitIbge}
              onChange={(e) => setUnitIbge(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
            />
          </Field>
          <Field label="Sigla do órgão emissor" hint="Até 6 caracteres, ex.: SMS">
            <Input
              value={unitOrgaoEmissor}
              onChange={(e) => setUnitOrgaoEmissor(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="SMS"
            />
          </Field>
          <Field label="Destino do BPA">
            <Select
              value={unitOrgaoDestino}
              onChange={(e) => setUnitOrgaoDestino(e.target.value === 'E' ? 'E' : 'M')}
            >
              <option value="M">Municipal (SMS)</option>
              <option value="E">Estadual (SES)</option>
            </Select>
          </Field>
        </div>
      </fieldset>
      {notice ? (
        <div className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-200">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      ) : null}
      <div className="mt-4 flex justify-end">
        <Button onClick={() => void submit()} disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </div>
  )
}

interface LogoSlotConfig {
  slot: BrandingLogoSlot
  label: string
  hint: string
}

const LOGO_SLOTS: LogoSlotConfig[] = [
  {
    slot: 'prefeitura',
    label: 'Logo da Prefeitura',
    hint: 'Brasão ou logotipo da prefeitura municipal.'
  },
  {
    slot: 'secretaria',
    label: 'Logo da Secretaria de Saúde',
    hint: 'Logotipo da secretaria municipal de saúde.'
  },
  {
    slot: 'hospital',
    label: 'Logo do Hospital',
    hint: 'Logotipo da unidade hospitalar.'
  }
]

function AppearanceTab(): React.JSX.Element {
  const themePrimary = useTheme((s) => s.primary)
  const themeMode = useTheme((s) => s.mode)
  const setPrimary = useTheme((s) => s.setPrimary)
  const setMode = useTheme((s) => s.setMode)

  const [logos, setLogos] = useState<BrandingLogos>({
    prefeitura: null,
    secretaria: null,
    hospital: null
  })
  const [prefeituraName, setPrefeituraName] = useState('')
  const [secretariaName, setSecretariaName] = useState('')
  const [colorDraft, setColorDraft] = useState(themePrimary)
  const [savingMeta, setSavingMeta] = useState(false)
  const [uploadingSlot, setUploadingSlot] = useState<BrandingLogoSlot | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setColorDraft(themePrimary)
  }, [themePrimary])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [s, l] = await Promise.all([
          window.api.settings.get(),
          window.api.branding.getLogos()
        ])
        if (cancelled) return
        setPrefeituraName(s.brandingPrefeituraName)
        setSecretariaName(s.brandingSecretariaName)
        setLogos(l)
      } catch (err) {
        if (!cancelled) setError((err as Error).message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const onUpload = async (slot: BrandingLogoSlot, file: File): Promise<void> => {
    setError(null)
    setNotice(null)
    setUploadingSlot(slot)
    try {
      const bytes = await file.arrayBuffer()
      const next = await window.api.branding.uploadLogo({
        slot,
        filename: file.name,
        mimeType: file.type,
        bytes
      })
      setLogos(next)
      setNotice('Logo atualizado.')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setUploadingSlot(null)
    }
  }

  const onRemove = async (slot: BrandingLogoSlot): Promise<void> => {
    setError(null)
    setNotice(null)
    try {
      const next = await window.api.branding.removeLogo(slot)
      setLogos(next)
      setNotice('Logo removido.')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const onSaveMeta = async (): Promise<void> => {
    setSavingMeta(true)
    setError(null)
    setNotice(null)
    try {
      await window.api.settings.update({
        brandingPrefeituraName: prefeituraName,
        brandingSecretariaName: secretariaName
      })
      setNotice('Textos institucionais salvos.')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSavingMeta(false)
    }
  }

  const onApplyColor = async (): Promise<void> => {
    setError(null)
    setNotice(null)
    try {
      await setPrimary(colorDraft)
      setNotice('Cor primária atualizada.')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const onToggleMode = async (next: ThemeMode): Promise<void> => {
    setError(null)
    setNotice(null)
    try {
      await setMode(next)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-800">Logotipos institucionais</h3>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Os 3 logos aparecem como papel timbrado no topo de fichas, atestados, receituários e
          requisições. Aceita PNG, JPG ou SVG (até 2 MB).
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          {LOGO_SLOTS.map((cfg) => (
            <LogoUploader
              key={cfg.slot}
              config={cfg}
              currentDataUrl={logos[cfg.slot]}
              uploading={uploadingSlot === cfg.slot}
              onUpload={(file) => void onUpload(cfg.slot, file)}
              onRemove={() => void onRemove(cfg.slot)}
            />
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Texto da prefeitura (cabeçalho)">
            <Input
              value={prefeituraName}
              onChange={(e) => setPrefeituraName(e.target.value)}
              placeholder="Ex.: PREFEITURA MUNICIPAL DE SÃO PAULO"
            />
          </Field>
          <Field label="Texto da secretaria (cabeçalho)">
            <Input
              value={secretariaName}
              onChange={(e) => setSecretariaName(e.target.value)}
              placeholder="Ex.: SECRETARIA MUNICIPAL DE SAÚDE"
            />
          </Field>
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={() => void onSaveMeta()} disabled={savingMeta}>
            {savingMeta ? 'Salvando…' : 'Salvar textos'}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-800">Aparência do aplicativo</h3>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          A cor primária é aplicada em botões, links e indicadores. O modo escuro afeta apenas a
          interface — os documentos impressos sempre saem em fundo branco.
        </p>

        <div className="mt-5">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Paletas pré-configuradas
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {THEME_PRESETS.map((p) => (
              <PresetCard
                key={p.id}
                preset={p}
                selected={themePrimary.toLowerCase() === p.primary.toLowerCase()}
                onSelect={async () => {
                  setError(null)
                  setNotice(null)
                  try {
                    await setPrimary(p.primary)
                    setColorDraft(p.primary)
                    setNotice(`Paleta aplicada: ${p.name}`)
                  } catch (err) {
                    setError((err as Error).message)
                  }
                }}
              />
            ))}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <Field label="Cor personalizada (hex)">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={colorDraft}
                  onChange={(e) => setColorDraft(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border border-slate-300"
                />
                <Input
                  value={colorDraft}
                  onChange={(e) => setColorDraft(e.target.value)}
                  className="font-mono uppercase"
                  placeholder="#0e7490"
                />
                <Button onClick={() => void onApplyColor()}>Aplicar</Button>
              </div>
            </Field>
          </div>
          <div>
            <Field label="Modo de tela">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void onToggleMode('light')}
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-sm',
                    themeMode === 'light'
                      ? 'border-[var(--color-ubs-primary)] bg-[var(--color-ubs-primary)]/10 text-[var(--color-ubs-primary-dark)]'
                      : 'border-slate-300 bg-white text-slate-600'
                  )}
                >
                  Claro
                </button>
                <button
                  type="button"
                  onClick={() => void onToggleMode('dark')}
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-sm',
                    themeMode === 'dark'
                      ? 'border-[var(--color-ubs-primary)] bg-[var(--color-ubs-primary)]/10 text-[var(--color-ubs-primary-dark)]'
                      : 'border-slate-300 bg-white text-slate-600'
                  )}
                >
                  Escuro
                </button>
              </div>
            </Field>
          </div>
        </div>
      </div>

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
    </div>
  )
}

function LogoUploader({
  config,
  currentDataUrl,
  uploading,
  onUpload,
  onRemove
}: {
  config: LogoSlotConfig
  currentDataUrl: string | null
  uploading: boolean
  onUpload: (file: File) => void
  onRemove: () => void
}): React.JSX.Element {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="text-sm font-medium text-slate-800">{config.label}</div>
      <div className="mt-0.5 text-xs text-slate-500">{config.hint}</div>
      <div className="mt-3 flex h-28 items-center justify-center rounded border border-dashed border-slate-300 bg-white">
        {currentDataUrl ? (
          <img src={currentDataUrl} alt={config.label} className="max-h-24 max-w-full" />
        ) : (
          <span className="text-xs text-slate-400">Nenhum logo</span>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <label className="inline-flex cursor-pointer items-center rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
          <input
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,.png,.jpg,.jpeg,.svg"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onUpload(file)
              e.target.value = ''
            }}
          />
          {uploading ? 'Enviando…' : currentDataUrl ? 'Trocar' : 'Enviar arquivo'}
        </label>
        {currentDataUrl ? (
          <button type="button" onClick={onRemove} className="text-xs text-red-600 hover:underline">
            Remover
          </button>
        ) : null}
      </div>
    </div>
  )
}

function PresetCard({
  preset,
  selected,
  onSelect
}: {
  preset: ThemePreset
  selected: boolean
  onSelect: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group flex flex-col gap-2 rounded-md border p-3 text-left transition',
        selected
          ? 'border-[var(--color-ubs-primary)] ring-2 ring-[var(--color-ubs-primary)]/30'
          : 'border-slate-200 hover:border-slate-300'
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-800">{preset.name}</span>
        {selected ? (
          <span className="rounded-full bg-[var(--color-ubs-primary)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Em uso
          </span>
        ) : null}
      </div>
      <div className="flex gap-1">
        {preset.swatch.map((c) => (
          <span
            key={c}
            className="h-6 flex-1 rounded-sm"
            style={{ backgroundColor: c }}
            aria-hidden
          />
        ))}
      </div>
      <div className="text-xs text-slate-500">{preset.description}</div>
    </button>
  )
}

function LetterheadTab(): React.JSX.Element {
  const navigate = useNavigate()
  const [logos, setLogos] = useState<BrandingLogos>({
    prefeitura: null,
    secretaria: null,
    hospital: null
  })
  const [unit, setUnit] = useState({
    unitName: '',
    unitCnes: '',
    unitAddress: '',
    unitPhone: '',
    unitMunicipality: '',
    brandingPrefeituraName: '',
    brandingSecretariaName: ''
  })
  const [logoHeight, setLogoHeight] = useState(56)
  const [align, setAlign] = useState<'left' | 'center'>('center')
  const [showFooter, setShowFooter] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = async (): Promise<void> => {
    const [s, l] = await Promise.all([
      window.api.settings.get(),
      window.api.branding.getLogos()
    ])
    setLogos(l)
    setUnit({
      unitName: s.unitName,
      unitCnes: s.unitCnes,
      unitAddress: s.unitAddress,
      unitPhone: s.unitPhone,
      unitMunicipality: s.unitMunicipality,
      brandingPrefeituraName: s.brandingPrefeituraName,
      brandingSecretariaName: s.brandingSecretariaName
    })
    setLogoHeight(s.letterheadLogoHeight)
    setAlign(s.letterheadAlign)
    setShowFooter(s.letterheadShowFooter)
  }

  useEffect(() => {
    void reload()
  }, [])

  const save = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await window.api.settings.update({
        letterheadLogoHeight: logoHeight,
        letterheadAlign: align,
        letterheadShowFooter: showFooter
      })
      setNotice('Layout do timbrado salvo. Já vale para os próximos documentos impressos.')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const hasAnyLogo = logos.prefeitura || logos.secretaria || logos.hospital
  const prefeituraText = unit.brandingPrefeituraName || 'PREFEITURA MUNICIPAL'
  const secretariaText = unit.brandingSecretariaName || 'SECRETARIA MUNICIPAL DE SAÚDE'
  const unidadeText = unit.unitName || 'NOME DO HOSPITAL'
  const logoStyle = { height: `${logoHeight}px`, width: 'auto' as const }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Editor de papel timbrado</h2>
        <p className="mt-1 max-w-2xl text-xs text-slate-600">
          Ajuste o tamanho e o alinhamento dos logos e textos que aparecem no cabeçalho de fichas,
          atestados, receituários e requisições. Faça upload dos logos em <em>Admin → Aparência</em>{' '}
          e os dados da unidade em <em>Admin → Unidade</em>.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <Field label={`Altura dos logos: ${logoHeight}px`} hint="24 a 120 pixels">
              <input
                type="range"
                min={24}
                max={120}
                step={2}
                value={logoHeight}
                onChange={(e) => setLogoHeight(Number(e.target.value))}
                className="w-full"
              />
            </Field>
            <Field label="Alinhamento">
              <Select
                value={align}
                onChange={(e) => setAlign(e.target.value === 'left' ? 'left' : 'center')}
              >
                <option value="center">Centralizado</option>
                <option value="left">Alinhado à esquerda</option>
              </Select>
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={showFooter}
                onChange={(e) => setShowFooter(e.target.checked)}
              />
              Mostrar rodapé (CNES · endereço · telefone · município)
            </label>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => void save()} disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar layout'}
              </Button>
              <Button variant="outline" onClick={() => navigate('/imprimir/modelo')}>
                Visualizar e exportar PDF
              </Button>
            </div>
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
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Pré-visualização ao vivo
            </div>
            <div className="rounded-md border border-dashed border-slate-300 bg-white p-4">
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  textAlign: align,
                  alignItems: align === 'center' ? 'center' : 'flex-start'
                }}
              >
                {hasAnyLogo ? (
                  <div
                    style={{
                      display: 'flex',
                      gap: 24,
                      justifyContent: align === 'center' ? 'space-around' : 'flex-start',
                      width: '100%'
                    }}
                  >
                    <div>
                      {logos.prefeitura ? (
                        <img src={logos.prefeitura} alt="Prefeitura" style={logoStyle} />
                      ) : (
                        <PlaceholderLogo h={logoHeight} label="Prefeitura" />
                      )}
                    </div>
                    <div>
                      {logos.secretaria ? (
                        <img src={logos.secretaria} alt="Secretaria" style={logoStyle} />
                      ) : (
                        <PlaceholderLogo h={logoHeight} label="Secretaria" />
                      )}
                    </div>
                    <div>
                      {logos.hospital ? (
                        <img src={logos.hospital} alt="Hospital" style={logoStyle} />
                      ) : (
                        <PlaceholderLogo h={logoHeight} label="Hospital" />
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400">
                    Nenhum logo cadastrado em Aparência ainda.
                  </div>
                )}
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    color: '#0f172a',
                    marginTop: 4
                  }}
                >
                  {prefeituraText}
                </div>
                <div style={{ fontSize: 12, color: '#334155' }}>{secretariaText}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{unidadeText}</div>
                {showFooter ? (
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>
                    {unit.unitCnes ? `CNES ${unit.unitCnes}` : 'CNES —'}
                    {unit.unitAddress ? ` · ${unit.unitAddress}` : ''}
                    {unit.unitPhone ? ` · Tel. ${unit.unitPhone}` : ''}
                    {unit.unitMunicipality ? ` · ${unit.unitMunicipality}` : ''}
                  </div>
                ) : null}
                <hr style={{ width: '100%', margin: '8px 0', border: '1px solid #e2e8f0' }} />
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: '#0e7490'
                  }}
                >
                  Ficha de atendimento
                </div>
                <div className="text-xs text-slate-400">— conteúdo do documento —</div>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Esta é uma simulação. Use <strong>Visualizar e exportar PDF</strong> para abrir o
              modelo real em página A4 e salvar como PDF.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function PlaceholderLogo({ h, label }: { h: number; label: string }): React.JSX.Element {
  return (
    <div
      style={{
        height: h,
        width: h * 1.2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px dashed #cbd5e1',
        borderRadius: 4,
        fontSize: 10,
        color: '#94a3b8',
        background: '#f8fafc'
      }}
    >
      {label}
    </div>
  )
}

function NetworkTab(): React.JSX.Element {
  const [loaded, setLoaded] = useState(false)
  const [runMode, setRunMode] = useState<RunMode>('standalone')
  const [serverPort, setServerPort] = useState(7321)
  const [serverUrl, setServerUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    void window.api.client.getBoot().then((b) => {
      setRunMode(b.runMode)
      setServerPort(b.serverPort ?? 7321)
      setServerUrl(b.serverUrl ?? '')
      setLoaded(true)
    })
  }, [])

  const testConnection = async (): Promise<void> => {
    setTesting(true)
    setTestResult(null)
    try {
      const r = await window.api.client.ping(serverUrl)
      setTestResult(
        r.ok
          ? `OK — servidor versão ${r.version ?? '?'}`
          : `Falha: ${r.error ?? 'sem resposta'}`
      )
    } finally {
      setTesting(false)
    }
  }

  const submit = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      if (runMode === 'client' && !serverUrl.trim()) {
        throw new Error('Informe a URL do servidor (ex.: http://192.168.1.10:7321).')
      }
      await window.api.client.setBoot({
        runMode,
        serverPort,
        serverUrl: serverUrl.trim() || undefined
      })
      setNotice('Configuração salva. Feche e abra o app novamente para aplicar.')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) return <div className="text-sm text-slate-500">Carregando…</div>

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-base font-semibold text-slate-800">Compartilhamento na rede (LAN)</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Defina como este computador se comporta. Em <strong>Servidor</strong>, ele expõe os dados
          para outras estações da mesma rede (recepção, enfermagem etc.). Em{' '}
          <strong>Cliente</strong>, ele se conecta a um servidor existente. <strong>Standalone</strong>{' '}
          é o modo padrão (banco local, sem rede).
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Modo de execução" required>
          <Select value={runMode} onChange={(e) => setRunMode(e.target.value as RunMode)}>
            {(Object.keys(RUN_MODE_LABELS) as RunMode[]).map((m) => (
              <option key={m} value={m}>
                {RUN_MODE_LABELS[m]}
              </option>
            ))}
          </Select>
        </Field>
        {runMode === 'server' ? (
          <Field
            label="Porta TCP"
            required
            hint="Padrão 7321. Use entre 1024 e 65535. Libere essa porta no firewall do Windows."
          >
            <Input
              type="number"
              min={1024}
              max={65535}
              value={serverPort}
              onChange={(e) => setServerPort(Number(e.target.value) || 7321)}
            />
          </Field>
        ) : null}
      </div>
      {runMode === 'server' ? (
        <div className="rounded-md border border-cyan-200 bg-cyan-50 p-3 text-xs text-cyan-900">
          <strong>Como os clientes conectam:</strong> peça aos outros computadores para abrir o app
          em modo <em>Cliente</em> e informar a URL{' '}
          <code className="rounded bg-cyan-100 px-1 py-0.5">
            http://[IP-deste-servidor]:{serverPort}
          </code>
          . Use o IP da rede local (ipconfig). Recomenda-se IP fixo no servidor.
        </div>
      ) : runMode === 'client' ? (
        <div className="space-y-2">
          <Field
            label="URL do servidor"
            required
            hint="Ex.: http://192.168.1.10:7321 (sem barra final)"
          >
            <Input
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="http://IP:porta"
            />
          </Field>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => void testConnection()} disabled={testing || !serverUrl.trim()}>
              {testing ? 'Testando…' : 'Testar conexão'}
            </Button>
            {testResult ? (
              <span
                className={`text-xs ${testResult.startsWith('OK') ? 'text-emerald-700' : 'text-red-700'}`}
              >
                {testResult}
              </span>
            ) : null}
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            Ao salvar e reiniciar, este computador deixará de usar o banco local e passará a
            consumir todos os dados do servidor configurado acima.
          </div>
        </div>
      ) : null}
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
      <div className="flex items-center justify-between">
        <a
          href="#/setup"
          className="text-xs font-medium text-cyan-700 hover:text-cyan-800 hover:underline"
        >
          Abrir assistente passo a passo →
        </a>
        <Button onClick={() => void submit()} disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </div>
  )
}

function SystemTab(): React.JSX.Element {
  const [seedHospitalState, setSeedHospitalState] = useState<
    | { status: 'idle' }
    | { status: 'running' }
    | { status: 'done'; message: string; kind: 'ok' | 'warn' }
  >({ status: 'idle' })

  const seedHospital = async (): Promise<void> => {
    setSeedHospitalState({ status: 'running' })
    try {
      const result = await window.api.demo.seedHospital()
      if (result.skipped) {
        setSeedHospitalState({
          status: 'done',
          kind: 'warn',
          message: 'Alas hospitalares já existem na base — operação ignorada.'
        })
      } else {
        setSeedHospitalState({
          status: 'done',
          kind: 'ok',
          message: `Criados: ${result.wardsCreated} alas, ${result.bedsCreated} leitos, ${result.admissionsCreated} internações com sinais vitais e balanço hídrico.`
        })
      }
    } catch (err) {
      setSeedHospitalState({
        status: 'done',
        kind: 'warn',
        message: (err as Error).message || 'Erro ao criar dados hospitalares.'
      })
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-800">
          Dados hospitalares de demonstração
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Cria alas (Clínica Médica, UTI, Observação), leitos e internações ativas com evoluções,
          sinais vitais e balanço hídrico de exemplo. Requer ao menos um paciente e um profissional
          cadastrados. Só roda uma vez (ignora se já houver alas cadastradas).
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Button
            onClick={() => void seedHospital()}
            disabled={seedHospitalState.status === 'running'}
          >
            {seedHospitalState.status === 'running'
              ? 'Criando…'
              : 'Popular dados hospitalares (demo)'}
          </Button>
          {seedHospitalState.status === 'done' ? (
            <div
              className={cn(
                'rounded-md px-3 py-1.5 text-xs',
                seedHospitalState.kind === 'ok'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-700'
              )}
            >
              {seedHospitalState.message}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
