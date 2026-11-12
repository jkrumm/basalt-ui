/**
 * `quality`: the browser-lane assertions the exemplar matrix runs, as functions a consumer points at
 * its own route list (docs/v3/concepts/quality-contract.md sections 4 and 7). Every function takes a
 * structural {@link PageLike}, so a Playwright `Page` fits without this module importing Playwright;
 * `axe` loads `@axe-core/playwright` (an optional peer) by dynamic import, on first use.
 *
 * Each function resolves on success and throws an `Error` that names the offending elements. A
 * failure is one string a person can act on: the selector path, the measurement and the limit.
 */

/** The part of a Playwright `Page` the assertions read. A real `Page` is assignable to it. */
export interface PageLike {
  evaluate(fn: never, arg?: unknown): Promise<unknown>
  addInitScript(fn: never, arg?: unknown): Promise<unknown>
  emulateMedia(options: {
    reducedMotion?: 'reduce' | 'no-preference' | null
    forcedColors?: 'active' | 'none' | null
    media?: 'print' | 'screen' | null
  }): Promise<unknown>
  setViewportSize(size: { width: number; height: number }): Promise<unknown>
  viewportSize(): { width: number; height: number } | null
  keyboard: { press(key: string): Promise<unknown> }
  click(selector: string): Promise<unknown>
  waitForFunction(fn: never, arg?: unknown, options?: { timeout?: number }): Promise<unknown>
  reload(): Promise<unknown>
  url(): string
}

/** Runs `fn` in the page. The one place the structural `never` parameters are widened. */
function run<R, A = undefined>(page: PageLike, fn: (arg: A) => R, arg?: A): Promise<Awaited<R>> {
  return page.evaluate(fn as never, arg) as Promise<Awaited<R>>
}

export type Scheme = 'light' | 'dark'

/** The `basalt:scheme` key the provider and the pre-paint script read (raw string value). */
const SCHEME_KEY = 'basalt:scheme'

/** The scheme each page was told to load in, so every later assertion can prove it got it. */
const expected = new WeakMap<object, Scheme>()

async function expectScheme(page: PageLike): Promise<void> {
  const want = expected.get(page)
  if (want === undefined) return
  try {
    await page.waitForFunction(
      ((scheme: string) => document.documentElement.dataset['theme'] === scheme) as never,
      want,
      { timeout: 5000 },
    )
  } catch {
    const got = await run(page, () => document.documentElement.dataset['theme'] ?? null)
    throw new Error(`quality: expected data-theme="${want}" on <html>, found ${String(got)}`)
  }
}

/**
 * Writes the raw `basalt:scheme` value before the document loads and, once a document is loaded,
 * asserts `<html data-theme>` equals it. Call it before `page.goto`; on an already-loaded page it
 * reloads so the scheme is the one the app booted with, not one flipped afterwards.
 */
async function setScheme(page: PageLike, scheme: Scheme): Promise<void> {
  expected.set(page, scheme)
  await page.addInitScript(
    (([key, value]: [string, string]) => {
      try {
        localStorage.setItem(key, value)
      } catch {
        // storage blocked: the assertion below reports the scheme that actually applied
      }
    }) as never,
    [SCHEME_KEY, scheme],
  )
  if (page.url() !== 'about:blank') {
    await page.reload()
    await expectScheme(page)
  }
}

// ── animations ────────────────────────────────────────────────────────────────────────────────

/** Fading colours are read blended, so every assertion that reads colour waits for this first. */
async function animationsSettled(page: PageLike): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  try {
    await page.waitForFunction((() => document.getAnimations().length === 0) as never, undefined, {
      timeout: 5000,
    })
  } catch {
    const running = await run(page, () =>
      document
        .getAnimations()
        .map((a) => a.constructor.name + ':' + String((a as CSSAnimation).animationName ?? '')),
    )
    throw new Error(
      `quality: ${running.length} animation(s) still running: ${running.slice(0, 5).join(', ')}`,
    )
  }
}

// ── axe ───────────────────────────────────────────────────────────────────────────────────────

export type OverlayKind = 'dialog' | 'sheet' | 'popover' | 'select' | 'menu' | 'toast'

export interface AxeOptions {
  /** Overlays to open and re-scan. A kind with no opener on the page is reported `absent`, not failed. */
  overlays?: readonly OverlayKind[]
  /** `incomplete` results tolerated before the run fails. Default 25. */
  incompleteCeiling?: number
  /** Limits the scan to a CSS selector. Default the whole document. */
  include?: string
}

export interface AxeReport {
  /** axe `incomplete` count for the page scan, for the evidence file. */
  incomplete: number
  /** Per overlay: its `incomplete` count, or `absent` when no opener was found. */
  overlays: Partial<Record<OverlayKind, number | 'absent'>>
}

interface AxeViolation {
  id: string
  impact?: string | null
  help: string
  nodes: { target: unknown[] }[]
}
interface AxeResults {
  violations: AxeViolation[]
  incomplete: unknown[]
}
interface AxeBuilderLike {
  withTags(tags: string[]): AxeBuilderLike
  include(selector: string): AxeBuilderLike
  analyze(): Promise<AxeResults>
}
type AxeBuilderCtor = new (options: { page: unknown }) => AxeBuilderLike

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
/** Landmark rules guard the shell: any impact fails, not only serious or critical. */
const SHELL_RULES = new Set([
  'landmark-one-main',
  'landmark-unique',
  'landmark-no-duplicate-main',
  'landmark-no-duplicate-banner',
  'landmark-no-duplicate-contentinfo',
  'landmark-main-is-top-level',
  'landmark-banner-is-top-level',
  'landmark-complementary-is-top-level',
  'landmark-contentinfo-is-top-level',
  'region',
  'bypass',
])

let axeBuilder: Promise<AxeBuilderCtor> | undefined
function loadAxe(): Promise<AxeBuilderCtor> {
  axeBuilder ??= import('@axe-core/playwright').then(
    (mod) => (mod as unknown as { default: AxeBuilderCtor }).default,
    (error: unknown) => {
      throw new Error(
        'quality.axe needs the optional peer @axe-core/playwright (4.14.x): install it as a dev dependency.',
        { cause: error },
      )
    },
  )
  return axeBuilder
}

async function scan(page: PageLike, label: string, options: AxeOptions): Promise<number> {
  await expectScheme(page)
  await animationsSettled(page)
  const Builder = await loadAxe()
  let builder = new Builder({ page }).withTags(AXE_TAGS)
  if (options.include !== undefined) builder = builder.include(options.include)
  const results = await builder.analyze()
  const failing = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical' || SHELL_RULES.has(v.id),
  )
  if (failing.length > 0) {
    const lines = failing.map(
      (v) =>
        `  ${v.id} (${v.impact ?? 'n/a'}): ${v.help}\n` +
        v.nodes
          .slice(0, 3)
          .map((n) => `    ${n.target.map(String).join(' ')}`)
          .join('\n'),
    )
    throw new Error(`quality.axe: ${failing.length} violation(s) ${label}\n${lines.join('\n')}`)
  }
  const ceiling = options.incompleteCeiling ?? 25
  if (results.incomplete.length > ceiling) {
    throw new Error(
      `quality.axe: ${results.incomplete.length} incomplete results ${label} exceed the ceiling of ${ceiling}`,
    )
  }
  return results.incomplete.length
}

const OPENERS: Record<OverlayKind, string> = {
  dialog: '[data-quality-open~="dialog"], [data-slot="dialog-trigger"]',
  sheet: '[data-quality-open~="sheet"], [data-slot="sheet-trigger"]',
  popover: '[data-quality-open~="popover"], [data-slot="popover-trigger"]',
  select: '[data-quality-open~="select"], [data-slot="select-trigger"]',
  menu: '[data-quality-open~="menu"], [data-slot="menu-trigger"]',
  toast: '[data-quality-open~="toast"]',
}

/** Marks the first visible opener `data-quality-target` (a click by selector must hit exactly one element). */
async function markOpener(page: PageLike, selector: string): Promise<boolean> {
  return run(
    page,
    (sel: string) => {
      document.querySelector('[data-quality-target]')?.removeAttribute('data-quality-target')
      for (const el of document.querySelectorAll<HTMLElement>(sel)) {
        const r = el.getBoundingClientRect()
        if (r.width > 0 && r.height > 0) {
          el.setAttribute('data-quality-target', '')
          return true
        }
      }
      return false
    },
    selector,
  )
}

/**
 * Scans the page with axe (`wcag2a` to `wcag22aa`) under `prefers-reduced-motion: reduce`, after
 * every animation ended. Fails on a serious or critical violation, on a landmark rule at any impact,
 * and when `incomplete` results pass the ceiling; returns the incomplete counts for the evidence
 * file. Each requested overlay is opened through its trigger (`[data-slot="<kind>-trigger"]`, or
 * `[data-quality-open="<kind>"]` for a kind with no trigger such as a toast), scanned open and
 * closed again with Escape.
 */
async function axe(page: PageLike, options: AxeOptions = {}): Promise<AxeReport> {
  const report: AxeReport = { incomplete: await scan(page, 'on the page', options), overlays: {} }
  for (const kind of options.overlays ?? []) {
    const selector = OPENERS[kind]
    if (!(await markOpener(page, selector))) {
      report.overlays[kind] = 'absent'
      continue
    }
    await page.click('[data-quality-target]')
    await page.waitForFunction(
      (() =>
        Array.from(
          document.querySelectorAll<HTMLElement>(
            '[role="dialog"], [role="menu"], [role="listbox"], [role="alertdialog"], [data-slot$="-content"], [data-slot="toast"]',
          ),
        ).some((el) => el.getBoundingClientRect().width > 0)) as never,
      undefined,
      { timeout: 5000 },
    )
    report.overlays[kind] = await scan(page, `with the ${kind} open`, options)
    await page.keyboard.press('Escape')
  }
  return report
}

// ── overflow ──────────────────────────────────────────────────────────────────────────────────

export interface OverflowOptions {
  /** Viewport widths to sweep. Default 320, 390, 768, 1440, 1800. */
  widths?: readonly number[]
}

/**
 * The document never scrolls horizontally: only the main scrollport may (the shell invariant).
 * Sweeps the widths and restores the viewport; the failure names the elements crossing the edge.
 */
async function overflow(page: PageLike, options: OverflowOptions = {}): Promise<void> {
  await expectScheme(page)
  const widths = options.widths ?? [320, 390, 768, 1440, 1800]
  const original = page.viewportSize()
  const failures: string[] = []
  try {
    for (const width of widths) {
      await page.setViewportSize({ width, height: original?.height ?? 900 })
      await run(page, () => new Promise<void>((done) => requestAnimationFrame(() => done())))
      const found = await run(page, () => {
        const root = document.scrollingElement ?? document.documentElement
        if (root.scrollWidth <= document.documentElement.clientWidth + 1) return null
        const names: string[] = []
        for (const el of document.body.querySelectorAll<HTMLElement>('*')) {
          const r = el.getBoundingClientRect()
          if (r.width === 0 || r.right <= document.documentElement.clientWidth + 1) continue
          let clipped = false
          for (let p = el.parentElement; p !== null && p !== document.body; p = p.parentElement) {
            const o = getComputedStyle(p).overflowX
            if (o !== 'visible') {
              clipped = true
              break
            }
          }
          if (!clipped) {
            names.push(
              `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : ''} right=${Math.round(r.right)}`,
            )
          }
          if (names.length === 4) break
        }
        return { scrollWidth: root.scrollWidth, names }
      })
      if (found !== null) {
        failures.push(
          `${width}px: document scrollWidth ${found.scrollWidth} > ${width} (${found.names.join('; ')})`,
        )
      }
    }
  } finally {
    if (original !== null) await page.setViewportSize(original)
  }
  if (failures.length > 0) throw new Error(`quality.overflow:\n  ${failures.join('\n  ')}`)
}

// ── focus ─────────────────────────────────────────────────────────────────────────────────────

export interface WalkOptions {
  /** Tab stops to visit at most. Default 80. */
  max?: number
}

interface Stop {
  name: string
  problems: string[]
}

/** Presses Tab up to `max` times and calls `inspect` in the page on every new focused element. */
async function tabWalk(
  page: PageLike,
  max: number,
  inspect: (el: Element) => string[],
): Promise<{ stops: number; problems: string[] }> {
  const problems: string[] = []
  const seen = new Set<string>()
  let stops = 0
  await run(page, () => {
    ;(document.activeElement as HTMLElement | null)?.blur()
    window.scrollTo(0, 0)
  })
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab')
    const stop = await run(
      page,
      async (fnSource: string) => {
        // A focus ring fades in; read it once the transition ended, not mid-fade.
        await Promise.race([
          Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
          new Promise((done) => setTimeout(done, 400)),
        ])
        const el = document.activeElement
        if (el === null || el === document.body) return null
        const path: string[] = []
        for (let n: Element | null = el; n !== null && path.length < 4; n = n.parentElement) {
          const slot = n.getAttribute('data-slot')
          path.unshift(n.tagName.toLowerCase() + (slot ? `[${slot}]` : ''))
        }
        const name = `${path.join('>')} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 24)}"`
        const fn = new Function(`return (${fnSource})`)() as (e: Element) => string[]
        return { name, problems: fn(el) } satisfies Stop
      },
      inspect.toString(),
    )
    if (stop === null) continue
    if (seen.has(stop.name)) break
    seen.add(stop.name)
    stops++
    for (const p of stop.problems) problems.push(`${stop.name}: ${p}`)
  }
  return { stops, problems }
}

/** The in-page body of {@link ringWalk}; serialised, so it closes over nothing. */
function inspectRing(el: Element): string[] {
  const problems: string[] = []
  const s = getComputedStyle(el)
  const width = parseFloat(s.outlineWidth)
  if (s.outlineStyle === 'none' || s.outlineStyle === 'hidden' || !(width > 0)) {
    return ['no focus outline']
  }
  // `auto` is the browser's own two-tone ring, built to hold contrast on any surface: accepted as is.
  if (s.outlineStyle === 'auto') return []
  if (s.outlineStyle !== 'solid') problems.push(`outline is ${s.outlineStyle}, not solid`)
  if (width < 2) problems.push(`outline ${width}px is thinner than 2px`)
  const parse = (c: string): [number, number, number, number] | null => {
    const m = /rgba?\(([^)]+)\)/.exec(c)
    if (m === null) {
      const probe = document.createElement('canvas').getContext('2d')
      if (probe === null) return null
      probe.fillStyle = 'black'
      probe.fillStyle = c
      const hex = probe.fillStyle
      if (hex.startsWith('#')) {
        const n = parseInt(hex.slice(1), 16)
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1]
      }
      const m2 = /rgba?\(([^)]+)\)/.exec(hex)
      if (m2 === null) return null
      const p2 = (m2[1] ?? '')
        .split(/[ ,/]+/)
        .filter(Boolean)
        .map(Number)
      return [p2[0] ?? 0, p2[1] ?? 0, p2[2] ?? 0, p2[3] ?? 1]
    }
    const p = (m[1] ?? '')
      .split(/[ ,/]+/)
      .filter(Boolean)
      .map(Number)
    return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0, p[3] ?? 1]
  }
  const lum = (c: [number, number, number, number]): number => {
    const f = (v: number): number => {
      const x = v / 255
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
  }
  const ratio = (
    a: [number, number, number, number],
    b: [number, number, number, number],
  ): number => {
    const [hi, lo] = lum(a) >= lum(b) ? [lum(a), lum(b)] : [lum(b), lum(a)]
    return (hi + 0.05) / (lo + 0.05)
  }
  const ring = parse(s.outlineColor)
  if (ring === null) return [...problems, `outline colour ${s.outlineColor} unreadable`]
  if (ring[3] < 1) problems.push(`outline colour ${s.outlineColor} is translucent`)
  // The nearest opaque background above the element is the surface the ring sits on.
  const fill = (e: Element | null): [number, number, number, number] => {
    for (let n = e; n !== null; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor)
      if (c !== null && c[3] > 0.99) return c
    }
    return [255, 255, 255, 1]
  }
  const own = fill(el)
  const surface = fill(el.parentElement)
  // A ring offset from the element sits on the surface; only a flush ring touches the element's own fill.
  const offset = parseFloat(s.outlineOffset) || 0
  const worst =
    offset >= 1 ? ratio(ring, surface) : Math.min(ratio(ring, own), ratio(ring, surface))
  if (worst < 3) problems.push(`outline contrast ${worst.toFixed(2)}:1 is under 3:1`)
  // Clipped: an ancestor that clips overflow cuts the ring (outline + offset) off.
  const reach = width + (parseFloat(s.outlineOffset) || 0)
  const rect = el.getBoundingClientRect()
  for (let p = el.parentElement; p !== null; p = p.parentElement) {
    const ps = getComputedStyle(p)
    if (ps.overflowX === 'visible' && ps.overflowY === 'visible') continue
    const pr = p.getBoundingClientRect()
    if (
      rect.left - reach < pr.left - 0.5 ||
      rect.right + reach > pr.right + 0.5 ||
      rect.top - reach < pr.top - 0.5 ||
      rect.bottom + reach > pr.bottom + 0.5
    ) {
      problems.push(`outline is clipped by ${p.tagName.toLowerCase()}`)
      break
    }
  }
  return problems
}

/**
 * Tabs through every stop: the computed outline is solid (or the browser's own `auto` ring), at least 2px, opaque, at least 3:1 against
 * the element's own fill and the surface under it, and no clipping ancestor cuts it off.
 */
async function ringWalk(page: PageLike, options: WalkOptions = {}): Promise<{ stops: number }> {
  await expectScheme(page)
  const { stops, problems } = await tabWalk(page, options.max ?? 80, inspectRing)
  if (stops === 0) throw new Error('quality.ringWalk: Tab reached no focusable element')
  if (problems.length > 0) throw new Error(`quality.ringWalk:\n  ${problems.join('\n  ')}`)
  return { stops }
}

/** The in-page body of {@link focusNotObscured}. */
function inspectObscured(el: Element): string[] {
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  const r = el.getBoundingClientRect()
  if (r.width === 0 || r.height === 0) return []
  const x = Math.min(Math.max(r.left + r.width / 2, 0), document.documentElement.clientWidth - 1)
  const y = Math.min(Math.max(r.top + r.height / 2, 0), window.innerHeight - 1)
  const hit = document.elementFromPoint(x, y)
  if (hit === null || el.contains(hit) || hit.contains(el)) return []
  return [
    `covered at (${Math.round(x)},${Math.round(y)}) by ${hit.tagName.toLowerCase()}${hit.getAttribute('data-slot') ? `[${hit.getAttribute('data-slot')}]` : ''}`,
  ]
}

/** WCAG 2.4.11: every focused element's centre hit-tests to itself, under sticky chrome included. */
async function focusNotObscured(
  page: PageLike,
  options: WalkOptions = {},
): Promise<{ stops: number }> {
  await expectScheme(page)
  const { stops, problems } = await tabWalk(page, options.max ?? 80, inspectObscured)
  if (stops === 0) throw new Error('quality.focusNotObscured: Tab reached no focusable element')
  if (problems.length > 0) throw new Error(`quality.focusNotObscured:\n  ${problems.join('\n  ')}`)
  return { stops }
}

// ── text spacing ──────────────────────────────────────────────────────────────────────────────

/**
 * WCAG 1.4.12: injects line-height 1.5, letter-spacing 0.12em and word-spacing 0.16em on everything
 * and fails on text that a fixed-size box now clips (`overflow` other than `visible`, content larger
 * than the box, no ellipsis rule).
 */
async function textSpacing(page: PageLike): Promise<void> {
  await expectScheme(page)
  const clipped = await run(page, () => {
    const style = document.createElement('style')
    style.dataset['quality'] = 'text-spacing'
    style.textContent =
      '*{line-height:1.5 !important;letter-spacing:.12em !important;word-spacing:.16em !important}'
    document.head.append(style)
    const names: string[] = []
    const measure = (): void => {
      for (const el of document.body.querySelectorAll<HTMLElement>('*')) {
        const s = getComputedStyle(el)
        if (s.overflowX === 'visible' && s.overflowY === 'visible') continue
        // `sr-only` text is clipped on purpose: it is not on screen to be cut off.
        if (
          (s.position === 'absolute' || s.position === 'fixed') &&
          (s.clip === 'rect(0px, 0px, 0px, 0px)' ||
            /inset\(50%\)/.test(s.clipPath) ||
            (parseFloat(s.width) <= 1 && parseFloat(s.height) <= 1))
        )
          continue
        if (s.textOverflow === 'ellipsis') continue
        if (el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1) continue
        // Only a box that clips its own text: scrollable regions (auto/scroll) are meant to overflow.
        const clips =
          s.overflowX === 'hidden' ||
          s.overflowY === 'hidden' ||
          s.overflowX === 'clip' ||
          s.overflowY === 'clip'
        const hasText = Array.from(el.childNodes).some(
          (n) => n.nodeType === 3 && (n.textContent ?? '').trim() !== '',
        )
        if (clips && hasText) {
          names.push(
            `${el.tagName.toLowerCase()}${el.getAttribute('data-slot') ? `[${el.getAttribute('data-slot')}]` : ''} "${(el.textContent ?? '').trim().slice(0, 24)}" ${el.scrollWidth}x${el.scrollHeight} in ${el.clientWidth}x${el.clientHeight}`,
          )
        }
      }
    }
    const before = (() => {
      style.disabled = true
      measure()
      const base = names.splice(0)
      style.disabled = false
      return new Set(base)
    })()
    measure()
    style.remove()
    return names.filter((n) => !before.has(n))
  })
  if (clipped.length > 0)
    throw new Error(`quality.textSpacing: text clipped\n  ${clipped.slice(0, 8).join('\n  ')}`)
}

/** The assertion set `quality` carries; each resolves on success and throws an `Error` naming the offenders. */
export interface Quality {
  setScheme(page: PageLike, scheme: Scheme): Promise<void>
  axe(page: PageLike, options?: AxeOptions): Promise<AxeReport>
  overflow(page: PageLike, options?: OverflowOptions): Promise<void>
  ringWalk(page: PageLike, options?: WalkOptions): Promise<{ stops: number }>
  focusNotObscured(page: PageLike, options?: WalkOptions): Promise<{ stops: number }>
  textSpacing(page: PageLike): Promise<void>
}

/**
 * ```ts
 * // The browser-lane assertions over a consumer's own route list. Every function takes a Playwright
 * // `Page`; `axe` loads the optional axe-core Playwright peer (4.14.x) on first use.
 * import { quality } from 'basalt-ui/testing'
 * const ROUTES = ['/', '/runs', '/settings'] // your own list, read from your router if it has one
 * for (const route of ROUTES) {
 *   for (const scheme of ['light', 'dark'] as const) {
 *     test(`${route} ${scheme}`, async ({ page }) => {
 *       await quality.setScheme(page, scheme) // before goto: writes basalt:scheme, then asserts data-theme
 *       await page.goto(route)
 *       await quality.axe(page, { overlays: ['dialog', 'menu'] }) // serious/critical fail; returns incomplete
 *       await quality.overflow(page) // 320, 390, 768, 1440, 1800: the document never scrolls sideways
 *       await quality.ringWalk(page) // Tab through every stop: solid ring, 3:1, not clipped
 *       await quality.focusNotObscured(page) // 2.4.11: no focused element sits under sticky chrome
 *       await quality.textSpacing(page) // 1.4.12: nothing clips at line-height 1.5, 0.12em, 0.16em
 *     })
 *   }
 * }
 * ```
 *
 * @useWhen a browser test must prove a route is accessible, never scrolls the document sideways and keeps focus visible and unobscured
 * @neverWhen the test runs in jsdom or happy-dom (these read layout and computed colour), or checks the markup of a single component
 */
export const quality: Quality = Object.freeze({
  setScheme,
  axe,
  overflow,
  ringWalk,
  focusNotObscured,
  textSpacing,
})
