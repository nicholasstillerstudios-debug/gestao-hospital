#!/usr/bin/env node
// Baixa o prebuild win32-x64 do better-sqlite3 contra o ABI do Electron antes
// de empacotar com electron-builder. Necessário porque cross-buildamos no Linux
// (ou em CI) e o .node nativo precisa casar com a plataforma destino.
import { execSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const repoRoot = resolve(__dirname, '..')
const electronVersion = require('electron/package.json').version
const moduleDir = resolve(repoRoot, 'node_modules/better-sqlite3')
const nodeFile = resolve(moduleDir, 'build/Release/better_sqlite3.node')
const backupDir = resolve(repoRoot, '.cache/native-host-backup')
const backupFile = resolve(backupDir, 'better_sqlite3.node')

if (existsSync(nodeFile)) {
  mkdirSync(backupDir, { recursive: true })
  copyFileSync(nodeFile, backupFile)
  console.log(`[prebuild-win-native] backup do .node atual em ${backupFile}`)
}

console.log(
  `[prebuild-win-native] baixando better-sqlite3 win32-x64 contra Electron ${electronVersion}`
)
execSync(
  `npx prebuild-install --runtime=electron --target=${electronVersion} --platform=win32 --arch=x64 --force`,
  { cwd: moduleDir, stdio: 'inherit' }
)
