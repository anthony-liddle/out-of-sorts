// Rasterizes the committed favicon SVG into the full icon set, and renders
// the OG image. One time asset generation; the outputs are committed.
// Run with: node scripts/assets/generate-icons.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const ROOT = new URL('../..', import.meta.url).pathname
const browser = await chromium.launch()

async function raster(size, out, { background = 'transparent', pad = 0 } = {}) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  const svg = readFileSync(`${ROOT}public/favicon.svg`, 'utf8')
  const inner = size - pad * 2
  await page.setContent(
    `<body style="margin:0;background:${background};display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px">
       <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg', '<svg width="100%" height="100%"')}</div>
     </body>`,
  )
  await page.waitForTimeout(150)
  await page.screenshot({
    path: `${ROOT}public/${out}`,
    omitBackground: background === 'transparent',
  })
  await page.close()
}

// Page favicons. The 192 and 512 belong to the manifest, never to <link>.
await raster(16, 'favicon-16.png')
await raster(32, 'favicon-32.png')
await raster(180, 'icons/apple-touch-icon.png', { background: '#F4F2FB', pad: 14 })
await raster(192, 'icons/icon-192.png')
await raster(512, 'icons/icon-512.png')

// favicon.ico: a real multi resolution container holding 16 and 32.
const pngs = ['favicon-16.png', 'favicon-32.png'].map((f) =>
  readFileSync(`${ROOT}public/${f}`),
)
const sizes = [16, 32]
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0)
header.writeUInt16LE(1, 2) // type: icon
header.writeUInt16LE(pngs.length, 4)
let offset = 6 + 16 * pngs.length
const entries = pngs.map((png, i) => {
  const e = Buffer.alloc(16)
  e.writeUInt8(sizes[i] === 256 ? 0 : sizes[i], 0)
  e.writeUInt8(sizes[i] === 256 ? 0 : sizes[i], 1)
  e.writeUInt8(0, 2)
  e.writeUInt8(0, 3)
  e.writeUInt16LE(1, 4)
  e.writeUInt16LE(32, 6)
  e.writeUInt32LE(png.length, 8)
  e.writeUInt32LE(offset, 12)
  offset += png.length
  return e
})
writeFileSync(
  `${ROOT}public/favicon.ico`,
  Buffer.concat([header, ...entries, ...pngs]),
)

// The OG image: a composed picture of the vertical, not a screenshot.
const og = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await og.goto(`file://${ROOT}scripts/assets/og.html`)
await og.waitForTimeout(500)
await og.screenshot({ path: `${ROOT}public/og.png` })

await browser.close()
console.log('icons: 16, 32, ico (16+32), apple-touch 180, 192, 512, og 1200x630')
