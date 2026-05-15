import { app } from 'electron'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as crypto from 'node:crypto'
import { logAudit } from '../audit'
import { getSettings, updateSettings } from './settings'
import type { AppSettings, BrandingLogoSlot, BrandingLogos } from '@shared/types'

type LogoKey =
  | 'brandingLogoPrefeituraFile'
  | 'brandingLogoSecretariaFile'
  | 'brandingLogoHospitalFile'

const ALLOWED_EXT = new Set(['.png', '.jpg', '.jpeg', '.svg'])
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/svg+xml'])
const MAX_BYTES = 2 * 1024 * 1024 // 2 MB

const SLOT_TO_KEY: Record<BrandingLogoSlot, LogoKey> = {
  prefeitura: 'brandingLogoPrefeituraFile',
  secretaria: 'brandingLogoSecretariaFile',
  hospital: 'brandingLogoHospitalFile'
}

function brandingDir(): string {
  const dir = path.join(app.getPath('userData'), 'branding')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  }
  return dir
}

/**
 * Apaga um arquivo dentro de `dir` com defesa contra path traversal.
 * Como as chaves brandingLogo*File são graváveis via settings.update (aceita
 * strings arbitrárias), validamos que o caminho resolvido continua dentro de
 * `dir` antes de chamar unlink. Se estiver fora, não faz nada.
 */
function safeDeleteInDir(dir: string, filename: string): void {
  if (!filename) return
  const filePath = path.resolve(dir, filename)
  if (!filePath.startsWith(dir + path.sep)) return
  if (!fs.existsSync(filePath)) return
  try {
    fs.unlinkSync(filePath)
  } catch {
    // ignora — arquivo órfão não bloqueia o fluxo
  }
}

function isValidSlot(slot: string): slot is BrandingLogoSlot {
  return slot === 'prefeitura' || slot === 'secretaria' || slot === 'hospital'
}

function detectExtension(filename: string, mimeType: string): string {
  const ext = path.extname(filename).toLowerCase()
  if (ALLOWED_EXT.has(ext)) return ext
  if (mimeType === 'image/png') return '.png'
  if (mimeType === 'image/jpeg') return '.jpg'
  if (mimeType === 'image/svg+xml') return '.svg'
  return ''
}

export interface UploadLogoInput {
  slot: BrandingLogoSlot
  filename: string
  mimeType: string
  /** Conteúdo binário do arquivo. Pode vir como ArrayBuffer (do renderer). */
  bytes: ArrayBuffer | Uint8Array
}

export function uploadLogo(input: UploadLogoInput): BrandingLogos {
  if (!isValidSlot(input.slot)) {
    throw new Error('Slot de logo inválido.')
  }
  if (!ALLOWED_MIME.has(input.mimeType)) {
    throw new Error('Formato não suportado. Use PNG, JPG ou SVG.')
  }
  const buf = Buffer.from(
    input.bytes instanceof Uint8Array ? input.bytes : new Uint8Array(input.bytes)
  )
  if (buf.length === 0) {
    throw new Error('Arquivo vazio.')
  }
  if (buf.length > MAX_BYTES) {
    throw new Error('Arquivo muito grande (limite 2 MB).')
  }
  const ext = detectExtension(input.filename, input.mimeType)
  if (!ext) {
    throw new Error('Extensão de arquivo não suportada. Use .png, .jpg ou .svg.')
  }

  const dir = brandingDir()
  const key = SLOT_TO_KEY[input.slot]
  const previous = getSettings()[key]

  const random = crypto.randomBytes(8).toString('hex')
  const newFile = `${input.slot}-${random}${ext}`
  fs.writeFileSync(path.join(dir, newFile), buf, { mode: 0o600 })

  const patch: Partial<AppSettings> = { [key]: newFile }
  updateSettings(patch)

  if (previous && previous !== newFile) {
    safeDeleteInDir(dir, previous)
  }

  logAudit({
    action: 'upload-logo',
    entity: 'branding',
    details: { slot: input.slot, sizeBytes: buf.length }
  })
  return getLogos()
}

export function removeLogo(slot: BrandingLogoSlot): BrandingLogos {
  if (!isValidSlot(slot)) {
    throw new Error('Slot de logo inválido.')
  }
  const key = SLOT_TO_KEY[slot]
  const current = getSettings()[key]
  if (current) {
    safeDeleteInDir(brandingDir(), current)
  }
  const patch: Partial<AppSettings> = { [key]: '' }
  updateSettings(patch)
  logAudit({ action: 'remove-logo', entity: 'branding', details: { slot } })
  return getLogos()
}

/**
 * Retorna o conteúdo do logo como data URL (base64) para o renderer
 * exibir em <img>. Retorna null se não houver logo configurado.
 */
function readAsDataUrl(file: string): string | null {
  if (!file) return null
  // Bloqueia path traversal (ver safeDeleteInDir).
  const dir = brandingDir()
  const filePath = path.resolve(dir, file)
  if (!filePath.startsWith(dir + path.sep)) return null
  if (!fs.existsSync(filePath)) return null
  try {
    const buf = fs.readFileSync(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const mime = ext === '.png' ? 'image/png' : ext === '.svg' ? 'image/svg+xml' : 'image/jpeg'
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

export function getLogos(): BrandingLogos {
  const s = getSettings()
  return {
    prefeitura: readAsDataUrl(s.brandingLogoPrefeituraFile),
    secretaria: readAsDataUrl(s.brandingLogoSecretariaFile),
    hospital: readAsDataUrl(s.brandingLogoHospitalFile)
  }
}
