import { BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

/**
 * Conjunto de webContents.id de janelas auxiliares (painel de chamada).
 * Usado pelo IPC para liberar `calls.recent` apenas para essas janelas
 * mesmo sem usuário autenticado (já que o painel é uma rota pública e
 * não tem fluxo de login). Janelas registradas aqui foram criadas
 * exclusivamente por handlers IPC autenticados (`panel.open` exige
 * `requireUser()`), então o trust boundary é o operador autenticado
 * que clicou em "Abrir painel".
 */
const panelWindowIds = new Set<number>()

export function isPanelWindow(webContentsId: number): boolean {
  return panelWindowIds.has(webContentsId)
}

/**
 * Cria uma janela auxiliar (ex.: painel de chamada) que carrega a mesma SPA
 * com um hash de rota específico. Não pode ser feita via window.open() do
 * renderer porque setWindowOpenHandler bloqueia novas janelas — então é
 * acionada por IPC e criada aqui no main process com o preload correto.
 */
export function createSecondaryWindow(hash: string): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 480,
    show: false,
    autoHideMenuBar: true,
    title: 'Gestão UBS — Painel',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  // Captura o id antes do `closed` — webContents pode estar destruído lá.
  const wcId = win.webContents.id
  panelWindowIds.add(wcId)
  win.on('closed', () => panelWindowIds.delete(wcId))

  win.on('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const cleanHash = hash.startsWith('#') ? hash : `#${hash}`
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}${cleanHash}`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash: cleanHash.slice(1) })
  }
  return win
}
