/**
 * Testes do Round 5: branding (logos + tema).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

let tempDir: string

vi.mock('electron', () => ({
  app: {
    getName: () => 'Gestão Hospitalar',
    getVersion: () => '0.1.0-test',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getPath: (_name: string) => tempDir
  }
}))

async function freshDb(): Promise<void> {
  tempDir = mkdtempSync(join(tmpdir(), 'gestao-ubs-r5-'))
  process.env.GESTAO_HOSPITAL_DB_PATH = join(tempDir, 'test.db')
  vi.resetModules()
  const dbModule = await import('../src/main/db')
  dbModule.initDatabase()
}

beforeEach(() => {
  process.env.GESTAO_HOSPITAL_DB_PATH = ''
})

afterEach(() => {
  if (tempDir) {
    try {
      rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  }
})

const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
  'base64'
)

describe('Branding: upload e remoção de logos', () => {
  it('upload aceita PNG válido e cria arquivo em userData/branding', async () => {
    await freshDb()
    const branding = await import('../src/main/repositories/branding')
    const result = branding.uploadLogo({
      slot: 'prefeitura',
      filename: 'brasao.png',
      mimeType: 'image/png',
      bytes: PNG_1x1
    })
    expect(result.prefeitura).toMatch(/^data:image\/png;base64,/)
    expect(result.secretaria).toBeNull()
    expect(result.ubs).toBeNull()

    const dir = join(tempDir, 'branding')
    expect(existsSync(dir)).toBe(true)
    const files = readdirSync(dir)
    expect(files.length).toBe(1)
    expect(files[0]).toMatch(/^prefeitura-[0-9a-f]{16}\.png$/)
  })

  it('rejeita formatos não suportados', async () => {
    await freshDb()
    const branding = await import('../src/main/repositories/branding')
    expect(() =>
      branding.uploadLogo({
        slot: 'prefeitura',
        filename: 'evil.exe',
        mimeType: 'application/octet-stream',
        bytes: Buffer.from([0x4d, 0x5a])
      })
    ).toThrow(/Formato/i)
  })

  it('rejeita arquivos maiores que 2 MB', async () => {
    await freshDb()
    const branding = await import('../src/main/repositories/branding')
    const big = Buffer.alloc(3 * 1024 * 1024, 0)
    expect(() =>
      branding.uploadLogo({
        slot: 'ubs',
        filename: 'huge.png',
        mimeType: 'image/png',
        bytes: big
      })
    ).toThrow(/grande/i)
  })

  it('substitui o arquivo anterior ao trocar logo do mesmo slot', async () => {
    await freshDb()
    const branding = await import('../src/main/repositories/branding')
    branding.uploadLogo({
      slot: 'secretaria',
      filename: 'a.png',
      mimeType: 'image/png',
      bytes: PNG_1x1
    })
    branding.uploadLogo({
      slot: 'secretaria',
      filename: 'b.png',
      mimeType: 'image/png',
      bytes: PNG_1x1
    })
    const files = readdirSync(join(tempDir, 'branding'))
    // Apenas 1 arquivo deve sobrar (o segundo upload removeu o primeiro).
    expect(files.length).toBe(1)
  })

  it('removeLogo apaga o arquivo e zera o slot em settings', async () => {
    await freshDb()
    const branding = await import('../src/main/repositories/branding')
    branding.uploadLogo({
      slot: 'ubs',
      filename: 'c.png',
      mimeType: 'image/png',
      bytes: PNG_1x1
    })
    const after = branding.removeLogo('ubs')
    expect(after.ubs).toBeNull()
    const files = readdirSync(join(tempDir, 'branding'))
    expect(files.length).toBe(0)
  })

  it('getLogos retorna data URLs apenas dos slots presentes', async () => {
    await freshDb()
    const branding = await import('../src/main/repositories/branding')
    branding.uploadLogo({
      slot: 'prefeitura',
      filename: 'p.png',
      mimeType: 'image/png',
      bytes: PNG_1x1
    })
    branding.uploadLogo({
      slot: 'ubs',
      filename: 'u.png',
      mimeType: 'image/png',
      bytes: PNG_1x1
    })
    const logos = branding.getLogos()
    expect(logos.prefeitura).toMatch(/^data:image\/png;/)
    expect(logos.secretaria).toBeNull()
    expect(logos.ubs).toMatch(/^data:image\/png;/)
  })
})

describe('Tema customizável', () => {
  it('grava cor primária válida e ignora hex inválido', async () => {
    await freshDb()
    const settings = await import('../src/main/repositories/settings')
    settings.updateSettings({ themePrimary: '#ff5500' })
    expect(settings.getSettings().themePrimary).toBe('#ff5500')
    expect(() => settings.updateSettings({ themePrimary: 'red' })).toThrow(/Cor/)
    // valor anterior preservado
    expect(settings.getSettings().themePrimary).toBe('#ff5500')
  })

  it('alterna entre light e dark', async () => {
    await freshDb()
    const settings = await import('../src/main/repositories/settings')
    expect(settings.getSettings().themeMode).toBe('light')
    settings.updateSettings({ themeMode: 'dark' })
    expect(settings.getSettings().themeMode).toBe('dark')
    settings.updateSettings({ themeMode: 'light' })
    expect(settings.getSettings().themeMode).toBe('light')
  })
})
