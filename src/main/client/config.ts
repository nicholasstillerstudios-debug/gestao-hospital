/**
 * Configuração de boot do app: lida ANTES de abrir banco/servidor.
 * Persistida em userData/runmode.json. Fonte de verdade quando o
 * processo decide se vai abrir SQLite local (standalone/server) ou
 * proxyar IPC via HTTP para um servidor remoto (client).
 */
import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { RunMode } from '@shared/types'

export interface BootConfig {
  runMode: RunMode
  serverUrl?: string
  serverPort?: number
}

function file(): string {
  return join(app.getPath('userData'), 'runmode.json')
}

export function loadBootConfig(): BootConfig {
  try {
    const p = file()
    if (!existsSync(p)) return { runMode: 'standalone' }
    const raw = JSON.parse(readFileSync(p, 'utf8')) as Partial<BootConfig>
    const m: RunMode =
      raw.runMode === 'server' || raw.runMode === 'client' ? raw.runMode : 'standalone'
    return { runMode: m, serverUrl: raw.serverUrl, serverPort: raw.serverPort }
  } catch {
    return { runMode: 'standalone' }
  }
}

export function saveBootConfig(c: BootConfig): void {
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(file(), JSON.stringify(c, null, 2), 'utf8')
}
