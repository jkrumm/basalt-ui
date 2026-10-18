/**
 * Wave 38 strip footers and sibling qualifiers in a real browser: a footer Meter's captions stay on one
 * line and inside the footer box at every width, and sibling cards of one group place a narrow
 * qualifier the same way.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import type { LayoutPage, Viewport } from './harness'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
  PHONE,
  closeLayoutSuite,
  initLayoutSuite,
  openFixture,
} from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

const SPEC: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  dash: true,
}

const SNAP = 1

type Box = { text: string | null; left: number; right: number; top: number; bottom: number }
type Footer = { key: string | null; cell: Box; caps: Box[]; lines: number[] }

const footers = (p: LayoutPage): Promise<Footer[]> =>
  p.raw.evaluate(() => {
    const box = (el: Element) => {
      const r = el.getBoundingClientRect()
      return { text: el.textContent, left: r.left, right: r.right, top: r.top, bottom: r.bottom }
    }
    const host = document.querySelector('[data-testid="dash-w38-strip-footers"]')
    return [...(host?.querySelectorAll('[data-strip-footer-cell]') ?? [])].map((f) => {
      const caps = [...f.querySelectorAll('[data-meter-captions] > span')].filter(
        (c) => !c.hasAttribute('data-hidden'),
      )
      return {
        key: f.getAttribute('data-strip-footer-cell'),
        cell: box(f),
        caps: caps.map(box),
        lines: caps.map((c) => {
          const lh = Number.parseFloat(getComputedStyle(c).lineHeight) || c.clientHeight
          return Math.round(c.getBoundingClientRect().height / lh)
        }),
      }
    })
  })

const quals = (p: LayoutPage) =>
  p.raw.evaluate(() => {
    const host = document.querySelector('[data-testid="dash-qual-card"]')
    return [...(host?.querySelectorAll('[class*="captionMain_"]') ?? [])].map((main) => {
      const lead = main.querySelector('[class*="lead_"]')!.getBoundingClientRect()
      const q = main.querySelector('[class*="qualifier_"]')!.getBoundingClientRect()
      return { leadBottom: lead.bottom, qualifierTop: q.top }
    })
  })

layout('strip footers and sibling qualifiers (Wave 38)', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)
  const pages = new Map<number, LayoutPage>()
  const viewports: Viewport[] = [DESKTOP_1440, PHONE]
  beforeAll(async () => {
    for (const vp of viewports) {
      const p = await openFixture(SPEC, vp)
      await p.settle()
      pages.set(vp.width, p)
    }
  }, CLOSE_BUDGET_MS)

  test.each(viewports.map((v) => v.width))(
    'at %ipx footer Meter captions stay on one line and inside their footer cell',
    async (width) => {
      const all = await footers(pages.get(width)!)
      expect(all.map((f) => f.key)).toEqual(['day', 'week'])
      for (const f of all) {
        expect(f.caps.length).toBeGreaterThan(0)
        expect(f.lines).toEqual(f.caps.map(() => 1))
        for (const c of f.caps) {
          expect(c.left).toBeGreaterThanOrEqual(f.cell.left - SNAP)
          expect(c.right).toBeLessThanOrEqual(f.cell.right + SNAP)
          expect(c.bottom).toBeLessThanOrEqual(f.cell.bottom + SNAP)
        }
      }
    },
  )

  test.each(viewports.map((v) => v.width))(
    'at %ipx sibling cards place a narrow qualifier alike: always under the caption',
    async (width) => {
      for (const q of await quals(pages.get(width)!))
        expect(q.qualifierTop).toBeGreaterThanOrEqual(q.leadBottom - 0.5)
    },
  )
})
