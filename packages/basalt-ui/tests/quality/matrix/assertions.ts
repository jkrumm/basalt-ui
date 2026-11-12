/**
 * The matrix assertions that are not `quality.*` exports (quality-contract section 4): forced
 * colours, fit on worst-case data, reduced motion and the two carried effective-hit-box checks.
 * Each throws an `Error` naming the offending elements, like the exports do, so one offender
 * fixture per assertion can prove it fails (`offenders.test.ts`).
 */
import type { Page } from 'playwright-core'
import { quality } from '../../../src/testing/quality'
import type { PageLike } from '../../../src/testing/quality'

/** Slots that draw no frame of their own, so forced colours has nothing to keep. */
const FRAMELESS = new Set([
  'separator',
  'skeleton',
  'swatch',
  'ring',
  'progress',
  'meter',
  'spinner',
  'scroll-area',
  'virtual-list',
  'tabs',
  'tabs-list',
  'table',
  'table-body',
  'table-header',
  'table-row',
  'table-cell',
  'table-head',
  'toolbar',
  'toolbar-group',
  'field',
  'fieldset',
  'form',
])

/** Source of the in-page "visually hidden" test (`sr-only`: a 1px absolutely placed box), shared by every evaluate below. */
const VISUALLY_HIDDEN = `(el) => {
  const s = getComputedStyle(el)
  if (s.position !== 'absolute' && s.position !== 'fixed') return false
  return s.clip === 'rect(0px, 0px, 0px, 0px)' || /inset\\(50%\\)/.test(s.clipPath) || (parseFloat(s.width) <= 1 && parseFloat(s.height) <= 1)
}`

function fail(name: string, lines: readonly string[]): never {
  throw new Error(
    `${name}:\n  ${lines.slice(0, 8).join('\n  ')}${lines.length > 8 ? `\n  ... ${lines.length - 8} more` : ''}`,
  )
}

/**
 * Forced colours drop `box-shadow` and background colour. A surface or control whose frame in
 * normal rendering is a shadow ring (no border) must keep a border or outline when
 * `forced-colors: active`, or its edge vanishes.
 */
export async function forcedColors(page: Page): Promise<void> {
  const candidates = await page.evaluate(
    ([frameless, hiddenSource]: [string[], string]) => {
      const hidden = new Function(`return (${hiddenSource})`)() as (e: Element) => boolean
      const found: { index: number; label: string }[] = []
      document.querySelectorAll<HTMLElement>('[data-slot]').forEach((el, index) => {
        const slot = el.getAttribute('data-slot') ?? ''
        if (frameless.includes(slot)) return
        const r = el.getBoundingClientRect()
        if (r.width < 8 || r.height < 8 || hidden(el)) return
        const s = getComputedStyle(el)
        if (s.visibility === 'hidden') return
        const border = ['Top', 'Right', 'Bottom', 'Left'].some(
          (side) =>
            parseFloat(s.getPropertyValue(`border-${side.toLowerCase()}-width`)) > 0 &&
            s.getPropertyValue(`border-${side.toLowerCase()}-style`) !== 'none',
        )
        if (border) return
        if (s.boxShadow === 'none') return
        el.setAttribute('data-quality-fc', String(index))
        found.push({
          index,
          label: `[${slot}] ${el.tagName.toLowerCase()} ${Math.round(r.width)}x${Math.round(r.height)}`,
        })
      })
      return found
    },
    [[...FRAMELESS], VISUALLY_HIDDEN] as [string[], string],
  )
  await page.emulateMedia({ forcedColors: 'active' })
  try {
    const vanished = await page.evaluate((list: { index: number; label: string }[]) => {
      const lost: string[] = []
      for (const { index, label } of list) {
        const el = document.querySelector<HTMLElement>(`[data-quality-fc="${index}"]`)
        if (el === null) continue
        const s = getComputedStyle(el)
        const border = ['top', 'right', 'bottom', 'left'].some(
          (side) =>
            parseFloat(s.getPropertyValue(`border-${side}-width`)) > 0 &&
            s.getPropertyValue(`border-${side}-style`) !== 'none',
        )
        const outline = parseFloat(s.outlineWidth) > 0 && s.outlineStyle !== 'none'
        if (!border && !outline) lost.push(label)
      }
      return lost
    }, candidates)
    if (vanished.length > 0) fail('forcedColors: the frame vanishes under forced-colors', vanished)
  } finally {
    await page.emulateMedia({ forcedColors: 'none' })
    await page.evaluate(() => {
      document
        .querySelectorAll('[data-quality-fc]')
        .forEach((el) => el.removeAttribute('data-quality-fc'))
    })
  }
}

/**
 * Fit: no text-bearing element holds more content than its box without saying so. A scrollport
 * (`overflow: auto|scroll`) and an ellipsis rule are both a statement; a silent clip or spill is not.
 */
export async function fit(page: Page): Promise<void> {
  const overflowing = await page.evaluate((hiddenSource: string) => {
    const hidden = new Function(`return (${hiddenSource})`)() as (e: Element) => boolean
    const lines: string[] = []
    for (const el of document.body.querySelectorAll<HTMLElement>('*')) {
      const hasText = Array.from(el.childNodes).some(
        (n) => n.nodeType === 3 && (n.textContent ?? '').trim() !== '',
      )
      if (!hasText) continue
      const s = getComputedStyle(el)
      if (s.display === 'inline' || s.display === 'contents' || s.visibility === 'hidden') continue
      if (hidden(el)) continue
      if (s.overflowX === 'auto' || s.overflowX === 'scroll') continue
      if (el.clientWidth === 0 || el.scrollWidth <= el.clientWidth + 1) continue
      if (s.textOverflow === 'ellipsis' || s.webkitLineClamp !== 'none') continue
      const slot = el.getAttribute('data-slot')
      lines.push(
        `${el.tagName.toLowerCase()}${slot ? `[${slot}]` : ''} "${(el.textContent ?? '').trim().slice(0, 28)}" content ${el.scrollWidth}px in ${el.clientWidth}px`,
      )
    }
    return lines
  }, VISUALLY_HIDDEN)
  if (overflowing.length > 0) fail('fit: text overflows its box with no ellipsis rule', overflowing)
}

/**
 * Reduced motion: under `prefers-reduced-motion: reduce`, with every dialog and sheet opener on the
 * page opened in turn, no animation is running once the frame settles.
 */
export async function reducedMotion(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  const running = async (): Promise<string[]> =>
    page.evaluate(async () => {
      await new Promise<void>((done) =>
        requestAnimationFrame(() => requestAnimationFrame(() => done())),
      )
      // Finite animations get their time; only one that never ends is a failure.
      await Promise.race([
        Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
        new Promise((done) => setTimeout(done, 400)),
      ])
      return document
        .getAnimations()
        .map(
          (a) =>
            `${a.constructor.name} ${(a as CSSAnimation).animationName ?? (a as CSSTransition).transitionProperty ?? ''}`,
        )
    })
  const all = await running()
  for (const slot of ['dialog-trigger', 'sheet-trigger']) {
    const trigger = page.locator(`[data-slot="${slot}"]:visible`).first()
    if ((await trigger.count()) === 0) continue
    await trigger.click()
    await page.waitForTimeout(150)
    all.push(...(await running()).map((a) => `${slot}: ${a}`))
    await page.keyboard.press('Escape')
    await page.waitForTimeout(100)
  }
  if (all.length > 0) fail('reducedMotion: animations run under prefers-reduced-motion', all)
}

const INTERACTIVE =
  'button, a[href], input:not([type="hidden"]), select, textarea, [role="switch"], [role="tab"], [role="checkbox"], [role="menuitem"]'

/**
 * The carried effective-hit-box floor (tests/layout/hit-floor.layout.test.ts): an element's own rect
 * unioned with its `[data-basalt-hit]::after`, capped by `--vx-hit-gap`, is at least 24px on a fine
 * pointer and 44px on a coarse one. Inline prose links are exempt (WCAG 2.5.8 inline exception).
 */
export async function hitFloor(page: Page, pointer: 'fine' | 'coarse'): Promise<number> {
  const { short, checked } = await page.evaluate(
    ([selector, floor, hiddenSource]: [string, number, string]) => {
      const hidden = new Function(`return (${hiddenSource})`)() as (e: Element) => boolean
      const short: string[] = []
      let checked = 0
      for (const el of document.querySelectorAll<HTMLElement>(selector)) {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) continue
        const style = getComputedStyle(el)
        if (style.visibility === 'hidden' || style.pointerEvents === 'none') continue
        if (el.matches('a[href]') && style.display === 'inline') continue
        if (hidden(el)) continue
        if (el instanceof HTMLInputElement) {
          const label = el.closest('label')
          if (label !== null) {
            const lr = label.getBoundingClientRect()
            if (lr.width >= floor && lr.height >= floor) continue
          }
          const host = el.closest<HTMLElement>('[data-basalt-hit]')
          if (host !== null && host !== el) {
            const hr = host.getBoundingClientRect()
            if (hr.width >= floor && hr.height >= floor) continue
          }
        }
        const after = getComputedStyle(el, '::after')
        const aw = parseFloat(after.width)
        const ah = parseFloat(after.height)
        const w = Math.max(r.width, Number.isNaN(aw) || after.content === 'none' ? 0 : aw)
        const h = Math.max(r.height, Number.isNaN(ah) || after.content === 'none' ? 0 : ah)
        const gap = parseFloat(style.getPropertyValue('--vx-hit-gap')) || 0
        const needW = gap ? Math.min(floor, r.width + gap) : floor
        const needH = gap ? Math.min(floor, r.height + gap) : floor
        checked++
        if (w + 0.5 < needW || h + 0.5 < needH) {
          const slot = el.getAttribute('data-slot')
          short.push(
            `${el.tagName.toLowerCase()}${slot ? `[${slot}]` : ''} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 24)}" ${w.toFixed(0)}x${h.toFixed(0)} < ${needW.toFixed(0)}x${needH.toFixed(0)}`,
          )
        }
      }
      return { short, checked }
    },
    [INTERACTIVE, pointer === 'coarse' ? 44 : 24, VISUALLY_HIDDEN] as [string, number, string],
  )
  if (short.length > 0) fail(`hitFloor (${pointer}): target smaller than the floor`, short)
  return checked
}

/** The carried overlap check (tests/layout/hit-overlap.layout.test.ts): sibling hit overlays never cover each other. */
export async function hitOverlap(page: Page): Promise<number> {
  const { boxes } = await page.evaluate(() => {
    const selector = '[data-basalt-hit], [data-basalt-hit-scope] :is(button, a)'
    const list = [...document.querySelectorAll<HTMLElement>(selector)].flatMap((el, i) => {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return []
      const after = getComputedStyle(el, '::after')
      const w = parseFloat(after.width)
      const h = parseFloat(after.height)
      if (Number.isNaN(w) || Number.isNaN(h)) return []
      const cx = r.x + r.width / 2
      const cy = r.y + r.height / 2
      return [
        {
          id: `${i}:${el.tagName.toLowerCase()}[${el.getAttribute('data-slot') ?? ''}]`,
          left: cx - w / 2,
          top: cy - h / 2,
          right: cx + w / 2,
          bottom: cy + h / 2,
          el,
        },
      ]
    })
    const flat = list.filter(
      (a) => !list.some((b) => b !== a && (b.el.contains(a.el) || a.el.contains(b.el))),
    )
    return { boxes: flat.map(({ el: _el, ...rest }) => rest) }
  })
  const overlaps: string[] = []
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]
      const b = boxes[j]
      if (a === undefined || b === undefined) continue
      const dx = Math.min(a.right, b.right) - Math.max(a.left, b.left)
      const dy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
      if (dx > 0.5 && dy > 0.5)
        overlaps.push(`${a.id} x ${b.id} (${dx.toFixed(1)}x${dy.toFixed(1)})`)
    }
  }
  if (overlaps.length > 0) fail('hitOverlap: hit boxes overlap', overlaps)
  return boxes.length
}

/** Every assertion of one cell, in order. A route's failures are collected, never short-circuited. */
export interface CellOptions {
  pointer: 'fine' | 'coarse'
  /** Overflow sweeps resize the viewport; the sampled run keeps them (cheap) on every cell. */
  overlays?: boolean
}

type Step = { name: string; run: () => Promise<unknown> }

export function cellSteps(page: Page, options: CellOptions): Step[] {
  const like: PageLike = page
  return [
    {
      name: 'axe',
      run: () =>
        quality.axe(like, {
          overlays:
            options.overlays === false
              ? []
              : ['dialog', 'sheet', 'popover', 'select', 'menu', 'toast'],
        }),
    },
    { name: 'overflow', run: () => quality.overflow(like) },
    { name: 'ringWalk', run: () => quality.ringWalk(like) },
    { name: 'focusNotObscured', run: () => quality.focusNotObscured(like) },
    { name: 'textSpacing', run: () => quality.textSpacing(like) },
    { name: 'forcedColors', run: () => forcedColors(page) },
    { name: 'fit', run: () => fit(page) },
    { name: 'reducedMotion', run: () => reducedMotion(page) },
    { name: 'hitFloor', run: () => hitFloor(page, options.pointer) },
    { name: 'hitOverlap', run: () => hitOverlap(page) },
  ]
}

/** Runs every step and returns the failures as `name: message`; an empty list is a pass. */
export async function runCell(page: Page, options: CellOptions): Promise<string[]> {
  const failures: string[] = []
  for (const step of cellSteps(page, options)) {
    try {
      await step.run()
    } catch (error) {
      failures.push(`${step.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return failures
}
