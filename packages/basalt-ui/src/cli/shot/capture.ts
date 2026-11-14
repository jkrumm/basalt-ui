/** Per route × scheme × viewport: full-page shot, then every anchor through every state. */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { basename, join } from 'node:path'

import { buildSheet } from './board'
import { finishMeasurement, measureAnchor } from './measure'
import type { Box, PwBrowser, PwContext, PwLocator, PwPage, ShotOptions } from './playwright'
import { SEED_FLAG, seedScript } from './real-data'
import type { Pair } from './real-data'
import {
  ANCHOR_SLOTS,
  NO_STATES_NOTE,
  PAGE_ANCHOR,
  SCHEMES,
  URL_STATES,
  VIEWPORT_SPECS,
} from './types'
import type {
  AnchorMetrics,
  Measurement,
  PageMetrics,
  Scale,
  Scheme,
  ShotMetrics,
  ShotRecord,
  ShotState,
  ViewportSpec,
} from './types'

const NAV_TIMEOUT_MS = 30_000
/** Every Playwright wait on one anchor: a hidden or tall target costs this, not 30 s. */
const STEP_MS = 5_000
const SHOT_TIMEOUT_MS = 15_000
const SETTLE_MS = 60
/** Chromium refuses screenshots past ~16k px. */
const MAX_PX = 16_000
const FRAMES = 'new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))'

export type CaptureInput = {
  browser: PwBrowser
  base: string
  routes: readonly string[]
  viewports: readonly ViewportSpec[]
  states: readonly ShotState[]
  pngDir: string
  /** Seeded before any page script runs (values may be secrets: never logged or written). */
  localStorage?: readonly Pair[]
  /** Extra settle in ms after `networkidle`. */
  wait?: number
  /** Drains the proxied calls that failed since the last read (401/403, no answer). */
  apiProblems?: () => string[]
  /** On a page with no anchor, tag each large card and table as one. */
  autoAnchors?: boolean
  /** Replaces the in-page measurer (tests). */
  measure?: (anchor: PwLocator) => Promise<Measurement>
  log: (line: string) => void
}

type PageFacts = {
  anchors: string[]
  /** Anchor → its URL states: `data-shot-states`, else all three when a `data-phase` is on, in or above it. */
  states: Record<string, string[]>
  /** Anchor → the states it declares itself absent in (`data-shot-absent`). */
  absent: Record<string, string[]>
  content: string
  /** px the document is wider than the viewport. */
  overflowX: number
}

/** Everything one page visit shares. */
type Ctx = {
  page: PwPage
  input: CaptureInput
  route: string
  scheme: Scheme
  spec: ViewportSpec
  /** The viewport's current height: a tall anchor grows it for one shot. */
  height: number
  facts: PageFacts
  anchors: AnchorMetrics[]
  shots: ShotRecord[]
  measured: Set<string>
  /** What the data itself got wrong: a failed seed, a 401/403, no API answer. */
  problems: string[]
}

type Outcome = Pick<ShotRecord, 'name' | 'state' | 'status'> &
  Partial<Pick<ShotRecord, 'note' | 'ignored'>> & { file?: string }

/** The anchor has no such target: recorded `not-declared`, not `error`. */
class NotDeclared extends Error {}
/** The anchor is not rendered at this viewport: recorded `absent` with the reason. */
class Absent extends Error {}

const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms))

/** `work`, rejected after `ms`: one hung Playwright call never spends the 30 s default. */
function within<T>(what: string, work: Promise<T>, ms = STEP_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} timed out after ${ms / 1000} s`)), ms)
  })
  return Promise.race([work, late]).finally(() => clearTimeout(timer))
}

export const SAME_CONTENT_WARNING =
  '[shot] warning: every route rendered the same content — a lock screen or auth wall? see --api'

const hash = (text: string): string => createHash('sha1').update(text).digest('hex').slice(0, 6)
const slug = (text: string): string => text.replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '')
const firstLine = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).split('\n')[0] ?? ''
const sel = (name: string): string => `[data-shot-anchor=${JSON.stringify(name)}]`
const anchorOf = (c: Ctx, name: string): PwLocator => c.page.locator(sel(name)).first()
const stem = (route: string, name: string): string =>
  `${slug(route) || 'root'}-${hash(route)}__${slug(name)}-${hash(name)}`

/** `<route>-<hash>__<name>-<hash>__…`: the hash of the RAW text keeps `/a/b` and `/a-b` apart. */
export const fileName = (
  route: string,
  name: string,
  scheme: Scheme,
  viewport: string,
  state: ShotState,
): string => `${stem(route, name)}__${scheme}__${viewport}__${state}.png`

/** `<stem>__sheet.png`: one contact sheet per anchor, beside its crops. */
export const sheetName = (route: string, name: string): string => `${stem(route, name)}__sheet.png`

/** The state URL: the query goes before any `#fragment`. */
export function withParam(route: string, state: ShotState): string {
  const at = route.indexOf('#')
  const [path, fragment] = at < 0 ? [route, ''] : [route.slice(0, at), route.slice(at)]
  return `${path}${path.includes('?') ? '&' : '?'}shot-state=${state}${fragment}`
}

/** The union of `boxes` grown by `margin` and clamped to the viewport (`tall`: its live height); null when none of it is inside. */
export function unionClip(
  boxes: readonly Box[],
  margin: number,
  spec: Pick<ViewportSpec, 'width' | 'height'>,
  tall?: number,
): Box | null {
  const left = Math.max(0, Math.min(...boxes.map((b) => b.x)) - margin)
  const top = Math.max(0, Math.min(...boxes.map((b) => b.y)) - margin)
  const right = Math.min(spec.width, Math.max(...boxes.map((b) => b.x + b.width)) + margin)
  const bottom = Math.min(
    tall ?? spec.height,
    Math.max(...boxes.map((b) => b.y + b.height)) + margin,
  )
  return right <= left || bottom <= top
    ? null
    : { x: left, y: top, width: right - left, height: bottom - top }
}

const snap = (
  target: { screenshot(options: ShotOptions): Promise<unknown> },
  path: string,
  extra: { fullPage?: boolean; clip?: Box } = {},
): Promise<unknown> =>
  target.screenshot({
    path,
    animations: 'disabled',
    caret: 'hide',
    timeout: SHOT_TIMEOUT_MS,
    ...extra,
  })

/** A clip of `targets` against the live page height (it goes stale after a reflow); an empty one is retried once after a frame. */
export async function snapClip(c: Ctx, path: string, targets: readonly PwLocator[]): Promise<void> {
  for (let retry = true; ; retry = false) {
    const live = await c.page.evaluate<number>('window.innerHeight')
    const boxes = (await Promise.all(targets.map((t) => t.boundingBox()))).filter((b) => b !== null)
    const clip = boxes.length === targets.length && unionClip(boxes, 8, c.spec, live)
    if (clip) return void (await snap(c.page, path, { clip }))
    if (!retry) throw new Error('Clipped area is either empty or outside the resulting image')
    await c.page.evaluate(FRAMES)
  }
}

function record(c: Ctx, { name, state, status, file, note, ignored }: Outcome): void {
  const { route, scheme } = c
  const shot = { route, name, scheme, viewport: c.spec.label, state, file: file ?? null, status }
  c.shots.push({ ...shot, ...(note ? { note } : {}), ...(ignored ? { ignored } : {}) })
  if (status === 'error')
    c.input.log(`[shot] ${route} ${name} ${scheme}/${c.spec.label}/${state}: ${note}`)
}

async function load(page: PwPage, url: string, settle = 0): Promise<void> {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.evaluate('document.fonts.ready.then(() => undefined)')
  if (settle > 0) await sleep(settle)
}

/** Runs in the page, on a page with no anchor: tags each card and table over 120×60 px `auto-NN`, else `main`, `section`, `header`, `form`. */
export function tagAutoAnchors(): void {
  const tag = (selector: string): number => {
    let tagged = 0
    Array.from(document.querySelectorAll(selector)).forEach((el, i) => {
      const { width, height } = el.getBoundingClientRect()
      if (width <= 120 || height <= 60) return
      el.setAttribute('data-shot', `auto-${String(i + 1).padStart(2, '0')}`)
      tagged++
    })
    return tagged
  }
  if (tag('[data-slot="card"], table') === 0) tag('main, section, header, form')
}

/**
 * Runs in the page: names every anchor (`data-shot="<name>"`, else the outermost public slot as
 * `<slot>-<n>` in DOM order) with `data-shot-anchor`, and reads what each declares.
 */
export function readFactsInPage(slots: string[]): PageFacts {
  const words = (el: Element | null, attr: string): string[] =>
    (el?.getAttribute(attr) ?? '').split(/\s+/).filter(Boolean)
  const nest = `[data-shot], ${slots.map((s) => `[data-slot="${s}"]`).join(', ')}`
  const counts: Record<string, number> = {}
  const facts: PageFacts = { anchors: [], states: {}, absent: {}, content: '', overflowX: 0 }
  for (const el of Array.from(document.querySelectorAll(nest))) {
    let name = el.getAttribute('data-shot')
    if (!name) {
      const slot = el.getAttribute('data-slot') ?? ''
      if (!slots.includes(slot) || el.parentElement?.closest(nest)) continue
      counts[slot] = (counts[slot] ?? 0) + 1
      name = `${slot}-${counts[slot]}`
    }
    if (facts.anchors.includes(name)) continue
    el.setAttribute('data-shot-anchor', name)
    facts.anchors.push(name)
    const own = el.closest('[data-shot-states]') ?? el.querySelector('[data-shot-states]')
    const phased = el.closest('[data-phase]') ?? el.querySelector('[data-phase]')
    facts.states[name] = own
      ? words(own, 'data-shot-states')
      : phased
        ? ['empty', 'loading', 'error']
        : []
    facts.absent[name] = words(el, 'data-shot-absent')
  }
  const root = document.documentElement
  facts.content = document.body ? document.body.innerText : ''
  facts.overflowX = Math.max(0, root.scrollWidth - root.clientWidth)
  return facts
}

const addProblem = (c: Ctx, problem: string): void => {
  if (!c.problems.includes(problem)) c.problems.push(problem)
}

/** Moves the proxied calls that failed since the last read into this visit's problems. */
const collect = (c: Ctx): void => c.input.apiProblems?.().forEach((p) => addProblem(c, p))

/** One load of `url`: settle, auto-anchor a page that has none, read its facts, collect what is wrong with the data. */
async function visit(c: Ctx, url: string): Promise<PageFacts> {
  const { input, page } = c
  await load(page, url, input.wait)
  const read = (): Promise<PageFacts> => page.evaluate(readFactsInPage, ANCHOR_SLOTS as string[])
  let facts = await read()
  if (input.autoAnchors && facts.anchors.length === 0) {
    await page.evaluate(tagAutoAnchors, undefined)
    facts = await read()
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

/** When this visit's data is untrustworthy, every shot of it becomes an error carrying the problem. */
function flagProblems(c: Ctx): void {
  if (c.problems.length === 0) return
  const note = c.problems.join('; ')
  for (const shot of c.shots)
    if (shot.status === 'ok') Object.assign(shot, { status: 'error', note })
  if (!c.shots.some((s) => s.name === PAGE_ANCHOR && s.state === 'rest'))
    record(c, { name: PAGE_ANCHOR, state: 'rest', status: 'error', note })
  c.input.log(`[shot] ${c.route} ${c.scheme}/${c.spec.label}: ${note}`)
}

/**
 * Runs in the page: why the anchor paints nothing (`display: none` on it or an ancestor, hidden,
 * zero size), or '' after scrolling it into view itself (Playwright's own wait cost 30 s on a hidden pane).
 */
export function revealInPage(el: Element): string {
  for (let node: Element | null = el; node; node = node.parentElement) {
    const where = node === el ? '' : ' on an ancestor'
    const style = getComputedStyle(node)
    if (style.display === 'none') return `display: none${where}`
    if (node.hasAttribute('hidden')) return `hidden attribute${where}`
    if (style.visibility === 'hidden' && node === el) return 'visibility: hidden'
  }
  const rect = el.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return 'zero size'
  el.scrollIntoView({
    block: rect.height > window.innerHeight ? 'start' : 'center',
    inline: 'nearest',
    behavior: 'instant',
  })
  return ''
}

/** Runs in the page: hides every fixed or sticky element that is not (in, around) the anchor or an open popup. */
export function hideChrome(name: string): void {
  const anchor = document.querySelector(`[data-shot-anchor=${JSON.stringify(name)}]`)
  const popup = '[role="tooltip"], [role="dialog"], [role="listbox"], [role="menu"]'
  const shown = (e: Element): boolean => e.getBoundingClientRect().width > 0
  for (const el of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
    const { position } = getComputedStyle(el)
    if (position !== 'fixed' && position !== 'sticky') continue
    if (anchor && (el.contains(anchor) || anchor.contains(el))) continue
    if ((el.matches(popup) && shown(el)) || Array.from(el.querySelectorAll(popup)).some(shown))
      continue
    el.setAttribute('data-shot-chrome', el.style.visibility)
    el.style.setProperty('visibility', 'hidden', 'important')
  }
}

/** Runs in the page: undoes `hideChrome`. */
export function showChrome(): void {
  for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-shot-chrome]'))) {
    const before = el.getAttribute('data-shot-chrome') ?? ''
    if (before) el.style.setProperty('visibility', before)
    else el.style.removeProperty('visibility')
    el.removeAttribute('data-shot-chrome')
  }
}

async function resize(c: Ctx, height: number): Promise<void> {
  await c.page.setViewportSize({ width: c.spec.width, height })
  c.height = height
  await c.page.evaluate(FRAMES)
}

/** Hides the shell's chrome and grows the viewport to hold an anchor taller than it; returns the undo. */
async function frame(c: Ctx, name: string): Promise<() => Promise<void>> {
  const undo = async (): Promise<void> => {
    await c.page.evaluate(showChrome, undefined)
    if (c.height !== c.spec.height) await resize(c, c.spec.height)
  }
  await c.page.evaluate(hideChrome, name)
  try {
    const anchor = anchorOf(c, name)
    if ((await within('locating the anchor', anchor.count())) === 0)
      throw new Error('anchor not found')
    const box = anchor.evaluate((el) => el.getBoundingClientRect().height)
    const height = Number(await within('measuring the anchor', box))
    if (height > c.spec.height) await resize(c, Math.min(MAX_PX, Math.ceil(height) + c.spec.height))
  } catch (error) {
    await undo()
    throw error
  }
  return undo
}

/** Scrolls the anchor into view. Hidden is `absent` where hiding is expected (pointer, focus, a declared state), else a defect. */
async function reveal(c: Ctx, name: string, state: ShotState): Promise<void> {
  const verdict = await within('revealing the anchor', anchorOf(c, name).evaluate(revealInPage))
  if (typeof verdict === 'string' && verdict !== '') {
    const note = `not visible at this viewport: ${verdict}`
    const expected =
      ['hover', 'focus', 'tooltip'].includes(state) || c.facts.absent[name]?.includes(state)
    throw expected ? new Absent(note) : new Error(note)
  }
  await sleep(SETTLE_MS)
}

/** `read()` once two reads in a row agree: an animating card never shifts the clip. */
async function settled<T>(what: string, read: () => Promise<T>): Promise<T> {
  let last = await within(what, read())
  for (let i = 0; i < 10; i++) {
    await sleep(SETTLE_MS)
    const next = await within(what, read())
    const same = JSON.stringify(next) === JSON.stringify(last)
    last = next
    if (same) break
  }
  return last
}

/** Runs in the page: px the PAGE scrollport hides, which `fullPage` cannot see (the shell's `data-basalt-scrollport`, else the outermost auto/scroll box; a nested one never counts). */
export function hiddenScrollPx(): number {
  const hidden = (el: Element): number => Math.max(0, el.scrollHeight - el.clientHeight)
  const declared = document.querySelector('[data-basalt-scrollport]')
  if (declared !== null) return hidden(declared)
  const scrolls = (el: Element): boolean =>
    ['auto', 'scroll'].includes(getComputedStyle(el).overflowY)
  let extra = 0
  for (const el of Array.from(document.body.querySelectorAll('*'))) {
    if (el.clientHeight < window.innerHeight / 2 || !scrolls(el)) continue
    let nested = false
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement)
      if (scrolls(p)) nested = true
    if (!nested) extra = Math.max(extra, hidden(el))
  }
  return extra
}

async function fullPage(c: Ctx, path: string): Promise<void> {
  const extra = Number(await c.page.evaluate(hiddenScrollPx, undefined))
  if (extra > 0) await resize(c, Math.min(MAX_PX, c.spec.height + Math.ceil(extra)))
  try {
    await snap(c.page, path, { fullPage: true })
  } finally {
    if (extra > 0) await resize(c, c.spec.height)
  }
}

/** One capture, recorded. Metrics are taken after the FIRST successful capture of an anchor, whichever state. */
async function attempt(
  c: Ctx,
  name: string,
  state: ShotState,
  run: (path: string) => Promise<unknown>,
  note?: string,
): Promise<ShotRecord | undefined> {
  const file = fileName(c.route, name, c.scheme, c.spec.label, state)
  let unframe: (() => Promise<void>) | undefined
  try {
    if (name !== PAGE_ANCHOR) {
      unframe = await frame(c, name)
      await reveal(c, name, state)
    }
    await run(join(c.input.pngDir, file))
  } catch (error) {
    const status =
      error instanceof NotDeclared ? 'not-declared' : error instanceof Absent ? 'absent' : 'error'
    record(c, { name, state, status, note: firstLine(error) })
    return undefined
  } finally {
    await unframe?.()
  }
  // The PNG is good: a measurement failure is recorded beside it, never instead of it.
  const notes = note ? [note] : []
  if (name !== PAGE_ANCHOR && !c.measured.has(name)) {
    try {
      const measure = c.input.measure ?? ((a) => a.evaluate(measureAnchor).then(finishMeasurement))
      const m = await measure(anchorOf(c, name))
      c.anchors.push({ route: c.route, name, scheme: c.scheme, viewport: c.spec.label, ...m })
      c.measured.add(name)
    } catch (error) {
      notes.push(`metrics unavailable: ${firstLine(error)}`)
    }
  }
  record(c, {
    name,
    state,
    status: 'ok',
    file: `png/${file}`,
    ...(notes.length ? { note: notes.join('; ') } : {}),
  })
  return c.shots.at(-1)
}

const TOOLTIPS = '[role="tooltip"]:visible'

/** Hover or tooltip crop: the anchor and the readout the pointer opened, in one clip. */
async function pointerCrop(c: Ctx, name: string, state: ShotState, path: string): Promise<void> {
  const anchor = anchorOf(c, name)
  const marked = c.page.locator(`${sel(name)} [data-shot-tooltip]`).first()
  if (state === 'tooltip' && (await marked.count()) === 0)
    throw new NotDeclared('no [data-shot-tooltip] in the anchor')
  // Off the previous anchor first, so a crop never holds a tooltip left over from it.
  await c.page.mouse.move(0, 0)
  for (let i = 0; i < 16 && (await c.page.locator(TOOLTIPS).count()) > 0; i++)
    await sleep(SETTLE_MS)
  await (state === 'tooltip' ? marked : anchor).hover({ timeout: STEP_MS })
  const tip = c.page.locator(TOOLTIPS).last()
  const wait = { state: 'visible', timeout: state === 'tooltip' ? 3_000 : 250 } as const
  const shown = await tip.waitFor(wait).then(
    () => true,
    () => false,
  )
  if (state === 'tooltip' && !shown) throw new Error('no visible [role="tooltip"] after hover')
  await settled('measuring the anchor', () => anchor.boundingBox())
  if (shown) await snapClip(c, path, [anchor, tip])
  else await snap(anchor, path)
}

/** Tab from the document top until `:focus-visible` lands inside the anchor, then crop it with any tooltip it opened. */
async function focusCrop(c: Ctx, name: string, path: string): Promise<void> {
  const anchor = anchorOf(c, name)
  const reachable =
    'a[href], button, input:not([type="hidden"]), select, textarea, summary, [tabindex]:not([tabindex^="-"])'
  const target = (el: Element): boolean =>
    [el, ...Array.from(el.querySelectorAll(reachable))].some(
      (e) => e.matches(reachable) && !e.matches(':disabled') && e.checkVisibility(),
    )
  if (!(await anchor.evaluate(target))) throw new NotDeclared('no focus target in the anchor')
  await c.page.evaluate('document.activeElement?.blur(); window.scrollTo(0, 0)')
  const landed = `(() => { const a = document.activeElement; return a != null && a.matches(':focus-visible') && a.closest(${JSON.stringify(sel(name))}) != null })()`
  for (let i = 0; !(await c.page.evaluate<boolean>(landed)); i++) {
    if (i === 80) throw new Error(':focus-visible never reached the anchor in 80 Tab presses')
    await c.page.keyboard.press('Tab')
  }
  // Focus scrolls the nearest scrollport on its own terms: put the anchor back where the clip is taken.
  await within('re-centring the anchor', anchor.evaluate(revealInPage))
  await settled('measuring the anchor', () => anchor.boundingBox())
  const tip = c.page.locator(TOOLTIPS).last()
  await snapClip(c, path, (await tip.count()) > 0 ? [anchor, tip] : [anchor])
  await c.page.evaluate('document.activeElement?.blur()')
}

async function captureAnchor(c: Ctx, name: string, state: ShotState): Promise<void> {
  if (c.spec.mobile && (state === 'hover' || state === 'tooltip')) {
    record(c, { name, state, status: 'skipped', note: 'touch viewport' })
    return
  }
  await attempt(c, name, state, (path) =>
    state === 'focus'
      ? focusCrop(c, name, path)
      : state === 'rest'
        ? snap(anchorOf(c, name), path)
        : pointerCrop(c, name, state, path),
  )
  await c.page.mouse.move(0, 0)
}

const digest = (dir: string, file: string): string | null => {
  try {
    return createHash('sha1')
      .update(readFileSync(join(dir, basename(file))))
      .digest('hex')
  } catch {
    return null
  }
}

/** `empty`/`loading`/`error`: reload with `shot-state=<state>` once an anchor declares it and crop each that does; a crop identical to its ready crop is `ignored`. */
async function captureUrlState(c: Ctx, state: ShotState): Promise<void> {
  const rest = c.facts
  const declaring = rest.anchors.filter((n) => rest.states[n]?.includes(state))
  const skip = (name: string, note: string): void =>
    record(c, { name, state, status: 'not-declared', note })
  if (declaring.length === 0) {
    const any = rest.anchors.some((n) => (rest.states[n]?.length ?? 0) > 0)
    for (const name of rest.anchors)
      skip(name, any ? 'anchor does not declare this state' : NO_STATES_NOTE)
    return
  }
  let here: PageFacts
  try {
    here = await visit(c, c.input.base + withParam(c.route, state))
  } catch (error) {
    for (const name of rest.anchors)
      record(c, { name, state, status: 'error', note: `load failed: ${firstLine(error)}` })
    return
  }
  c.facts = here
  for (const name of new Set([...rest.anchors, ...here.anchors])) {
    const inRest = rest.anchors.includes(name)
    if (inRest && !declaring.includes(name)) {
      skip(name, 'anchor does not declare this state')
    } else if (!here.anchors.includes(name)) {
      // The declaration lives on the element, which is gone in this state: it is read from the rest render.
      const gone = rest.absent[name]?.includes(state)
        ? { status: 'absent', note: 'declared absent in this state' }
        : { status: 'error', note: 'anchor absent in this state' }
      record(c, { name, state, ...gone } as Outcome)
    } else {
      const note = inRest ? undefined : 'anchor only present in this state'
      const shot = await attempt(c, name, state, (path) => snap(anchorOf(c, name), path), note)
      const ready = c.shots.find((s) => s.name === name && s.state === 'rest' && s.status === 'ok')
      if (shot?.file && ready?.file) {
        const [a, b] = [digest(c.input.pngDir, ready.file), digest(c.input.pngDir, shot.file)]
        if (a !== null && a === b) shot.ignored = true
      }
    }
  }
  c.facts = rest
}

type Steps = Pick<Scale, 'spacing' | 'radius' | 'fontSizes'>

/**
 * Runs in the page: the theme's steps in px. Spacing is Tailwind's `--spacing` unit times the
 * ladder; radius and font size are every `--vx-*`, `--radius-*` and `--text-*` custom property a
 * style rule declares, resolved through a probe's `width` so `calc()` and `rem` read as the page does.
 */
export function readScaleInPage(): Steps {
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
  const out: Steps = { spacing: {}, radius: {}, fontSizes: {} }
  const kinds: [RegExp, keyof Steps][] = [
    [/^--vx-space-/, 'spacing'],
    [/^--(vx-)?radius-/, 'radius'],
    [/^--(vx-)?text-/, 'fontSizes'],
  ]
  const declared = new Map<string, string>()
  const walk = (rules: CSSRuleList): void => {
    for (const rule of Array.from(rules)) {
      if ('cssRules' in rule) walk((rule as CSSGroupingRule).cssRules)
      const style = (rule as CSSStyleRule).style
      for (const name of style ? Array.from(style) : [])
        if (kinds.some(([re]) => re.test(name)) && !/-lh$|line-height/.test(name))
          declared.set(name, style.getPropertyValue(name).trim())
    }
  }
  try {
    const unit = root.getPropertyValue('--spacing').trim() ? px('var(--spacing)') : undefined
    const ladder = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, ...Array.from({ length: 21 }, (_, i) => i + 4)]
    for (const k of ladder) if (unit) out.spacing[String(k)] = Math.round(unit * k * 100) / 100
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        walk(sheet.cssRules)
      } catch {
        // A cross-origin stylesheet's rules throw SecurityError: its tokens are not ours to read.
      }
    }
    for (const [name, value] of declared) {
      // A token set on the root resolves through the cascade; a component-scoped one only by its text.
      const resolved = root.getPropertyValue(name).trim() ? px(`var(${name})`) : px(value)
      const kind = kinds.find(([re]) => re.test(name))?.[1]
      if (resolved && kind) out[kind][name.replace(/^--/, '')] = resolved
    }
    return out
  } finally {
    probe.remove()
  }
}

type PageRun = { c: Ctx; content?: string; page?: PageMetrics; scale?: Steps; scaleError?: string }

async function capturePage(
  args: Pick<Ctx, 'page' | 'input' | 'route' | 'scheme' | 'spec'>,
): Promise<PageRun> {
  const empty: PageFacts = { anchors: [], states: {}, absent: {}, content: '', overflowX: 0 }
  const c: Ctx = {
    ...args,
    height: args.spec.height,
    facts: empty,
    anchors: [],
    shots: [],
    measured: new Set(),
    problems: [],
  }
  const { input, route, scheme, spec } = c
  const out: PageRun = { c }
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
    return out
  }
  if (c.facts.content) out.content = hash(c.facts.content)
  out.page = { route, scheme, viewport: spec.label, overflowX: c.facts.overflowX }
  try {
    out.scale = await c.page.evaluate(readScaleInPage, undefined)
  } catch (error) {
    out.scaleError = firstLine(error)
  }
  const usable = c.facts.anchors.filter((n) => slug(n) !== '' && n !== PAGE_ANCHOR)
  c.facts.anchors = usable
  if (usable.length === 0 && scheme === 'light' && spec === input.viewports[0])
    input.log(`[shot] no anchors on ${route}`)
  if (input.states.includes('rest'))
    await attempt(c, PAGE_ANCHOR, 'rest', (path) => fullPage(c, path))
  flagProblems(c)
  for (const name of usable) {
    for (const state of ['rest', 'hover', 'focus', 'tooltip'] as const) {
      if (!input.states.includes(state)) continue
      await captureAnchor(c, name, state)
      collect(c)
    }
  }
  for (const state of URL_STATES) {
    if (!input.states.includes(state)) continue
    await captureUrlState(c, state)
    collect(c)
  }
  // After every state, so the order never matters: a name no rest read held is absent at rest.
  const atRest = new Set(c.shots.filter((s) => s.state === 'rest').map((s) => s.name))
  for (const name of new Set(c.shots.map((s) => s.name)))
    if (input.states.includes('rest') && !atRest.has(name) && !usable.includes(name))
      record(c, { name, state: 'rest', status: 'absent', note: 'not rendered at rest' })
  flagProblems(c)
  return out
}

/** A fresh context for one scheme × viewport: the scheme is set on the context AND seeded (`data-theme`, the stored choice) before load. */
export async function openContext<C extends PwContext>(
  browser: PwBrowser<C>,
  scheme: Scheme,
  viewport: ViewportSpec | keyof typeof VIEWPORT_SPECS,
  seeded: readonly Pair[] = [],
  origin = '',
): Promise<C> {
  const spec = typeof viewport === 'string' ? VIEWPORT_SPECS[viewport] : viewport
  const context = await browser.newContext({
    viewport: { width: spec.width, height: spec.height },
    deviceScaleFactor: 1,
    isMobile: spec.mobile,
    hasTouch: spec.mobile,
    colorScheme: scheme,
    reducedMotion: 'reduce',
  })
  await context.addInitScript(
    `try{localStorage.setItem('basalt:scheme','${scheme}');document.documentElement.setAttribute('data-theme','${scheme}')}catch{}`,
  )
  if (seeded.length > 0) await context.addInitScript(seedScript(seeded, origin))
  return context
}

/** One contact sheet per anchor (every state × scheme × viewport) rendered from the crops on disk; a failed one is logged and left unlisted, so the reviewer treats the anchor as unverified. */
async function writeSheets(
  input: CaptureInput,
  out: Pick<ShotMetrics, 'anchors' | 'shots'>,
): Promise<void> {
  const targets = new Map<string, { route: string; name: string }>()
  for (const { route, name } of out.shots)
    if (name !== PAGE_ANCHOR) targets.set(`${route}\0${name}`, { route, name })
  if (targets.size === 0) return
  const context = await input.browser.newContext({
    viewport: { width: 2000, height: 1000 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    colorScheme: 'light',
    reducedMotion: 'reduce',
  })
  const dataUri = (file: string): string =>
    `data:image/png;base64,${readFileSync(join(input.pngDir, basename(file))).toString('base64')}`
  try {
    const page = await context.newPage()
    for (const { route, name } of targets.values()) {
      try {
        const shots = out.shots
          .filter((s) => s.route === route && s.name === name)
          .map((s) => (s.status === 'ok' && s.file ? { ...s, file: dataUri(s.file) } : s))
        const sheet = {
          viewports: input.viewports.map((v) => v.label),
          states: [...input.states],
          shots,
        }
        await page.setContent(buildSheet(route, name, sheet), { waitUntil: 'load' })
        const file = sheetName(route, name)
        await snap(page, join(input.pngDir, file), { fullPage: true })
        for (const a of out.anchors)
          if (a.route === route && a.name === name) a.sheet = `png/${file}`
      } catch (error) {
        input.log(`[shot] ${route} ${name}: sheet not written: ${firstLine(error)}`)
      }
    }
  } finally {
    await context.close().catch(() => undefined)
  }
}

export async function capture(
  input: CaptureInput,
): Promise<Pick<ShotMetrics, 'anchors' | 'shots' | 'scale' | 'pages' | 'scaleError'>> {
  const out = {
    anchors: [] as AnchorMetrics[],
    shots: [] as ShotRecord[],
    scale: [] as Scale[],
    pages: [] as PageMetrics[],
    scaleError: undefined as string | undefined,
  }
  const contents = new Map<string, string>()
  for (const scheme of SCHEMES) {
    for (const spec of input.viewports) {
      input.apiProblems?.() // a new context starts with a clean queue
      const origin = new URL(input.base).origin
      const context = await openContext(input.browser, scheme, spec, input.localStorage, origin)
      try {
        const page = await context.newPage()
        page.setDefaultTimeout(NAV_TIMEOUT_MS)
        for (const route of input.routes) {
          const done = await capturePage({ page, input, route, scheme, spec })
          if (done.scale) out.scale.push({ route, scheme, viewport: spec.label, ...done.scale })
          if (done.content && !contents.has(route)) contents.set(route, done.content)
          out.scaleError ??= done.scaleError
          if (done.page) out.pages.push(done.page)
          out.anchors.push(...done.c.anchors)
          out.shots.push(...done.c.shots)
        }
      } finally {
        await context.close().catch(() => undefined)
      }
    }
  }
  const same = new Set(contents.values()).size === 1
  if (input.routes.length > 1 && contents.size === new Set(input.routes).size && same)
    input.log(SAME_CONTENT_WARNING)
  await writeSheets(input, out).catch((error: unknown) =>
    input.log(`[shot] contact sheets not written: ${firstLine(error)}`),
  )
  // A scale that was read at all is a scale: the error is only for one that never was.
  const { scaleError, ...rest } = out
  if (rest.scale.length > 0 || scaleError === undefined) return rest
  input.log(`[shot] scale unavailable: ${scaleError}`)
  return { ...rest, scaleError }
}
