import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { closeDatabase, initDatabase } from './db'
import { seedInitialAdmin, seedSampleProfessionals } from './db/seed'
import { registerIpcHandlers } from './ipc'
import { registerUpdater } from './updater'
import { purgeAuditOlderThan } from './audit'
import { getSettings } from './repositories/settings'
import { startServer, stopServer } from './server'
import { purgeExpiredSessions } from './server/sessions'
import { loadBootConfig } from './client/config'
import { registerClientHandlers } from './client/proxy'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    title: 'Gestão Hospitalar',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('br.hospital.gestao')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const boot = loadBootConfig()

  if (boot.runMode === 'client') {
    // Cliente: sem DB local. Proxy IPC → HTTP do servidor LAN.
    registerClientHandlers()
    console.log(`[client] modo cliente — servidor configurado: ${boot.serverUrl ?? '(none)'}`)
  } else {
    // Standalone ou servidor: abre banco local e registra handlers reais.
    const db = initDatabase()
    seedInitialAdmin(db)
    seedSampleProfessionals(db)
    registerIpcHandlers()
    registerUpdater()

    const settings = getSettings()
    try {
      purgeAuditOlderThan(settings.auditRetentionDays)
    } catch (err) {
      console.error('[audit] purge inicial falhou:', err)
    }

    if (boot.runMode === 'server' || settings.runMode === 'server') {
      try {
        purgeExpiredSessions()
        const port = boot.serverPort ?? settings.serverPort
        const info = await startServer(port)
        console.log(`[server] API LAN ouvindo em ${info.url}`)
      } catch (err) {
        console.error('[server] falha ao iniciar HTTP API:', err)
      }
    }
  }

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (loadBootConfig().runMode !== 'client') {
    closeDatabase()
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async (e) => {
  e.preventDefault()
  try {
    await stopServer()
  } catch {
    /* ignore */
  }
  if (loadBootConfig().runMode !== 'client') {
    closeDatabase()
  }
  app.exit(0)
})
