/**
 * Backup do banco no Google Drive via OAuth2 (Installed Application).
 *
 * O admin configura Client ID/Secret obtidos no Google Cloud Console
 * (projeto próprio do hospital). O fluxo:
 *   1) connectDrive() → gera URL OAuth, abre no browser, ouve callback
 *      em http://127.0.0.1:<porta efêmera>/oauth, troca code por
 *      refresh_token e salva nas settings.
 *   2) uploadBackup() → faz BACKUP da conexão SQLite atual (backup hot,
 *      consistente), comprime com gzip, sobe para a pasta configurada
 *      no Drive. Nome: gestao-hospital-YYYY-MM-DD-HHmm.db.gz
 *   3) ensureFolder() → cria pasta "Gestão Hospitalar — Backups" no
 *      Drive do usuário se ainda não existir.
 *
 * Esta implementação só é montada quando o app está em modo standalone
 * ou server (cliente não tem DB local pra fazer backup).
 */
import { shell, app } from 'electron'
import { createServer, type Server } from 'node:http'
import { createReadStream, createWriteStream, statSync, unlinkSync } from 'node:fs'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createGzip } from 'node:zlib'
import { pipeline } from 'node:stream/promises'
import { google, type drive_v3 } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import { getDb } from '../db'
import { getSettings, updateSettings } from '../repositories/settings'
import { logAudit } from '../audit'

const SCOPES = ['https://www.googleapis.com/auth/drive.file']
const FOLDER_NAME = 'Gestão Hospitalar — Backups'

function backupTempDir(): string {
  const dir = join(app.getPath('userData'), 'drive-tmp')
  mkdirSync(dir, { recursive: true })
  return dir
}

function buildOAuth(redirectUri: string): OAuth2Client {
  const s = getSettings()
  if (!s.driveClientId || !s.driveClientSecret) {
    throw Object.assign(new Error('Configure Client ID e Client Secret do Drive primeiro.'), {
      code: 'DRIVE_NOT_CONFIGURED'
    })
  }
  return new google.auth.OAuth2(s.driveClientId, s.driveClientSecret, redirectUri)
}

/** OAuth client pronto para uso autenticado (com refresh token). */
function authenticatedClient(): OAuth2Client {
  const s = getSettings()
  if (!s.driveRefreshToken) {
    throw Object.assign(new Error('Drive não conectado.'), { code: 'DRIVE_NOT_CONNECTED' })
  }
  const oauth = new google.auth.OAuth2(s.driveClientId, s.driveClientSecret)
  oauth.setCredentials({ refresh_token: s.driveRefreshToken })
  return oauth
}

export interface DriveStatus {
  configured: boolean
  connected: boolean
  folderId: string | null
  lastBackupAt: string | null
  autoEnabled: boolean
}

export function driveStatus(): DriveStatus {
  const s = getSettings()
  return {
    configured: !!(s.driveClientId && s.driveClientSecret),
    connected: !!s.driveRefreshToken,
    folderId: s.driveFolderId || null,
    lastBackupAt: s.driveLastBackupAt || null,
    autoEnabled: s.driveAutoEnabled
  }
}

/**
 * Inicia OAuth: sobe servidor local efêmero, abre browser na URL de
 * autorização, aguarda callback, troca code por tokens. Resolve quando
 * o refresh_token é salvo. Rejeita em timeout (2 min).
 */
export function connectDrive(): Promise<{ connected: true }> {
  return new Promise((resolve, reject) => {
    let server: Server | null = null
    let oauth: OAuth2Client
    const timeout = setTimeout(() => {
      try {
        server?.close()
      } catch {
        /* ignore */
      }
      reject(Object.assign(new Error('Tempo esgotado aguardando autorização.'), {
        code: 'DRIVE_TIMEOUT'
      }))
    }, 120000)

    server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url ?? '/', `http://127.0.0.1`)
        if (url.pathname !== '/oauth') {
          res.writeHead(404).end('Not found')
          return
        }
        const code = url.searchParams.get('code')
        const err = url.searchParams.get('error')
        if (err) {
          res.writeHead(400, { 'content-type': 'text/html; charset=utf-8' })
          res.end(`<h2>Falha: ${err}</h2><p>Volte ao app e tente de novo.</p>`)
          clearTimeout(timeout)
          server?.close()
          reject(Object.assign(new Error(err), { code: 'DRIVE_OAUTH_ERROR' }))
          return
        }
        if (!code) {
          res.writeHead(400).end('Missing code')
          return
        }
        const { tokens } = await oauth.getToken(code)
        if (!tokens.refresh_token) {
          res.writeHead(400, { 'content-type': 'text/html; charset=utf-8' })
          res.end(
            '<h2>Token de atualização ausente.</h2><p>Revogue o acesso em myaccount.google.com → Segurança → Apps conectados e tente novamente.</p>'
          )
          clearTimeout(timeout)
          server?.close()
          reject(Object.assign(new Error('refresh_token ausente'), { code: 'DRIVE_NO_REFRESH' }))
          return
        }
        updateSettings({ driveRefreshToken: tokens.refresh_token })
        logAudit({ action: 'connect', entity: 'drive' })
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        res.end(
          '<h2>Drive conectado.</h2><p>Pode fechar esta aba e voltar ao Gestão Hospitalar.</p>'
        )
        clearTimeout(timeout)
        server?.close()
        resolve({ connected: true })
      } catch (e) {
        res.writeHead(500).end((e as Error).message)
        clearTimeout(timeout)
        try {
          server?.close()
        } catch {
          /* ignore */
        }
        reject(e)
      }
    })

    server.listen(0, '127.0.0.1', () => {
      const addr = server!.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      const redirect = `http://127.0.0.1:${port}/oauth`
      try {
        oauth = buildOAuth(redirect)
      } catch (e) {
        clearTimeout(timeout)
        server?.close()
        return reject(e)
      }
      const authUrl = oauth.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: SCOPES
      })
      shell.openExternal(authUrl).catch(() => {
        // se não abrir, ainda dá pra copiar a URL — logamos
        console.log('[drive] cole no navegador:', authUrl)
      })
    })
    server.on('error', (e) => {
      clearTimeout(timeout)
      reject(e)
    })
  })
}

export function disconnectDrive(): { ok: true } {
  updateSettings({ driveRefreshToken: '', driveFolderId: '' })
  logAudit({ action: 'disconnect', entity: 'drive' })
  return { ok: true }
}

async function ensureFolder(drive: drive_v3.Drive): Promise<string> {
  const s = getSettings()
  if (s.driveFolderId) {
    try {
      const r = await drive.files.get({ fileId: s.driveFolderId, fields: 'id, trashed' })
      if (r.data.id && !r.data.trashed) return r.data.id
    } catch {
      /* re-cria */
    }
  }
  // Procura pasta existente
  const list = await drive.files.list({
    q: `name = '${FOLDER_NAME.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id)',
    pageSize: 1
  })
  let id = list.data.files?.[0]?.id ?? null
  if (!id) {
    const created = await drive.files.create({
      requestBody: { name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' },
      fields: 'id'
    })
    id = created.data.id ?? null
  }
  if (!id) {
    throw Object.assign(new Error('Falha ao criar pasta no Drive.'), { code: 'DRIVE_FOLDER' })
  }
  updateSettings({ driveFolderId: id })
  return id
}

/** Faz backup hot do SQLite atual para um arquivo, comprime e sobe ao Drive. */
export async function uploadBackup(): Promise<{ ok: true; fileId: string; size: number }> {
  const oauth = authenticatedClient()
  const drive = google.drive({ version: 'v3', auth: oauth })
  const folderId = await ensureFolder(drive)

  const ts = new Date().toISOString().replace(/[:]/g, '-').replace(/\..+/, '')
  const tmpDir = backupTempDir()
  const dbCopy = join(tmpDir, `backup-${ts}.db`)
  const gzPath = join(tmpDir, `backup-${ts}.db.gz`)

  try {
    // 1) snapshot consistente do SQLite (hot backup)
    await getDb().backup(dbCopy)

    // 2) gzip
    await pipeline(createReadStream(dbCopy), createGzip(), createWriteStream(gzPath))

    // 3) upload
    const stats = statSync(gzPath)
    const filename = `gestao-hospital-${ts}.db.gz`
    const r = await drive.files.create({
      requestBody: { name: filename, parents: [folderId] },
      media: { mimeType: 'application/gzip', body: createReadStream(gzPath) },
      fields: 'id, size'
    })

    if (!r.data.id) {
      throw Object.assign(new Error('Drive não retornou ID do arquivo.'), { code: 'DRIVE_UPLOAD' })
    }
    updateSettings({ driveLastBackupAt: new Date().toISOString() })
    logAudit({
      action: 'backup',
      entity: 'drive',
      details: { fileId: r.data.id, size: stats.size, filename }
    })
    return { ok: true, fileId: r.data.id, size: stats.size }
  } finally {
    try {
      unlinkSync(dbCopy)
    } catch {
      /* ignore */
    }
    try {
      unlinkSync(gzPath)
    } catch {
      /* ignore */
    }
  }
}

let scheduler: NodeJS.Timeout | null = null

/** Agenda backup diário (intervalo 24h). Se já foi feito hoje, pula. */
export function startDailyScheduler(): void {
  if (scheduler) return
  const tick = async (): Promise<void> => {
    try {
      const s = getSettings()
      if (!s.driveAutoEnabled || !s.driveRefreshToken) return
      const last = s.driveLastBackupAt ? new Date(s.driveLastBackupAt).getTime() : 0
      if (Date.now() - last >= 24 * 3600 * 1000) {
        await uploadBackup()
      }
    } catch (e) {
      console.error('[drive] backup agendado falhou:', (e as Error).message)
    }
  }
  // 1ª execução em 60s (dá tempo do app abrir), depois a cada hora avalia janela
  setTimeout(() => void tick(), 60_000)
  scheduler = setInterval(() => void tick(), 3600_000)
}

export function stopDailyScheduler(): void {
  if (scheduler) {
    clearInterval(scheduler)
    scheduler = null
  }
}
