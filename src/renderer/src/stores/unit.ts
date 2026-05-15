/**
 * Tipo da unidade (UBS, hospital, mista). Carregado uma vez após login;
 * controla a visibilidade dos módulos no menu lateral.
 */
import { create } from 'zustand'
import type { UnitType } from '@shared/types'

interface UnitState {
  unitType: UnitType
  loaded: boolean
  loadFromServer: () => Promise<void>
  setUnitType: (type: UnitType) => void
}

export const useUnit = create<UnitState>((set) => ({
  unitType: 'hospital',
  loaded: false,
  loadFromServer: async () => {
    try {
      const s = await window.api.settings.getPublic()
      set({ unitType: s.unitType ?? 'hospital', loaded: true })
    } catch {
      set({ loaded: true })
    }
  },
  setUnitType: (unitType) => set({ unitType })
}))

