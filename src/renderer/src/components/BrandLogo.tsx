/**
 * Logo institucional do Gestão Hospitalar.
 *
 * Usa a cor primária atual (`--color-ubs-primary`, mantida com o nome legado
 * por compatibilidade do tema) como base do gradiente, então o logo se ajusta
 * automaticamente quando o usuário troca o tema. `tone="light"` inverte cores
 * (base translúcida branca) para superfícies escuras.
 */
interface Props {
  /** Tamanho em pixels (largura = altura). */
  size?: number
  /** "brand" = gradiente da cor primária. "light" = translúcido branco. */
  tone?: 'brand' | 'light'
  className?: string
  title?: string
}

export function BrandLogo({
  size = 40,
  tone = 'brand',
  className,
  title = 'Gestão Hospitalar'
}: Props): React.JSX.Element {
  const id = `brand-logo-${tone}`
  const gradId = `${id}-grad`
  const base = tone === 'light' ? 'rgba(255,255,255,0.16)' : 'var(--color-ubs-primary)'
  const top = tone === 'light' ? 'rgba(255,255,255,0.28)' : 'var(--color-ubs-primary)'
  const bottom = tone === 'light' ? 'rgba(255,255,255,0.10)' : 'var(--color-ubs-primary-dark)'
  const cross = tone === 'light' ? '#ffffff' : '#ffffff'
  const pulse = tone === 'light' ? 'rgba(255,255,255,0.85)' : '#e0f7ff'
  const ring = tone === 'light' ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.55)'

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 40 40"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={className}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={top} />
          <stop offset="100%" stopColor={bottom} />
        </linearGradient>
      </defs>
      {/* Container (escudo arredondado) */}
      <rect
        x="1.5"
        y="1.5"
        width="37"
        height="37"
        rx="9.5"
        ry="9.5"
        fill={tone === 'light' ? base : `url(#${gradId})`}
        stroke={ring}
        strokeWidth="1"
      />
      {/* Cruz médica */}
      <path
        d="M22.6 8.5h-5.2a1.2 1.2 0 0 0-1.2 1.2v5.3H10.9a1.2 1.2 0 0 0-1.2 1.2v5.2a1.2 1.2 0 0 0 1.2 1.2h5.3V28a1.2 1.2 0 0 0 1.2 1.2h5.2A1.2 1.2 0 0 0 23.8 28v-5.4h5.3a1.2 1.2 0 0 0 1.2-1.2v-5.2a1.2 1.2 0 0 0-1.2-1.2h-5.3V9.7a1.2 1.2 0 0 0-1.2-1.2Z"
        fill={cross}
        opacity={tone === 'light' ? 0.92 : 1}
      />
      {/* Linha de pulso (ECG) sobreposta, sutil */}
      <path
        d="M6 26.5h5.2l1.6-3 2.4 6 2.2-4.4 1.6 2.4h15"
        fill="none"
        stroke={pulse}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      />
    </svg>
  )
}
