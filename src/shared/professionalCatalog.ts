/**
 * Catálogo de categorias profissionais usadas em UBS, com CBO sugerido
 * e tipo de conselho de classe correspondente.
 *
 * CBO (Classificação Brasileira de Ocupações) — códigos retirados do
 * CBO 2002 do Ministério do Trabalho. As entradas a seguir são as mais
 * relevantes para Atenção Básica; podem ser sobrescritas livremente
 * pelo usuário no formulário.
 */
export type ProfessionalCategory =
  | 'medico'
  | 'dentista'
  | 'enfermeiro'
  | 'tecnico_enfermagem'
  | 'auxiliar_enfermagem'
  | 'farmaceutico'
  | 'psicologo'
  | 'fisioterapeuta'
  | 'nutricionista'
  | 'assistente_social'
  | 'agente_comunitario_saude'
  | 'tecnico_saude_bucal'
  | 'auxiliar_saude_bucal'
  | 'fonoaudiologo'
  | 'terapeuta_ocupacional'
  | 'recepcionista'
  | 'tecnico_radiologia'
  | 'biomedico'
  | 'outro'

export interface ProfessionalCategoryDef {
  key: ProfessionalCategory
  label: string
  /** Sugestão de tipo de conselho (CRM, CRO, COREN, etc.) ou null quando não há. */
  councilType: string | null
  /** CBO sugerido (código + descrição). */
  cbo: { code: string; name: string } | null
}

export const PROFESSIONAL_CATEGORIES: ProfessionalCategoryDef[] = [
  {
    key: 'medico',
    label: 'Médico(a)',
    councilType: 'CRM',
    cbo: { code: '2251-25', name: 'Médico clínico (atenção básica)' }
  },
  {
    key: 'dentista',
    label: 'Cirurgião-dentista',
    councilType: 'CRO',
    cbo: { code: '2232-08', name: 'Cirurgião-dentista — clínico geral' }
  },
  {
    key: 'enfermeiro',
    label: 'Enfermeiro(a)',
    councilType: 'COREN',
    cbo: { code: '2235-05', name: 'Enfermeiro' }
  },
  {
    key: 'tecnico_enfermagem',
    label: 'Técnico(a) de enfermagem',
    councilType: 'COREN',
    cbo: { code: '3222-05', name: 'Técnico de enfermagem' }
  },
  {
    key: 'auxiliar_enfermagem',
    label: 'Auxiliar de enfermagem',
    councilType: 'COREN',
    cbo: { code: '3222-30', name: 'Auxiliar de enfermagem' }
  },
  {
    key: 'farmaceutico',
    label: 'Farmacêutico(a)',
    councilType: 'CRF',
    cbo: { code: '2234-05', name: 'Farmacêutico' }
  },
  {
    key: 'psicologo',
    label: 'Psicólogo(a)',
    councilType: 'CRP',
    cbo: { code: '2515-10', name: 'Psicólogo clínico' }
  },
  {
    key: 'fisioterapeuta',
    label: 'Fisioterapeuta',
    councilType: 'CREFITO',
    cbo: { code: '2236-05', name: 'Fisioterapeuta geral' }
  },
  {
    key: 'nutricionista',
    label: 'Nutricionista',
    councilType: 'CRN',
    cbo: { code: '2237-10', name: 'Nutricionista' }
  },
  {
    key: 'assistente_social',
    label: 'Assistente social',
    councilType: 'CRESS',
    cbo: { code: '2516-05', name: 'Assistente social' }
  },
  {
    key: 'agente_comunitario_saude',
    label: 'Agente Comunitário de Saúde (ACS)',
    councilType: null,
    cbo: { code: '5151-05', name: 'Agente comunitário de saúde' }
  },
  {
    key: 'tecnico_saude_bucal',
    label: 'Técnico em Saúde Bucal (TSB)',
    councilType: 'CRO',
    cbo: { code: '3224-05', name: 'Técnico em saúde bucal' }
  },
  {
    key: 'auxiliar_saude_bucal',
    label: 'Auxiliar em Saúde Bucal (ASB)',
    councilType: 'CRO',
    cbo: { code: '3224-10', name: 'Auxiliar em saúde bucal' }
  },
  {
    key: 'fonoaudiologo',
    label: 'Fonoaudiólogo(a)',
    councilType: 'CREFONO',
    cbo: { code: '2238-10', name: 'Fonoaudiólogo geral' }
  },
  {
    key: 'terapeuta_ocupacional',
    label: 'Terapeuta ocupacional',
    councilType: 'CREFITO',
    cbo: { code: '2239-05', name: 'Terapeuta ocupacional' }
  },
  {
    key: 'tecnico_radiologia',
    label: 'Técnico em radiologia',
    councilType: 'CRTR',
    cbo: { code: '3241-15', name: 'Técnico em radiologia (médica)' }
  },
  {
    key: 'biomedico',
    label: 'Biomédico(a)',
    councilType: 'CRBM',
    cbo: { code: '2212-05', name: 'Biomédico' }
  },
  {
    key: 'recepcionista',
    label: 'Recepcionista de unidade de saúde',
    councilType: null,
    cbo: { code: '4221-25', name: 'Recepcionista, em geral' }
  },
  { key: 'outro', label: 'Outro', councilType: null, cbo: null }
]

const CATEGORY_BY_KEY = new Map(PROFESSIONAL_CATEGORIES.map((c) => [c.key, c]))

export function getCategoryDef(key: string | null | undefined): ProfessionalCategoryDef | null {
  if (!key) return null
  return CATEGORY_BY_KEY.get(key as ProfessionalCategory) ?? null
}

export function getCategoryLabel(key: string | null | undefined): string {
  return getCategoryDef(key)?.label ?? '—'
}

/** Tipos de conselho de classe usados no Brasil. */
export const COUNCIL_TYPES = [
  'CRM',
  'CRO',
  'COREN',
  'CRF',
  'CRP',
  'CREFITO',
  'CRN',
  'CRESS',
  'CREFONO',
  'CRBM',
  'CRTR',
  'Outro'
] as const

export const UF_LIST = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO'
] as const
