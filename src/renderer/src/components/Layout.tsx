import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@renderer/stores/auth'
import { useGlobalShortcuts } from '@renderer/hooks/useGlobalShortcuts'
import { cn, roleLabel } from '@renderer/lib/utils'
import { ErrorBoundary } from '@renderer/components/ErrorBoundary'
import { BrandLogo } from '@renderer/components/BrandLogo'
import { UpdateBanner } from '@renderer/components/UpdateBanner'
import type { UserRole } from '@shared/types'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  roles?: UserRole[]
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
  )
}

const ITEMS: NavItem[] = [
  { to: '/', label: 'Início', icon: Icon.home },
  { to: '/pacientes', label: 'Pacientes', icon: Icon.users },
  {
    to: '/ps',
    label: 'Pronto-Socorro',
    icon: Icon.ambulance,
    roles: ['admin', 'recepcao', 'enfermagem', 'medico']
  },
  { to: '/leitos', label: 'Leitos', icon: Icon.bed },
  {
    to: '/internacoes',
    label: 'Internações',
    icon: Icon.clipboard,
    roles: ['admin', 'medico', 'enfermagem']
  },
  {
    to: '/cirurgico',
    label: 'Centro Cirúrgico',
    icon: Icon.scalpel,
    roles: ['admin', 'medico', 'enfermagem']
  },
  {
    to: '/ccih',
    label: 'CCIH',
    icon: Icon.shield,
    roles: ['admin', 'medico', 'enfermagem']
  },
  { to: '/farmacia', label: 'Farmácia', icon: Icon.pill, roles: ['admin', 'farmacia'] },
  { to: '/relatorios', label: 'Relatórios', icon: Icon.chart, roles: ['admin', 'medico'] },
  { to: '/admin', label: 'Administração', icon: Icon.cog, roles: ['admin'] }
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
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
            Operação
          </div>
          {ITEMS.filter((item) => !item.roles || item.roles.includes(user.role)).map((item) => (
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
          ))}
        </nav>
        <div className="app-sidebar-divider" aria-hidden />
        <div className="px-3 py-3">
          <div className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2.5 ring-1 ring-white/10">
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
    </div>
  )
}
