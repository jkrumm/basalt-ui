/**
 * Frames of the phone nav trial (Issue 3205): `bun apps/playground/scripts/phone-nav-frames.ts [--out <dir>]`.
 *
 * Run AFTER a playground build. Serves `dist/` (scripts/evidence/serve.ts), opens the headless shell
 * with touch on, and shoots the shipped bar and each variant at 390x844 and 430x932, light and dark:
 * at rest (the summed count badge on the Overview section shows), with a section's list open, with
 * More's sidebar out, and with the keyboard up (a text field focused, the viewport 336 px shorter, as a phone keyboard leaves
 * it). A 34 px home indicator is stood in by `--shell-safe-bottom`. Then one contact sheet per
 * variant: rows are size and scheme, columns are the states. Frames land in `.evidence/phone-nav/`.
 */
import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright-core'
import type { Page } from 'playwright-core'
import { serveDist } from '../../../scripts/evidence/serve'

type Variant = 'default' | 'a' | 'b'
type State = 'rest' | 'open' | 'section' | 'more' | 'keyboard'

const ROOT = resolve(import.meta.dir, '../../..')
const outArg = process.argv.indexOf('--out')
const OUT = outArg > 0 ? resolve(process.argv[outArg + 1] ?? '') : join(ROOT, '.evidence/phone-nav')
const only = process.argv.includes('--only')
  ? (process.argv[process.argv.indexOf('--only') + 1] ?? '').split(',')
  : null

const VARIANTS: readonly Variant[] = ['default', 'a', 'b']
const NAMES: Record<Variant, string> = {
  default: 'Shipped tab bar',
  a: 'A · Section bar with a tray',
  b: 'B · Section bar with a short drawer',
}
const SIZES = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
] as const
const SCHEMES = ['light', 'dark'] as const
const KEYBOARD = 336
const HOME_INDICATOR = 34

const STATES: Record<Variant, readonly State[]> = {
  default: ['rest', 'open', 'keyboard'],
  a: ['rest', 'section', 'more', 'keyboard'],
  b: ['rest', 'section', 'more', 'keyboard'],
}

const LABELS: Record<State, string> = {
  rest: 'rest · badge',
  open: 'More open',
  section: 'section open',
  more: 'More: the sidebar',
  keyboard: 'keyboard up',
}

const settle = (page: Page): Promise<void> => page.waitForTimeout(450)

async function shoot(page: Page, variant: Variant, state: State, origin: string): Promise<void> {
  const path = state === 'keyboard' ? '/kit/mobile-nav' : '/'
  await page.goto(`${origin}${path}?nav=${variant}`)
  await page.waitForSelector('[data-slot="shell-main"]')
  await settle(page)
  if (state === 'open') {
    await page.click('[data-slot="shell-tab-bar"] [aria-label^="More"]')
    await settle(page)
  }
  if (state === 'section') {
    await page.click('[data-slot="shell-phone-bar"] button >> nth=0')
    await settle(page)
  }
  if (state === 'more') {
    await page.click('[data-slot="shell-phone-more"]')
    await settle(page)
  }
  if (state === 'keyboard') {
    const field = page.locator('input[aria-label="Try the keyboard"]')
    await field.scrollIntoViewIfNeeded()
    await field.focus()
    const size = page.viewportSize()
    if (size !== null)
      await page.setViewportSize({ width: size.width, height: size.height - KEYBOARD })
    await field.scrollIntoViewIfNeeded()
    await settle(page)
  }
}

const server = serveDist(join(ROOT, 'apps/playground/dist'))
const browser = await chromium.launch({ chromiumSandbox: !process.env['CI'] })
await mkdir(OUT, { recursive: true })
const written: Record<Variant, string[][]> = { default: [], a: [], b: [] }
try {
  for (const variant of VARIANTS) {
    if (only !== null && !only.includes(variant)) continue
    for (const size of SIZES) {
      for (const scheme of SCHEMES) {
        const row: string[] = []
        for (const state of STATES[variant]) {
          const context = await browser.newContext({
            viewport: size,
            deviceScaleFactor: 2,
            hasTouch: true,
            isMobile: true,
            reducedMotion: 'reduce',
            colorScheme: scheme,
          })
          // No stored scheme: the boot script follows the emulated \`colorScheme\` (auto).
          await context.addInitScript((inset) => {
            document.documentElement.style.setProperty('--shell-safe-bottom', `${inset}px`)
          }, HOME_INDICATOR)
          const page = await context.newPage()
          await shoot(page, variant, state, server.origin)
          const file = join(OUT, `${variant}--${state}--${scheme}--${size.width}.png`)
          await page.screenshot({ path: file })
          row.push(file)
          await context.close()
        }
        written[variant].push(row)
      }
    }
  }
  // One contact sheet per variant.
  const sheet = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1,
  })
  const page = await sheet.newPage()
  for (const variant of VARIANTS) {
    const rows = written[variant]
    if (rows.length === 0) continue
    const states = STATES[variant]
    const cells = await Promise.all(
      rows.map((row) =>
        Promise.all(
          row.map(
            async (file) =>
              `data:image/png;base64,${Buffer.from(await Bun.file(file).arrayBuffer()).toString('base64')}`,
          ),
        ),
      ),
    )
    const labels = SIZES.flatMap((size) =>
      SCHEMES.map((scheme) => `${size.width}×${size.height} ${scheme}`),
    )
    const html = `<html><body style="margin:0;padding:24px;background:#888;font:14px system-ui;color:#111">
      <div style="font-size:20px;font-weight:600;margin-bottom:12px">${NAMES[variant]}</div>
      <div style="display:grid;grid-template-columns:120px repeat(${states.length}, 215px);gap:12px;align-items:start">
        <div></div>${states.map((s) => `<div style="font-weight:600">${LABELS[s]}</div>`).join('')}
        ${cells.map((row, i) => `<div style="font-weight:600">${labels[i]}</div>${row.map((src) => `<img src="${src}" style="width:215px;border-radius:12px;box-shadow:0 1px 4px #0006">`).join('')}`).join('')}
      </div></body></html>`
    await page.setContent(html)
    await page.waitForTimeout(200)
    await page.screenshot({ path: join(OUT, `sheet--${variant}.png`), fullPage: true })
  }
  await sheet.close()
} finally {
  await browser.close()
  server.stop()
}
console.log(`frames in ${OUT}`)
