/**
 * Spike Q5 + Q8 (docs/v3/concepts/quality-contract.md section 10). Throwaway harness, no tests.
 *
 * Q5: under `reducedMotion: 'reduce'` plus the harness clamp (CLAMP below), open and close the
 * dialog, sheet, popover and toast. An exit is finished when `document.getAnimations()` is empty
 * and the element is gone from the DOM within 1 s of the close action. Two variants of the same
 * four parts (fixture/app.tsx): `bare` (Base UI with only its enter/exit transitions, so the clamp
 * is the only thing acting) decides `q5.byPart`; `shipped` (src/ui, which also carries
 * `motion-reduce:transition-none`) is reported next to it. A control run without reduced motion
 * proves the harness can see an exit animation at all.
 *
 * Q8: the quality matrix (tests/quality/matrix, BASALT_MATRIX=full cells) is scanned for axe
 * `color-contrast` `incomplete` nodes. Each node's text is made transparent, its text rect is
 * screenshotted, the background is the pixel whose luminance is farthest from the text colour, and
 * the ratio is contrastRatio(text colour, that pixel).
 *
 * Prints ONE JSON object on stdout and exits 0 (0 = the harness ran, not "hypothesis held").
 * Progress goes to stderr.
 */
import { resolve } from 'node:path'
import { AxeBuilder } from '@axe-core/playwright'
import { chromium } from 'playwright-core'
import type { Page } from 'playwright-core'
import { bootMatrix } from '../../../packages/basalt-ui/tests/quality/matrix/harness'
import { routePaths } from '../../../packages/basalt-ui/tests/quality/matrix/routes'

const ROOT = import.meta.dir
const REPO = resolve(ROOT, '../../..')
const log = (msg: string): void => void process.stderr.write(`${msg}\n`)

/** The harness constant under test: what the real clamp in tailwind.css would be. */
const CLAMP = `
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
`

// ── Q5 ──────────────────────────────────────────────────────────────────────────────────────────

const PARTS = ['dialog', 'sheet', 'popover', 'toast'] as const
type Part = (typeof PARTS)[number]
type Variant = 'bare' | 'shipped'

const POPUP: Record<Variant, Record<Part, string>> = {
  bare: {
    dialog: '[data-part="dialog"]',
    sheet: '[data-part="sheet"]',
    popover: '[data-part="popover"]',
    toast: '[data-part="toast"]',
  },
  shipped: {
    dialog: '[data-slot="dialog-content"]',
    sheet: '[data-slot="sheet-content"]',
    popover: '[data-slot="popover-content"]',
    toast: '[data-slot="toast"]',
  },
}
const TOAST_CLOSE: Record<Variant, string> = {
  bare: '[data-part="toast-close"]',
  shipped: '[data-slot="toast-close"]',
}

async function buildFixture(): Promise<{ js: string; css: string }> {
  const built = await Bun.build({
    entrypoints: [resolve(ROOT, 'fixture/app.tsx')],
    target: 'browser',
    define: {
      'process.env': JSON.stringify({ NODE_ENV: 'production' }),
      'import.meta.env': JSON.stringify({ MODE: 'production', DEV: false, PROD: true }),
    },
  })
  if (!built.success) throw new Error(built.logs.map(String).join('\n'))
  const css = Bun.spawnSync(
    [
      resolve(REPO, 'node_modules/.bin/tailwindcss'),
      '--input',
      resolve(ROOT, 'fixture/index.css'),
      '--output',
      '-',
    ],
    { cwd: REPO, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0) throw new Error(`tailwind failed:\n${css.stderr.toString()}`)
  return { js: await built.outputs[0]!.text(), css: css.stdout.toString() }
}

type ExitResult = {
  /** The popup opened and its enter finished. */
  opened: boolean
  /** No animation left and the popup unmounted within 1 s of the close action. */
  exitFinished: boolean
  /** An animation was running at some frame after the close action. */
  sawExitAnimation: boolean
  exitMs: number | null
}

async function measureExit(
  page: Page,
  variant: Variant,
  part: Part,
  close: () => Promise<void>,
): Promise<ExitResult> {
  const popup = POPUP[variant][part]
  await page.click(`[data-open="${part}"]`)
  const opened = await page
    .waitForSelector(popup, { state: 'attached', timeout: 3000 })
    .then(() => true)
    .catch(() => false)
  if (!opened) return { opened, exitFinished: false, sawExitAnimation: false, exitMs: null }
  // Enter finished: the exit is measured from a settled open state.
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => null)))
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  })
  // Armed before the close action so a short exit cannot slip between the click and the sampler.
  await page.evaluate((sel: string) => {
    const w = window as unknown as { exitProbe: { saw: boolean; done: number | null; t0: number } }
    w.exitProbe = { saw: false, done: null, t0: performance.now() }
    const tick = (): void => {
      const e = w.exitProbe
      if (document.getAnimations().length > 0) e.saw = true
      if (
        e.t0 > 0 &&
        document.getAnimations().length === 0 &&
        document.querySelector(sel) === null
      ) {
        e.done ??= performance.now() - e.t0
        return
      }
      if (performance.now() - e.t0 < 1500) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, popup)
  await page.evaluate(() => {
    ;(window as unknown as { exitProbe: { t0: number } }).exitProbe.t0 = performance.now()
  })
  await close()
  await page.waitForTimeout(1200)
  const r = await page.evaluate(
    () => (window as unknown as { exitProbe: { saw: boolean; done: number | null } }).exitProbe,
  )
  const unmounted = (await page.$(popup)) === null
  const idle = await page.evaluate(() => document.getAnimations().length === 0)
  return {
    opened,
    exitFinished: unmounted && idle && r.done !== null && r.done <= 1000,
    sawExitAnimation: r.saw,
    exitMs: r.done === null ? null : Math.round(r.done),
  }
}

async function runQ5() {
  const { js, css } = await buildFixture()
  const server = Bun.serve({
    port: 0,
    fetch(req) {
      const path = new URL(req.url).pathname
      if (path === '/app.js')
        return new Response(js, { headers: { 'content-type': 'text/javascript' } })
      if (path === '/app.css') return new Response(css, { headers: { 'content-type': 'text/css' } })
      return new Response(
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Q5</title><link rel="stylesheet" href="/app.css"><style>${CLAMP}</style></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>`,
        { headers: { 'content-type': 'text/html' } },
      )
    },
  })
  const browser = await chromium.launch({ channel: 'chrome' })
  try {
    type How = 'escape' | 'button'
    const CASES: readonly (readonly [Part, How])[] = [
      ['dialog', 'escape'],
      ['dialog', 'button'],
      ['sheet', 'escape'],
      ['sheet', 'button'],
      ['popover', 'escape'],
      ['toast', 'button'],
    ]
    const run = async (variant: Variant, reducedMotion: 'reduce' | 'no-preference') => {
      const out: Record<string, ExitResult> = {}
      for (const [part, how] of CASES) {
        // The control retries: an exit that Base UI unmounts in the first frame (before the
        // transition starts) shows no animation, and that says nothing about the sampler.
        for (let attempt = 1; attempt <= (reducedMotion === 'reduce' ? 1 : 5); attempt++) {
          const context = await browser.newContext({
            viewport: { width: 1280, height: 800 },
            reducedMotion,
          })
          const page = await context.newPage()
          await page.goto(`http://127.0.0.1:${server.port}/?variant=${variant}`)
          await page.waitForSelector(`[data-open="${part}"]`)
          const close =
            part === 'toast'
              ? () => page.click(TOAST_CLOSE[variant])
              : how === 'button'
                ? () =>
                    page
                      .getByRole('button', { name: /^close$/i })
                      .first()
                      .click()
                : () => page.keyboard.press('Escape')
          const result = await measureExit(page, variant, part, close)
          out[`${part}:${how}`] = result
          log(
            `q5 ${variant} ${reducedMotion} ${part}:${how} #${attempt}: ${JSON.stringify(result)}`,
          )
          await context.close()
          if (result.sawExitAnimation) break
        }
      }
      return out
    }
    const bare = await run('bare', 'reduce')
    const shipped = await run('shipped', 'reduce')
    const control = await run('bare', 'no-preference')
    const every = (r: Record<string, ExitResult>, part: Part, key: keyof ExitResult): boolean =>
      CASES.filter(([p]) => p === part).every(([p, h]) => r[`${p}:${h}`]![key] === true)
    const any = (r: Record<string, ExitResult>, part: Part, key: keyof ExitResult): boolean =>
      CASES.filter(([p]) => p === part).some(([p, h]) => r[`${p}:${h}`]![key] === true)
    const byPart = Object.fromEntries(PARTS.map((p) => [p, every(bare, p, 'exitFinished')]))
    return {
      clampLines: CLAMP.trim().split('\n').length,
      /** Part to exitFinished on every close path (bare Base UI + the clamp alone). */
      byPart,
      /** The same with the parts as src/ui ships them. */
      shippedByPart: Object.fromEntries(PARTS.map((p) => [p, every(shipped, p, 'exitFinished')])),
      /** Without reduced motion, an exit animation was seen on at least one close path of each part. */
      controlSeesExit: Object.fromEntries(
        PARTS.map((p) => [p, any(control, p, 'sawExitAnimation')]),
      ),
      verdict:
        PARTS.every((p) => every(bare, p, 'opened')) && Object.values(byPart).every(Boolean)
          ? 'PASS'
          : 'REFUTED',
    }
  } finally {
    await browser.close()
    server.stop(true)
  }
}

// ── Q8 ──────────────────────────────────────────────────────────────────────────────────────────

type Prep =
  | { status: 'unresolved'; why: string }
  | {
      status: 'ready'
      clip: { x: number; y: number; width: number; height: number }
      fg: [number, number, number]
      alpha: number
      large: boolean
    }

/** In-page: resolves the node, hides its text, returns its text rect and text colour. */
function prepare(selector: string): Prep {
  document.getElementById('q8-hide')?.remove()
  document.querySelector('[data-q8]')?.removeAttribute('data-q8')
  const el = document.querySelector<HTMLElement>(selector)
  if (el === null) return { status: 'unresolved', why: 'node-gone' }
  if (el.closest('video, canvas, iframe')) return { status: 'unresolved', why: 'media' }
  el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' })
  const cs = getComputedStyle(el)
  const clipText =
    cs.backgroundClip === 'text' ||
    (cs as unknown as { webkitBackgroundClip: string }).webkitBackgroundClip === 'text'
  if (clipText) return { status: 'unresolved', why: 'gradient-text' }
  for (const animation of document.getAnimations()) {
    const target = (animation.effect as KeyframeEffect | null)?.target
    if (target instanceof Element && (target.contains(el) || el.contains(target))) {
      return { status: 'unresolved', why: 'animating' }
    }
  }
  const own = el.getBoundingClientRect()
  if (
    (own.width <= 1 && own.height <= 1) ||
    cs.clip === 'rect(0px, 0px, 0px, 0px)' ||
    /inset\(50%\)/.test(cs.clipPath)
  ) {
    return { status: 'unresolved', why: 'visually-hidden' }
  }
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) {
    if ((n.textContent ?? '').trim() === '') continue
    const range = document.createRange()
    range.selectNodeContents(n)
    for (const r of range.getClientRects()) {
      if (r.width <= 0 || r.height <= 0) continue
      left = Math.min(left, r.left)
      top = Math.min(top, r.top)
      right = Math.max(right, r.right)
      bottom = Math.max(bottom, r.bottom)
    }
  }
  if (!Number.isFinite(left)) return { status: 'unresolved', why: 'zero-sized' }
  const x = Math.max(0, Math.floor(left))
  const y = Math.max(0, Math.floor(top))
  const x2 = Math.min(document.documentElement.clientWidth, Math.ceil(right))
  const y2 = Math.min(document.documentElement.clientHeight, Math.ceil(bottom))
  if (x2 - x < 1 || y2 - y < 1) return { status: 'unresolved', why: 'off-screen' }
  for (const [px, py] of [
    [(x + x2) / 2, (y + y2) / 2],
    [x + 1, y + 1],
    [x2 - 1, y2 - 1],
  ] as const) {
    if (
      document
        .elementsFromPoint(px, py)
        .some((e) => e.tagName === 'VIDEO' || e.tagName === 'CANVAS')
    ) {
      return { status: 'unresolved', why: 'media' }
    }
  }
  // The text colour in sRGB, whatever colour space the computed value is written in.
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D
  ctx.clearRect(0, 0, 1, 1)
  const svg = el instanceof SVGElement
  if (svg && (cs.fill === 'none' || cs.fill.startsWith('url('))) {
    return { status: 'unresolved', why: 'svg-paint' }
  }
  ctx.fillStyle = svg ? cs.fill : cs.color
  ctx.fillRect(0, 0, 1, 1)
  const px = ctx.getImageData(0, 0, 1, 1).data
  let opacity = 1
  for (let e: HTMLElement | null = el; e !== null; e = e.parentElement) {
    opacity *= Number(getComputedStyle(e).opacity)
  }
  if (svg) opacity *= Number(cs.fillOpacity)
  const size = parseFloat(cs.fontSize)
  const bold = Number(cs.fontWeight) >= 700
  const style = document.createElement('style')
  style.id = 'q8-hide'
  style.textContent =
    '[data-q8], [data-q8] * { color: transparent !important; fill: transparent !important; stroke: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; text-decoration-color: transparent !important; caret-color: transparent !important; }'
  document.head.append(style)
  el.setAttribute('data-q8', '')
  return {
    status: 'ready',
    clip: { x, y, width: x2 - x, height: y2 - y },
    fg: [px[0]!, px[1]!, px[2]!],
    alpha: ((px[3] ?? 255) / 255) * opacity,
    large: size >= 24 || (bold && size >= 18.66),
  }
}

/** In-page (scratch page): the pixel farthest in luminance from the text colour, and the ratio there. */
async function analyse([dataUrl, fg, alpha]: [string, [number, number, number], number]) {
  const img = new Image()
  img.src = dataUrl
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D
  ctx.drawImage(img, 0, 0)
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  const lin = (v: number): number => {
    const c = v / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const lum = (r: number, g: number, b: number): number =>
    0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  const fgL = lum(fg[0], fg[1], fg[2])
  let best = -1
  let bg: [number, number, number] = [255, 255, 255]
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!
    const g = data[i + 1]!
    const b = data[i + 2]!
    const d = Math.abs(lum(r, g, b) - fgL)
    if (d > best) {
      best = d
      bg = [r, g, b]
    }
  }
  const mixed = [0, 1, 2].map((k) => fg[k]! * alpha + bg[k]! * (1 - alpha)) as [
    number,
    number,
    number,
  ]
  const a = lum(mixed[0], mixed[1], mixed[2])
  const b = lum(bg[0], bg[1], bg[2])
  return { ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), bg }
}

type Sample = {
  fg?: string
  bg?: string
  route: string
  cell: string
  target: string
  ratio: number | null
  large: boolean
  verdict: string
  why?: string
}

const tally = (items: readonly Sample[], key: (s: Sample) => string): Record<string, number> => {
  const out: Record<string, number> = {}
  for (const item of items) out[key(item)] = (out[key(item)] ?? 0) + 1
  return Object.fromEntries(Object.entries(out).toSorted(([a], [b]) => a.localeCompare(b)))
}
const hex = (c: readonly number[]): string =>
  `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`

async function runQ8() {
  const harness = await bootMatrix()
  if (harness === null) throw new Error('Q8 needs Google Chrome')
  const { quality } = await import('../../../packages/basalt-ui/src/testing/quality')
  const scratch = await harness.open({ width: 200, height: 200 })
  await scratch.goto('about:blank')
  const samples: Sample[] = []
  const messages: Record<string, number> = {}
  const DESKTOP = { width: 1800, height: 1200 }
  const PHONE = { width: 390, height: 844 }
  const cells: { size: typeof DESKTOP; scheme: 'light' | 'dark'; pseudo: boolean }[] = [
    ...[DESKTOP, PHONE].flatMap((size) =>
      (['light', 'dark'] as const).map((scheme) => ({ size, scheme, pseudo: false })),
    ),
    { size: PHONE, scheme: 'dark', pseudo: true },
  ]
  try {
    for (const route of routePaths()) {
      for (const cell of cells) {
        const label = `${cell.size.width}x${cell.size.height} ${cell.scheme}${cell.pseudo ? ' pseudo' : ''}`
        const page = await harness.open({
          ...cell.size,
          pointer: cell.size.width <= 600 ? 'coarse' : 'fine',
        })
        try {
          await quality.setScheme(page, cell.scheme)
          await page.goto((cell.pseudo ? harness.pseudoOrigin : harness.origin) + route)
          await page.waitForSelector('[data-slot], main', { timeout: 15_000 })
          await page.evaluate(async () => {
            await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => null)))
          })
          const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze()
          const nodes = results.incomplete.flatMap((r) => r.nodes)
          for (const node of nodes) {
            const data = (node.any[0]?.data ?? {}) as { messageKey?: string | null }
            const key = data.messageKey ?? 'none'
            messages[key] = (messages[key] ?? 0) + 1
            const target = node.target.length === 1 ? String(node.target[0]) : null
            const base = { route, cell: label, target: node.target.map(String).join(' >> ') }
            if (target === null) {
              samples.push({
                ...base,
                ratio: null,
                large: false,
                verdict: 'unresolved',
                why: 'frame-or-shadow',
              })
              continue
            }
            const prep = await page.evaluate(prepare, target)
            if (prep.status === 'unresolved') {
              samples.push({
                ...base,
                ratio: null,
                large: false,
                verdict: 'unresolved',
                why: prep.why,
              })
              continue
            }
            const png = await page.screenshot({ clip: prep.clip, animations: 'disabled' })
            await page.evaluate(() => {
              document.getElementById('q8-hide')?.remove()
              document.querySelector('[data-q8]')?.removeAttribute('data-q8')
            })
            const { ratio, bg } = await scratch
              .evaluate(analyse, [
                `data:image/png;base64,${png.toString('base64')}`,
                prep.fg,
                prep.alpha,
              ] as never)
              .catch(() => ({ ratio: Number.NaN, bg: [0, 0, 0] as [number, number, number] }))
            const need = prep.large ? 3 : 4.5
            samples.push({
              ...base,
              fg: hex(prep.fg),
              bg: hex(bg),
              ratio: Number.isFinite(ratio) ? Math.round(ratio * 100) / 100 : null,
              large: prep.large,
              verdict: !Number.isFinite(ratio) ? 'unresolved' : ratio >= need ? 'pass' : 'fail',
              ...(Number.isFinite(ratio) ? {} : { why: 'analysis-failed' }),
            })
          }
          log(`q8 ${route} ${label}: ${nodes.length} incomplete`)
        } finally {
          await page.context().close()
        }
      }
    }
  } finally {
    await harness.close()
  }
  for (const f of samples.filter((x) => x.verdict === 'fail')) {
    log(
      `q8 fail ${f.route} | ${f.cell} | ${f.target.slice(0, 90)} | ${f.fg} on ${f.bg} = ${f.ratio}${f.large ? ' large' : ''}`,
    )
  }
  const count = (v: string): number => samples.filter((s) => s.verdict === v).length
  const unresolvedWhy: Record<string, number> = {}
  for (const s of samples.filter((x) => x.verdict === 'unresolved')) {
    unresolvedWhy[s.why ?? '?'] = (unresolvedWhy[s.why ?? '?'] ?? 0) + 1
  }
  const fails = samples.filter((s) => s.verdict === 'fail')
  const population = samples.length
  return {
    population,
    belowFiled3694: population < 3694,
    sampled: population - count('unresolved'),
    pass: count('pass'),
    fail: fails.length,
    unresolved: count('unresolved'),
    incompleteCeiling: Math.ceil(population * 1.05),
    byMessageKey: Object.fromEntries(
      Object.entries(messages).toSorted(([a], [b]) => a.localeCompare(b)),
    ),
    unresolvedWhy: Object.fromEntries(
      Object.entries(unresolvedWhy).toSorted(([a], [b]) => a.localeCompare(b)),
    ),
    failsByRoute: tally(fails, (s) => `${s.route} ${s.cell}`),
    failsByColours: tally(fails, (s) => `${s.fg} on ${s.bg} = ${s.ratio}`),
    failures: fails.slice(0, 20),
    verdict: fails.length === 0 ? 'PASS' : 'REFUTED',
  }
}

const only = process.env['SPIKE_ONLY']
const q5 = only === 'q8' ? ({ verdict: 'SKIPPED' } as never) : await runQ5()
const q8 = only === 'q5' ? ({ verdict: 'SKIPPED' } as never) : await runQ8()
const verdict = q5.verdict === 'PASS' && q8.verdict === 'PASS' ? 'PASS' : 'REFUTED'
process.stdout.write(`${JSON.stringify({ q5, q8, verdict })}\n`)
process.exit(0)
