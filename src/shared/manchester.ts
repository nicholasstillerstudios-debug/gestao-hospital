/**
 * Protocolo de Triagem de Manchester (versão simplificada para UBS).
 *
 * O sistema oficial tem 52 fluxogramas — aqui mantemos os mais comuns na
 * Atenção Primária. Cada fluxograma tem uma lista de discriminadores
 * ordenados do mais grave (vermelho) ao mais leve (azul). A cor da triagem
 * é a do discriminador mais grave marcado; se nenhum for marcado, AZUL.
 *
 * Tempos-alvo seguem o protocolo brasileiro (Portaria 354/2014 e ABNT):
 *   vermelho 0 min · laranja 10 min · amarelo 60 min · verde 120 min · azul 240 min
 */

export type ManchesterColor = 'vermelho' | 'laranja' | 'amarelo' | 'verde' | 'azul'

export const MANCHESTER_ORDER: ManchesterColor[] = [
  'vermelho',
  'laranja',
  'amarelo',
  'verde',
  'azul'
]

export const MANCHESTER_LABELS: Record<ManchesterColor, string> = {
  vermelho: 'Vermelho — Emergência',
  laranja: 'Laranja — Muito urgente',
  amarelo: 'Amarelo — Urgente',
  verde: 'Verde — Pouco urgente',
  azul: 'Azul — Não urgente'
}

export const MANCHESTER_TARGETS: Record<
  ManchesterColor,
  { minutes: number; label: string; tone: string }
> = {
  vermelho: { minutes: 0, label: 'Atendimento imediato', tone: 'Emergência' },
  laranja: { minutes: 10, label: 'Até 10 minutos', tone: 'Muito urgente' },
  amarelo: { minutes: 60, label: 'Até 60 minutos', tone: 'Urgente' },
  verde: { minutes: 120, label: 'Até 120 minutos', tone: 'Pouco urgente' },
  azul: { minutes: 240, label: 'Até 240 minutos', tone: 'Não urgente' }
}

export interface Discriminator {
  id: string
  label: string
  color: ManchesterColor
  /** Hint técnica curta para o profissional. */
  hint?: string
}

export type FlowchartCategory = 'clinico' | 'trauma' | 'pediatrico' | 'gestante' | 'mental'

export interface Flowchart {
  key: string
  label: string
  category: FlowchartCategory
  description?: string
  discriminators: Discriminator[]
}

/**
 * Discriminadores universais que aparecem em quase todos os fluxogramas.
 * Mantidos em uma constante para evitar duplicação na lista abaixo.
 */
const RED_FLAGS: Discriminator[] = [
  {
    id: 'via-aerea',
    label: 'Via aérea comprometida',
    color: 'vermelho',
    hint: 'Estridor, obstrução, engasgo'
  },
  {
    id: 'respiracao',
    label: 'Respiração ineficaz',
    color: 'vermelho',
    hint: 'Apneia, gasping, FR < 8 ou > 35'
  },
  {
    id: 'choque',
    label: 'Sinais de choque',
    color: 'vermelho',
    hint: 'Pele fria/úmida, perfusão > 3s, hipotensão grave'
  },
  {
    id: 'inconsciente',
    label: 'Inconsciente / não responde',
    color: 'vermelho',
    hint: 'Glasgow ≤ 8'
  },
  { id: 'convulsao', label: 'Convulsão ativa', color: 'vermelho' },
  { id: 'hemorragia-exsanguinante', label: 'Hemorragia exsanguinante', color: 'vermelho' }
]

export const FLOWCHARTS: Flowchart[] = [
  {
    key: 'dor-toracica',
    label: 'Dor torácica',
    category: 'clinico',
    description: 'Dor ou desconforto no tórax, de qualquer característica.',
    discriminators: [
      ...RED_FLAGS,
      {
        id: 'dor-precordial-irradiada',
        label: 'Dor precordial com irradiação para braço/mandíbula',
        color: 'laranja',
        hint: 'Suspeita de SCA'
      },
      { id: 'dor-severa', label: 'Dor severa (7–10)', color: 'laranja' },
      { id: 'dispneia-aguda', label: 'Dispneia aguda associada', color: 'laranja' },
      { id: 'sudorese-palidez', label: 'Sudorese fria + palidez', color: 'laranja' },
      { id: 'dor-moderada', label: 'Dor moderada (4–6)', color: 'amarelo' },
      { id: 'historia-cardiaca', label: 'História de cardiopatia conhecida', color: 'amarelo' },
      { id: 'dor-pleuritica', label: 'Dor que piora com respiração', color: 'amarelo' },
      { id: 'dor-leve-recente', label: 'Dor leve (1–3) recente', color: 'verde' },
      { id: 'dor-leve-cronica', label: 'Dor leve crônica em investigação', color: 'verde' }
    ]
  },
  {
    key: 'dispneia',
    label: 'Dispneia / falta de ar',
    category: 'clinico',
    description: 'Sensação de falta de ar ou dificuldade respiratória.',
    discriminators: [
      ...RED_FLAGS,
      { id: 'spo2-90', label: 'SpO₂ < 90% em ar ambiente', color: 'laranja' },
      { id: 'tiragem', label: 'Uso de musculatura acessória / tiragem', color: 'laranja' },
      { id: 'cianose', label: 'Cianose central', color: 'laranja' },
      { id: 'taquipneia-severa', label: 'Taquipneia severa (FR > 30)', color: 'laranja' },
      { id: 'spo2-94', label: 'SpO₂ 90–94%', color: 'amarelo' },
      { id: 'dispneia-moderada', label: 'Dispneia aos pequenos esforços', color: 'amarelo' },
      { id: 'historia-asma-dpoc', label: 'Asma/DPOC com piora recente', color: 'amarelo' },
      { id: 'dispneia-leve', label: 'Dispneia leve aos grandes esforços', color: 'verde' }
    ]
  },
  {
    key: 'cefaleia',
    label: 'Cefaleia / dor de cabeça',
    category: 'clinico',
    description: 'Dor de cabeça de qualquer intensidade ou localização.',
    discriminators: [
      ...RED_FLAGS,
      {
        id: 'cefaleia-thunderclap',
        label: 'Cefaleia súbita "em trovoada"',
        color: 'laranja',
        hint: 'Pico em segundos, suspeita de HSA'
      },
      {
        id: 'sinal-focal',
        label: 'Déficit neurológico novo',
        color: 'laranja',
        hint: 'Hemiparesia, disartria, alteração visual'
      },
      { id: 'rigidez-nuca', label: 'Rigidez de nuca + febre', color: 'laranja' },
      { id: 'dor-severa-cefaleia', label: 'Dor severa (7–10)', color: 'laranja' },
      { id: 'cefaleia-pos-trauma', label: 'Pós trauma craniano (< 24h)', color: 'amarelo' },
      { id: 'vomitos-cefaleia', label: 'Vômitos associados', color: 'amarelo' },
      { id: 'dor-moderada-cefaleia', label: 'Dor moderada (4–6)', color: 'amarelo' },
      { id: 'dor-leve-cefaleia', label: 'Dor leve / habitual', color: 'verde' }
    ]
  },
  {
    key: 'dor-abdominal',
    label: 'Dor abdominal (adulto)',
    category: 'clinico',
    description: 'Dor em qualquer região do abdome em adulto.',
    discriminators: [
      ...RED_FLAGS,
      { id: 'abdome-rigido', label: 'Abdome em tábua / peritonite', color: 'laranja' },
      { id: 'sangramento-digestivo', label: 'Hematêmese / melena ativa', color: 'laranja' },
      { id: 'dor-severa-abd', label: 'Dor severa (7–10)', color: 'laranja' },
      { id: 'gestante-1tri', label: 'Gestante com sangramento', color: 'laranja' },
      { id: 'vomitos-incoerciveis', label: 'Vômitos incoercíveis', color: 'amarelo' },
      { id: 'febre-abd', label: 'Febre > 38,5°C', color: 'amarelo' },
      { id: 'dor-moderada-abd', label: 'Dor moderada (4–6)', color: 'amarelo' },
      { id: 'dor-leve-abd', label: 'Dor leve (1–3)', color: 'verde' },
      { id: 'sintomas-cronicos-abd', label: 'Sintomas crônicos estáveis', color: 'verde' }
    ]
  },
  {
    key: 'febre-adulto',
    label: 'Febre / queixas gerais (adulto)',
    category: 'clinico',
    description: 'Febre como queixa principal em adulto.',
    discriminators: [
      ...RED_FLAGS,
      {
        id: 'sepse',
        label: 'Sinais de sepse (qSOFA ≥ 2)',
        color: 'laranja',
        hint: 'Hipotensão, FR ≥ 22, alteração mental'
      },
      { id: 'febre-40', label: 'Temperatura > 40°C', color: 'laranja' },
      { id: 'imunodeprimido', label: 'Imunodeprimido com febre', color: 'laranja' },
      { id: 'febre-38-40', label: 'Temperatura 38–40°C', color: 'amarelo' },
      { id: 'sintomas-7d', label: 'Sintomas há < 7 dias com piora', color: 'amarelo' },
      { id: 'febre-baixa', label: 'Febre baixa estável (< 38°C)', color: 'verde' },
      {
        id: 'sintomas-cronicos-febre',
        label: 'Sintomas crônicos / em investigação',
        color: 'verde'
      }
    ]
  },
  {
    key: 'febre-pediatrica',
    label: 'Febre em criança',
    category: 'pediatrico',
    description: 'Lactente ou criança com febre.',
    discriminators: [
      ...RED_FLAGS,
      { id: 'lactente-3m', label: 'Lactente < 3 meses com febre', color: 'laranja' },
      { id: 'irritabilidade-lactente', label: 'Irritabilidade ou letargia', color: 'laranja' },
      { id: 'desidratacao-grave', label: 'Sinais de desidratação grave', color: 'laranja' },
      { id: 'petequias', label: 'Petéquias / rash purpúrico', color: 'laranja' },
      { id: 'febre-39-pediatrico', label: 'Temperatura ≥ 39°C', color: 'amarelo' },
      { id: 'recusa-alimentar', label: 'Recusa alimentar persistente', color: 'amarelo' },
      { id: 'vomitos-pediatrico', label: 'Vômitos repetidos', color: 'amarelo' },
      { id: 'febre-baixa-pediatrico', label: 'Febre baixa, criança ativa', color: 'verde' }
    ]
  },
  {
    key: 'trauma-extremidade',
    label: 'Trauma de extremidade',
    category: 'trauma',
    description: 'Lesão em braço, perna ou articulação.',
    discriminators: [
      ...RED_FLAGS,
      { id: 'amputacao', label: 'Amputação / quase-amputação', color: 'vermelho' },
      { id: 'fratura-exposta', label: 'Fratura exposta', color: 'laranja' },
      { id: 'sangramento-arterial', label: 'Sangramento arterial', color: 'laranja' },
      { id: 'dor-severa-trauma', label: 'Dor severa (7–10)', color: 'laranja' },
      { id: 'deformidade', label: 'Deformidade óssea evidente', color: 'amarelo' },
      { id: 'edema-impotencia', label: 'Edema e impotência funcional', color: 'amarelo' },
      { id: 'dor-moderada-trauma', label: 'Dor moderada (4–6)', color: 'amarelo' },
      { id: 'dor-leve-trauma', label: 'Dor leve / contusão', color: 'verde' }
    ]
  },
  {
    key: 'ferida',
    label: 'Ferida / lesão de pele',
    category: 'trauma',
    description: 'Ferida cortocontusa, abrasão ou laceração.',
    discriminators: [
      ...RED_FLAGS,
      { id: 'sangramento-grave', label: 'Sangramento maciço não controlado', color: 'laranja' },
      { id: 'evisceracao', label: 'Evisceração / lesão profunda', color: 'laranja' },
      { id: 'mordedura-grande', label: 'Mordedura por animal grande / face', color: 'laranja' },
      { id: 'ferida-suja-tendao', label: 'Ferida com exposição de tendão/osso', color: 'amarelo' },
      { id: 'sinal-infeccao', label: 'Sinais de infecção (eritema, pus, febre)', color: 'amarelo' },
      { id: 'ferida-recente', label: 'Ferida limpa < 6h, sem sangramento ativo', color: 'verde' },
      { id: 'ferida-curativo', label: 'Curativo de rotina / troca', color: 'azul' }
    ]
  },
  {
    key: 'mal-estar',
    label: 'Indisposição / mal-estar geral',
    category: 'clinico',
    description: 'Queixa inespecífica de fraqueza, tontura, mal-estar.',
    discriminators: [
      ...RED_FLAGS,
      { id: 'sincope-recente', label: 'Síncope há menos de 1h', color: 'laranja' },
      {
        id: 'palidez-acentuada',
        label: 'Palidez intensa / suspeita de hemorragia',
        color: 'laranja'
      },
      { id: 'glicemia-grave', label: 'Glicemia < 60 ou > 400 mg/dL', color: 'laranja' },
      { id: 'tontura-com-sintomas', label: 'Tontura + sintomas neurológicos', color: 'amarelo' },
      { id: 'desidratacao-leve', label: 'Sinais leves de desidratação', color: 'amarelo' },
      { id: 'sintomas-cronicos-mal', label: 'Sintomas crônicos estáveis', color: 'verde' }
    ]
  },
  {
    key: 'urinario',
    label: 'Sintomas urinários',
    category: 'clinico',
    description: 'Disúria, polaciúria, hematúria, dor lombar.',
    discriminators: [
      ...RED_FLAGS,
      {
        id: 'sepse-urinaria',
        label: 'Febre alta + tremores + dor lombar',
        color: 'laranja',
        hint: 'Suspeita de pielonefrite/sepse'
      },
      { id: 'retencao-urinaria', label: 'Retenção urinária com dor', color: 'laranja' },
      { id: 'hematuria-macro', label: 'Hematúria macroscópica + dor', color: 'amarelo' },
      { id: 'gestante-itu', label: 'Gestante com sintoma urinário', color: 'amarelo' },
      { id: 'disuria-comum', label: 'Disúria sem febre', color: 'verde' },
      { id: 'controle-urinario', label: 'Controle / resultado de exame', color: 'azul' }
    ]
  },
  {
    key: 'gestante',
    label: 'Gestante / puérpera',
    category: 'gestante',
    description: 'Queixa em gestante ou puérpera (até 42 dias).',
    discriminators: [
      ...RED_FLAGS,
      { id: 'sangramento-vaginal-grave', label: 'Sangramento vaginal intenso', color: 'laranja' },
      {
        id: 'pre-eclampsia',
        label: 'PA ≥ 160×110 / cefaleia / escotomas',
        color: 'laranja',
        hint: 'Suspeita de pré-eclâmpsia grave'
      },
      {
        id: 'trabalho-parto-ativo',
        label: 'Trabalho de parto ativo / perda de líquido',
        color: 'laranja'
      },
      { id: 'reducao-mov-fetal', label: 'Redução de movimentos fetais', color: 'amarelo' },
      { id: 'sangramento-leve-gest', label: 'Sangramento vaginal leve', color: 'amarelo' },
      { id: 'consulta-pre-natal', label: 'Consulta de pré-natal de rotina', color: 'azul' }
    ]
  },
  {
    key: 'saude-mental',
    label: 'Saúde mental / comportamental',
    category: 'mental',
    description: 'Crise psiquiátrica, ideação suicida, agitação.',
    discriminators: [
      ...RED_FLAGS,
      { id: 'tentativa-suicidio', label: 'Tentativa de suicídio em curso', color: 'vermelho' },
      { id: 'ideacao-suicida-ativa', label: 'Ideação suicida com plano', color: 'laranja' },
      { id: 'agitacao-grave', label: 'Agitação grave / risco a si ou a outros', color: 'laranja' },
      { id: 'psicose-aguda', label: 'Psicose aguda / alucinações', color: 'amarelo' },
      { id: 'ansiedade-severa', label: 'Crise de ansiedade severa', color: 'amarelo' },
      {
        id: 'acompanhamento-mental',
        label: 'Acompanhamento / renovação de medicação',
        color: 'verde'
      }
    ]
  },
  {
    key: 'mordedura-picada',
    label: 'Mordedura / picada',
    category: 'trauma',
    description: 'Acidente com animal (cão, gato, cobra, escorpião, abelha).',
    discriminators: [
      ...RED_FLAGS,
      {
        id: 'reacao-anafilatica',
        label: 'Reação anafilática',
        color: 'vermelho',
        hint: 'Edema laringe, hipotensão'
      },
      { id: 'cobra-peconhenta', label: 'Picada de cobra peçonhenta', color: 'laranja' },
      { id: 'escorpiao-criancas', label: 'Escorpião em criança / idoso', color: 'laranja' },
      { id: 'mordedura-cao-face', label: 'Mordedura em face / pescoço', color: 'amarelo' },
      { id: 'sinal-infeccao-mordedura', label: 'Sinais de infecção local', color: 'amarelo' },
      { id: 'mordedura-pequena', label: 'Mordedura/picada sem complicação', color: 'verde' }
    ]
  },
  {
    key: 'rotina',
    label: 'Demanda não urgente / agendamento',
    category: 'clinico',
    description: 'Renovação de receita, vacinação, atestado, exame de rotina.',
    discriminators: [
      ...RED_FLAGS,
      { id: 'sintomas-novos', label: 'Refere sintomas novos significativos', color: 'amarelo' },
      { id: 'controle-cronico', label: 'Controle de doença crônica estável', color: 'verde' },
      { id: 'renovacao-receita', label: 'Renovação de receita', color: 'azul' },
      { id: 'vacinacao', label: 'Vacinação', color: 'azul' },
      { id: 'atestado-rotina', label: 'Atestado / declaração', color: 'azul' },
      { id: 'orientacao', label: 'Orientação / dúvida', color: 'azul' }
    ]
  }
]

export function getFlowchart(key: string): Flowchart | undefined {
  return FLOWCHARTS.find((f) => f.key === key)
}

/**
 * Determina a cor de Manchester com base no conjunto de discriminadores
 * marcados. Retorna a cor mais grave entre os discriminadores presentes.
 * Se nenhum discriminador estiver marcado, retorna 'azul' (não urgente).
 */
export function suggestColor(flowchartKey: string, discriminatorIds: string[]): ManchesterColor {
  if (discriminatorIds.length === 0) return 'azul'
  const flowchart = getFlowchart(flowchartKey)
  if (!flowchart) return 'azul'
  const colors = discriminatorIds
    .map((id) => flowchart.discriminators.find((d) => d.id === id)?.color)
    .filter((c): c is ManchesterColor => Boolean(c))
  if (colors.length === 0) return 'azul'
  for (const c of MANCHESTER_ORDER) {
    if (colors.includes(c)) return c
  }
  return 'azul'
}

/**
 * Heurística que sugere uma cor com base apenas nos sinais vitais (sem
 * fluxograma). Usada como segundo input ao profissional. A combinação
 * final é o pior entre fluxograma e sinais vitais.
 */
export interface VitalSigns {
  systolicBp?: number | null
  diastolicBp?: number | null
  heartRate?: number | null
  respRate?: number | null
  spo2?: number | null
  temperatureC?: number | null
  glucoseMgDl?: number | null
  painScale?: number | null
}

export function colorFromVitals(v: VitalSigns): ManchesterColor {
  // Vermelho: parâmetros incompatíveis com a vida
  if (v.respRate != null && (v.respRate < 8 || v.respRate > 35)) return 'vermelho'
  if (v.spo2 != null && v.spo2 < 88) return 'vermelho'
  if (v.systolicBp != null && v.systolicBp < 80) return 'vermelho'

  // Laranja: instabilidade
  if (v.spo2 != null && v.spo2 < 92) return 'laranja'
  if (v.heartRate != null && (v.heartRate < 40 || v.heartRate > 130)) return 'laranja'
  if (v.systolicBp != null && (v.systolicBp < 90 || v.systolicBp >= 200)) return 'laranja'
  if (v.temperatureC != null && v.temperatureC >= 40) return 'laranja'
  if (v.glucoseMgDl != null && (v.glucoseMgDl < 60 || v.glucoseMgDl > 400)) return 'laranja'
  if (v.painScale != null && v.painScale >= 7) return 'laranja'

  // Amarelo: alterado mas estável
  if (v.spo2 != null && v.spo2 < 95) return 'amarelo'
  if (v.heartRate != null && (v.heartRate < 50 || v.heartRate > 110)) return 'amarelo'
  if (v.systolicBp != null && v.systolicBp >= 180) return 'amarelo'
  if (v.temperatureC != null && v.temperatureC >= 38) return 'amarelo'
  if (v.painScale != null && v.painScale >= 4) return 'amarelo'

  // Verde: leves alterações
  if (v.painScale != null && v.painScale >= 1) return 'verde'

  return 'azul'
}

/**
 * Combina a cor do fluxograma com a cor dos sinais vitais retornando a
 * cor mais grave entre as duas. Esta é a sugestão final do sistema.
 */
export function combineColors(a: ManchesterColor, b: ManchesterColor): ManchesterColor {
  for (const c of MANCHESTER_ORDER) {
    if (a === c || b === c) return c
  }
  return 'azul'
}
