/**
 * Modo CLIENTE: substitui handlers IPC por proxies HTTP que chamam
 * o servidor LAN. Renderer continua usando window.api.* normalmente —
 * a substituição é transparente.
 *
 * Tokens de sessão e config ficam em memória (Map) + arquivo JSON local
 * (apenas runMode/serverUrl). Login emite POST /api/auth/login; demais
 * channels vão pra POST /api/channel/:name com Bearer token.
 */
import { ipcMain, app, dialog, BrowserWindow } from 'electron'
import { writeFileSync } from 'node:fs'
import { IPC, type UpdaterStatus } from '@shared/ipc'
import type { AuthUser } from '@shared/types'
import { loadBootConfig, saveBootConfig, type BootConfig } from './config'

interface ClientSession {
  token: string | null
  user: AuthUser | null
}

const session: ClientSession = { token: null, user: null }

function serverBase(): string {
  const cfg = loadBootConfig()
  return cfg.serverUrl?.replace(/\/+$/, '') ?? ''
}

function networkError(msg: string): { ok: false; error: { code: string; message: string } } {
  return { ok: false, error: { code: 'NETWORK', message: msg } }
}

async function httpJson(
  path: string,
  init: { method?: string; body?: unknown; auth?: boolean } = {}
): Promise<{ ok: boolean; data?: unknown; error?: { code: string; message: string } }> {
  const base = serverBase()
  if (!base) return networkError('Servidor não configurado. Acesse Admin → Rede.')
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (init.auth !== false && session.token) {
    headers.authorization = `Bearer ${session.token}`
  }
  try {
    const r = await fetch(`${base}${path}`, {
      method: init.method ?? 'POST',
      headers,
      body: init.body == null ? undefined : JSON.stringify(init.body)
    })
    const json = (await r.json()) as {
      ok: boolean
      data?: unknown
      error?: { code: string; message: string }
    }
    return json
  } catch (err) {
    return networkError((err as Error).message || 'Falha de conexão com o servidor.')
  }
}

function collectChannels(): string[] {
  const out: string[] = []
  for (const group of Object.values(IPC)) {
    for (const ch of Object.values(group as Record<string, string>)) {
      out.push(ch)
    }
  }
  return out
}

export function registerClientHandlers(): void {
  // ── Auth (casos especiais) ──────────────────────────────────────────
  ipcMain.handle(IPC.auth.login, async (_e, username: unknown, password: unknown) => {
    const r = await httpJson('/api/auth/login', {
      auth: false,
      body: { username, password }
    })
    if (!r.ok) return r
    const data = r.data as { token: string; user: AuthUser }
    session.token = data.token
    session.user = data.user
    return { ok: true, data: data.user }
  })

  ipcMain.handle(IPC.auth.logout, async () => {
    if (!session.token) return { ok: true, data: null }
    await httpJson('/api/auth/logout', {}).catch(() => null)
    session.token = null
    session.user = null
    return { ok: true, data: null }
  })

  ipcMain.handle(IPC.auth.whoami, async () => {
    if (!session.token) return { ok: true, data: null }
    return await httpJson('/api/auth/whoami', {})
  })

  // ── Print é local: usa a janela atual, não vai pro servidor ─────────
  ipcMain.handle(IPC.print.saveCurrentAsPdf, async (event, defaultName: unknown) => {
    try {
      const sender = BrowserWindow.fromWebContents(event.sender)
      if (!sender) throw new Error('Janela não localizada.')
      const fallback = `documento-${new Date().toISOString().replace(/[:]/g, '-').replace(/\..+/, '')}.pdf`
      const safe =
        typeof defaultName === 'string' && defaultName.trim().length > 0
          ? String(defaultName).replace(/[\\/:*?"<>|]/g, '-')
          : fallback
      const chosen = await dialog.showSaveDialog(sender, {
        title: 'Salvar como PDF',
        defaultPath: safe.endsWith('.pdf') ? safe : `${safe}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      })
      if (chosen.canceled || !chosen.filePath) {
        return { ok: true, data: { saved: false, path: null as string | null } }
      }
      const pdf = await event.sender.printToPDF({
        pageSize: 'A4',
        printBackground: true,
        margins: { top: 0, bottom: 0, left: 0, right: 0 }
      })
      writeFileSync(chosen.filePath, pdf)
      return { ok: true, data: { saved: true, path: chosen.filePath } }
    } catch (err) {
      return { ok: false, error: { code: 'PRINT', message: (err as Error).message } }
    }
  })

  // ── Meta também é local ─────────────────────────────────────────────
  ipcMain.handle(IPC.meta.appInfo, async () => ({
    ok: true,
    data: { name: app.getName(), version: app.getVersion(), platform: process.platform }
  }))

  // ── Client boot (gestão local da config — sempre disponível) ────────
  ipcMain.handle(IPC.client.getBoot, async () => ({ ok: true, data: loadBootConfig() }))
  ipcMain.handle(IPC.client.setBoot, async (_e, cfg: unknown) => {
    saveBootConfig(cfg as BootConfig)
    return { ok: true, data: { ok: true } }
  })
  ipcMain.handle(IPC.client.ping, async (_e, url: unknown) => ({
    ok: true,
    data: await pingServer(String(url))
  }))
  ipcMain.handle(IPC.client.status, async () => {
    const cfg = loadBootConfig()
    const url = cfg.serverUrl ?? ''
    const r = url ? await pingServer(url) : { ok: false, error: 'sem URL' }
    return {
      ok: true,
      data: {
        runMode: cfg.runMode,
        connected: r.ok,
        serverRunning: false,
        serverUrl: url || null,
        message: r.ok ? `Conectado · ${url}` : `Sem conexão: ${r.error ?? '?'}`
      }
    }
  })

  // ── Updater fica desligado em modo cliente ──────────────────────────
  const idle: UpdaterStatus = { kind: 'idle' }
  ipcMain.handle(IPC.updater.check, async () => ({ ok: true, data: idle }))
  ipcMain.handle(IPC.updater.state, async () => ({ ok: true, data: idle }))
  ipcMain.handle(IPC.updater.quitAndInstall, async () => ({ ok: true, data: null }))

  // ── Demais channels: proxy genérico ─────────────────────────────────
  const handled = new Set<string>([
    IPC.auth.login,
    IPC.auth.logout,
    IPC.auth.whoami,
    IPC.print.saveCurrentAsPdf,
    IPC.meta.appInfo,
    IPC.updater.check,
    IPC.updater.state,
    IPC.updater.quitAndInstall,
    IPC.client.getBoot,
    IPC.client.setBoot,
    IPC.client.ping,
    IPC.client.status
  ])
  for (const channel of collectChannels()) {
    if (handled.has(channel)) continue
    ipcMain.handle(channel, async (_e, ...args: unknown[]) => {
      return await httpJson(`/api/channel/${channel}`, { body: { args } })
    })
  }
}

/** Pra UI da aba Rede testar conectividade antes de salvar. */
export async function pingServer(
  url: string
): Promise<{ ok: boolean; version?: string; error?: string }> {
  try {
    const base = url.replace(/\/+$/, '')
    const r = await fetch(`${base}/api/health`)
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` }
    const j = (await r.json()) as { ok: boolean; version?: string }
    return { ok: !!j.ok, version: j.version }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}
