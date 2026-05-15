import { dialog, app } from 'electron'
import Database from 'better-sqlite3'
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { closeDatabase, getDatabasePath, getDb } from '../db'
import { logAudit } from '../audit'
import type { BackupInfo } from '@shared/types'

function getBackupDir(): string {
  const dir = join(app.getPath('userData'), 'backups')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export async function exportBackup(): Promise<BackupInfo | null> {
  const db = getDb()
  const ts = new Date().toISOString().replace(/[:]/g, '-').replace(/\..+/, '')
  const defaultName = `gestao-hospital-backup-${ts}.db`

  const chosen = await dialog.showSaveDialog({
    title: 'Exportar backup do banco de dados',
    defaultPath: defaultName,
    filters: [{ name: 'SQLite Database', extensions: ['db'] }]
  })

  if (chosen.canceled || !chosen.filePath) return null

  // Primeiro salva dentro da pasta oficial de backups (histórico local)
  const localPath = join(getBackupDir(), defaultName)
  await db.backup(localPath)
  copyFileSync(localPath, chosen.filePath)

  const stats = statSync(chosen.filePath)
  logAudit({
    action: 'export',
    entity: 'backup',
    details: { path: chosen.filePath, sizeBytes: stats.size }
  })
  return {
    path: chosen.filePath,
    sizeBytes: stats.size,
    createdAt: new Date().toISOString()
  }
}

export function listBackups(): BackupInfo[] {
  const dir = getBackupDir()
  return readdirSync(dir)
    .filter((f) => f.endsWith('.db'))
    .map((f) => {
      const p = join(dir, f)
      const s = statSync(p)
      return {
        path: p,
        sizeBytes: s.size,
        createdAt: s.mtime.toISOString()
      }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getCurrentDatabasePath(): string {
  return getDatabasePath()
}

export interface RestoreResult {
  restored: boolean
  backupOfCurrent: string | null
  restoredFrom: string | null
}

/**
 * Substitui o banco atual por um arquivo de backup escolhido pelo usuário.
 * Faz primeiro um backup de segurança do estado atual (em caso de reversão),
 * valida que o arquivo é um SQLite com a tabela `users` (sanidade mínima)
 * e só depois copia por cima. O chamador deve reiniciar o app em seguida.
 */
export async function restoreBackup(): Promise<RestoreResult> {
  const chosen = await dialog.showOpenDialog({
    title: 'Restaurar backup',
    filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    properties: ['openFile']
  })

  if (chosen.canceled || chosen.filePaths.length === 0) {
    return { restored: false, backupOfCurrent: null, restoredFrom: null }
  }

  const source = chosen.filePaths[0]
  if (!existsSync(source)) {
    throw new Error('Arquivo de backup não encontrado.')
  }

  // Validação mínima: abrir em modo readonly e checar que tem a tabela `users`.
  // Se der erro, rejeita antes de tocar no DB atual.
  try {
    const probe = new Database(source, { readonly: true, fileMustExist: true })
    try {
      const row = probe
        .prepare(`SELECT count(*) AS c FROM sqlite_master WHERE type='table' AND name='users'`)
        .get() as { c: number }
      if (!row || row.c < 1) {
        throw new Error('Arquivo de backup inválido (esquema não reconhecido).')
      }
    } finally {
      probe.close()
    }
  } catch (err) {
    const msg = (err as Error).message
    throw new Error(`Não foi possível ler o backup: ${msg}`)
  }

  // Confirmação explícita: o usuário perde os dados atuais se não houver export prévio.
  const currentPath = getDatabasePath()
  const confirmation = await dialog.showMessageBox({
    type: 'warning',
    buttons: ['Cancelar', 'Restaurar'],
    defaultId: 0,
    cancelId: 0,
    title: 'Restaurar backup',
    message: 'Substituir banco de dados atual pelo backup selecionado?',
    detail: `Isso sobrescreverá todos os dados atuais em:\n${currentPath}\n\nUm snapshot de segurança do estado atual será salvo antes. O app será encerrado automaticamente ao final.`
  })
  if (confirmation.response !== 1) {
    return { restored: false, backupOfCurrent: null, restoredFrom: null }
  }

  // Snapshot do estado atual antes de sobrescrever.
  const db = getDb()
  const ts = new Date().toISOString().replace(/[:]/g, '-').replace(/\..+/, '')
  const safetyPath = join(getBackupDir(), `gestao-hospital-before-restore-${ts}.db`)
  await db.backup(safetyPath)

  // Log antes de fechar o DB (depois de closeDatabase o getDb() lança).
  logAudit({
    action: 'restore',
    entity: 'backup',
    details: { source, safetyBackup: safetyPath }
  })

  // Fecha conexão antes de sobrescrever o arquivo.
  closeDatabase()
  copyFileSync(source, currentPath)

  return {
    restored: true,
    backupOfCurrent: safetyPath,
    restoredFrom: source
  }
}
