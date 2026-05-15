import { getDb } from '../db'
import { logAudit } from '../audit'
import type { AppSettings, ThemeMode, UnitType } from '@shared/types'

interface Row {
  key: string
  value: string
}

const DEFAULT_PRIMARY = '#0e7490'

const DEFAULTS: AppSettings = {
  auditRetentionDays: 0,
  unitType: 'hospital',
  unitName: '',
  unitCnes: '',
  unitAddress: '',
  unitPhone: '',
  unitMunicipality: '',
  brandingLogoPrefeituraFile: '',
  brandingLogoSecretariaFile: '',
  brandingLogoHospitalFile: '',
  brandingPrefeituraName: '',
  brandingSecretariaName: '',
  themePrimary: DEFAULT_PRIMARY,
  themeMode: 'light'
}

const STRING_KEYS: Array<keyof AppSettings> = [
  'unitName',
  'unitCnes',
  'unitAddress',
  'unitPhone',
  'unitMunicipality',
  'brandingLogoPrefeituraFile',
  'brandingLogoSecretariaFile',
  'brandingLogoHospitalFile',
  'brandingPrefeituraName',
  'brandingSecretariaName'
]

function readString(map: Map<string, string>, key: keyof AppSettings, fallback: string): string {
  const raw = map.get(key)
  return raw == null ? fallback : raw
}

function isValidHex(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}

function parseUnitType(raw: string | undefined): UnitType {
  return raw === 'ubs' || raw === 'mista' ? raw : 'hospital'
}

export function getSettings(): AppSettings {
  const rows = getDb().prepare('SELECT key, value FROM app_settings').all() as Row[]
  const map = new Map(rows.map((r) => [r.key, r.value]))
  const auditRaw = map.get('auditRetentionDays')
  const audit = auditRaw == null ? DEFAULTS.auditRetentionDays : Number(auditRaw)
  const themePrimary = map.get('themePrimary')
  const themeMode = map.get('themeMode')
  return {
    auditRetentionDays: Number.isFinite(audit) && audit >= 0 ? audit : DEFAULTS.auditRetentionDays,
    unitType: parseUnitType(map.get('unitType')),
    unitName: readString(map, 'unitName', DEFAULTS.unitName),
    unitCnes: readString(map, 'unitCnes', DEFAULTS.unitCnes),
    unitAddress: readString(map, 'unitAddress', DEFAULTS.unitAddress),
    unitPhone: readString(map, 'unitPhone', DEFAULTS.unitPhone),
    unitMunicipality: readString(map, 'unitMunicipality', DEFAULTS.unitMunicipality),
    brandingLogoPrefeituraFile: readString(map, 'brandingLogoPrefeituraFile', ''),
    brandingLogoSecretariaFile: readString(map, 'brandingLogoSecretariaFile', ''),
    brandingLogoHospitalFile: readString(map, 'brandingLogoHospitalFile', ''),
    brandingPrefeituraName: readString(map, 'brandingPrefeituraName', ''),
    brandingSecretariaName: readString(map, 'brandingSecretariaName', ''),
    themePrimary: themePrimary && isValidHex(themePrimary) ? themePrimary : DEFAULT_PRIMARY,
    themeMode: themeMode === 'dark' ? 'dark' : 'light'
  }
}

export function updateSettings(input: Partial<AppSettings>): AppSettings {
  const db = getDb()
  const stmt = db.prepare(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
  )
  const tx = db.transaction(() => {
    if (input.auditRetentionDays != null) {
      const value = Math.max(0, Math.floor(input.auditRetentionDays))
      stmt.run('auditRetentionDays', String(value))
    }
    for (const key of STRING_KEYS) {
      const value = input[key]
      if (value != null) {
        stmt.run(key, String(value).trim())
      }
    }
    if (input.themePrimary != null) {
      const v = String(input.themePrimary).trim()
      if (!isValidHex(v)) {
        const err = new Error('Cor primária inválida (use formato #rrggbb).') as Error & {
          code?: string
        }
        err.code = 'INVALID_THEME_COLOR'
        throw err
      }
      stmt.run('themePrimary', v.toLowerCase())
    }
    if (input.themeMode != null) {
      const mode: ThemeMode = input.themeMode === 'dark' ? 'dark' : 'light'
      stmt.run('themeMode', mode)
    }
    if (input.unitType != null) {
      const value: UnitType =
        input.unitType === 'ubs' || input.unitType === 'mista' ? input.unitType : 'hospital'
      stmt.run('unitType', value)
    }
  })
  tx()
  logAudit({ action: 'update', entity: 'settings', details: input })
  return getSettings()
}
