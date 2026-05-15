import { AsyncLocalStorage } from 'node:async_hooks'
import type { AuthUser } from '@shared/types'

/**
 * Sessão atual.
 *
 * - No fluxo IPC tradicional (Electron + janela única), usamos o singleton
 *   `currentUser` — uma janela só, um usuário só.
 * - No fluxo HTTP (modo servidor LAN), múltiplas requests concorrem; cada
 *   uma seta seu usuário em `als` (AsyncLocalStorage). `getCurrentUser`
 *   prefere o do ALS quando existe.
 */
const als = new AsyncLocalStorage<AuthUser>()
let currentUser: AuthUser | null = null

export function setCurrentUser(user: AuthUser | null): void {
  currentUser = user
}

export function getCurrentUser(): AuthUser | null {
  return als.getStore() ?? currentUser
}

export function runWithUser<T>(user: AuthUser, fn: () => T | Promise<T>): T | Promise<T> {
  return als.run(user, fn)
}

export function requireUser(): AuthUser {
  const u = getCurrentUser()
  if (!u) {
    throw Object.assign(new Error('Sessão expirada. Faça login novamente.'), {
      code: 'UNAUTHORIZED'
    })
  }
  return u
}

export function requireRole(...roles: AuthUser['role'][]): AuthUser {
  const user = requireUser()
  if (!roles.includes(user.role)) {
    throw Object.assign(new Error('Você não tem permissão para executar esta ação.'), {
      code: 'FORBIDDEN'
    })
  }
  return user
}
