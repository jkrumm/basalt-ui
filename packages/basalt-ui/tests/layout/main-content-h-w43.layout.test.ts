/**
 * Wave 43: `--basalt-main-content-h`, the content-box height of the scrollport, for a page that
 * fills it (argo's astro Map tab, which computed it from five shell vars plus the band's 1 px
 * border). An element at `height: var(--basalt-main-content-h)` fills Main exactly: no scroll in
 * Main, none on the page, at a desktop and a phone width, with and without a PageBar band.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
  MAIN,
  PHONE,
  closeLayoutSuite,
  initLayoutSuite,
  openFixture,
} from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

const FILL = '[data-testid="w43-fill"]'
/** Sub-pixel slack on a measured height, px. */
const EPS = 0.5

const base: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
}

layout('Wave 43 --basalt-main-content-h fills the scrollport', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  test.each([
    ['1440, no band', DESKTOP_1440, base],
    ['390, no band', PHONE, base],
    ['1440, band', DESKTOP_1440, { ...base, bar: { pills: 2, tabs: 2 } }],
    ['390, band', PHONE, { ...base, bar: { pills: 2, tabs: 2 } }],
  ] as const)('%s: the element fills Main with nothing to scroll', async (_, viewport, spec) => {
    const p = await openFixture(spec, viewport)
    await p.raw.evaluate(
      ([main, id]) => {
        const el = document.createElement('div')
        el.dataset['testid'] = id
        el.style.height = 'var(--basalt-main-content-h)'
        document.querySelector(main)?.replaceChildren(el)
      },
      [MAIN, 'w43-fill'] as const,
    )
    await p.settle()
    const inner = await p.raw.evaluate(
      ([main, fill]) => {
        const m = document.querySelector(main) as HTMLElement
        const f = document.querySelector(fill) as HTMLElement
        const cs = getComputedStyle(m)
        return {
          fill: f.getBoundingClientRect().height,
          content: m.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom),
          mainScroll: m.scrollHeight - m.clientHeight,
          pageScroll: document.documentElement.scrollHeight - document.documentElement.clientHeight,
        }
      },
      [MAIN, FILL] as const,
    )
    expect(Math.abs(inner.fill - inner.content)).toBeLessThanOrEqual(EPS)
    expect(inner.mainScroll).toBeLessThanOrEqual(EPS)
    expect(inner.pageScroll).toBeLessThanOrEqual(EPS)
  })
})
