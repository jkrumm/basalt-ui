/** Per route × scheme × viewport: full-page shot, then every `data-shot` anchor through every state. */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { basename, join } from 'node:path'

import { buildSheet } from './board'
import { SEED_FLAG, seedScript } from './real-data'
import type { Pair } from './real-data'

import { finishMeasurement, measureAnchor } from './measure'
import type { Box, PwBrowser, PwContext, PwLocator, PwPage, ShotOptions } from './playwright'
import { PAGE_ANCHOR, SCHEMES, URL_STATES, VIEWPORTS, VIEWPORT_SPECS } from './types'
import type {
  AnchorMetrics,
  Measurement,
  Scale,
  Scheme,
  ShotRecord,
  ShotState,
  Viewport,
} from './types'

const NAV_TIMEOUT_MS = 30_000
const HOVER_TIMEOUT_MS = 5_000
const TOOLTIP_TIMEOUT_MS = 3_000
const TAB_PRESSES = 80
const FOCUS_MARGIN_PX = 8
const TIP_PROBE_MS = 250
const TIP_SETTLE_MS = 60
const TIP_SETTLE_READS = 10

export type CaptureInput = {
  browser: PwBrowser
  base: string
  routes: readonly string[]
  states: readonly ShotState[]
  pngDir: string
  /** Seeded before any page script runs (values may be secrets: never logged or written). */
  localStorage?: readonly Pair[]
  /** Extra settle in ms after `networkidle`; omitted: none. */
  wait?: number
  /** Drains the proxied calls that failed since the last read (401/403, no answer). */
  apiProblems?: () => string[]
  /** On a page with no `data-shot`, tag each large Card, Paper and table as an anchor. */
  autoAnchors?: boolean
  /** Replaces the in-page measurer (tests). */
  measure?: (anchor: PwLocator) => Promise<Measurement>
  log: (line: string) => void
}

type PageFacts = {
  anchors: string[]
  declared: string[]
  /** Anchor → the URL states it declares itself absent in (`data-shot-absent="empty error"`). */
  absent?: Record<string, string[]>
}

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
  /** What the last visit showed to be wrong about the data itself: a failed seed, a 401/403, no API answer. */
  problems: string[]
  /** Read on the first page of a context that loads. */
  scale?: Steps | undefined
  scaleError?: string | undefined
}

type Outcome = {
  name: string
  state: ShotState
  status: ShotRecord['status']
  file?: string
  note?: string
}

/** Thrown inside a capture when the anchor simply has no such target: recorded `not-declared`, not `error`. */
class NotDeclared extends Error {}

const hash = (text: string): string => createHash('sha1').update(text).digest('hex').slice(0, 6)
const slug = (text: string): string => text.replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '')
const firstLine = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).split('\n')[0] ?? ''
const sel = (name: string): string => `[data-shot=${JSON.stringify(name)}]`
const anchorOf = (c: Ctx, name: string): PwLocator => c.page.locator(sel(name)).first()

/** `<route>-<hash>__<name>-<hash>__…`: the hash of the RAW text keeps `/a/b` and `/a-b` apart. */
export const fileName = (
  route: string,
  name: string,
  scheme: Scheme,
  viewport: Viewport,
  state: ShotState,
): string =>
  `${slug(route) || 'root'}-${hash(route)}__${slug(name)}-${hash(name)}__${scheme}__${viewport}__${state}.png`

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

async function load(page: PwPage, url: string, settle = 0): Promise<void> {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.evaluate('document.fonts.ready.then(() => undefined)')
  if (settle > 0) await new Promise((done) => setTimeout(done, settle))
}

/** Runs in the page: numbers every Card, Paper and table in DOM order, tagging those over 120×60 px as anchors. */
export function tagAutoAnchors(): void {
  const found = document.querySelectorAll('.mantine-Card-root, .mantine-Paper-root, table')
  Array.from(found).forEach((el, i) => {
    const { width, height } = el.getBoundingClientRect()
    if (width > 120 && height > 60)
      el.setAttribute('data-shot', `auto-${String(i + 1).padStart(2, '0')}`)
  })
}

const readFacts = (page: PwPage): Promise<PageFacts> =>
  page.evaluate(`(() => ({
    anchors: [...new Set([...document.querySelectorAll('[data-shot]')].map((e) => e.getAttribute('data-shot')).filter(Boolean))],
    declared: [...document.querySelectorAll('[data-shot-states]')].flatMap((e) => (e.getAttribute('data-shot-states') ?? '').split(/\\s+/)).filter(Boolean),
    absent: Object.fromEntries([...document.querySelectorAll('[data-shot][data-shot-absent]')].map((e) => [e.getAttribute('data-shot'), (e.getAttribute('data-shot-absent') ?? '').split(/\\s+/).filter(Boolean)])),
  }))()`)

const addProblem = (c: Ctx, problem: string): void => {
  if (!c.problems.includes(problem)) c.problems.push(problem)
}

/** Moves the proxied calls that failed since the last read into this page visit's problems. */
const collect = (c: Ctx): void => {
  for (const problem of c.input.apiProblems?.() ?? []) addProblem(c, problem)
}

/**
 * One load of `url`: settle, auto-anchor a page that declares none, read its facts, and collect
 * what is wrong with the data (`c.problems`) so a board never looks fine over a failed login.
 */
async function visit(c: Ctx, url: string): Promise<PageFacts> {
  const { input, page } = c
  await load(page, url, input.wait)
  let facts = await readFacts(page)
  if (input.autoAnchors && facts.anchors.length === 0) {
    await page.evaluate(tagAutoAnchors, undefined)
    facts = await readFacts(page)
  }
  collect(c)
  if (input.localStorage?.length) {
    const failed = await page.evaluate<unknown>(`globalThis.${SEED_FLAG} ?? ''`)
    if (failed === 'origin') {
      input.log(`[shot] ${c.route}: page left the app origin; not seeded`)
    } else if (typeof failed === 'string' && failed !== '') {
      addProblem(c, `localStorage seed failed (${failed})`)
      input.log(`[shot] ${c.route}: localStorage seed failed (${failed})`)
    }
  }
  return facts
}

/**
 * When this page visit's data is untrustworthy, every shot of it (page and anchors, every state)
 * becomes an error carrying the problem; a page shot is added when `rest` was not requested.
 */
function flagProblems(c: Ctx): void {
  if (c.problems.length === 0) return
  const note = c.problems.join('; ')
  for (const shot of c.shots)
    if (shot.status === 'ok') Object.assign(shot, { status: 'error', note })
  if (!c.shots.some((s) => s.name === PAGE_ANCHOR && s.state === 'rest'))
    record(c, { name: PAGE_ANCHOR, state: 'rest', status: 'error', note })
  c.input.log(`[shot] ${c.route} ${c.scheme}/${c.viewport}: ${note}`)
}

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
  const file = fileName(c.route, name, c.scheme, c.viewport, state)
  try {
    await run(join(c.input.pngDir, file))
  } catch (error) {
    const status = error instanceof NotDeclared ? 'not-declared' : 'error'
    record(c, { name, state, status, note: firstLine(error) })
    return
  }
  // The PNG is good: a measurement failure is recorded beside it, never instead of it.
  let notes = note ? [note] : []
  if (name !== PAGE_ANCHOR && !c.measured.has(name)) {
    try {
      const measure =
        c.input.measure ?? ((a: PwLocator) => a.evaluate(measureAnchor).then(finishMeasurement))
      const m = await measure(anchorOf(c, name))
      c.anchors.push({ route: c.route, name, scheme: c.scheme, viewport: c.viewport, ...m })
      c.measured.add(name)
    } catch (error) {
      notes = [...notes, `metrics unavailable: ${firstLine(error)}`]
    }
  }
  record(c, {
    name,
    state,
    status: 'ok',
    file: `png/${file}`,
    ...(notes.length ? { note: notes.join('; ') } : {}),
  })
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

/**
 * Runs in the page: forgets the previous marks, then marks every tooltip that is visible now, so
 * a tooltip another component already holds open is never taken for the one a trigger opens.
 */
export function markVisibleTooltips(): void {
  for (const el of Array.from(document.querySelectorAll('[data-shot-seen]')))
    el.removeAttribute('data-shot-seen')
  for (const el of Array.from(document.querySelectorAll('[role="tooltip"]'))) {
    const rect = el.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== 'hidden')
      el.setAttribute('data-shot-seen', '')
  }
}

/** Runs in the page: the first id a trigger names in `aria-describedby`, looking at it and its descendants. */
export function describedByOf(el: Element | null): string {
  const named = el?.matches('[aria-describedby]') ? el : el?.querySelector('[aria-describedby]')
  return named?.getAttribute('aria-describedby')?.split(/\s+/)[0] ?? ''
}

/** The tooltip the trigger names, else any that was not already visible at the snapshot. */
export const tooltipSelector = (describedBy: string): string =>
  describedBy
    ? `[role="tooltip"][id=${JSON.stringify(describedBy)}]`
    : '[role="tooltip"]:not([data-shot-seen])'

/** `tooltipSelector`, narrowed to a rendered readout: a hidden 0×0 one of another chart never wins `.first()`. */
export const visibleTooltip = (describedBy: string): string =>
  `${tooltipSelector(describedBy)}:visible`

/**
 * Where a trigger is hovered: its centre, or the `data-shot-at="x,y"` fractions of its box when the
 * centre paints no readout (a donut's hole).
 */
export function hoverAtOf(el: Element | null): string {
  return el?.getAttribute('data-shot-at') ?? ''
}

const HOVER_AT = /^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\s*$/

/**
 * Exactly two non-negative numbers, each in [0, 1): 1 is the box's far edge, outside it. Anything else (a missing half, a third
 * field, a value outside the box, a sign) is null, so the trigger is hovered at its centre.
 */
export function parseHoverAt(raw: string): { x: number; y: number } | null {
  const m = HOVER_AT.exec(raw)
  if (!m) return null
  const [x, y] = [Number(m[1]), Number(m[2])]
  return x < 1 && y < 1 ? { x, y } : null
}

export async function hoverTrigger(target: PwLocator): Promise<void> {
  const at = parseHoverAt(String(await target.evaluate(hoverAtOf)))
  const box = at ? await target.boundingBox() : null
  const position = at && box ? { x: at.x * box.width, y: at.y * box.height } : undefined
  await target.hover({ timeout: HOVER_TIMEOUT_MS, ...(position && { position }) })
}

/**
 * The box of the tooltip an action opened, or null when none shows up. Call `markVisibleTooltips`
 * before the action; `describedBy` is the trigger's own tooltip id, when it has one.
 */
async function openTooltipBox(
  c: Ctx,
  describedBy: string,
  timeout = TIP_PROBE_MS,
): Promise<Box | null> {
  const tip = c.page.locator(visibleTooltip(describedBy)).first()
  try {
    await tip.waitFor({ state: 'visible', timeout })
  } catch {
    return null
  }
  // The tooltip animates in: read its box once two reads agree, or the crop clips the final size.
  let box = await tip.boundingBox()
  for (let i = 0; i < TIP_SETTLE_READS; i++) {
    await new Promise((done) => setTimeout(done, TIP_SETTLE_MS))
    const next = await tip.boundingBox()
    const settled = JSON.stringify(next) === JSON.stringify(box)
    box = next
    if (settled) break
  }
  return box
}

const idOf = (value: unknown): string => (typeof value === 'string' ? value : '')

async function captureHover(c: Ctx, name: string): Promise<void> {
  if (skipOnMobile(c, name, 'hover')) return
  await attempt(c, name, 'hover', async (path) => {
    const anchor = anchorOf(c, name)
    await reveal(anchor)
    const inner = c.page.locator(`${sel(name)} [data-shot-hover]`).first()
    const target = (await inner.count()) > 0 ? inner : anchor
    await c.page.evaluate(markVisibleTooltips, undefined)
    await hoverTrigger(target)
    const describedBy = idOf(await target.evaluate(describedByOf))
    const [box, tip] = [await anchor.boundingBox(), await openTooltipBox(c, describedBy)]
    if (!box || !tip) return void (await snap(anchor, path))
    await snap(c.page, path, { clip: unionClip([box, tip], FOCUS_MARGIN_PX, c.viewport) })
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

/**
 * True when Tab can reach the anchor or something in it: a link, an enabled control, a `tabindex`
 * ≥ 0 or editable host, outside any `hidden`/`inert` subtree, and actually rendered. Runs in the page, so it is
 * self-contained.
 */
export function hasFocusTarget(root: Element): boolean {
  const candidates =
    'a[href], button, input:not([type="hidden"]), select, textarea, summary, [tabindex], [contenteditable=""], [contenteditable="true"]'
  return [root, ...Array.from(root.querySelectorAll(candidates))].some(
    (el) =>
      el.matches(candidates) &&
      !el.matches(':disabled') &&
      !el.getAttribute('tabindex')?.startsWith('-') &&
      el.closest('[hidden], [inert]') === null &&
      (typeof el.checkVisibility === 'function'
        ? el.checkVisibility()
        : el.getClientRects().length > 0) &&
      getComputedStyle(el).visibility !== 'hidden',
  )
}

async function captureFocus(c: Ctx, name: string): Promise<void> {
  await attempt(c, name, 'focus', async (path) => {
    const anchor = anchorOf(c, name)
    if (!(await anchor.evaluate(hasFocusTarget)))
      throw new NotDeclared('no focus target in the anchor')
    await reveal(anchor)
    await c.page.evaluate(markVisibleTooltips, undefined)
    await tabInto(c.page, name)
    const box = await anchor.boundingBox()
    if (!box) throw new Error('anchor has no box')
    const focused = idOf(
      await c.page.evaluate(
        () => document.activeElement?.getAttribute('aria-describedby')?.split(/\s+/)[0] ?? '',
        undefined,
      ),
    )
    const tip = await openTooltipBox(c, focused)
    await snap(c.page, path, {
      clip: unionClip(tip ? [box, tip] : [box], FOCUS_MARGIN_PX, c.viewport),
    })
  })
  await c.page.evaluate('document.activeElement?.blur()')
}

async function captureTooltip(c: Ctx, name: string): Promise<void> {
  if (skipOnMobile(c, name, 'tooltip')) return
  const trigger = c.page.locator(`${sel(name)} [data-shot-tooltip]`).first()
  await attempt(c, name, 'tooltip', async (path) => {
    if ((await trigger.count()) === 0) throw new NotDeclared('no [data-shot-tooltip] in the anchor')
    const anchor = anchorOf(c, name)
    await reveal(anchor)
    await c.page.evaluate(markVisibleTooltips, undefined)
    await hoverTrigger(trigger)
    const describedBy = idOf(await trigger.evaluate(describedByOf))
    const t = await openTooltipBox(c, describedBy, TOOLTIP_TIMEOUT_MS)
    if (!t) throw new Error('no visible [role="tooltip"] after hover')
    const a = await anchor.boundingBox()
    if (!a) throw new Error('tooltip or anchor has no box')
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
    here = await visit(c, c.input.base + withParam(c.route, state))
  } catch (error) {
    for (const name of restNames)
      record(c, { name, state, status: 'error', note: `load failed: ${firstLine(error)}` })
    return
  }
  for (const name of new Set([...restNames, ...here.anchors])) {
    if (!here.anchors.includes(name)) {
      // The declaration lives on the element, which is gone in this state: it is read from the rest render.
      const declared = c.facts.absent?.[name]?.includes(state) ?? false
      record(
        c,
        declared
          ? { name, state, status: 'absent', note: 'declared absent in this state' }
          : { name, state, status: 'error', note: 'anchor absent in this state' },
      )
      continue
    }
    const note = restNames.includes(name) ? undefined : 'anchor only present in this state'
    await attempt(c, name, state, (path) => restCrop(c, name, path), note)
  }
}

const STEPS = ['xs', 'sm', 'md', 'lg', 'xl', 'default']

type Steps = Pick<Scale, 'spacing' | 'radius' | 'fontSizes'>
type ScaleRead = { mantine: Steps; vx: Record<string, number> }

/**
 * Runs in the page: Mantine's steps plus every `--vx-space-*`, `--vx-text-*` and `--vx-radius-*`
 * custom property declared by ANY style rule (the root's and each component's own), resolved to px
 * through a probe's `width` so `calc()`/`rem` read as the page sees them. Self-contained: it is
 * serialised into the page.
 */
export function readScaleInPage(steps: string[]): ScaleRead {
  const probe = document.createElement('div')
  probe.style.cssText = 'position:absolute;visibility:hidden'
  document.body.append(probe)
  const root = getComputedStyle(document.documentElement)
  const px = (width: string): number | undefined => {
    probe.style.width = ''
    probe.style.width = width
    const value = parseFloat(getComputedStyle(probe).width)
    return Number.isFinite(value) ? Math.round(value * 100) / 100 : undefined
  }
  const read = (prefix: string): Record<string, number> => {
    const out: Record<string, number> = {}
    for (const key of steps) {
      const name = prefix + key
      const value = root.getPropertyValue(name).trim() ? px(`var(${name})`) : undefined
      if (value !== undefined) out[key] = value
    }
    return out
  }
  const declared = new Map<string, string>()
  const walk = (rules: CSSRuleList): void => {
    for (const rule of Array.from(rules)) {
      if ('cssRules' in rule) walk((rule as CSSGroupingRule).cssRules)
      const style = (rule as CSSStyleRule).style
      if (!style) continue
      for (const name of Array.from(style)) {
        if (/^--vx-(space|text|radius)-/.test(name))
          declared.set(name, style.getPropertyValue(name).trim())
      }
    }
  }
  try {
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        walk(sheet.cssRules)
      } catch {
        // A cross-origin stylesheet's rules throw SecurityError: its tokens are not ours to read.
      }
    }
    const vx: Record<string, number> = {}
    for (const [name, value] of declared) {
      // A token set on the root resolves through the cascade; a component-scoped one only by its text.
      const resolved = root.getPropertyValue(name).trim() ? px(`var(${name})`) : px(value)
      if (resolved !== undefined) vx[name] = resolved
    }
    return {
      mantine: {
        spacing: read('--mantine-spacing-'),
        radius: read('--mantine-radius-'),
        fontSizes: read('--mantine-font-size-'),
      },
      vx,
    }
  } finally {
    probe.remove()
  }
}

/** Sorts the page's `--vx-*` readings into the three kinds; a step of 0 px (or an unresolvable one) is not a step. */
export function groupScale({ mantine, vx }: ScaleRead): Steps {
  const pick = (kind: string): Record<string, number> =>
    Object.fromEntries(
      Object.entries(vx)
        .filter(([name, value]) => name.startsWith(`--vx-${kind}-`) && value > 0)
        .map(([name, value]) => [name.slice(2), value]),
    )
  return {
    spacing: { ...mantine.spacing, ...pick('space') },
    radius: { ...mantine.radius, ...pick('radius') },
    fontSizes: { ...mantine.fontSizes, ...pick('text') },
  }
}

async function capturePage(
  args: Omit<Ctx, 'facts' | 'anchors' | 'shots' | 'measured' | 'problems'> & { wantScale: boolean },
) {
  const { wantScale, ...rest } = args
  const c: Ctx = {
    ...rest,
    facts: { anchors: [], declared: [] },
    anchors: [],
    shots: [],
    measured: new Set(),
    problems: [],
  }
  const { input, route } = c
  input.apiProblems?.() // calls still in flight from an earlier route are not this page's
  try {
    c.facts = await visit(c, input.base + route)
  } catch (error) {
    record(c, {
      name: PAGE_ANCHOR,
      state: 'rest',
      status: 'error',
      note: `load failed: ${firstLine(error)}`,
    })
    return c
  }
  if (wantScale) {
    try {
      c.scale = groupScale(await c.page.evaluate(readScaleInPage, STEPS))
    } catch (error) {
      c.scaleError = firstLine(error)
    }
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
  flagProblems(c)
  for (const name of usable) {
    for (const [state, capture] of Object.entries(POINTER_STATES)) {
      if (!input.states.includes(state as ShotState)) continue
      await capture(c, name)
      collect(c)
    }
  }
  for (const state of URL_STATES) {
    if (!input.states.includes(state)) continue
    await captureUrlState(c, state)
    collect(c)
  }
  flagProblems(c)
  return c
}

/** A fresh context for one scheme × viewport: the colour scheme is set on the context AND in storage before load. */
export async function openContext<C extends PwContext>(
  browser: PwBrowser<C>,
  scheme: Scheme,
  viewport: Viewport,
  seeded: readonly Pair[] = [],
  origin = '',
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
  if (seeded.length > 0) await context.addInitScript(seedScript(seeded, origin))
  return context
}

const SHEET_WIDTH_PX = 2000

/** `<route>-<hash>__<name>-<hash>__sheet.png`: one contact sheet per anchor, beside its crops. */
export const sheetName = (route: string, name: string): string =>
  `${slug(route) || 'root'}-${hash(route)}__${slug(name)}-${hash(name)}__sheet.png`

const dataUri = (path: string): string =>
  `data:image/png;base64,${readFileSync(path).toString('base64')}`

/**
 * One contact sheet per anchor: the board's section for it (every state × scheme × viewport,
 * labelled), rendered in the open browser from the crops already on disk and screenshot whole. A
 * failed sheet is logged and left unlisted — the reviewer treats an anchor without one as unverified.
 */
async function writeSheets(
  input: CaptureInput,
  out: { anchors: AnchorMetrics[]; shots: ShotRecord[] },
): Promise<void> {
  const targets = new Map<string, { route: string; name: string }>()
  for (const s of out.shots) {
    if (s.name !== PAGE_ANCHOR)
      targets.set(`${s.route}\0${s.name}`, { route: s.route, name: s.name })
  }
  if (targets.size === 0) return
  const context = await input.browser.newContext({
    viewport: { width: SHEET_WIDTH_PX, height: 1000 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    colorScheme: 'light',
    reducedMotion: 'reduce',
  })
  try {
    const page = await context.newPage()
    for (const { route, name } of targets.values()) {
      try {
        const shots = out.shots
          .filter((s) => s.route === route && s.name === name)
          .map((s) =>
            s.status === 'ok' && s.file
              ? { ...s, file: dataUri(join(input.pngDir, basename(s.file))) }
              : s,
          )
        await page.setContent(buildSheet(route, name, input.states, shots), { waitUntil: 'load' })
        const file = sheetName(route, name)
        await snap(page, join(input.pngDir, file), { fullPage: true })
        for (const a of out.anchors) {
          if (a.route === route && a.name === name) a.sheet = `png/${file}`
        }
      } catch (error) {
        input.log(`[shot] ${route} ${name}: sheet not written: ${firstLine(error)}`)
      }
    }
  } finally {
    await context.close().catch(() => undefined)
  }
}

export async function capture(input: CaptureInput): Promise<{
  anchors: AnchorMetrics[]
  shots: ShotRecord[]
  scale: Scale[]
  scaleError?: string
}> {
  const out = {
    anchors: [] as AnchorMetrics[],
    shots: [] as ShotRecord[],
    scale: [] as Scale[],
    scaleError: undefined as string | undefined,
  }
  for (const scheme of SCHEMES) {
    for (const viewport of VIEWPORTS) {
      input.apiProblems?.() // a new context starts with a clean queue
      const context = await openContext(
        input.browser,
        scheme,
        viewport,
        input.localStorage,
        new URL(input.base).origin,
      )
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
          if (done.scaleError) out.scaleError = out.scaleError ?? done.scaleError
          out.anchors.push(...done.anchors)
          out.shots.push(...done.shots)
        }
      } finally {
        await context.close().catch(() => undefined)
      }
    }
  }
  await writeSheets(input, out).catch((error: unknown) =>
    input.log(`[shot] contact sheets not written: ${firstLine(error)}`),
  )
  // A scale that was read at all is a scale: the error is only for one that never was.
  const { anchors, shots, scale } = out
  if (scale.length > 0 || out.scaleError === undefined) return { anchors, shots, scale }
  input.log(`[shot] scale unavailable: ${out.scaleError}`)
  return { anchors, shots, scale, scaleError: out.scaleError }
}
