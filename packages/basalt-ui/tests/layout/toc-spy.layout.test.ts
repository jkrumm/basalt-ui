/**
 * TableOfContents scroll-spy in real Chrome, inside the shell scrollport (`AppShell.Main`) under a
 * STICKY title bar, with headings that carry `scroll-margin-top`. happy-dom has no layout, so the
 * two facts the spy depends on — where a clicked heading comes to rest, and whether it can ever
 * reach the observer's band — can only be measured here.
 *
 * The regression this guards (ledger row 73): clicking the LAST entry scrolls Main to a position a
 * few px short of its maximum, the heading rests above the band, and once the click's pin let go the
 * spy answered with the PREVIOUS entry. Neither the bottom edge (not at max) nor the band (heading
 * above it) could name the clicked one.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { TOC_SCROLL_MARGIN_PX } from './fixture/spec'
import type { FixtureSpec, TocSpec } from './fixture/spec'
import type { LayoutPage } from './harness'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
  MAIN,
  closeLayoutSuite,
  initLayoutSuite,
  openFixture,
} from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

/** How far short of Main's maximum the last heading's click lands in rb's repro (3100 of 3122). */
const SHORT_BY = 22

const specOf = (toc: TocSpec): FixtureSpec => ({
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  toc,
})

const ARTICLE: TocSpec = { sections: 4, sectionHeight: 700, lastHeight: 200 }
/** Tall enough that no section is near another's band. */
const TALL: TocSpec = { sections: 6, sectionHeight: 20_000, lastHeight: 2000 }
const ACTIVE = 'nav[aria-label="On this page"] [aria-current="location"]'
const link = (id: string) => `nav[aria-label="On this page"] a[href="#${id}"]`

const active = (p: LayoutPage): Promise<string> =>
  p.raw.evaluate((s) => document.querySelector(s)?.textContent?.trim() ?? '', ACTIVE)

/** Resolves once the active item has held for `holdMs`; throws if it never does. */
async function settled(p: LayoutPage, holdMs = 400, timeoutMs = 4000): Promise<string> {
  const deadline = Date.now() + timeoutMs
  let value = await active(p)
  let since = Date.now()
  while (Date.now() < deadline) {
    await p.raw.waitForTimeout(50)
    const now = await active(p)
    if (now !== value) {
      value = now
      since = Date.now()
    } else if (Date.now() - since >= holdMs) return value
  }
  throw new Error(`FAILED: the active TOC item never stabilised (last: "${value}")`)
}

/**
 * Where the reader actually is, computed from the DOM: the label the spy shows, and the sections it
 * may legitimately name — the last heading at or above the activation line, or the topmost one in
 * the band below it.
 */
const readerSection = (p: LayoutPage) =>
  p.raw.evaluate(
    ([main, selector]) => {
      const port = document.querySelector<HTMLElement>(main as string)
      if (!port) throw new Error('LAYOUT: no scrollport')
      const portTop = port.getBoundingClientRect().top
      const heads = [...document.querySelectorAll<HTMLElement>('h2')]
      const rel = (el: HTMLElement) => el.getBoundingClientRect().top - portTop
      const passed = heads.filter((h) => rel(h) <= 80).at(-1)
      const inBand = heads.find((h) => rel(h) > 80 && rel(h) < port.clientHeight * 0.3)
      const label = document.querySelector(selector as string)?.textContent?.trim() ?? ''
      return {
        label,
        candidates: [passed, inBand].flatMap((h) => (h ? [h.textContent?.trim() ?? ''] : [])),
      }
    },
    [MAIN, ACTIVE] as const,
  )

const scrollMain = (p: LayoutPage, top: number): Promise<void> =>
  p.raw.evaluate(
    ([s, y]) => document.querySelector<HTMLElement>(s as string)?.scrollTo({ top: y as number }),
    [MAIN, top] as const,
  )

const mainScroll = (p: LayoutPage) =>
  p.raw.evaluate((s) => {
    const el = document.querySelector<HTMLElement>(s)
    if (!el) throw new Error('LAYOUT: no scrollport')
    return { top: el.scrollTop, max: el.scrollHeight - el.clientHeight }
  }, MAIN)

/**
 * Remount with a last section sized so that clicking its heading lands `SHORT_BY` px short of
 * Main's maximum: the heading rests at `scroll-margin-top`, and the page could scroll further.
 */
async function openCalibrated(
  reducedMotion: 'reduce' | 'no-preference',
  base: TocSpec = ARTICLE,
): Promise<LayoutPage> {
  const p = await openFixture(specOf(base), DESKTOP_1440, '/', reducedMotion)
  await p.settle()
  const gap = await p.raw.evaluate(
    ([main, margin]) => {
      const port = document.querySelector<HTMLElement>(main as string)
      const last = document.querySelector<HTMLElement>(
        `#s${document.querySelectorAll('h2').length}`,
      )
      if (!port || !last) throw new Error('LAYOUT: no scrollport or heading')
      const target =
        last.getBoundingClientRect().top -
        port.getBoundingClientRect().top +
        port.scrollTop -
        (margin as number)
      return port.scrollHeight - port.clientHeight - target
    },
    [MAIN, TOC_SCROLL_MARGIN_PX] as const,
  )
  await p.remount(specOf({ ...base, lastHeight: base.lastHeight + SHORT_BY - Math.round(gap) }))
  await p.settle()
  return p
}

layout('TableOfContents scroll-spy — real geometry', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  test('rb row 73: clicking the last entry keeps it active though the click lands short of the end', async () => {
    const p = await openCalibrated('no-preference')
    await p.raw.click(link('s4'))
    expect(await active(p)).toBe('Section 4') // immediately, before the scroll has moved
    expect(await settled(p)).toBe('Section 4') // and after the pin has let go
    const { top, max } = await mainScroll(p)
    expect(max - top).toBeGreaterThan(10) // the precondition: NOT at the bottom
    expect(max - top).toBeLessThan(40)
    await p.raw.context().close()
  })

  test('the same click under reduced motion (instant scroll)', async () => {
    const p = await openCalibrated('reduce')
    await p.raw.click(link('s4'))
    expect(await active(p)).toBe('Section 4')
    expect(await settled(p)).toBe('Section 4')
    await p.raw.context().close()
  })

  test('clicking a middle entry activates it, not the neighbour that sits in the band', async () => {
    const p = await openCalibrated('no-preference', {
      sections: 6,
      sectionHeight: 160,
      lastHeight: 200,
    })
    await p.raw.click(link('s3'))
    expect(await active(p)).toBe('Section 3')
    expect(await settled(p)).toBe('Section 3')
    await p.raw.context().close()
  })

  test('scrolling to the very bottom activates the short last section', async () => {
    const p = await openFixture(specOf(ARTICLE), DESKTOP_1440)
    await p.scrollToEnd()
    expect(await settled(p)).toBe('Section 4')
    await p.raw.context().close()
  })

  test('ordinary scrolling, no click: the rail follows the band and the fallback line', async () => {
    const p = await openFixture(specOf(ARTICLE), DESKTOP_1440)
    await p.settle()
    await scrollMain(p, 750) // Section 2's heading sits just under the port's top: in the 0-80px strip
    expect(await settled(p)).toBe('Section 2')
    await scrollMain(p, 0)
    expect(await settled(p)).toBe('Section 1')
    await p.raw.context().close()
  })

  test('a heading 0-80px under the port top counts as reached (nothing in the band)', async () => {
    const p = await openFixture(specOf(ARTICLE), DESKTOP_1440)
    await p.settle()
    // Put Section 3's heading 40px under the port's top edge: above the band (it starts at 80px),
    // not yet past the top edge. The old edge-only fallback named Section 2 here.
    const top = await p.raw.evaluate((main) => {
      const port = document.querySelector<HTMLElement>(main)
      const h = document.querySelector<HTMLElement>('#s3')
      if (!port || !h) throw new Error('LAYOUT: no scrollport or heading')
      return h.getBoundingClientRect().top - port.getBoundingClientRect().top + port.scrollTop - 40
    }, MAIN)
    await scrollMain(p, top)
    expect(await settled(p)).toBe('Section 3')
    await p.raw.context().close()
  })

  test('a settled click is released by ANY later movement (find-in-page, focus, app scroll)', async () => {
    const p = await openCalibrated('no-preference')
    await p.raw.click(link('s4'))
    expect(await settled(p)).toBe('Section 4')
    await scrollMain(p, 0) // nobody touched wheel/touch/keys: a script scrolls
    expect(await settled(p)).toBe('Section 1')
    await p.raw.context().close()
  })

  test('a click on a tall article: its entry is active at once and after the scroll settles', async () => {
    const p = await openFixture(specOf(TALL), DESKTOP_1440, '/', 'no-preference')
    await p.settle()
    await p.raw.click(link('s6'))
    expect(await active(p)).toBe('Section 6')
    expect(await settled(p)).toBe('Section 6')
    await p.raw.context().close()
  })

  test('after the click settles, a 600px scroll away hands the rail back to the reader', async () => {
    const p = await openFixture(specOf(TALL), DESKTOP_1440, '/', 'no-preference')
    await p.settle()
    await p.raw.click(link('s6'))
    expect(await settled(p)).toBe('Section 6')
    const { top } = await mainScroll(p)
    await scrollMain(p, top - 600) // back into Section 5, by script
    await settled(p, 600, 8000)
    const { label, candidates } = await readerSection(p)
    expect(label).toBe('Section 5')
    expect(candidates).toContain(label)
    await p.raw.context().close()
  })

  test('a wheel after the click lands at another section, and the spy names THAT one', async () => {
    const p = await openFixture(specOf(TALL), DESKTOP_1440, '/', 'no-preference')
    await p.settle()
    await p.raw.mouse.move(700, 400)
    await p.raw.click(link('s6'))
    expect(await settled(p)).toBe('Section 6')
    await p.raw.mouse.wheel(0, -400)
    await settled(p, 600, 8000)
    const { label, candidates } = await readerSection(p)
    expect(label).toBe('Section 5')
    expect(candidates).toContain(label)
    await p.raw.context().close()
  })

  test('a click that needs no scroll holds (quiet window), then any movement releases it', async () => {
    const p = await openFixture(specOf(ARTICLE), DESKTOP_1440, '/', 'no-preference')
    await p.settle()
    await p.raw.click(link('s1')) // already at the top: no scroll, no scrollend
    expect(await active(p)).toBe('Section 1')
    await p.raw.waitForTimeout(500) // 200 ms without scrolling moves pinned → held
    await scrollMain(p, 750)
    expect(await settled(p, 300, 1500)).toBe('Section 2')
    await p.raw.context().close()
  })

  test('rapid double-click keeps the last click', async () => {
    const p = await openCalibrated('no-preference')
    await p.raw.click(link('s2'))
    await p.raw.click(link('s4'))
    expect(await active(p)).toBe('Section 4')
    expect(await settled(p, 600, 6000)).toBe('Section 4')
    await p.raw.context().close()
  })

  test('content that fits is not "at the bottom": the first section is active, not the last', async () => {
    const p = await openFixture(
      specOf({ sections: 4, sectionHeight: 40, lastHeight: 40 }),
      DESKTOP_1440,
    )
    const { top, max } = await mainScroll(p)
    expect({ top, scrollable: max > 2 }).toEqual({ top: 0, scrollable: false })
    expect(await settled(p)).toBe('Section 1')
    await p.raw.context().close()
  })
})
