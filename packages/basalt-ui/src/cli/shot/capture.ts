/** Per route × scheme × viewport: full-page shot, then every `data-shot` anchor through every state. */
import { join } from 'node:path'

import { finishMeasurement, measureAnchor } from './measure'
import type { Box, PwBrowser, PwContext, PwLocator, PwPage } from './playwright'
import { SCHEMES, URL_STATES, VIEWPORTS, VIEWPORT_SPECS } from './types'
import type { AnchorMetrics, Scheme, ShotRecord, ShotState, Viewport } from './types'

const NAV_TIMEOUT_MS = 30_000
const TAB_PRESSES = 80
const FOCUS_MARGIN = 8

export const PAGE_ANCHOR = '_page'

export type CaptureInput = {
  browser: PwBrowser
  base: string
  routes: readonly string[]
  states: readonly ShotState[]
  pngDir: string
  log: (line: string) => void
}

const slug = (route: string): string =>
  route.replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '') || 'root'
const firstLine = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).split('\n')[0] ?? ''
const sel = (name: string): string => `[data-shot=${JSON.stringify(name)}]`
const withParam = (route: string, state: ShotState): string =>
  `${route}${route.includes('?') ? '&' : '?'}shot-state=${state}`

/** The rect union of `boxes`, grown by `margin` and clamped to the viewport. */
export function unionClip(boxes: readonly Box[], margin: number, viewport: Viewport): Box {
  const { width, height } = VIEWPORT_SPECS[viewport]
  const left = Math.max(0, Math.min(...boxes.map((b) => b.x)) - margin)
  const top = Math.max(0, Math.min(...boxes.map((b) => b.y)) - margin)
  const right = Math.min(width, Math.max(...boxes.map((b) => b.x + b.width)) + margin)
  const bottom = Math.min(height, Math.max(...boxes.map((b) => b.y + b.height)) + margin)
  return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) }
}

async function load(page: PwPage, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.evaluate('document.fonts.ready.then(() => undefined)')
}

type PageFacts = { anchors: string[]; declared: string[] }

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

/** Sequential-focus from the top until focus lands inside the anchor (`:focus-visible` needs keys). */
async function tabInto(page: PwPage, name: string): Promise<void> {
  await page.evaluate('(() => { document.activeElement?.blur(); window.scrollTo(0, 0) })()')
  const inside = `document.activeElement?.closest(${JSON.stringify(sel(name))}) != null`
  for (let i = 0; i < TAB_PRESSES; i++) {
    await page.keyboard.press('Tab')
    if (await page.evaluate<boolean>(inside)) return
  }
  throw new Error(`focus never reached the anchor in ${TAB_PRESSES} Tab presses`)
}

async function capturePage(args: {
  page: PwPage
  input: CaptureInput
  route: string
  scheme: Scheme
  viewport: Viewport
}): Promise<{ anchors: AnchorMetrics[]; shots: ShotRecord[] }> {
  const { page, input, route, scheme, viewport } = args
  const anchors: AnchorMetrics[] = []
  const shots: ShotRecord[] = []
  const fileFor = (name: string, state: ShotState): string =>
    `${slug(route)}__${name}__${scheme}__${viewport}__${state}.png`
  const record = (
    name: string,
    state: ShotState,
    status: ShotRecord['status'],
    file: string | null,
    note?: string,
  ): void => {
    shots.push({ route, name, scheme, viewport, state, file, status, ...(note ? { note } : {}) })
    if (status === 'error')
      input.log(`[shot] ${route} ${name} ${scheme}/${viewport}/${state}: ${note}`)
  }
  const attempt = async (
    name: string,
    state: ShotState,
    run: (file: string) => Promise<void>,
  ): Promise<void> => {
    const file = fileFor(name, state)
    try {
      await run(join(input.pngDir, file))
      record(name, state, 'ok', `png/${file}`)
    } catch (error) {
      record(name, state, 'error', null, firstLine(error))
    }
  }
  const settle = (): Promise<void> => page.mouse.move(0, 0)

  await load(page, input.base + route)
  const facts = await readFacts(page)
  if (facts.anchors.length === 0 && scheme === 'light' && viewport === 'desktop')
    input.log(`[shot] no data-shot anchors on ${route}`)

  if (input.states.includes('rest')) {
    await attempt(PAGE_ANCHOR, 'rest', (path) =>
      page
        .screenshot({ path, fullPage: true, animations: 'disabled', caret: 'hide' })
        .then(() => undefined),
    )
  }

  const shootRest = async (name: string, state: ShotState, measure: boolean): Promise<void> => {
    await attempt(name, state, async (path) => {
      const anchor = page.locator(sel(name)).first()
      await reveal(anchor)
      await anchor.screenshot({ path, animations: 'disabled', caret: 'hide' })
      if (measure) {
        const m = finishMeasurement(await anchor.evaluate(measureAnchor))
        anchors.push({ route, name, scheme, viewport, ...m })
      }
    })
  }

  for (const name of facts.anchors) {
    const anchor = page.locator(sel(name)).first()
    if (input.states.includes('rest')) await shootRest(name, 'rest', true)

    if (input.states.includes('hover')) {
      if (viewport === 'mobile') record(name, 'hover', 'not-declared', null, 'desktop only')
      else {
        await attempt(name, 'hover', async (path) => {
          await reveal(anchor)
          const inner = page.locator(`${sel(name)} [data-shot-hover]`).first()
          await ((await inner.count()) > 0 ? inner : anchor).hover({ timeout: 5000 })
          await anchor.screenshot({ path, animations: 'disabled', caret: 'hide' })
        })
        await settle()
      }
    }

    if (input.states.includes('focus')) {
      await attempt(name, 'focus', async (path) => {
        await reveal(anchor)
        await tabInto(page, name)
        const box = await anchor.boundingBox()
        if (!box) throw new Error('anchor has no box')
        await page.screenshot({
          path,
          clip: unionClip([box], FOCUS_MARGIN, viewport),
          animations: 'disabled',
          caret: 'hide',
        })
      })
      await page.evaluate('document.activeElement?.blur()')
    }

    if (input.states.includes('tooltip')) {
      const trigger = page.locator(`${sel(name)} [data-shot-tooltip]`).first()
      if (viewport === 'mobile') record(name, 'tooltip', 'not-declared', null, 'desktop only')
      else if ((await trigger.count()) === 0)
        record(name, 'tooltip', 'not-declared', null, 'no [data-shot-tooltip] in the anchor')
      else {
        await attempt(name, 'tooltip', async (path) => {
          await reveal(anchor)
          await trigger.hover({ timeout: 5000 })
          const tip = page.locator('[role="tooltip"]').first()
          await tip.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {
            throw new Error('no visible [role="tooltip"] after hover')
          })
          const [a, t] = [await anchor.boundingBox(), await tip.boundingBox()]
          if (!a || !t) throw new Error('tooltip or anchor has no box')
          await page.screenshot({
            path,
            clip: unionClip([a, t], FOCUS_MARGIN, viewport),
            animations: 'disabled',
            caret: 'hide',
          })
        })
        await settle()
      }
    }
  }

  for (const state of URL_STATES) {
    if (!input.states.includes(state)) continue
    if (!facts.declared.includes(state)) {
      for (const name of facts.anchors)
        record(name, state, 'not-declared', null, 'page does not declare this state')
      continue
    }
    await load(page, input.base + withParam(route, state))
    for (const name of facts.anchors) await shootRest(name, state, false)
  }
  return { anchors, shots }
}

/** A fresh context for one scheme × viewport: the colour scheme is set on the context AND in storage before load. */
export async function openContext(
  browser: PwBrowser,
  scheme: Scheme,
  viewport: Viewport,
): Promise<PwContext> {
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
): Promise<{ anchors: AnchorMetrics[]; shots: ShotRecord[] }> {
  const out = { anchors: [] as AnchorMetrics[], shots: [] as ShotRecord[] }
  for (const scheme of SCHEMES) {
    for (const viewport of VIEWPORTS) {
      const context = await openContext(input.browser, scheme, viewport)
      try {
        const page = await context.newPage()
        page.setDefaultTimeout(NAV_TIMEOUT_MS)
        for (const route of input.routes) {
          const got = await capturePage({ page, input, route, scheme, viewport })
          out.anchors.push(...got.anchors)
          out.shots.push(...got.shots)
        }
      } finally {
        await context.close().catch(() => undefined)
      }
    }
  }
  return out
}
