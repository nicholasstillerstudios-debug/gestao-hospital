#!/usr/bin/env node
// Restaura o .node nativo do host (Linux ABI Electron) após cross-build win32,
// para que `npm run start`/`npm run dev` continuem funcionando localmente.
import { copyFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')
const nodeFile = resolve(repoRoot, 'node_modules/better-sqlite3/build/Release/better_sqlite3.node')
const backupFile = resolve(repoRoot, '.cache/native-host-backup/better_sqlite3.node')

if (!existsSync(backupFile)) {
  console.log('[restore-host-native] nenhum backup encontrado, nada a fazer.')
  process.exit(0)
}

copyFileSync(backupFile, nodeFile)
console.log(`[restore-host-native] .node do host restaurado de ${backupFile}`)
