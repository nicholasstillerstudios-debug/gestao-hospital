/**
 * Servidor HTTP local (LAN).
 *
 * Expõe os mesmos handlers IPC como rotas REST autenticadas por Bearer
 * token. Clientes (modo cliente) usam isso ao invés de chamar IPC.
 *
 *   POST /api/auth/login        { username, password } → { token, user }
 *   POST /api/auth/logout       Bearer X              → { ok: true }
 *   POST /api/auth/whoami       Bearer X              → { user }
 *   POST /api/channel/:name     Bearer X, body = args → { ok, data | error }
 *   GET  /api/health                                  → { ok, version }
 *
 * Channel name segue o IPC (ex.: "patients:list"). Body é um array de
 * argumentos serializável em JSON (mesmo contrato do ipcRenderer.invoke).
 *
 * Cada request roda dentro de runWithUser para que getCurrentUser/requireRole
 * funcionem corretamente sob concorrência (AsyncLocalStorage).
 */
import express, { type Request, type Response, type NextFunction } from 'express'
import cors from 'cors'
import type { Server } from 'node:http'
import { app as electronApp } from 'electron'
import { handlerRegistry } from '../ipc'
import { runWithUser } from '../session'
import * as usersRepo from '../repositories/users'
import { createApiSession, destroyApiSession, resolveApiSession } from './sessions'
import type { AuthUser } from '@shared/types'

let httpServer: Server | null = null

function fail(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ ok: false, error: { code, message } })
}

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  const user = token ? resolveApiSession(token) : null
  if (!user) {
    fail(res, 401, 'UNAUTHORIZED', 'Token inválido ou expirado.')
    return
  }
  ;(req as Request & { user: AuthUser }).user = user
  next()
}

function buildApp(): express.Express {
  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '20mb' }))

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, app: 'gestao-hospital', version: electronApp.getVersion() })
  })

  // ── Login (sem auth) ────────────────────────────────────────────────
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = (req.body ?? {}) as {
      username?: string
      password?: string
    }
    if (!username || !password) {
      return fail(res, 400, 'MISSING_CREDENTIALS', 'Informe usuário e senha.')
    }
    const u = usersRepo.verifyLogin(String(username), String(password))
    if (!u) {
      return fail(res, 401, 'INVALID_CREDENTIALS', 'Usuário ou senha incorretos.')
    }
    const token = createApiSession(u.id)
    res.json({ ok: true, data: { token, user: u } })
  })

  // ── Logout / whoami ─────────────────────────────────────────────────
  app.post('/api/auth/logout', authMiddleware, (req, res) => {
    const header = req.header('authorization') ?? ''
    const token = header.slice(7).trim()
    destroyApiSession(token)
    res.json({ ok: true, data: null })
  })

  app.post('/api/auth/whoami', authMiddleware, (req, res) => {
    res.json({ ok: true, data: (req as Request & { user: AuthUser }).user })
  })

  // ── Dispatcher genérico para os channels IPC ────────────────────────
  // Channel name vem da URL (ex.: "patients:list" → /api/channel/patients:list).
  // Body deve ser { args: [...] } (array JSON-serializável).
  app.post('/api/channel/:name', authMiddleware, async (req, res) => {
    const name = String(req.params.name)
    const handler = handlerRegistry.get(name)
    if (!handler) {
      return fail(res, 404, 'CHANNEL_NOT_FOUND', `Canal "${name}" não existe.`)
    }
    const body = (req.body ?? {}) as { args?: unknown[] }
    const args = Array.isArray(body.args) ? body.args : []
    const user = (req as Request & { user: AuthUser }).user
    try {
      const result = await runWithUser(user, async () => handler(...args))
      res.json({ ok: true, data: result })
    } catch (err) {
      const e = err as Error & { code?: string }
      const status = e.code === 'FORBIDDEN' ? 403 : e.code === 'UNAUTHORIZED' ? 401 : 400
      fail(res, status, e.code ?? 'INTERNAL_ERROR', e.message || 'Erro interno.')
    }
  })

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    fail(res, 500, 'UNHANDLED', err.message || 'Erro não tratado.')
  })

  return app
}

export interface ServerInfo {
  port: number
  url: string
}

export function startServer(port: number): Promise<ServerInfo> {
  return new Promise((resolve, reject) => {
    if (httpServer) {
      return resolve({ port, url: `http://localhost:${port}` })
    }
    const app = buildApp()
    const server = app
      .listen(port, '0.0.0.0', () => {
        httpServer = server
        resolve({ port, url: `http://localhost:${port}` })
      })
      .on('error', reject)
  })
}

export async function stopServer(): Promise<void> {
  if (!httpServer) return
  await new Promise<void>((resolve) => httpServer!.close(() => resolve()))
  httpServer = null
}

export function isServerRunning(): boolean {
  return httpServer != null
}
