/** Per route × scheme × viewport: full-page shot, then every `data-shot` anchor through every state. */
import { join } from 'node:path'

import { finishMeasurement, measureAnchor } from './measure'
import type { Box, PwBrowser, PwContext, PwLocator, PwPage, ShotOptions } from './playwright'
import { PAGE_ANCHOR, SCHEMES, URL_STATES, VIEWPORTS, VIEWPORT_SPECS } from './types'
import type { AnchorMetrics, Scale, Scheme, ShotRecord, ShotState, Viewport } from './types'

const NAV_TIMEOUT_MS = 30_000
const HOVER_TIMEOUT_MS = 5_000
const TOOLTIP_TIMEOUT_MS = 3_000
const TAB_PRESSES = 80
const FOCUS_MARGIN_PX = 8

export type CaptureInput = {
  browser: PwBrowser
  base: string
  routes: readonly string[]
  states: readonly ShotState[]
  pngDir: string
  log: (line: string) => void
}

type PageFacts = { anchors: string[]; declared: string[] }

/** Everything one page visit shares: where the records go and what was already measured. */
type Ctx = {
  page: PwPage
  input: CaptureInput
  route: string
  scheme: Scheme
  viewport: Viewport
  facts: PageFacts
  anchors: AnchorMetrics[]
  shots: ShotRecord[]
  measured: Set<string>
  /** Read on the first page of a context that loads. */
  scale?: Pick<Scale, 'spacing' | 'radius' | 'fontSizes'>
}

type Outcome = {
  name: string
  state: ShotState
  status: ShotRecord['status']
  file?: string
  note?: string
}

const slug = (text: string): string => text.replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '')
const firstLine = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).split('\n')[0] ?? ''
const sel = (name: string): string => `[data-shot=${JSON.stringify(name)}]`
const anchorOf = (c: Ctx, name: string): PwLocator => c.page.locator(sel(name)).first()

/** The state URL: the query goes before any `#fragment`. */
export function withParam(route: string, state: ShotState): string {
  const hash = route.indexOf('#')
  const [path, fragment] = hash < 0 ? [route, ''] : [route.slice(0, hash), route.slice(hash)]
  return `${path}${path.includes('?') ? '&' : '?'}shot-state=${state}${fragment}`
}

/** The rect union of `boxes`, grown by `margin` and clamped to the viewport. */
export function unionClip(boxes: readonly Box[], margin: number, viewport: Viewport): Box {
  const { width, height } = VIEWPORT_SPECS[viewport]
  const left = Math.max(0, Math.min(...boxes.map((b) => b.x)) - margin)
  const top = Math.max(0, Math.min(...boxes.map((b) => b.y)) - margin)
  const right = Math.min(width, Math.max(...boxes.map((b) => b.x + b.width)) + margin)
  const bottom = Math.min(height, Math.max(...boxes.map((b) => b.y + b.height)) + margin)
  return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) }
}

/** One screenshot with the options every shot shares. */
const snap = (
  target: { screenshot(options: ShotOptions): Promise<unknown> },
  path: string,
  extra: { fullPage?: boolean; clip?: Box } = {},
): Promise<unknown> => target.screenshot({ path, animations: 'disabled', caret: 'hide', ...extra })

function record(c: Ctx, { name, state, status, file, note }: Outcome): void {
  const { route, scheme, viewport } = c
  c.shots.push({
    route,
    name,
    scheme,
    viewport,
    state,
    file: file ?? null,
    status,
    ...(note ? { note } : {}),
  })
  if (status === 'error')
    c.input.log(`[shot] ${route} ${name} ${scheme}/${viewport}/${state}: ${note}`)
}

async function load(page: PwPage, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.evaluate('document.fonts.ready.then(() => undefined)')
}

const readFacts = (page: PwPage): Promise<PageFacts> =>
  page.evaluate(`(() => ({
    anchors: [...new Set([...document.querySelectorAll('[data-shot]')].map((e) => e.getAttribute('data-shot')).filter(Boolean))],
    declared: [...document.querySelectorAll('[data-shot-states]')].flatMap((e) => (e.getAttribute('data-shot-states') ?? '').split(/\\s+/)).filter(Boolean),
  }))()`)

/** Brings the anchor into view; throws when it is absent, hidden or off-screen at this viewport. */
async function reveal(anchor: PwLocator): Promise<void> {
  if ((await anchor.count()) === 0) throw new Error('anchor not found')
  await anchor.scrollIntoViewIfNeeded()
  if (!(await anchor.isVisible())) throw new Error('anchor is not visible at this viewport')
}

/**
 * Runs one capture and records it. Metrics are taken after the FIRST successful capture of an
 * anchor, whichever state that is, so `--states hover` still yields them.
 */
async function attempt(
  c: Ctx,
  name: string,
  state: ShotState,
  run: (path: string) => Promise<void>,
  note?: string,
): Promise<void> {
  const file = `${slug(c.route) || 'root'}__${slug(name)}__${c.scheme}__${c.viewport}__${state}.png`
  try {
    await run(join(c.input.pngDir, file))
    if (name !== PAGE_ANCHOR && !c.measured.has(name)) {
      const m = finishMeasurement(await anchorOf(c, name).evaluate(measureAnchor))
      c.anchors.push({ route: c.route, name, scheme: c.scheme, viewport: c.viewport, ...m })
      c.measured.add(name)
    }
    record(c, { name, state, status: 'ok', file: `png/${file}`, ...(note ? { note } : {}) })
  } catch (error) {
    record(c, { name, state, status: 'error', note: firstLine(error) })
  }
}

const skipOnMobile = (c: Ctx, name: string, state: ShotState): boolean => {
  if (c.viewport === 'desktop') return false
  record(c, { name, state, status: 'skipped', note: 'desktop only' })
  return true
}

const restCrop = async (c: Ctx, name: string, path: string): Promise<void> => {
  const anchor = anchorOf(c, name)
  await reveal(anchor)
  await snap(anchor, path)
}

async function captureRest(c: Ctx, name: string): Promise<void> {
  await attempt(c, name, 'rest', (path) => restCrop(c, name, path))
}

async function captureHover(c: Ctx, name: string): Promise<void> {
  if (skipOnMobile(c, name, 'hover')) return
  await attempt(c, name, 'hover', async (path) => {
    const anchor = anchorOf(c, name)
    await reveal(anchor)
    const inner = c.page.locator(`${sel(name)} [data-shot-hover]`).first()
    await ((await inner.count()) > 0 ? inner : anchor).hover({ timeout: HOVER_TIMEOUT_MS })
    await snap(anchor, path)
  })
  await c.page.mouse.move(0, 0)
}

/** Sequential focus from the document top until `:focus-visible` lands inside the anchor. */
async function tabInto(page: PwPage, name: string): Promise<void> {
  await page.evaluate(
    '(() => { document.activeElement?.blur(); window.scrollTo(0, 0); getSelection()?.collapse(document.body, 0) })()',
  )
  const landed = `(() => { const a = document.activeElement; return a != null && a.matches(':focus-visible') && a.closest(${JSON.stringify(sel(name))}) != null })()`
  for (let i = 0; i < TAB_PRESSES; i++) {
    await page.keyboard.press('Tab')
    if (await page.evaluate<boolean>(landed)) return
  }
  throw new Error(`:focus-visible never reached the anchor in ${TAB_PRESSES} Tab presses`)
}

async function captureFocus(c: Ctx, name: string): Promise<void> {
  await attempt(c, name, 'focus', async (path) => {
    const anchor = anchorOf(c, name)
    await reveal(anchor)
    await tabInto(c.page, name)
    const box = await anchor.boundingBox()
    if (!box) throw new Error('anchor has no box')
    await snap(c.page, path, { clip: unionClip([box], FOCUS_MARGIN_PX, c.viewport) })
  })
  await c.page.evaluate('document.activeElement?.blur()')
}

async function captureTooltip(c: Ctx, name: string): Promise<void> {
  if (skipOnMobile(c, name, 'tooltip')) return
  const trigger = c.page.locator(`${sel(name)} [data-shot-tooltip]`).first()
  if ((await trigger.count()) === 0) {
    record(c, {
      name,
      state: 'tooltip',
      status: 'not-declared',
      note: 'no [data-shot-tooltip] in the anchor',
    })
    return
  }
  await attempt(c, name, 'tooltip', async (path) => {
    const anchor = anchorOf(c, name)
    await reveal(anchor)
    await trigger.hover({ timeout: HOVER_TIMEOUT_MS })
    const tip = c.page.locator('[role="tooltip"]').first()
    await tip.waitFor({ state: 'visible', timeout: TOOLTIP_TIMEOUT_MS }).catch(() => {
      throw new Error('no visible [role="tooltip"] after hover')
    })
    const [a, t] = [await anchor.boundingBox(), await tip.boundingBox()]
    if (!a || !t) throw new Error('tooltip or anchor has no box')
    await snap(c.page, path, { clip: unionClip([a, t], FOCUS_MARGIN_PX, c.viewport) })
  })
  await c.page.mouse.move(0, 0)
}

const POINTER_STATES = {
  rest: captureRest,
  hover: captureHover,
  focus: captureFocus,
  tooltip: captureTooltip,
}

/** `empty`/`loading`/`error`: reload with `shot-state=<state>`, re-read the anchors, crop each. */
async function captureUrlState(c: Ctx, state: ShotState): Promise<void> {
  const restNames = c.facts.anchors
  if (!c.facts.declared.includes(state)) {
    for (const name of restNames) {
      record(c, { name, state, status: 'not-declared', note: 'page does not declare this state' })
    }
    return
  }
  let here: PageFacts
  try {
    await load(c.page, c.input.base + withParam(c.route, state))
    here = await readFacts(c.page)
  } catch (error) {
    for (const name of restNames)
      record(c, { name, state, status: 'error', note: `load failed: ${firstLine(error)}` })
    return
  }
  for (const name of new Set([...restNames, ...here.anchors])) {
    if (!here.anchors.includes(name)) {
      record(c, { name, state, status: 'error', note: 'anchor absent in this state' })
      continue
    }
    const note = restNames.includes(name) ? undefined : 'anchor only present in this state'
    await attempt(c, name, state, (path) => restCrop(c, name, path), note)
  }
}

const STEPS = ['xs', 'sm', 'md', 'lg', 'xl']

/** Resolves each custom property to px through a probe's `width`, so `calc()`/`rem` values are read as the page sees them. */
const readScale = (page: PwPage): Promise<Pick<Scale, 'spacing' | 'radius' | 'fontSizes'>> =>
  page.evaluate(`(() => {
    const probe = document.createElement('div')
    probe.style.cssText = 'position:absolute;visibility:hidden'
    document.body.append(probe)
    const root = getComputedStyle(document.documentElement)
    const read = (prefix, keys) => {
      const out = {}
      for (const key of keys) {
        const name = prefix + key
        if (!root.getPropertyValue(name).trim()) continue
        probe.style.width = 'var(' + name + ')'
        const px = parseFloat(getComputedStyle(probe).width)
        if (Number.isFinite(px)) out[key] = Math.round(px * 100) / 100
      }
      return out
    }
    const steps = ${JSON.stringify(STEPS)}
    const result = {
      spacing: read('--mantine-spacing-', steps),
      radius: { ...read('--mantine-radius-', [...steps, 'default']), ...read('--vx-radius-', ['card', 'ctrl']) },
      fontSizes: read('--mantine-font-size-', steps),
    }
    probe.remove()
    return result
  })()`)

async function capturePage(
  args: Omit<Ctx, 'facts' | 'anchors' | 'shots' | 'measured'> & { wantScale: boolean },
) {
  const { wantScale, ...rest } = args
  const c: Ctx = {
    ...rest,
    facts: { anchors: [], declared: [] },
    anchors: [],
    shots: [],
    measured: new Set(),
  }
  const { input, route } = c
  try {
    await load(c.page, input.base + route)
    c.facts = await readFacts(c.page)
    if (wantScale) c.scale = await readScale(c.page)
  } catch (error) {
    record(c, {
      name: PAGE_ANCHOR,
      state: 'rest',
      status: 'error',
      note: `load failed: ${firstLine(error)}`,
    })
    return c
  }
  const usable = c.facts.anchors.filter((n) => slug(n) !== '' && n !== PAGE_ANCHOR)
  for (const name of c.facts.anchors.filter((n) => !usable.includes(n))) {
    record(c, { name, state: 'rest', status: 'error', note: 'unusable data-shot name' })
  }
  c.facts.anchors = usable
  if (usable.length === 0 && c.scheme === 'light' && c.viewport === 'desktop') {
    input.log(`[shot] no data-shot anchors on ${route}`)
  }
  if (input.states.includes('rest')) {
    await attempt(c, PAGE_ANCHOR, 'rest', (path) =>
      snap(c.page, path, { fullPage: true }).then(() => undefined),
    )
  }
  for (const name of usable) {
    for (const [state, capture] of Object.entries(POINTER_STATES)) {
      if (input.states.includes(state as ShotState)) await capture(c, name)
    }
  }
  for (const state of URL_STATES) if (input.states.includes(state)) await captureUrlState(c, state)
  return c
}

/** A fresh context for one scheme × viewport: the colour scheme is set on the context AND in storage before load. */
export async function openContext<C extends PwContext>(
  browser: PwBrowser<C>,
  scheme: Scheme,
  viewport: Viewport,
): Promise<C> {
  const spec = VIEWPORT_SPECS[viewport]
  const context = await browser.newContext({
    viewport: { width: spec.width, height: spec.height },
    deviceScaleFactor: 1,
    isMobile: spec.mobile,
    hasTouch: spec.mobile,
    colorScheme: scheme,
    reducedMotion: 'reduce',
  })
  await context.addInitScript(`localStorage.setItem('mantine-color-scheme-value', '${scheme}')`)
  return context
}

export async function capture(
  input: CaptureInput,
): Promise<{ anchors: AnchorMetrics[]; shots: ShotRecord[]; scale: Scale[] }> {
  const out = { anchors: [] as AnchorMetrics[], shots: [] as ShotRecord[], scale: [] as Scale[] }
  for (const scheme of SCHEMES) {
    for (const viewport of VIEWPORTS) {
      const context = await openContext(input.browser, scheme, viewport)
      try {
        const page = await context.newPage()
        page.setDefaultTimeout(NAV_TIMEOUT_MS)
        let scaled = false
        for (const route of input.routes) {
          const done = await capturePage({
            page,
            input,
            route,
            scheme,
            viewport,
            wantScale: !scaled,
          })
          if (done.scale) {
            out.scale.push({ scheme, viewport, ...done.scale })
            scaled = true
          }
          out.anchors.push(...done.anchors)
          out.shots.push(...done.shots)
        }
      } finally {
        await context.close().catch(() => undefined)
      }
    }
  }
  return out
}
