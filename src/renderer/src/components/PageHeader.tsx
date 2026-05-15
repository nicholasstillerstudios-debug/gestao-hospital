interface Props {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  /** Rótulo curto acima do título (ex.: "Administração"). Opcional. */
  eyebrow?: string
}

/**
 * Cabeçalho padrão de página, estética empresarial:
 * - eyebrow opcional em caps com cor da marca
 * - título em peso semibold
 * - barra de acento sutil (gradiente) embaixo, sem o tom "caixa alta" antigo
 */
export function PageHeader({ title, subtitle, actions, eyebrow }: Props): React.JSX.Element {
  return (
    <header className="app-page-header relative flex flex-wrap items-end justify-between gap-4 px-6 py-5">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ubs-primary-dark)]">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="truncate text-[22px] font-semibold tracking-tight text-[var(--app-text)]">
          {title}
        </h1>
        {subtitle ? <p className="mt-1 text-sm text-[var(--app-text-muted)]">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}
