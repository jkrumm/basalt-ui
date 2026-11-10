/**
 * Spike 618 (docs/v3/concepts/tokens-visual.md section 8, S2 and S3). Throwaway harness, no tests.
 *
 *   S2  light `secondary` (raised fill + hairline ring) with and without the ring, rendered at 2x
 *       in Chrome; the pixel column across the control's top edge; `edgeSteps` = steps of 0.02 or
 *       more in relative luminance within 3 css px of the edge.
 *   S3  contrast of the input boundary (`--color-input` = the hairline) against each surface it
 *       can sit on, both schemes.
 *
 * Prints ONE JSON object on stdout and always exits 0 (0 = the harness ran, not "hypothesis held").
 * Progress goes to stderr. Proof shots land in ./shots.
 */
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright-core'
import type { Page } from 'playwright-core'
import {
  contrastRatio,
  hctToHex,
  hexToHct,
  relativeLuminance,
} from '../../../packages/basalt-ui/src/tokens/hct'

type Scheme = 'light' | 'dark'
type Surface = 'canvas' | 'inset' | 'card' | 'raised'
const SCHEMES: readonly Scheme[] = ['light', 'dark']
const SURFACE_NAMES: readonly Surface[] = ['canvas', 'inset', 'card', 'raised']

// tokens-visual.md section 3.3, hex values as written there.
const SURFACES: Record<Scheme, Record<Surface, string>> = {
  light: { canvas: '#f8f4f1', inset: '#fefcfb', card: '#ece9e6', raised: '#ffffff' },
  dark: { canvas: '#23201d', inset: '#282522', card: '#312e2b', raised: '#3c3835' },
}
// Section 3.3: ink T93 dark / T14 light. Hue and chroma are the warm ramp's, taken from canvas.
const INK_TONE: Record<Scheme, number> = { light: 14, dark: 93 }
// Hairline is an ink alpha, 9% light and 8% dark (evidence/self-tokens-theme.md item 7; carried
// as `--vx-hairline` by concepts/static-framework-free.md). Section 3 states no hex for it.
const HAIRLINE_ALPHA: Record<Scheme, number> = { light: 0.09, dark: 0.08 }

const STEP_MIN = 0.02 // S2 rule: a step is >= 0.02 relative luminance
const STEP_REFUTE = 0.04 // S2 rule: REFUTED needs two steps both >= 0.04
const WINDOW_CSS_PX = 3 // S2 rule: within 3 css px of the edge
const SCALE = 2
const BAR = 3.0 // this Issue's conservative reading of SC 1.4.11 (non-text contrast)

const r2 = (n: number): number => Math.round(n * 100) / 100
const r4 = (n: number): number => Math.round(n * 10000) / 10000

const toRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
]
const toHex = (rgb: readonly number[]): string =>
  `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`

function inkFor(scheme: Scheme): string {
  const warm = hexToHct(SURFACES[scheme].canvas)
  return hctToHex({ hue: warm.hue, chroma: warm.chroma, tone: INK_TONE[scheme] })
}

/** `color-mix(in srgb, ink a%, transparent)` painted over `surface`, per 8-bit channel. */
function over(surface: string, scheme: Scheme, alpha = HAIRLINE_ALPHA[scheme]): string {
  const ink = toRgb(inkFor(scheme))
  const bg = toRgb(surface)
  return toHex(bg.map((c, i) => alpha * (ink[i] ?? 0) + (1 - alpha) * c))
}

/** Smallest ink alpha whose boundary reaches BAR against `surface` (informational). */
function alphaForBar(surface: string, scheme: Scheme): number {
  let lo = 0
  let hi = 1
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (contrastRatio(over(surface, scheme, mid), surface) >= BAR) hi = mid
    else lo = mid
  }
  return r4(hi)
}

// ── S3 ────────────────────────────────────────────────────────────────────────────────────────

function measureS3() {
  const bySurface = {} as Record<Scheme, Record<Surface, number>>
  const alphaNeeded = {} as Record<Scheme, Record<Surface, number>>
  for (const scheme of SCHEMES) {
    bySurface[scheme] = {} as Record<Surface, number>
    alphaNeeded[scheme] = {} as Record<Surface, number>
    for (const name of SURFACE_NAMES) {
      const surface = SURFACES[scheme][name]
      bySurface[scheme][name] = r2(contrastRatio(over(surface, scheme), surface))
      alphaNeeded[scheme][name] = alphaForBar(surface, scheme)
    }
  }
  const min = (scheme: Scheme): number => Math.min(...Object.values(bySurface[scheme]))
  return { light: min('light'), dark: min('dark'), bySurface, alphaFor3: alphaNeeded }
}

// ── S2 ────────────────────────────────────────────────────────────────────────────────────────

const TOP = 40 // css px, integer so the edge snaps to the device grid
const LEFT = 40

function s2Html(scheme: Scheme, surfaceName: Surface, ring: boolean): string {
  const surface = SURFACES[scheme][surfaceName]
  const raised = SURFACES[scheme].raised
  const hairline = `color-mix(in srgb, ${inkFor(scheme)} ${HAIRLINE_ALPHA[scheme] * 100}%, transparent)`
  return `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;background:${surface}}
button{position:absolute;left:${LEFT}px;top:${TOP}px;width:120px;height:32px;border:0;padding:0;
  border-radius:6px;background:${raised};${ring ? `box-shadow:0 0 0 1px ${hairline};` : ''}}
</style><button type="button"></button>`
}

type Probe = {
  rows: number[]
  steps: number[]
  ringPixel: string
  fillPixel: string
  surfacePixel: string
}

async function readColumn(
  page: Page,
  png: Buffer,
  x: number,
  y0: number,
  y1: number,
): Promise<string[]> {
  const rgb = await page.evaluate(
    async ({ b64, x, y0, y1 }) => {
      const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob()
      const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none' })
      const ctx = new OffscreenCanvas(bmp.width, bmp.height).getContext('2d')
      if (!ctx) throw new Error('no 2d context')
      ctx.drawImage(bmp, 0, 0)
      const out: number[][] = []
      for (let y = y0; y <= y1; y++)
        out.push(Array.from(ctx.getImageData(x, y, 1, 1).data.slice(0, 3)))
      return out
    },
    { b64: png.toString('base64'), x, y0, y1 },
  )
  return rgb.map(toHex)
}

async function probeEdge(
  page: Page,
  scheme: Scheme,
  surface: Surface,
  ring: boolean,
): Promise<Probe> {
  await page.setContent(s2Html(scheme, surface, ring))
  const png = await page.screenshot()
  const edge = TOP * SCALE // first device row of the fill
  const half = (WINDOW_CSS_PX * SCALE) / 2 // window centred on the edge: 3 css px = 6 device rows
  const y0 = edge - half
  const y1 = edge + half - 1
  const col = await readColumn(page, png, (LEFT + 60) * SCALE, y0, y1)
  const lum = col.map(relativeLuminance)
  const steps: number[] = []
  for (let i = 1; i < lum.length; i++) {
    const d = Math.abs((lum[i] ?? 0) - (lum[i - 1] ?? 0))
    if (d >= STEP_MIN) steps.push(r4(d))
  }
  return {
    rows: lum.map(r4),
    steps,
    surfacePixel: col[0] ?? '',
    ringPixel: col[half - 1] ?? '', // the device row directly above the fill
    fillPixel: col[half] ?? '',
  }
}

async function measureS2(page: Page) {
  const scheme: Scheme = 'light'
  const bySurface: Record<string, unknown> = {}
  for (const name of ['canvas', 'inset', 'card'] as const) {
    const withRing = await probeEdge(page, scheme, name, true)
    const without = await probeEdge(page, scheme, name, false)
    bySurface[name] = {
      edgeSteps: withRing.steps.length,
      edgeStepsWithoutRing: without.steps.length,
      stepSizes: withRing.steps,
      stepSizesWithoutRing: without.steps,
      renderedRingPixel: withRing.ringPixel,
      expectedRingPixel: over(SURFACES[scheme][name], scheme),
    }
  }
  // Headline surface: card, the home of control bands and the only one where the fill step and
  // the ring step are both real (raised 100 over card 92.5). Chosen before measuring.
  const card = SURFACES[scheme].card
  const withRing = await probeEdge(page, scheme, 'card', true)
  const without = await probeEdge(page, scheme, 'card', false)
  const ring = withRing.ringPixel
  const insetHairline = over(SURFACES[scheme].inset, scheme)
  return {
    surface: 'card',
    ringVsSurface: r2(contrastRatio(ring, card)),
    // The other hairline a control meets on a card: the Inset's own, drawn over inset.
    ringVsHairline: r2(contrastRatio(ring, insetHairline)),
    edgeSteps: withRing.steps.length,
    edgeStepsWithoutRing: without.steps.length,
    stepSizes: withRing.steps,
    rowsWithRing: withRing.rows,
    rowsWithoutRing: without.rows,
    renderedRingPixel: ring,
    expectedRingPixel: over(card, scheme),
    bySurface,
  }
}

function s2Verdict(steps: readonly number[]): 'PASS' | 'REFUTED' | 'owner-eye' {
  if (steps.length <= 1) return 'PASS'
  const [a = 0, b = 0] = steps.toSorted((x, y) => y - x)
  return a >= STEP_REFUTE && b >= STEP_REFUTE ? 'REFUTED' : 'owner-eye'
}

// ── Proof shots ───────────────────────────────────────────────────────────────────────────────

function shotHtml(scheme: Scheme): string {
  const s = SURFACES[scheme]
  const ink = inkFor(scheme)
  const hair = `color-mix(in srgb, ${ink} ${HAIRLINE_ALPHA[scheme] * 100}%, transparent)`
  const panel = (name: Surface): string => `<section style="background:${s[name]}">
  <h2>${name} ${s[name]}</h2>
  <div class="row">
    <span class="ctl ring">secondary + ring</span>
    <span class="ctl">secondary, no ring</span>
    <span class="inp">input, hairline ${contrastRatio(over(s[name], scheme), s[name]).toFixed(2)}:1</span>
  </div></section>`
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
html,body{margin:0;background:${s.canvas};color:${ink};font:13px/1.4 system-ui,sans-serif}
main{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:0}
section{padding:24px}h2{margin:0 0 14px;font-size:12px;font-weight:600}
.row{display:flex;flex-wrap:wrap;gap:14px;align-items:center}
.ctl{display:inline-flex;align-items:center;height:32px;padding:0 14px;border-radius:6px;background:${s.raised}}
.ctl.ring{box-shadow:0 0 0 1px ${hair}}
.inp{display:inline-flex;align-items:center;height:32px;padding:0 12px;border-radius:6px;box-shadow:inset 0 0 0 1px ${hair}}
</style><main>${SURFACE_NAMES.map(panel).join('')}</main>`
}

async function shoot(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  dir: string,
): Promise<string[]> {
  const written: string[] = []
  const viewports = [
    { label: '1800x1200', width: 1800, height: 1200 },
    { label: '390x844', width: 390, height: 844 },
  ]
  for (const vp of viewports) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: SCALE,
    })
    const page = await ctx.newPage()
    for (const scheme of SCHEMES) {
      await page.setContent(shotHtml(scheme))
      const file = `${dir}/${scheme}-${vp.label}.png`
      await page.screenshot({ path: file })
      written.push(file)
    }
    await ctx.close()
  }
  return written
}

// ── Main ──────────────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const shotsDir = resolve(import.meta.dirname, 'shots')
  mkdirSync(shotsDir, { recursive: true })

  const browser = await chromium.launch({ channel: 'chrome' })
  try {
    const ctx = await browser.newContext({
      viewport: { width: 240, height: 120 },
      deviceScaleFactor: SCALE,
    })
    const page = await ctx.newPage()
    const s2 = await measureS2(page)
    await ctx.close()
    const s3 = measureS3()
    const shots = await shoot(browser, shotsDir)
    process.stderr.write(`[token-surfaces] ${shots.length} shots in ${shotsDir}\n`)

    const s2Result = s2Verdict(s2.stepSizes)
    const s3Result = s3.light >= BAR && s3.dark >= BAR ? 'PASS' : 'REFUTED'
    const verdict =
      s2Result === 'REFUTED' || s3Result === 'REFUTED'
        ? 'refuted'
        : s2Result === 'PASS' && s3Result === 'PASS'
          ? 'pass'
          : 'pending'

    const ink = { light: inkFor('light'), dark: inkFor('dark') }
    process.stdout.write(
      `${JSON.stringify({
        verdict,
        s2: { ...s2, verdict: s2Result },
        s3: { ...s3, bar: BAR, verdict: s3Result },
        inputs: { surfaces: SURFACES, ink, hairlineAlpha: HAIRLINE_ALPHA },
        shots: shots.map((f) => f.slice(shotsDir.length + 1)),
      })}\n`,
    )
  } finally {
    await browser.close()
  }
}

await main()
