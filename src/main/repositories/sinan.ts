/**
 * SINAN — Sistema de Informação de Agravos de Notificação.
 * Cada linha é uma notificação compulsória de doença / agravo.
 *
 * Export CSV: gera planilha pronta para o operador municipal importar
 * manualmente no SINAN-NET (o formato DBF oficial requer ferramenta
 * externa; CSV é aceito como entrada de digitação).
 */
import { getDb } from '../db'
import { logAudit } from '../audit'
import { getCurrentUser } from '../session'
import type {
  SinanNotification,
  SinanNotificationInput,
  SinanNotificationWithRefs,
  Sex
} from '@shared/types'

interface Row {
  id: number
  patient_id: number
  professional_id: number | null
  agravo_cid: string
  agravo_name: string
  sintomas_iniciais_em: string | null
  notificado_em: string
  classificacao: string | null
  evolucao: string | null
  observations: string | null
  exported_at: string | null
  created_by_user_id: number | null
  created_at: string
  updated_at: string
}

interface RowWithRefs extends Row {
  patient_name: string
  patient_cpf: string | null
  patient_cns: string | null
  patient_birth_date: string | null
  patient_sex: string | null
  professional_name: string | null
  professional_cns: string | null
}

function toModel(r: Row): SinanNotification {
  return {
    id: r.id,
    patientId: r.patient_id,
    professionalId: r.professional_id,
    agravoCid: r.agravo_cid,
    agravoName: r.agravo_name,
    sintomasIniciaisEm: r.sintomas_iniciais_em,
    notificadoEm: r.notificado_em,
    classificacao: r.classificacao,
    evolucao: r.evolucao,
    observations: r.observations,
    exportedAt: r.exported_at,
    createdByUserId: r.created_by_user_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}

function toRefs(r: RowWithRefs): SinanNotificationWithRefs {
  return {
    ...toModel(r),
    patientName: r.patient_name,
    patientCpf: r.patient_cpf,
    patientCns: r.patient_cns,
    patientBirthDate: r.patient_birth_date,
    patientSex: r.patient_sex === 'M' || r.patient_sex === 'F' || r.patient_sex === 'O'
      ? (r.patient_sex as Sex)
      : null,
    professionalName: r.professional_name,
    professionalCns: r.professional_cns
  }
}

const SELECT = `
  SELECT s.*,
         p.full_name  AS patient_name,
         p.cpf        AS patient_cpf,
         p.cns        AS patient_cns,
         p.birth_date AS patient_birth_date,
         p.sex        AS patient_sex,
         pr.full_name AS professional_name,
         pr.cns       AS professional_cns
    FROM sinan_notifications s
    JOIN patients p ON p.id = s.patient_id
    LEFT JOIN professionals pr ON pr.id = s.professional_id
`

export function listNotifications(filter?: {
  fromDate?: string
  toDate?: string
  agravoCid?: string
}): SinanNotificationWithRefs[] {
  const where: string[] = []
  const params: (string | number)[] = []
  if (filter?.fromDate) {
    where.push('s.notificado_em >= ?')
    params.push(filter.fromDate)
  }
  if (filter?.toDate) {
    where.push('s.notificado_em <= ?')
    params.push(filter.toDate)
  }
  if (filter?.agravoCid) {
    where.push('s.agravo_cid = ?')
    params.push(filter.agravoCid)
  }
  const sql = `${SELECT}
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY s.notificado_em DESC, s.id DESC
    LIMIT 1000`
  return (getDb().prepare(sql).all(...params) as RowWithRefs[]).map(toRefs)
}

export function getNotification(id: number): SinanNotificationWithRefs | null {
  const r = getDb().prepare(`${SELECT} WHERE s.id = ?`).get(id) as RowWithRefs | undefined
  return r ? toRefs(r) : null
}

export function createNotification(input: SinanNotificationInput): SinanNotificationWithRefs {
  if (!input.agravoCid?.trim() || !input.agravoName?.trim()) {
    throw Object.assign(new Error('CID e nome do agravo são obrigatórios.'), {
      code: 'SINAN_AGRAVO_REQUIRED'
    })
  }
  const user = getCurrentUser()
  const db = getDb()
  const r = db
    .prepare(
      `INSERT INTO sinan_notifications
         (patient_id, professional_id, agravo_cid, agravo_name, sintomas_iniciais_em,
          classificacao, evolucao, observations, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.patientId,
      input.professionalId ?? null,
      input.agravoCid.trim(),
      input.agravoName.trim(),
      input.sintomasIniciaisEm ?? null,
      input.classificacao?.trim() || null,
      input.evolucao?.trim() || null,
      input.observations?.trim() || null,
      user?.id ?? null
    )
  const id = Number(r.lastInsertRowid)
  logAudit({
    action: 'create',
    entity: 'sinan_notification',
    entityId: id,
    details: { agravo: input.agravoCid }
  })
  return getNotification(id)!
}

export function deleteNotification(id: number): void {
  getDb().prepare('DELETE FROM sinan_notifications WHERE id = ?').run(id)
  logAudit({ action: 'delete', entity: 'sinan_notification', entityId: id })
}

/** Marca notificações como exportadas (limpa o flag se reabrir). */
export function markExported(ids: number[]): void {
  if (ids.length === 0) return
  const db = getDb()
  const stmt = db.prepare(
    `UPDATE sinan_notifications SET exported_at = datetime('now') WHERE id = ?`
  )
  const tx = db.transaction(() => {
    for (const id of ids) stmt.run(id)
  })
  tx()
  logAudit({ action: 'export', entity: 'sinan_notification', details: { count: ids.length } })
}

/** Monta CSV pronto para importação manual no SINAN-NET. */
export function buildCsv(items: SinanNotificationWithRefs[]): string {
  const headers = [
    'data_notificacao',
    'agravo_cid',
    'agravo_nome',
    'paciente_nome',
    'paciente_cpf',
    'paciente_cns',
    'paciente_nascimento',
    'paciente_sexo',
    'data_primeiros_sintomas',
    'classificacao',
    'evolucao',
    'profissional_nome',
    'profissional_cns'
  ]
  const esc = (v: string | null | undefined): string => {
    const s = (v ?? '').toString()
    return `"${s.replace(/"/g, '""')}"`
  }
  const lines = [headers.join(';')]
  for (const n of items) {
    lines.push(
      [
        esc(n.notificadoEm),
        esc(n.agravoCid),
        esc(n.agravoName),
        esc(n.patientName),
        esc(n.patientCpf),
        esc(n.patientCns),
        esc(n.patientBirthDate),
        esc(n.patientSex),
        esc(n.sintomasIniciaisEm),
        esc(n.classificacao),
        esc(n.evolucao),
        esc(n.professionalName),
        esc(n.professionalCns)
      ].join(';')
    )
  }
  // BOM UTF-8 para Excel reconhecer acentos.
  return '﻿' + lines.join('\r\n') + '\r\n'
}
