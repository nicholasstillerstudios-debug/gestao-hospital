/**
 * Gera os ícones do app a partir de build/logo.svg.
 *
 * Saída:
 *   build/icon.png       — 512x512 (usado em macOS / Linux / electron-builder)
 *   build/icon.ico       — multi-resolution (16, 24, 32, 48, 64, 128, 256) — Windows
 *   resources/icon.png   — 512x512 (usado pelo Electron como --icon em runtime)
 *
 * Para regenerar:
 *   node scripts/generate-icons.mjs
 *
 * Deps (devDependencies): sharp, png-to-ico.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SVG_PATH = join(ROOT, 'build', 'logo.svg')

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]

async function main() {
  const svg = readFileSync(SVG_PATH)

  // 1) PNG 512x512 para build/ e resources/
  const png512 = await sharp(svg, { density: 384 })
    .resize(512, 512)
    .png({ compressionLevel: 9 })
    .toBuffer()

  mkdirSync(join(ROOT, 'build'), { recursive: true })
  mkdirSync(join(ROOT, 'resources'), { recursive: true })
  writeFileSync(join(ROOT, 'build', 'icon.png'), png512)
  writeFileSync(join(ROOT, 'resources', 'icon.png'), png512)
  console.log(`✓ build/icon.png e resources/icon.png (512x512, ${png512.length} bytes)`)

  // 2) ICO multi-res para Windows
  const pngs = await Promise.all(
    ICO_SIZES.map((size) =>
      sharp(svg, { density: 384 })
        .resize(size, size)
        .png({ compressionLevel: 9 })
        .toBuffer()
    )
  )
  const ico = await pngToIco(pngs)
  writeFileSync(join(ROOT, 'build', 'icon.ico'), ico)
  console.log(
    `✓ build/icon.ico (${ICO_SIZES.join(', ')} px, ${ico.length} bytes)`
  )

  console.log('\nÍcones regenerados. Rode `npm run build:win` para empacotar o instalador.')
}

main().catch((err) => {
  console.error('[generate-icons] falhou:', err)
  process.exit(1)
})
