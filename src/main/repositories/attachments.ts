import { app, shell } from 'electron'
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { getDb } from '../db'
import { logAudit } from '../audit'
import { getCurrentUser } from '../session'
import type { PatientAttachment, PatientAttachmentUploadInput } from '@shared/types'

interface Row {
  id: number
  patient_id: number
  file_name: string
  storage_name: string
  mime_type: string | null
  size_bytes: number
  category: string | null
  description: string | null
  uploaded_by_name: string | null
  uploaded_at: string
}

const ALLOWED_EXT = new Set([
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
  '.tiff',
  '.tif',
  '.doc',
  '.docx',
  '.txt',
  '.rtf'
])

const MAX_SIZE = 25 * 1024 * 1024 // 25 MB

function baseDir(): string {
  const dir = join(app.getPath('userData'), 'attachments')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function patientDir(patientId: number): string {
  const dir = join(baseDir(), String(patientId))
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 120)
}

function toAtt(r: Row): PatientAttachment {
  return {
    id: r.id,
    patientId: r.patient_id,
    fileName: r.file_name,
    mimeType: r.mime_type,
    sizeBytes: r.size_bytes,
    category: r.category,
    description: r.description,
    uploadedByName: r.uploaded_by_name,
    uploadedAt: r.uploaded_at
  }
}

export function listForPatient(patientId: number): PatientAttachment[] {
  const rows = getDb()
    .prepare(
      'SELECT * FROM patient_attachments WHERE patient_id=? ORDER BY uploaded_at DESC'
    )
    .all(patientId) as Row[]
  return rows.map(toAtt)
}

export function upload(input: PatientAttachmentUploadInput): PatientAttachment {
  const user = getCurrentUser()
  const ext = extname(input.fileName).toLowerCase()
  if (!ALLOWED_EXT.has(ext)) {
    throw Object.assign(new Error('Tipo de arquivo não permitido.'), { code: 'INVALID_TYPE' })
  }
  const size = input.bytes.byteLength
  if (size > MAX_SIZE) {
    throw Object.assign(new Error('Arquivo maior que 25 MB.'), { code: 'TOO_LARGE' })
  }
  const dir = patientDir(input.patientId)
  const storageName = `${randomBytes(8).toString('hex')}${ext}`
  writeFileSync(join(dir, storageName), Buffer.from(input.bytes as ArrayBuffer))
  const r = getDb()
    .prepare(
      `INSERT INTO patient_attachments
        (patient_id, file_name, storage_name, mime_type, size_bytes, category, description,
         uploaded_by_user_id, uploaded_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.patientId,
      safeName(input.fileName),
      storageName,
      input.mimeType,
      size,
      input.category,
      input.description,
      user?.id ?? null,
      user?.fullName ?? null
    )
  logAudit({ action: 'upload', entity: 'patient_attachment', entityId: Number(r.lastInsertRowid) })
  const row = getDb()
    .prepare('SELECT * FROM patient_attachments WHERE id=?')
    .get(r.lastInsertRowid) as Row
  return toAtt(row)
}

export async function open(id: number): Promise<{ ok: boolean; path: string }> {
  const row = getDb().prepare('SELECT * FROM patient_attachments WHERE id=?').get(id) as
    | Row
    | undefined
  if (!row) throw new Error('Anexo não encontrado.')
  const filePath = join(patientDir(row.patient_id), row.storage_name)
  if (!existsSync(filePath)) throw new Error('Arquivo não encontrado no disco.')
  const err = await shell.openPath(filePath)
  if (err) throw new Error(err)
  return { ok: true, path: filePath }
}

export function remove(id: number): void {
  const row = getDb().prepare('SELECT * FROM patient_attachments WHERE id=?').get(id) as
    | Row
    | undefined
  if (!row) return
  const filePath = join(patientDir(row.patient_id), row.storage_name)
  try {
    if (existsSync(filePath)) unlinkSync(filePath)
  } catch {
    /* ignore */
  }
  getDb().prepare('DELETE FROM patient_attachments WHERE id=?').run(id)
  logAudit({ action: 'delete', entity: 'patient_attachment', entityId: id })
}
