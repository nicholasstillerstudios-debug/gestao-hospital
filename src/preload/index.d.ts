import type { ElectronAPI } from '@electron-toolkit/preload'
import type { GestaoUbsApi } from './index'

declare global {
  interface Window {
    electron: ElectronAPI
    api: GestaoUbsApi
  }
}
