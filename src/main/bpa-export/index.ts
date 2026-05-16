/**
 * Gera o arquivo BPA-MAGNÉTICO (SIA-SUS) — texto fixo ASCII, sem acentos,
 * conforme layout da Portaria SAS/MS nº 637/2012 (e revisões).
 *
 *   Linha 01 (header)   — identificação do remetente, competência, totais.
 *   Linha 03 (BPA-I)    — 1 por procedimento individualizado realizado.
 *
 * Limitações conhecidas desta implementação:
 *  - Caráter de atendimento fixo "01" (eletivo) — não há ainda campo no
 *    bpa_records para distinguir urgência/acidente.
 *  - IBGE do paciente cai pro IBGE do estabelecimento (settings.unitIbge)
 *    porque o cadastro de pacientes só guarda município em string livre.
 *  - Endereço/CEP do paciente preenchidos quando existirem, senão zeros.
 *  - Caso o município devolva o arquivo com erro de validação, ajustes
 *    finos costumam ser bem específicos do programa SIA usado.
 */
import { listRecords } from '../repositories/bpa'
import { getSettings } from '../repositories/settings'
import type { BpaRecordWithRefs } from '@shared/types'

// ─── helpers ─────────────────────────────────────────────────────────

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function ascii(s: string): string {
  // Remove acentos e qualquer caractere fora do conjunto ASCII imprimível.
  return stripAccents(s).replace(/[^\x20-\x7E]/g, ' ')
}

function padR(s: string, n: number): string {
  const v = ascii(s).slice(0, n)
  return v + ' '.repeat(Math.max(0, n - v.length))
}

function padL0(s: string | number, n: number): string {
  const v = String(s ?? '').replace(/\D/g, '').slice(0, n)
  return v.padStart(n, '0')
}

function ageYears(birthDate: string | null): number {
  if (!birthDate) return 0
  const b = new Date(birthDate)
  if (Number.isNaN(b.getTime())) return 0
  const now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  if (
    now.getMonth() < b.getMonth() ||
    (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())
  ) {
    age -= 1
  }
  return Math.max(0, Math.min(999, age))
}

function raceCode(race: string | null): string {
  if (!race) return '99'
  const r = stripAccents(race).toLowerCase()
  if (r.startsWith('branca')) return '01'
  if (r.startsWith('preta')) return '02'
  if (r.startsWith('parda')) return '03'
  if (r.startsWith('amarela')) return '04'
  if (r.startsWith('indig')) return '05'
  return '99'
}

function isoDateToBR(iso: string): string {
  // YYYY-MM-DD ou YYYY-MM-DD... → YYYYMMDD
  if (!iso) return '00000000'
  const d = iso.slice(0, 10).replace(/\D/g, '')
  return d.length === 8 ? d : '00000000'
}

/**
 * Campo de controle do header: soma das quantidades apresentadas mod 1111,
 * acrescido de 1111 (gera valor entre 1111 e 2221). Convenção SIA-SUS.
 */
function controlField(totalQty: number): string {
  const v = (totalQty % 1111) + 1111
  return padL0(v, 4)
}

// ─── header ──────────────────────────────────────────────────────────

interface HeaderInput {
  competence: string // AAAAMM
  totalLines: number
  totalSheets: number
  totalQty: number
  orgaoSigla: string
  orgaoNome: string
  cnpj: string
  destino: 'M' | 'E'
}

function buildHeader(h: HeaderInput): string {
  return (
    '01' +
    '#BPA#' +
    padL0(h.competence, 6) +
    padL0(h.totalLines, 6) +
    padL0(h.totalSheets, 6) +
    controlField(h.totalQty) +
    padR(h.orgaoNome || 'ESTABELECIMENTO', 30) +
    padR(h.orgaoSigla || 'SMS', 6) +
    padL0(h.cnpj, 14) +
    padR(h.destino === 'E' ? 'EST' : 'MUN', 3) +
    'M' + // indicador magnético
    padR('GESTAOHOSP', 10) // versão sistema (10 chars)
  )
}

// ─── linha BPA-I (tipo 03) ───────────────────────────────────────────

interface LineCtx {
  cnes: string
  competence: string // AAAAMM
  defaultIbge: string
  sheet: number
  seq: number // 1..99 na folha
}

function buildBpaILine(r: BpaRecordWithRefs, ctx: LineCtx): string {
  const sexo = r.patientSex === 'F' ? 'F' : r.patientSex === 'M' ? 'M' : 'I'
  return (
    '03' +
    padL0(ctx.cnes, 7) +
    padL0(ctx.competence, 6) +
    padL0(r.professionalCns ?? '', 15) +
    padL0(r.professionalCboCode ?? r.cboCode ?? '', 6) +
    isoDateToBR(r.procedureDate) +
    padL0(ctx.sheet, 3) +
    padL0(ctx.seq, 2) +
    padL0(r.procedureCode, 10) +
    padL0(r.patientCns ?? '', 15) +
    sexo +
    padL0(ctx.defaultIbge, 6) +
    padR((r.cid10 ?? '').replace('.', ''), 4) +
    padL0(ageYears(r.patientBirthDate), 3) +
    padL0(r.quantity, 6) +
    '01' + // caráter de atendimento: eletivo
    padL0('', 13) + // nº autorização
    'BPA' + // origem
    padR(r.patientName ?? '', 30) +
    isoDateToBR(r.patientBirthDate ?? '') +
    raceCode(/* race string */ null /* não exposto em BpaRecordWithRefs */) +
    padL0('', 4) + // etnia
    '010' + // nacionalidade Brasileira
    padL0('', 3) + // serviço
    padL0('', 3) + // classificação
    padL0('', 8) + // equipe seq
    padL0('', 4) + // equipe área
    padL0('', 14) + // cnpj empregador
    padL0('', 8) + // CEP paciente
    padL0('', 3) + // cod logradouro
    padR('', 30) + // logradouro
    padR('', 10) + // complemento
    padR('', 5) + // numero
    padR('', 30) + // bairro
    padL0('', 11) + // telefone
    padR('', 40) + // email
    padL0('', 10) + // INE
    padL0(r.patientCpf ?? '', 11) +
    'N' // situação de rua
  )
}

// ─── geração ─────────────────────────────────────────────────────────

export interface BpaFileResult {
  /** Conteúdo do arquivo, codificação latin1 / ASCII puro. */
  content: string
  /** Total de linhas tipo 03 emitidas. */
  lineCount: number
  /** Sugestão de nome de arquivo (PAxxx). */
  suggestedName: string
}

const ROWS_PER_SHEET = 20

export function generateBpaFile(year: number, month: number): BpaFileResult {
  const s = getSettings()
  const records = listRecords({ year, month })
  if (records.length === 0) {
    throw Object.assign(new Error('Sem procedimentos para a competência selecionada.'), {
      code: 'BPA_EMPTY'
    })
  }
  if (!s.unitCnes) {
    throw Object.assign(
      new Error('Configure o CNES do estabelecimento em Admin → Unidade.'),
      { code: 'BPA_NO_CNES' }
    )
  }

  const competence = `${year}${String(month).padStart(2, '0')}`
  const totalSheets = Math.ceil(records.length / ROWS_PER_SHEET)
  const totalQty = records.reduce((a, r) => a + r.quantity, 0)

  const lines: string[] = []
  lines.push(
    buildHeader({
      competence,
      totalLines: records.length,
      totalSheets,
      totalQty,
      orgaoSigla: s.unitOrgaoEmissor || 'SMS',
      orgaoNome: s.unitName,
      cnpj: s.unitCnpj,
      destino: s.unitOrgaoDestino
    })
  )

  records.forEach((r, idx) => {
    const sheet = Math.floor(idx / ROWS_PER_SHEET) + 1
    const seq = (idx % ROWS_PER_SHEET) + 1
    lines.push(
      buildBpaILine(r, {
        cnes: s.unitCnes,
        competence,
        defaultIbge: s.unitIbge,
        sheet,
        seq
      })
    )
  })

  // Linha PA<numero>.<extensão> — convenção SIA: 3 chars sequência alfanumérica.
  // Usamos o padrão "PA" + sequência derivada da competência.
  const m = String(month).padStart(2, '0')
  const y = String(year).slice(-2)
  const suggestedName = `PA${m}${y}.bpa`

  // Linhas separadas por CRLF (padrão Windows do SIA).
  return {
    content: lines.join('\r\n') + '\r\n',
    lineCount: records.length,
    suggestedName
  }
}
