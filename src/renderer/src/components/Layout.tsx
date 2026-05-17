import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@renderer/stores/auth'
import { useGlobalShortcuts } from '@renderer/hooks/useGlobalShortcuts'
import { cn, roleLabel } from '@renderer/lib/utils'
import { ErrorBoundary } from '@renderer/components/ErrorBoundary'
import { BrandLogo } from '@renderer/components/BrandLogo'
import { UpdateBanner } from '@renderer/components/UpdateBanner'
import { CommandPalette } from '@renderer/components/CommandPalette'
import type { UserRole } from '@shared/types'

interface NavItem {
  /** Caminho de rota interna. Quando `action` é definido, este valor é
   *  ignorado para navegação — só serve como key. */
  to: string
  label: string
  icon: React.ReactNode
  roles?: UserRole[]
  /** Se definido, o item vira botão que executa a ação ao invés de
   *  navegar. Usado pelo "Painel de Chamadas" que abre em janela nova. */
  action?: () => void | Promise<void>
}

/** Ícones inline (stroke) — estética empresarial, sem emoji. */
const Icon = {
  home: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
      aria-hidden
    >
      <path d="m3 11 9-7 9 7v9a2 2 0 0 1-2 2h-4v-6h-6v6H5a2 2 0 0 1-2-2v-9Z" />
    </svg>
  ),
  users: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
      aria-hidden
    >
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4 0-7 2.2-7 5v2h14v-2c0-2.8-3-5-7-5Z" />
    </svg>
  ),
  calendar: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </svg>
  ),
  stethoscope: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
      aria-hidden
    >
      <path d="M6 3v6a4 4 0 0 0 8 0V3" />
      <path d="M6 3H4m10 0h2" />
      <path d="M10 13v2a5 5 0 0 0 10 0v-2" />
      <circle cx="20" cy="10" r="2" />
    </svg>
  ),
  chart: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
      aria-hidden
    >
      <path d="M3 3v18h18" />
      <path d="m7 15 3-4 3 2 4-6" />
    </svg>
  ),
  cog: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5h.1a1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
    </svg>
  ),
  pill: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
      aria-hidden
    >
      <path d="M10.5 20.5a6 6 0 0 1-4.243-10.243l4-4A6 6 0 0 1 18.5 14.5l-4 4a6 6 0 0 1-4 2Z" />
      <path d="m9 9 6 6" />
    </svg>
  ),
  doorOpen: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
      aria-hidden
    >
      <path d="M13 4h3a2 2 0 0 1 2 2v14" />
      <path d="M2 20h3" />
      <path d="M13 20h9" />
      <path d="M10 12v.01" />
      <path d="M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.562Z" />
    </svg>
  ),
  triage: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
      aria-hidden
    >
      <path d="M3 12h3l2-5 4 10 2-5h7" />
    </svg>
  ),
  syringe: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
      aria-hidden
    >
      <path d="m18 2 4 4" />
      <path d="m17 7 3-3" />
      <path d="M19 9 8.7 19.3a2.4 2.4 0 0 1-3.4 0L4 18a2.4 2.4 0 0 1 0-3.4L14.3 4.3 19 9Z" />
      <path d="m9 11 4 4" />
      <path d="m6 14 4 4" />
      <path d="m4 17 3 3" />
    </svg>
  ),
  signOut: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M15 17l5-5-5-5M20 12H9M12 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" />
    </svg>
  ),
  bed: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
      aria-hidden
    >
      <path d="M2 8v12" />
      <path d="M22 12v8" />
      <path d="M2 16h20" />
      <path d="M2 12h12a4 4 0 0 1 4 4v0" />
      <circle cx="7" cy="11" r="2" />
    </svg>
  ),
  clipboard: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
      aria-hidden
    >
      <rect x="8" y="3" width="8" height="4" rx="1" />
      <path d="M8 5H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </svg>
  ),
  ambulance: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
      aria-hidden
    >
      <path d="M10 17h4" />
      <path d="M2 17h2" />
      <path d="M20 17h2" />
      <circle cx="7" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
      <path d="M14 17V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10" />
      <path d="M14 9h4l3 4v4" />
      <path d="M8 11h4" />
      <path d="M10 9v4" />
    </svg>
  ),
  scalpel: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
      aria-hidden
    >
      <path d="M14 4 4 14l3 3 10-10" />
      <path d="M14 4 21 11 17 13l-3-3-2-3 1-3z" />
    </svg>
  ),
  shield: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
      aria-hidden
    >
      <path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3Z" />
      <path d="M9 12h6" />
      <path d="M12 9v6" />
    </svg>
  ),
  clock: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  beaker: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
      aria-hidden
    >
      <path d="M9 3h6" />
      <path d="M10 3v6L4 20a2 2 0 0 0 1.7 3h12.6A2 2 0 0 0 20 20L14 9V3" />
      <path d="M7 16h10" />
    </svg>
  ),
  docs: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
      aria-hidden
    >
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5" />
      <path d="M8 13h8" />
      <path d="M8 17h5" />
    </svg>
  ),
  monitor: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
    </svg>
  )
}

interface NavGroup {
  category: string
  items: NavItem[]
}

const GROUPS: NavGroup[] = [
  {
    category: 'Geral',
    items: [{ to: '/', label: 'Dashboard', icon: Icon.home }]
  },
  {
    category: 'Atendimento',
    items: [
      { to: '/pacientes', label: 'Pacientes', icon: Icon.users },
      {
        to: '/recepcao',
        label: 'Recepção',
        icon: Icon.doorOpen,
        roles: ['admin', 'recepcao']
      },
      {
        to: '/consultas',
        label: 'Consultas',
        icon: Icon.calendar,
        roles: ['admin', 'recepcao', 'medico', 'enfermagem']
      },
      {
        to: '/fila',
        label: 'Fila',
        icon: Icon.triage,
        roles: ['admin', 'recepcao', 'enfermagem', 'medico']
      },
      {
        to: '/triagem',
        label: 'Triagem',
        icon: Icon.stethoscope,
        roles: ['admin', 'enfermagem', 'medico']
      },
      {
        to: 'painel-action',
        label: 'Painel de Chamadas',
        icon: Icon.monitor,
        roles: ['admin', 'recepcao', 'enfermagem', 'medico'],
        action: () => {
          void window.api.panel.open('/painel').catch(() => {
            // fallback: se falhar abrir janela nova, navega na mesma
            window.location.hash = '#/painel'
          })
        }
      }
    ]
  },
  {
    category: 'Emergência e cirurgia',
    items: [
      {
        to: '/ps',
        label: 'Pronto-Socorro',
        icon: Icon.ambulance,
        roles: ['admin', 'recepcao', 'enfermagem', 'medico']
      },
      {
        to: '/cirurgico',
        label: 'Centro Cirúrgico',
        icon: Icon.scalpel,
        roles: ['admin', 'medico', 'enfermagem']
      }
    ]
  },
  {
    category: 'Clínico',
    items: [
      {
        to: '/exames',
        label: 'Exames',
        icon: Icon.beaker,
        roles: ['admin', 'medico']
      },
      {
        to: '/medicacao',
        label: 'Sala de medicação',
        icon: Icon.pill,
        roles: ['admin', 'medico', 'enfermagem']
      },
      {
        to: '/atestados',
        label: 'Atestados / Declarações',
        icon: Icon.docs,
        roles: [
          'admin',
          'medico',
          'enfermagem',
          'dentista',
          'psicologo',
          'nutricionista',
          'fisioterapeuta'
        ]
      },
      {
        to: '/internacoes',
        label: 'Internações',
        icon: Icon.clipboard,
        roles: ['admin', 'medico', 'enfermagem']
      },
      { to: '/leitos', label: 'Leitos', icon: Icon.bed }
    ]
  },
  {
    category: 'Suprimentos',
    items: [
      { to: '/farmacia', label: 'Farmácia', icon: Icon.pill, roles: ['admin', 'farmacia'] }
    ]
  },
  {
    category: 'Segurança',
    items: [
      {
        to: '/ccih',
        label: 'CCIH',
        icon: Icon.shield,
        roles: ['admin', 'medico', 'enfermagem']
      }
    ]
  },
  {
    category: 'SUS',
    items: [
      { to: '/bpa', label: 'BPA / Produção', icon: Icon.chart, roles: ['admin', 'medico'] },
      {
        to: '/sinan',
        label: 'SINAN',
        icon: Icon.shield,
        roles: ['admin', 'medico', 'enfermagem']
      }
    ]
  },
  {
    category: 'Administração',
    items: [
      { to: '/tarefas', label: 'Tarefas / Avisos', icon: Icon.clipboard },
      { to: '/relatorios', label: 'Relatórios', icon: Icon.chart, roles: ['admin', 'medico'] },
      {
        to: '/admin',
        label: 'Administração',
        icon: Icon.cog,
        roles: ['admin', 'coordenacao', 'secretaria_saude']
      }
    ]
  }
]

const PRODUCT_LABEL: { title: string; subtitle: string } = {
  title: 'Gestão Hospitalar',
  subtitle: 'Sistema hospitalar'
}

export function Layout(): React.JSX.Element {
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
  useGlobalShortcuts()
  if (!user) return <div />

  const initials = user.fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')

  const product = PRODUCT_LABEL

  return (
    <div className="flex h-full">
      <aside className="app-sidebar flex w-64 flex-col">
        <div className="app-sidebar-brand flex items-center gap-3 px-5 py-5">
          <BrandLogo size={40} tone="light" />
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-tight text-white">
              {product.title}
            </div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-white/60">
              {product.subtitle}
            </div>
          </div>
        </div>
        <div className="app-sidebar-divider" aria-hidden />
        <nav className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
          {GROUPS.map((group) => {
            const visible = group.items.filter(
              (item) => !item.roles || item.roles.includes(user.role)
            )
            if (visible.length === 0) return null
            return (
              <div key={group.category} className="space-y-0.5">
                <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
                  {group.category}
                </div>
                {visible.map((item) =>
                  item.action ? (
                    <button
                      key={item.to}
                      type="button"
                      onClick={() => void item.action!()}
                      className="app-nav-link w-full text-left"
                    >
                      <span className="flex h-6 w-6 flex-none items-center justify-center">
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </button>
                  ) : (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/'}
                      className={({ isActive }) => cn('app-nav-link', isActive && 'is-active')}
                    >
                      <span className="flex h-6 w-6 flex-none items-center justify-center">
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </NavLink>
                  )
                )}
              </div>
            )
          })}
        </nav>
        <div className="app-sidebar-divider" aria-hidden />
        <div className="px-3 py-3">
          <ConnectionIndicator />
          <VersionIndicator />
          <div className="mt-2 flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2.5 ring-1 ring-white/10">
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white ring-1 ring-white/15">
              {initials || '?'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">{user.fullName}</div>
              <div className="text-[11px] text-white/60">{roleLabel(user.role)}</div>
            </div>
          </div>
          <button
            type="button"
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-xs font-medium text-white/80 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
            onClick={() => {
              void logout()
            }}
          >
            {Icon.signOut}
            Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
      <UpdateBanner />
      <CommandPalette />
    </div>
  )
}

/**
 * Indicador discreto de status de conexão. Em modo cliente faz health
 * check no servidor LAN a cada 15s (verde / vermelho). Em standalone/
 * server mostra o papel local (cinza / azul claro).
 */
function ConnectionIndicator(): React.JSX.Element | null {
  const [s, setS] = useState<{
    runMode: 'standalone' | 'server' | 'client'
    connected: boolean
    serverRunning: boolean
    serverUrl: string | null
    message: string
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    const tick = (): void => {
      void window.api.client
        .status()
        .then((r) => {
          if (!cancelled) setS(r)
        })
        .catch(() => null)
    }
    tick()
    const id = setInterval(tick, 15000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  if (!s) return null
  const color =
    s.runMode === 'client'
      ? s.connected
        ? 'bg-emerald-400'
        : 'bg-red-500'
      : s.runMode === 'server'
        ? s.serverRunning
          ? 'bg-cyan-400'
          : 'bg-amber-400'
        : 'bg-slate-400'
  const label =
    s.runMode === 'client'
      ? s.connected
        ? 'Cliente · conectado'
        : 'Cliente · sem conexão'
      : s.runMode === 'server'
        ? s.serverRunning
          ? 'Servidor LAN ativo'
          : 'Servidor não iniciou'
        : 'Standalone (local)'
  return (
    <div
      className="flex items-center gap-2 rounded-md bg-white/5 px-3 py-1.5 ring-1 ring-white/10"
      title={s.message}
    >
      <span className={`inline-block h-2 w-2 flex-none rounded-full ${color}`} />
      <span className="truncate text-[11px] text-white/75">{label}</span>
    </div>
  )
}

function VersionIndicator(): React.JSX.Element {
  const [version, setVersion] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    void window.api.meta.appInfo().then((r) => setVersion(r.version)).catch(() => null)
  }, [])

  const check = async (): Promise<void> => {
    setChecking(true)
    setStatus(null)
    try {
      const r = await window.api.updater.check()
      if (r.kind === 'available') setStatus(`Nova versão ${r.version} disponível`)
      else if (r.kind === 'not-available') setStatus('Você está na versão mais recente')
      else if (r.kind === 'downloading') setStatus(`Baixando ${Math.round(r.percent)}%`)
      else if (r.kind === 'downloaded') setStatus('Pronto para instalar — reinicie')
      else if (r.kind === 'error') setStatus(`Erro: ${r.message}`)
      else setStatus('Verificando…')
    } catch (err) {
      setStatus((err as Error).message)
    } finally {
      setChecking(false)
      setTimeout(() => setStatus(null), 5000)
    }
  }

  return (
    <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-white/5 px-3 py-1.5 ring-1 ring-white/10">
      <span className="truncate text-[10px] text-white/55">v{version ?? '?'}</span>
      <button
        type="button"
        onClick={() => void check()}
        disabled={checking}
        className="text-[10px] font-medium text-white/70 underline-offset-2 hover:text-white hover:underline disabled:opacity-50"
        title={status ?? 'Verificar atualização'}
      >
        {checking ? 'verificando…' : status ?? 'verificar update'}
      </button>
    </div>
  )
}
