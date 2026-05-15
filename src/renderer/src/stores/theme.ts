import { create } from 'zustand'
import type { ThemeMode } from '@shared/types'

interface ThemeState {
  primary: string
  mode: ThemeMode
  loaded: boolean
  applyTheme: (input: { primary?: string; mode?: ThemeMode }) => void
  loadFromServer: () => Promise<void>
  setMode: (mode: ThemeMode) => Promise<void>
  setPrimary: (color: string) => Promise<void>
}

const DEFAULT_PRIMARY = '#0e7490'

export interface ThemePreset {
  id: string
  name: string
  description: string
  primary: string
  swatch: string[]
}

/** Paletas pré-configuradas com boa legibilidade e padrões de branding governamentais. */
export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'hospital-clinico',
    name: 'Hospital Clínico',
    description: 'Azul-petróleo médico (recomendado)',
    primary: '#0e7490',
    swatch: ['#0e7490', '#0b5c74', '#06b6d4']
  },
  {
    id: 'sus-teal',
    name: 'SUS Verde-água',
    description: 'Padrão SUS / atenção primária',
    primary: '#0b7285',
    swatch: ['#0b7285', '#075b6b', '#198754']
  },
  {
    id: 'azul-governo',
    name: 'Azul Governo',
    description: 'Ministérios e prefeituras',
    primary: '#1d4ed8',
    swatch: ['#1d4ed8', '#1e3a8a', '#60a5fa']
  },
  {
    id: 'verde-saude',
    name: 'Verde Saúde',
    description: 'Vigilância e promoção em saúde',
    primary: '#15803d',
    swatch: ['#15803d', '#14532d', '#22c55e']
  },
  {
    id: 'vinho-clinico',
    name: 'Vinho Clínico',
    description: 'Ambiente clínico tradicional',
    primary: '#9d174d',
    swatch: ['#9d174d', '#831843', '#ec4899']
  },
  {
    id: 'grafite',
    name: 'Grafite Sóbrio',
    description: 'Neutro de alta legibilidade',
    primary: '#334155',
    swatch: ['#334155', '#1e293b', '#64748b']
  },
  {
    id: 'laranja-urgencia',
    name: 'Laranja Pronto-Atendimento',
    description: 'Alta visibilidade / urgência',
    primary: '#c2410c',
    swatch: ['#c2410c', '#9a3412', '#f97316']
  }
]

/** Escurece um hex (#rrggbb) por uma fração (0..1). Usado pra derivar `--primary-dark`. */
function darken(hex: string, factor = 0.18): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const dr = Math.max(0, Math.round(r * (1 - factor)))
  const dg = Math.max(0, Math.round(g * (1 - factor)))
  const db = Math.max(0, Math.round(b * (1 - factor)))
  return `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`
}

function applyToDocument(primary: string, mode: ThemeMode): void {
  const root = document.documentElement
  root.style.setProperty('--color-ubs-primary', primary)
  root.style.setProperty('--color-ubs-primary-dark', darken(primary))
  if (mode === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

export const useTheme = create<ThemeState>((set, get) => ({
  primary: DEFAULT_PRIMARY,
  mode: 'light',
  loaded: false,
  applyTheme: (input) => {
    const next = {
      primary: input.primary ?? get().primary,
      mode: input.mode ?? get().mode
    }
    applyToDocument(next.primary, next.mode)
    set({ primary: next.primary, mode: next.mode })
  },
  loadFromServer: async () => {
    try {
      const s = await window.api.settings.getPublic()
      applyToDocument(s.themePrimary, s.themeMode)
      set({ primary: s.themePrimary, mode: s.themeMode, loaded: true })
    } catch {
      set({ loaded: true })
    }
  },
  setMode: async (mode) => {
    await window.api.settings.update({ themeMode: mode })
    applyToDocument(get().primary, mode)
    set({ mode })
  },
  setPrimary: async (color) => {
    // Usa o valor normalizado devolvido pelo backend (trim + lowercase) pra
    // evitar divergência entre o que o servidor persistiu e o que vai pro DOM
    // (ex.: se o usuário colar "  #0B7285 ", o regex em darken() falharia).
    const updated = await window.api.settings.update({ themePrimary: color })
    applyToDocument(updated.themePrimary, get().mode)
    set({ primary: updated.themePrimary })
  }
}))
