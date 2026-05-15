import { app, BrowserWindow, ipcMain } from 'electron'
import log from 'electron-log'
import { autoUpdater, type UpdateInfo, type ProgressInfo } from 'electron-updater'
import { IPC, type UpdaterStatus } from '@shared/ipc'

/**
 * Auto-update via GitHub Releases.
 *
 * - Checa nova versão na inicialização e a cada 60 min.
 * - Baixa em background; o renderer recebe progresso por `updater:state`.
 * - O usuário decide "Reiniciar agora" via banner; senão instala no próximo
 *   fechamento natural da app.
 * - Em DEV (`!app.isPackaged`) o módulo é no-op pra não estourar erros sem
 *   `dev-app-update.yml`.
 */

let lastStatus: UpdaterStatus = { kind: 'idle' }

function broadcast(status: UpdaterStatus): void {
  lastStatus = status
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IPC.updater.state, status)
  }
}

export function registerUpdater(): void {
  ipcMain.handle(IPC.updater.state, () => ({ ok: true, data: lastStatus }))

  if (!app.isPackaged) {
    // Em dev não há build empacotada → registramos handlers que não fazem nada.
    ipcMain.handle(IPC.updater.check, () => ({ ok: true, data: { kind: 'idle' } }))
    ipcMain.handle(IPC.updater.quitAndInstall, () => ({ ok: true, data: null }))
    return
  }

  autoUpdater.logger = log
  log.transports.file.level = 'info'
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  // Pequena melhoria pra usuários sem certificado de code-signing (futuro).
  autoUpdater.disableWebInstaller = true

  autoUpdater.on('checking-for-update', () => broadcast({ kind: 'checking' }))
  autoUpdater.on('update-available', (info: UpdateInfo) =>
    broadcast({ kind: 'available', version: info.version })
  )
  autoUpdater.on('update-not-available', (info: UpdateInfo) =>
    broadcast({ kind: 'not-available', version: info.version })
  )
  autoUpdater.on('download-progress', (p: ProgressInfo) =>
    broadcast({
      kind: 'downloading',
      percent: Math.max(0, Math.min(100, p.percent)),
      transferred: p.transferred,
      total: p.total
    })
  )
  autoUpdater.on('update-downloaded', (info: UpdateInfo) =>
    broadcast({ kind: 'downloaded', version: info.version })
  )
  autoUpdater.on('error', (err: Error) =>
    broadcast({ kind: 'error', message: err?.message ?? String(err) })
  )

  ipcMain.handle(IPC.updater.check, async () => {
    try {
      await autoUpdater.checkForUpdates()
      return { ok: true, data: lastStatus }
    } catch (err) {
      const message = (err as Error)?.message ?? String(err)
      broadcast({ kind: 'error', message })
      return { ok: false, error: { code: 'UPDATER_ERROR', message } }
    }
  })

  ipcMain.handle(IPC.updater.quitAndInstall, () => {
    if (lastStatus.kind !== 'downloaded') {
      return {
        ok: false,
        error: { code: 'NO_UPDATE_DOWNLOADED', message: 'Nenhuma atualização baixada.' }
      }
    }
    // isSilent=false → mostra installer; isForceRunAfter=true → reabre.
    setImmediate(() => autoUpdater.quitAndInstall(false, true))
    return { ok: true, data: null }
  })

  // Primeira checagem 5s depois de subir (não bloqueia splash).
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      const message = (err as Error)?.message ?? String(err)
      broadcast({ kind: 'error', message })
    })
  }, 5_000)

  // Re-checa a cada 60 minutos.
  setInterval(
    () => {
      autoUpdater.checkForUpdates().catch((err) => {
        const message = (err as Error)?.message ?? String(err)
        broadcast({ kind: 'error', message })
      })
    },
    60 * 60 * 1000
  )
}
