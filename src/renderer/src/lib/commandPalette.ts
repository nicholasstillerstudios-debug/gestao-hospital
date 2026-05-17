/**
 * Comandos do Command Palette (Ctrl+K). Pacientes são adicionados via busca
 * dinâmica; aqui ficam só os destinos fixos do sistema.
 */
export interface PaletteCommand {
  id: string
  label: string
  group: string
  keywords?: string[]
  to: string
  openPanel?: boolean
}

export const PALETTE_COMMANDS: PaletteCommand[] = [
  // Geral
  { id: 'home', label: 'Dashboard', group: 'Geral', to: '/' },
  { id: 'patients', label: 'Pacientes', group: 'Geral', to: '/pacientes' },
  { id: 'patient-new', label: 'Novo paciente', group: 'Geral', to: '/pacientes/novo' },

  // Atendimento
  { id: 'consultas', label: 'Consultas / Agenda', group: 'Atendimento', to: '/consultas' },
  { id: 'queue', label: 'Fila', group: 'Atendimento', to: '/fila' },
  { id: 'triage', label: 'Triagem ambulatorial', group: 'Atendimento', to: '/triagem' },
  { id: 'reception', label: 'Recepção', group: 'Atendimento', to: '/recepcao' },
  { id: 'panel', label: 'Painel de Chamadas', group: 'Atendimento', to: '/painel', openPanel: true },

  // Emergência e cirurgia
  { id: 'ps', label: 'Pronto-Socorro', group: 'Emergência', to: '/ps' },
  { id: 'cirurgia', label: 'Centro Cirúrgico', group: 'Emergência', to: '/cirurgico' },

  // Clínico
  { id: 'exames', label: 'Exames / Laudos', group: 'Clínico', to: '/exames' },
  { id: 'medicacao', label: 'Sala de medicação', group: 'Clínico', to: '/medicacao' },
  { id: 'atestados', label: 'Atestados / Declarações', group: 'Clínico', to: '/atestados' },
  { id: 'internacoes', label: 'Internações', group: 'Clínico', to: '/internacoes' },
  { id: 'leitos', label: 'Leitos', group: 'Clínico', to: '/leitos' },

  // Suprimentos / Segurança
  { id: 'farmacia', label: 'Farmácia', group: 'Suprimentos', to: '/farmacia' },
  { id: 'ccih', label: 'CCIH', group: 'Segurança', to: '/ccih' },

  // SUS
  { id: 'bpa', label: 'BPA / Produção', group: 'SUS', to: '/bpa' },
  { id: 'sinan', label: 'SINAN', group: 'SUS', to: '/sinan' },

  // Tarefas
  { id: 'tasks', label: 'Tarefas / Avisos internos', group: 'Operação', to: '/tarefas', keywords: ['aviso'] },

  // Administração
  { id: 'relatorios', label: 'Relatórios', group: 'Admin', to: '/relatorios' },
  { id: 'admin', label: 'Administração', group: 'Admin', to: '/admin' },
  { id: 'catalogos', label: 'Catálogos CID/SIGTAP', group: 'Admin', to: '/admin/catalogos' },
  { id: 'rede', label: 'Rede / LAN', group: 'Admin', to: '/admin/rede' },
  { id: 'backup', label: 'Backup', group: 'Admin', to: '/admin/backup' }
]

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function filterCommands(query: string, cmds: PaletteCommand[]): PaletteCommand[] {
  const q = normalize(query.trim())
  if (!q) return cmds
  return cmds.filter((c) => {
    if (normalize(c.label).includes(q)) return true
    if (normalize(c.group).includes(q)) return true
    if (c.keywords && c.keywords.some((k) => normalize(k).includes(q))) return true
    return false
  })
}
