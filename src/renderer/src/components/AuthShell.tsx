import type { ReactNode } from 'react'
import { BrandLogo } from '@renderer/components/BrandLogo'

interface Props {
  /** Cabeçalho do formulário (ex.: "Bem-vindo de volta"). */
  title: string
  /** Texto auxiliar logo abaixo do título. */
  subtitle: string
  /** Conteúdo do formulário. */
  children: ReactNode
}

const FEATURES: { icon: ReactNode; label: string; description: string }[] = [
  {
    label: 'Prontuário eletrônico',
    description: 'Atendimento SOAP, histórico clínico e prescrição em um só lugar.',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden
      >
        <path d="M9 4h6a2 2 0 0 1 2 2v2H7V6a2 2 0 0 1 2-2Z" />
        <path d="M7 8h10v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V8Z" />
        <path d="M12 12v6" />
        <path d="M9 15h6" />
      </svg>
    )
  },
  {
    label: 'Pronto-socorro hospitalar',
    description: 'Atendimento de urgência, observação e encaminhamento à internação.',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden
      >
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 9h18" />
        <path d="M8 3v4" />
        <path d="M16 3v4" />
        <path d="m9 14 2 2 4-4" />
      </svg>
    )
  },
  {
    label: 'Conformidade LGPD',
    description: 'Trilha de auditoria, anonimização e portabilidade de dados.',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden
      >
        <path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    )
  },
  {
    label: 'Internação e leitos',
    description: 'Mapa de leitos, evolução, sinais vitais, MAR e balanço hídrico.',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden
      >
        <path d="M3 11h18v9H3z" />
        <path d="M3 11V7a2 2 0 0 1 2-2h4v6" />
        <path d="M11 11V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v6" />
        <circle cx="7" cy="14.5" r="1" />
      </svg>
    )
  },
  {
    label: 'Documentos com papel timbrado',
    description: 'Receituário, atestado, requisição e ficha exportados em PDF.',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden
      >
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
        <path d="M14 3v5h5" />
        <path d="M9 13h6" />
        <path d="M9 17h6" />
      </svg>
    )
  }
]

export function AuthShell({ title, subtitle, children }: Props): React.JSX.Element {
  const year = new Date().getFullYear()
  return (
    <div className="auth-shell relative flex h-full overflow-hidden bg-[var(--app-bg)]">
      {/* Painel esquerdo — branding institucional. Esconde em telas estreitas. */}
      <aside className="auth-side relative hidden flex-col justify-between overflow-hidden p-10 text-white md:flex md:w-[42%] lg:w-[48%] xl:w-[52%]">
        <div className="auth-side-bg" aria-hidden />
        <div className="auth-side-pattern" aria-hidden />
        <div className="relative">
          <div className="flex items-center gap-3">
            <BrandLogo size={48} tone="light" />
            <div>
              <div className="text-base font-semibold tracking-tight">Gestão Hospitalar</div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-white/70">
                Sistema de gestão hospitalar
              </div>
            </div>
          </div>
        </div>

        <div className="relative max-w-md animate-fade-in-up">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Cuidado contínuo,
            <br />
            <span className="text-white/80">com a tecnologia certa.</span>
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/75">
            Plataforma desktop para Hospitais — prontuário eletrônico, leitos,
            internação, evolução clínica, prescrição, farmácia hospitalar e
            conformidade LGPD.
          </p>

          <ul className="mt-8 space-y-4">
            {FEATURES.map((f) => (
              <li key={f.label} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-white/12 text-white ring-1 ring-white/20">
                  {f.icon}
                </span>
                <div>
                  <div className="text-sm font-semibold">{f.label}</div>
                  <div className="text-xs text-white/70">{f.description}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative text-xs text-white/60">
          <div className="font-medium text-white/80">Atenção hospitalar</div>
          <div>Sistema {year} — uso restrito a profissionais autorizados.</div>
        </div>
      </aside>

      {/* Painel direito — formulário. */}
      <main className="relative flex flex-1 items-center justify-center px-6 py-10">
        <div className="absolute inset-0 -z-10 auth-main-bg" aria-hidden />
        <div className="w-full max-w-sm animate-fade-in-up">
          {/* Branding compacto pra tela pequena (sem o painel lateral). */}
          <div className="mb-7 flex items-center gap-3 md:hidden">
            <BrandLogo size={44} />
            <div>
              <div className="text-base font-semibold text-[var(--app-text)]">Gestão Hospitalar</div>
              <div className="text-xs text-[var(--app-text-muted)]">Sistema de gestão hospitalar</div>
            </div>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--app-text)]">
              {title}
            </h1>
            <p className="mt-1 text-sm text-[var(--app-text-muted)]">{subtitle}</p>
          </div>

          {children}
        </div>
      </main>
    </div>
  )
}
