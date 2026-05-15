import type { AuthUser } from '@shared/types'

let currentUser: AuthUser | null = null

export function setCurrentUser(user: AuthUser | null): void {
  currentUser = user
}

export function getCurrentUser(): AuthUser | null {
  return currentUser
}

export function requireUser(): AuthUser {
  if (!currentUser) {
    throw Object.assign(new Error('Sessão expirada. Faça login novamente.'), {
      code: 'UNAUTHORIZED'
    })
  }
  return currentUser
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
