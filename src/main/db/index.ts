import Database from 'better-sqlite3'
import { app } from 'electron'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { runMigrations } from './migrations'

let dbInstance: Database.Database | null = null

function resolveDbPath(): string {
  if (process.env.GESTAO_HOSPITAL_DB_PATH) {
    return process.env.GESTAO_HOSPITAL_DB_PATH
  }
  const userData = app.getPath('userData')
  if (!existsSync(userData)) {
    mkdirSync(userData, { recursive: true })
  }
  return join(userData, 'gestao-hospital.db')
}

export function initDatabase(): Database.Database {
  if (dbInstance) return dbInstance
  const dbPath = resolveDbPath()
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
  dbInstance = db
  return db
}

export function getDb(): Database.Database {
  if (!dbInstance) {
    throw new Error('Database não inicializado. Chame initDatabase() antes.')
  }
  return dbInstance
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
}

export function getDatabasePath(): string {
  return resolveDbPath()
}
