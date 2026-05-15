/**
 * Logo institucional do Gestão Hospitalar.
 *
 * Quadrado arredondado em gradiente cyan, cruz médica branca e linha de
 * pulso ECG. `tone="light"` inverte para superfícies escuras (sidebar dark,
 * tela de login). É um SVG inline para escalar sem perder nitidez.
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
  const bgGrad = `${id}-bg`
  const crossGrad = `${id}-cross`

  // Cores: brand usa o gradiente cyan oficial; light fica translúcido para
  // funcionar sobre o sidebar escuro/azul-marinho do app.
  const bgStops =
    tone === 'light'
      ? [
          { offset: '0%', color: 'rgba(255,255,255,0.22)' },
          { offset: '100%', color: 'rgba(255,255,255,0.06)' }
        ]
      : [
          { offset: '0%', color: '#22d3ee' },
          { offset: '55%', color: '#0891b2' },
          { offset: '100%', color: '#0e7490' }
        ]
  const ring = tone === 'light' ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.22)'
  const crossTop = '#ffffff'
  const crossBottom = tone === 'light' ? 'rgba(255,255,255,0.92)' : '#e0f7ff'
  const pulseBack = tone === 'light' ? 'rgba(255,255,255,0.55)' : '#0e7490'
  const pulseFront = tone === 'light' ? '#ffffff' : '#ffffff'

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={className}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={bgGrad} x1="0" y1="0" x2="1" y2="1">
          {bgStops.map((s, i) => (
            <stop key={i} offset={s.offset} stopColor={s.color} />
          ))}
        </linearGradient>
        <linearGradient id={crossGrad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={crossTop} />
          <stop offset="100%" stopColor={crossBottom} />
        </linearGradient>
      </defs>

      {/* Fundo arredondado */}
      <rect x="16" y="16" width="480" height="480" rx="96" ry="96" fill={`url(#${bgGrad})`} />
      <rect
        x="20"
        y="20"
        width="472"
        height="472"
        rx="92"
        ry="92"
        fill="none"
        stroke={ring}
        strokeWidth="2"
      />

      {/* Cruz médica */}
      <rect x="216" y="104" width="80" height="304" rx="20" ry="20" fill={`url(#${crossGrad})`} />
      <rect x="104" y="216" width="304" height="80" rx="20" ry="20" fill={`url(#${crossGrad})`} />

      {/* Linha de pulso (ECG) */}
      <path
        d="M 80 256 L 168 256 L 192 224 L 224 296 L 256 200 L 288 296 L 320 224 L 344 256 L 432 256"
        fill="none"
        stroke={pulseBack}
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity="0.95"
      />
      <path
        d="M 80 256 L 168 256 L 192 224 L 224 296 L 256 200 L 288 296 L 320 224 L 344 256 L 432 256"
        fill="none"
        stroke={pulseFront}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity="0.9"
      />
    </svg>
  )
}
