/**
 * Frames of the phone nav (Issues 3205, 3246): `bun apps/playground/scripts/phone-nav-frames.ts [--out <dir>]`.
 *
 * Run AFTER a playground build. Serves `dist/` (scripts/evidence/serve.ts), opens the headless shell
 * with touch on, and shoots the section bar at 390x844 and 430x932, light and dark: at rest (the summed
 * count badge on the Overview section shows), the drawer at its short snap, at its tall snap, in the
 * middle of a drag, in the middle of a switch to another section, with More's sidebar out, and with the
 * keyboard up (a text field focused, the viewport 336 px shorter, as a phone keyboard leaves it). A 34 px
 * home indicator is stood in by `--shell-safe-bottom`. Then one contact sheet: rows are size and scheme,
 * columns are the states. Frames land in `.evidence/phone-nav/`.
 */
import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright-core'
import type { CDPSession, Page } from 'playwright-core'
import { serveDist } from '../../../scripts/evidence/serve'

type State = 'rest' | 'short' | 'tall' | 'drag' | 'switch' | 'more' | 'keyboard'

const ROOT = resolve(import.meta.dir, '../../..')
const outArg = process.argv.indexOf('--out')
const OUT = outArg > 0 ? resolve(process.argv[outArg + 1] ?? '') : join(ROOT, '.evidence/phone-nav')

const SIZES = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
] as const
const SCHEMES = ['light', 'dark'] as const
const KEYBOARD = 336
const HOME_INDICATOR = 34
const STATES: readonly State[] = ['rest', 'short', 'tall', 'drag', 'switch', 'more', 'keyboard']

const LABELS: Record<State, string> = {
  rest: 'rest · badge',
  short: 'drawer, short',
  tall: 'drawer, tall',
  drag: 'mid-drag',
  switch: 'mid-switch',
  more: 'More: the sidebar',
  keyboard: 'keyboard up',
}

/** The spring settles in 500 ms. */
const settle = (page: Page): Promise<void> => page.waitForTimeout(750)

async function touch(
  cdp: CDPSession,
  type: 'touchStart' | 'touchMove' | 'touchEnd',
  x: number,
  y: number,
): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }],
  })
}

/** A finger from (x, y) to (x, y + dy); `hold` keeps it down at the end, for a mid-drag frame. */
async function drag(
  page: Page,
  x: number,
  y: number,
  dy: number,
  hold: boolean,
): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page)
  await touch(cdp, 'touchStart', x, y)
  for (let i = 1; i <= 12; i++) {
    await touch(cdp, 'touchMove', x, y + (dy * i) / 12)
    await page.waitForTimeout(16)
  }
  if (!hold) await touch(cdp, 'touchEnd', x, y + dy)
  return cdp
}

async function grabber(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.locator('[data-slot="shell-phone-grabber"]').boundingBox()
  if (box === null) throw new Error('no grabber')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/** Open the nth section: 0 is Overview (five rows), 1 is Reference (eight, more than the short snap holds). */
async function openSection(page: Page, index: number): Promise<void> {
  await page.click(`[data-slot="shell-phone-bar"] button >> nth=${index}`)
  await page.waitForSelector('[data-slot="shell-phone-sheet"]')
  await settle(page)
}

async function shoot(page: Page, state: State, origin: string): Promise<void> {
  await page.goto(`${origin}${state === 'keyboard' ? '/kit/mobile-nav' : '/'}`)
  await page.waitForSelector('[data-slot="shell-main"]')
  await settle(page)
  if (state === 'short' || state === 'switch') await openSection(page, 0)
  if (state === 'tall' || state === 'drag') await openSection(page, 1)
  if (state === 'tall' || state === 'drag') {
    const at = await grabber(page)
    const cdp = await drag(page, at.x, at.y, state === 'tall' ? -500 : -90, state === 'drag')
    if (state === 'tall') {
      await cdp.detach()
      await settle(page)
    } else {
      // The finger stays down: the frame is the drawer under it. (Left to the context's end.)
      await page.waitForTimeout(100)
    }
  }
  if (state === 'switch') {
    await page.click('[data-slot="shell-phone-bar"] button >> nth=2')
    // Mid-motion: the rows cross-fade and the height eases.
    await page.waitForTimeout(120)
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
const rows: string[][] = []
try {
  for (const size of SIZES) {
    for (const scheme of SCHEMES) {
      const row: string[] = []
      for (const state of STATES) {
        const context = await browser.newContext({
          viewport: size,
          deviceScaleFactor: 2,
          hasTouch: true,
          isMobile: true,
          colorScheme: scheme,
        })
        // No stored scheme: the boot script follows the emulated `colorScheme` (auto).
        await context.addInitScript((inset) => {
          document.documentElement.style.setProperty('--shell-safe-bottom', `${inset}px`)
        }, HOME_INDICATOR)
        const page = await context.newPage()
        await shoot(page, state, server.origin)
        const file = join(OUT, `${state}--${scheme}--${size.width}.png`)
        await page.screenshot({ path: file })
        row.push(file)
        await context.close()
      }
      rows.push(row)
    }
  }
  const sheet = await browser.newContext({
    viewport: { width: 1900, height: 900 },
    deviceScaleFactor: 1,
  })
  const page = await sheet.newPage()
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
    <div style="font-size:20px;font-weight:600;margin-bottom:12px">Section bar with a short drawer</div>
    <div style="display:grid;grid-template-columns:120px repeat(${STATES.length}, 215px);gap:12px;align-items:start">
      <div></div>${STATES.map((s) => `<div style="font-weight:600">${LABELS[s]}</div>`).join('')}
      ${cells.map((row, i) => `<div style="font-weight:600">${labels[i]}</div>${row.map((src) => `<img src="${src}" style="width:215px;border-radius:12px;box-shadow:0 1px 4px #0006">`).join('')}`).join('')}
    </div></body></html>`
  await page.setContent(html)
  await page.waitForTimeout(200)
  await page.screenshot({ path: join(OUT, 'sheet.png'), fullPage: true })
  await sheet.close()
} finally {
  await browser.close()
  server.stop()
}
console.log(`frames in ${OUT}`)
