import { create } from 'zustand'
import type { AuthUser } from '@shared/types'

interface AuthState {
  user: AuthUser | null
  loading: boolean
  setUser: (user: AuthUser | null) => void
  login: (username: string, password: string) => Promise<AuthUser>
  logout: () => Promise<void>
  bootstrap: () => Promise<void>
  changePassword: (oldPassword: string, newPassword: string) => Promise<AuthUser>
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user }),
  login: async (username, password) => {
    const user = await window.api.auth.login(username, password)
    set({ user })
    return user
  },
  logout: async () => {
    await window.api.auth.logout()
    set({ user: null })
  },
  bootstrap: async () => {
    try {
      const user = await window.api.auth.whoami()
      set({ user, loading: false })
    } catch {
      set({ user: null, loading: false })
    }
  },
  changePassword: async (oldPassword, newPassword) => {
    const user = await window.api.auth.changePassword(oldPassword, newPassword)
    set({ user })
    return user
  }
}))
