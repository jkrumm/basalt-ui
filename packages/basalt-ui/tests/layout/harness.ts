/**
 * Real-browser layout harness — build the fixture, serve it, drive Chrome, measure boxes, assert.
 *
 * WHY THIS EXISTS. `bun test` runs on happy-dom, whose `getBoundingClientRect()` is literally
 * `return new DOMRect()` (`happy-dom/lib/nodes/element/Element.js`) and whose `offsetWidth` /
 * `offsetHeight` are hard-coded `0`. Its `getComputedStyle` is a cascade resolver, not a layout
 * engine — it echoes an authored `height: 40px` and returns `''` for a width that needs layout.
 * That is worse than no coverage: a test can LOOK like it asserts a box and assert nothing. 1889
 * green happy-dom tests is exactly how a full-viewport bottom sheet shipped.
 *
 * SCOPE DISCIPLINE. Geometry, overflow, computed box, viewport-driven state. Nothing else.
 * `src/shell/mobile-nav-model.test.ts` already pins the projection law (13 pure tests) and
 * `src/shell/app-mobile-nav.test.tsx` the interaction sequence (11 RTL tests). Re-testing either
 * here buys nothing and costs a browser.
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright-core'
import type { Browser, Page } from 'playwright-core'
import type { FixtureSpec } from './fixture/spec'

// ── Selectors ─────────────────────────────────────────────────────────────────────────────────

/**
 * Mantine's static class names (`mantine-<Component>-<selector>`). Already relied on inside
 * `app-mobile-nav.module.css`, so this is not new coupling. A Mantine rename fails as an explicit
 * `LAYOUT: no element matched …` rather than as a silent pass — the right failure mode, but it
 * does mean a Mantine major touches this block.
 */
export const BAR = 'nav[aria-label="Primary"]'
export const BAR_SLOTS = `${BAR} > *`
export const SHEET = '.mantine-Drawer-content'
/**
 * SCOPED to the drawer ON PURPOSE. The desktop sidebar is still mounted (merely hidden) below the
 * `sm` breakpoint: measured, a 7-row sheet yields 7 rows scoped and **15** unscoped. An unscoped
 * row query silently measures sidebar rows and every touch-target assertion goes vacuous.
 */
export const SHEET_ROWS = `${SHEET} .mantine-NavLink-root`
export const SHEET_BODY = `${SHEET} .mantine-ScrollArea-viewport`
export const MENU = '.mantine-Menu-dropdown'
/**
 * The ACTIVE PILL. It is the slot's icon span — the pill is that span's own background, which is
 * why an icon-less consumer used to get a 24x4px dash instead of an indicator. `> span` is a
 * direct child, so it never matches the nested unread dot, and the label renders as a `<p>`.
 */
export const ACTIVE_PILL = `${BAR} [data-active] > span`
/** The glyph inside the active pill — the bar normalizes it to the icon-size token. */
export const ACTIVE_PILL_ICON = `${ACTIVE_PILL} > svg`
export const CONTENT_END = '[data-testid="content-end"]'

/** A bar slot by accessible name — `aria-label={slot.label}` on both link and surface tabs. */
export function tab(label: string): string {
  return `${BAR} [aria-label="${label}"]`
}

const OVERLAY_SELECTORS = [
  '.mantine-Drawer-root',
  '.mantine-Modal-root',
  '.mantine-Menu-dropdown',
  '.mantine-Popover-dropdown',
  '[role="dialog"]',
] as const

// ── Types ─────────────────────────────────────────────────────────────────────────────────────

export type Viewport = { readonly name: string; readonly width: number; readonly height: number }

export const PHONE: Viewport = { name: 'iPhone 14', width: 390, height: 844 }
export const PHONE_SMALL: Viewport = { name: 'iPhone SE', width: 320, height: 568 }

export type Box = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly left: number
}

/** A box that knows what it is, so a failure can print a readable scene. */
export type Named = { readonly name: string; readonly box: Box }
export type ScrollInfo = { readonly scrollHeight: number; readonly clientHeight: number }
export type OverlayCensus = {
  readonly counts: Readonly<Record<string, number>>
  readonly bodyOverflow: string
}

export type LayoutPage = {
  readonly viewport: Viewport
  /** Escape hatch to the raw Playwright page for anything this API does not cover. */
  readonly raw: Page
  box(name: string, selector: string): Promise<Named>
  boxes(selector: string): Promise<Box[]>
  count(selector: string): Promise<number>
  /** A RESOLVED computed-style property — the only way to observe a cascade-layer outcome. */
  computed(selector: string, property: string): Promise<string>
  /** `'page'` measures `document.scrollingElement`. */
  scroll(selector: string): Promise<ScrollInfo>
  census(): Promise<OverlayCensus>
  navigations(): Promise<string[]>
  tap(selector: string): Promise<void>
  waitFor(selector: string): Promise<void>
  dismiss(): Promise<void>
  scrollToEnd(): Promise<void>
  settle(): Promise<void>
  /**
   * Waits for the DOM to go quiet (no mutation for 50ms) instead of a fixed sleep — the only
   * correct way to guard a NEGATIVE assertion ("no overlay mounted"). A tap already resolves once
   * its own settle() frames land, but an overlay that mounts LATER (Floating UI positions on its
   * own effect, off the tap's call stack) needs the page to say "nothing is changing anymore",
   * not a guessed duration. `timeoutMs` is a hard ceiling so a runaway mutation loop can't hang
   * the suite — it always resolves by then even if the DOM never settles.
   */
  quiesce(timeoutMs?: number): Promise<void>
  remount(spec: FixtureSpec): Promise<void>
  bounds(): Named
}

// ── Build + serve + launch ────────────────────────────────────────────────────────────────────

const FIXTURE_ENTRY = new URL('./fixture/main.tsx', import.meta.url).pathname
const FIXTURE_HTML = new URL('./fixture/index.html', import.meta.url).pathname

let browser: Browser | null = null
let server: ReturnType<typeof Bun.serve> | null = null
let outDir = ''
let origin = ''

/**
 * Ad-hoc documents served beside the fixture, keyed by path.
 *
 * `FIXTURE_HTML` is fixed, and one thing this suite has to measure is a `<head>` that
 * `basaltAppPlugin` composed — an anti-FOUC rule's cascade position is a property of the DOCUMENT,
 * not of a component, and `page.addStyleTag()` appends at the END of head, which is a different
 * cascade position and would prove nothing.
 */
const extraDocuments = new Map<string, string>()

/** Registers `html` at its own path and returns it, for `openFixture`'s `documentPath`. */
export function serveDocument(html: string): string {
  const path = `/doc-${extraDocuments.size}.html`
  extraDocuments.set(path, html)
  return path
}

/** The fixture shell verbatim — the base a probe document mutates. */
export function fixtureHtml(): Promise<string> {
  return Bun.file(FIXTURE_HTML).text()
}

/**
 * How long the whole boot — bundle, serve, launch Chrome — may take before it is called a hang.
 *
 * NOT a performance assertion; a hang detector that says something. MEASURED: the cold boot is
 * ~0.4 s locally and ~4.4 s on a GitHub runner (the first file pays the cold disk and the JIT; a
 * second file in the same process boots warm in ~0.2 s / ~1.5 s). 60 s is the budget
 * `bunfig.toml` already grants a single test, and ~14x the slowest boot observed here.
 *
 * It exists because the previous number was Bun's UNDECLARED 5000 ms `beforeAll` default, which
 * the cold boot had quietly been running at 87% of. A runner half a second slower than usual
 * crossed it and the suite reported `(fail) (unnamed)` — a number, no phase, no cause.
 */
const BOOT_BUDGET_MS = 60_000

type BootPhase = 'bundling the fixture' | 'serving the fixture' | 'launching Chrome'

let phase: BootPhase = 'bundling the fixture'

/**
 * Invalidation token. Both layout files share THIS module — `bun test` runs them in one process —
 * so a boot that was abandoned (watchdog fired, or Bun killed its Chrome as a dangling process)
 * must never publish or tear down state that by then belongs to the NEXT file.
 *
 * Not hypothetical. That is exactly how a single 5001 ms `beforeAll` timeout in
 * `boot-color-scheme` turned into 13 `ERR_CONNECTION_REFUSED` failures in `mobile-nav`: the
 * abandoned launch rejected late, its cleanup ran over the module-level `server` — which by then
 * was the other file's live one — and every subsequent test blamed the network.
 */
let generation = 0

async function buildFixture(dir: string): Promise<void> {
  const build = await Bun.build({
    entrypoints: [FIXTURE_ENTRY],
    outdir: dir,
    naming: '[name].[ext]',
    target: 'browser',
    // basalt source reads `process.env["NODE_ENV"]` in BRACKET form, which Bun's
    // `--define process.env.NODE_ENV=…` does NOT match. Defining the whole object does; verified,
    // zero `process.env` references survive. Without this the page dies at boot with
    // "process is not defined" and every selector below returns null for a reason that has nothing
    // to do with layout.
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success) {
    for (const log of build.logs) {
      // oxlint-disable-next-line no-console -- silence on failure is the worst output for a gate
      console.error(String(log))
    }
    throw new Error('FAILED: the layout fixture did not build — bundler logs above.')
  }
}

/**
 * The boot itself. Everything it creates stays in LOCALS until Chrome is up and this boot is still
 * the current one — so a failed or abandoned boot disposes of its own resources and cannot reach
 * the module-level state another file is using.
 */
async function bootLayoutSuite(gen: number): Promise<boolean> {
  const started = performance.now()

  phase = 'bundling the fixture'
  const dir = await mkdtemp(join(tmpdir(), 'basalt-layout-'))
  await buildFixture(dir)
  const bundled = performance.now()

  phase = 'serving the fixture'
  const html = await Bun.file(FIXTURE_HTML).text()
  const local = Bun.serve({
    port: 0, // ephemeral — parallel bun test files never collide
    async fetch(request) {
      const path = new URL(request.url).pathname
      if (path === '/') return new Response(html, { headers: { 'content-type': 'text/html' } })
      if (path === '/favicon.ico') return new Response(null, { status: 204 })
      const extra = extraDocuments.get(path)
      if (extra !== undefined) {
        return new Response(extra, { headers: { 'content-type': 'text/html' } })
      }
      const file = Bun.file(join(dir, path))
      if (!(await file.exists())) return new Response(`not built: ${path}`, { status: 404 })
      return new Response(file)
    },
  })
  const served = performance.now()

  const discard = async (chrome?: Browser): Promise<void> => {
    await chrome?.close()
    local.stop(true)
    await rm(dir, { recursive: true, force: true })
  }

  phase = 'launching Chrome'
  let chrome: Browser
  try {
    chrome = await chromium.launch({
      // playwright-core's own per-platform table resolves `/opt/google/chrome/chrome` on linux —
      // exactly what ubuntu-latest's Chrome .deb installs — and the .app bundle on darwin. NOTHING
      // is ever downloaded. Use the channel, not `executablePath`, which Playwright documents as
      // "at your own risk".
      channel: 'chrome',
      // Ubuntu 24.04 on the runner blocks unprivileged user namespaces and the image sets no
      // `apparmor_restrict_unprivileged_userns=0`, which is the classic "no usable sandbox" CI
      // failure. The fixtures are self-authored and served from localhost, so nothing is being
      // protected. Locally the sandbox works, so keep it.
      chromiumSandbox: !process.env['CI'],
    })
  } catch (error) {
    await discard()
    if (process.env['CI']) {
      throw new Error(
        'FAILED: could not launch Google Chrome and CI is set. ubuntu-latest ships ' +
          'google-chrome-stable at /opt/google/chrome/chrome — if this fires, the runner image ' +
          `changed and the layout suite is no longer running.\n${String(error)}`,
        { cause: error },
      )
    }
    // oxlint-disable-next-line no-console -- a skipped gate must announce itself
    console.warn(
      '[layout] SKIPPED — no Google Chrome found. Install it to run the layout regression ' +
        'suite locally (`make layout`); CI runs it regardless.',
    )
    return false
  }

  if (gen !== generation) {
    await discard(chrome)
    return false
  }

  browser = chrome
  server = local
  outDir = dir
  origin = local.url.origin

  const launched = performance.now()
  // oxlint-disable-next-line no-console -- the boot budget is invisible until the day it is blown
  console.error(
    `[layout] booted in ${(launched - started).toFixed(0)}ms ` +
      `(bundle ${(bundled - started).toFixed(0)}ms, serve ${(served - bundled).toFixed(0)}ms, ` +
      `chrome ${(launched - served).toFixed(0)}ms) — budget ${BOOT_BUDGET_MS}ms`,
  )
  return true
}

/**
 * Build, serve, and launch, under an explicit budget. Returns `false` (with a loud warning) when
 * Chrome is missing LOCALLY; throws when `CI` is set. A runner that loses Chrome must go red, not
 * quietly green.
 *
 * CALL THIS AT MODULE TOP LEVEL, never inside `beforeAll` — Bun caps a hook at an undeclared
 * 5000 ms that the cold boot does not reliably fit inside, and reports the overrun as an
 * `(unnamed)` failure that names neither the file nor the phase.
 *
 * The build output lives in `mkdtemp`, never in the repo — VERIFIED: a bundle inside
 * `packages/basalt-ui/` poisons `bun run lint` with hundreds of `no-var`/`no-unused-vars` errors
 * from minified vendor code.
 */
export async function initLayoutSuite(): Promise<boolean> {
  const gen = ++generation
  const boot = bootLayoutSuite(gen)
  // The race owns the outcome; a rejection arriving after the watchdog must not crash the process.
  boot.catch(() => {})

  let watchdogTimer: ReturnType<typeof setTimeout> | undefined
  const watchdog = new Promise<never>((_, reject) => {
    watchdogTimer = setTimeout(() => {
      generation++ // whatever the abandoned boot produces must never be published
      reject(
        new Error(
          `FAILED: the layout suite did not boot within ${BOOT_BUDGET_MS}ms — still ${phase}. ` +
            'Nothing is listening, so every test in this file would have reported ' +
            'ERR_CONNECTION_REFUSED against a server that never came up.',
        ),
      )
    }, BOOT_BUDGET_MS)
  })

  try {
    return await Promise.race([boot, watchdog])
  } finally {
    clearTimeout(watchdogTimer)
  }
}

export async function closeLayoutSuite(): Promise<void> {
  generation++ // anything still booting is abandoned and must not publish over this teardown
  await browser?.close()
  server?.stop(true)
  if (outDir) await rm(outDir, { recursive: true, force: true })
  browser = null
  server = null
  outDir = ''
  origin = ''
  extraDocuments.clear()
}

// ── The page API ──────────────────────────────────────────────────────────────────────────────

export async function openFixture(
  spec: FixtureSpec,
  viewport: Viewport = PHONE,
  documentPath = '/',
): Promise<LayoutPage> {
  // Named here, once, rather than as N identical ERR_CONNECTION_REFUSED stack traces further down.
  // `server` is checked as well as `browser`: a torn-down or abandoned boot leaves nothing
  // listening, and Playwright would blame the network for what is a harness lifecycle bug.
  if (!browser || !server) {
    throw new Error(
      'FAILED: the layout suite is not booted — initLayoutSuite() was not awaited at the top ' +
        'level of this file, it failed, or a previous file tore it down. Every assertion below ' +
        'would have reported ERR_CONNECTION_REFUSED and named nothing.',
    )
  }

  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    // Load-bearing, not cosmetic: MobileNav reads `useReducedMotion()` explicitly and drops the
    // Drawer/Menu transition to duration 0, so a box is FINAL the moment the surface exists. It is
    // also a media query happy-dom cannot express at all (matchMedia pinned to `matches: false`),
    // which is part of the gap this suite closes. The cost: mid-transition geometry is not covered
    // — correct, because layout invariants are about the settled frame.
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => pageErrors.push(error))

  await page.goto(origin + documentPath)
  // NOT `waitForSelector('[data-…="ready"]')` — Playwright's default `state: 'visible'` never
  // resolves for <html>, which cost a 30 s timeout the first time. Wait on the actual precondition.
  await page
    .waitForFunction(() => typeof window.basaltMountFixture === 'function')
    .catch(() => {
      throw new Error(
        'FAILED: the layout fixture never booted.\npage errors: ' +
          `${pageErrors.map(String).join(' | ') || '(none)'}`,
      )
    })

  const settle = () =>
    page.evaluate(
      () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
    )

  const api: LayoutPage = {
    viewport,
    raw: page,
    async box(name, selector) {
      const found = await page.evaluate((sel) => {
        const element = document.querySelector(sel)
        if (!element) return null
        const r = element.getBoundingClientRect()
        return {
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
          top: r.top,
          right: r.right,
          bottom: r.bottom,
          left: r.left,
        }
      }, selector)
      if (!found) {
        throw new Error(
          `LAYOUT: no element matched \`${selector}\` — the component did not render it, or a ` +
            'Mantine upgrade renamed the static class.',
        )
      }
      return { name, box: found as Box }
    },
    boxes: (selector) =>
      page.evaluate(
        (sel) =>
          [...document.querySelectorAll(sel)].map((element) => {
            const r = element.getBoundingClientRect()
            return {
              x: r.x,
              y: r.y,
              width: r.width,
              height: r.height,
              top: r.top,
              right: r.right,
              bottom: r.bottom,
              left: r.left,
            }
          }),
        selector,
      ) as Promise<Box[]>,
    count: (selector) => page.evaluate((s) => document.querySelectorAll(s).length, selector),
    computed: (selector, property) =>
      page.evaluate(
        ([sel, prop]) => {
          const element = document.querySelector(sel)
          if (!element) throw new Error(`LAYOUT: no element matched \`${sel}\``)
          return getComputedStyle(element).getPropertyValue(prop)
        },
        [selector, property] as [string, string],
      ),
    scroll: (selector) =>
      page.evaluate((s) => {
        const element =
          s === 'page' ? document.scrollingElement : (document.querySelector(s) as Element | null)
        if (!element) throw new Error(`LAYOUT: no scroll container matched \`${s}\``)
        return { scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }
      }, selector),
    census: () =>
      page.evaluate(
        (sels) => ({
          counts: Object.fromEntries(sels.map((s) => [s, document.querySelectorAll(s).length])),
          bodyOverflow: getComputedStyle(document.body).overflow,
        }),
        [...OVERLAY_SELECTORS],
      ),
    navigations: () => page.evaluate(() => [...window.basaltNavigations]),
    async tap(selector) {
      await page.tap(selector)
      await settle()
    },
    async waitFor(selector) {
      await page.waitForSelector(selector, { state: 'visible' })
      await settle()
    },
    async dismiss() {
      await page.keyboard.press('Escape')
      await settle()
    },
    async scrollToEnd() {
      await page.evaluate(() => {
        document.scrollingElement?.scrollTo({ top: 1e7, behavior: 'instant' })
      })
      await settle()
    },
    settle,
    quiesce: (timeoutMs = 1000) =>
      page.evaluate(
        (timeout) =>
          new Promise<void>((resolve) => {
            const deadline = Date.now() + timeout
            let lastMutation = Date.now()
            const observer = new MutationObserver(() => {
              lastMutation = Date.now()
            })
            observer.observe(document.body, { childList: true, subtree: true, attributes: true })
            // One resolve() call site: poll every 20ms and settle once either the DOM has been
            // quiet for 50ms or the hard ceiling is reached.
            const poll = () => {
              const now = Date.now()
              if (now - lastMutation >= 50 || now >= deadline) {
                observer.disconnect()
                resolve()
                return
              }
              setTimeout(poll, 20)
            }
            setTimeout(poll, 20)
          }),
        timeoutMs,
      ),
    async remount(next) {
      await page.evaluate((s) => window.basaltMountFixture(s as FixtureSpec), next)
      await settle()
    },
    bounds: () => ({
      name: 'viewport',
      box: {
        x: 0,
        y: 0,
        width: viewport.width,
        height: viewport.height,
        top: 0,
        left: 0,
        right: viewport.width,
        bottom: viewport.height,
      },
    }),
  }

  await api.remount(spec)
  return api
}

// ── Assertions: failures that name the pixel ──────────────────────────────────────────────────

const px = (n: number) => n.toFixed(1).padStart(7)
const line = ({ name, box }: Named) =>
  `  ${name.padEnd(14)} x=${px(box.x)} y=${px(box.y)}  w=${px(box.width)} h=${px(box.height)}` +
  `  top=${px(box.top)} bottom=${px(box.bottom)}`

function fail(
  why: string,
  expected: string,
  actual: string,
  scene: readonly Named[],
  viewport?: Viewport,
): never {
  throw new Error(
    [
      '',
      `LAYOUT INVARIANT VIOLATED — ${why}`,
      '',
      ...scene.map(line),
      viewport ? `  viewport       ${viewport.width}x${viewport.height} (${viewport.name})` : '',
      '',
      `  expected: ${expected}`,
      `  actual:   ${actual}`,
      '',
    ]
      .filter(Boolean)
      .join('\n'),
  )
}

export function expectHeightAtMost(
  target: Named,
  max: number,
  why: string,
  scene: readonly Named[] = [],
  viewport?: Viewport,
): void {
  if (target.box.height <= max) return
  fail(
    why,
    `${target.name}.height <= ${px(max)}`,
    `${target.name}.height = ${px(target.box.height)} (+${px(target.box.height - max)})`,
    [target, ...scene],
    viewport,
  )
}

export function expectHeightAtLeast(target: Named, min: number, why: string): void {
  if (target.box.height >= min) return
  fail(
    why,
    `${target.name}.height >= ${px(min)}`,
    `${target.name}.height = ${px(target.box.height)} (−${px(min - target.box.height)})`,
    [target],
  )
}

/** The literal "hugs its content" law: no dead space between the last painted child and the edge. */
export function expectGapAtMost(
  outer: Named,
  inner: Named,
  edge: 'top' | 'bottom',
  max: number,
  why: string,
  viewport?: Viewport,
): void {
  const gap =
    edge === 'bottom' ? outer.box.bottom - inner.box.bottom : inner.box.top - outer.box.top
  if (gap <= max) return
  fail(
    why,
    `${outer.name}.${edge} − ${inner.name}.${edge} <= ${px(max)}`,
    `gap = ${px(gap)} (+${px(gap - max)} of dead space)`,
    [outer, inner],
    viewport,
  )
}

export function expectFullyInside(target: Named, bounds: Named, why: string, vp?: Viewport): void {
  const t = target.box
  const b = bounds.box
  const breaches = [
    t.top < b.top - 0.5 ? `top ${px(t.top)} < ${px(b.top)}` : '',
    t.bottom > b.bottom + 0.5 ? `bottom ${px(t.bottom)} > ${px(b.bottom)}` : '',
    t.left < b.left - 0.5 ? `left ${px(t.left)} < ${px(b.left)}` : '',
    t.right > b.right + 0.5 ? `right ${px(t.right)} > ${px(b.right)}` : '',
  ].filter(Boolean)
  if (breaches.length === 0) return
  fail(
    why,
    `${target.name} entirely inside ${bounds.name}`,
    breaches.join('; '),
    [target, bounds],
    vp,
  )
}

export function expectScrolls(name: string, info: ScrollInfo, why: string): void {
  if (info.scrollHeight > info.clientHeight + 1) return
  fail(
    why,
    `${name}.scrollHeight > clientHeight`,
    `scrollHeight = ${px(info.scrollHeight)}, clientHeight = ${px(info.clientHeight)}`,
    [],
  )
}

export function expectDoesNotScroll(name: string, info: ScrollInfo, why: string): void {
  if (info.scrollHeight <= info.clientHeight + 1) return
  fail(
    why,
    `${name}.scrollHeight <= clientHeight`,
    `scrollHeight = ${px(info.scrollHeight)}, clientHeight = ${px(info.clientHeight)}`,
    [],
  )
}

/** Diffs an overlay census taken before an interaction against one taken after. */
export function expectNoNewOverlay(before: OverlayCensus, after: OverlayCensus, why: string): void {
  const grew = Object.entries(after.counts)
    .filter(([sel, n]) => n > (before.counts[sel] ?? 0))
    .map(([sel, n]) => `${sel}: ${before.counts[sel] ?? 0} → ${n}`)
  if (after.bodyOverflow === 'hidden' && before.bodyOverflow !== 'hidden') {
    grew.push(`body overflow: ${before.bodyOverflow} → hidden (scroll lock)`)
  }
  if (grew.length === 0) return
  fail(why, 'no overlay node mounted and no scroll lock applied', grew.join('; '), [])
}

/** A synthetic bound for "the area above the bar" — reuses `expectFullyInside`'s scene dump. */
export function above(bar: Named, viewport: Viewport): Named {
  return {
    name: 'above the bar',
    box: {
      x: 0,
      y: 0,
      width: viewport.width,
      height: bar.box.top,
      top: 0,
      left: 0,
      right: viewport.width,
      bottom: bar.box.top,
    },
  }
}

/**
 * Two boxes have the same SIZE (position is deliberately not compared — the caller is asking
 * whether one configuration renders the same shape as another, not in the same place).
 */
export function expectSameSize(a: Named, b: Named, why: string, tolerance = 0.5): void {
  const dw = Math.abs(a.box.width - b.box.width)
  const dh = Math.abs(a.box.height - b.box.height)
  if (dw <= tolerance && dh <= tolerance) return
  fail(
    why,
    `${a.name} and ${b.name} identical in size (±${px(tolerance)})`,
    `width differs by ${px(dw)}, height differs by ${px(dh)}`,
    [a, b],
  )
}

/**
 * A measured series strictly increases. The density defects live here: a value that GROWS is not
 * the same claim as a value that TRACKS density, and a frozen term inside a growing sum hides
 * behind any "is it bigger?" assertion.
 */
export function expectStrictlyIncreasing(
  name: string,
  samples: readonly (readonly [label: string, value: number])[],
  why: string,
): void {
  for (let i = 1; i < samples.length; i++) {
    const [prevLabel, prev] = samples[i - 1]!
    const [label, value] = samples[i]!
    if (value > prev) continue
    fail(
      why,
      `${name} strictly increases: ${prevLabel} < ${label}`,
      samples.map(([l, v]) => `${l} = ${px(v)}`).join(', '),
      [],
    )
  }
}
