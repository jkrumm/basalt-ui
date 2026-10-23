/**
 * `PageSummary`'s aside sits right after the sentence it dates, and wraps under it when the line is
 * full — never pinned to the row's far edge (W50 trial row 201: ~480 px from its sentence, and at
 * 390 the headline squeezed to three lines). Measured against real CSS geometry.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import { DESKTOP_1440, PHONE, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite)

const spec: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  w37: { summary: true },
}

const LONG = 'Practised 24 times in the last 30 days, up from 16 in the 30 days before.'

type Boxes = {
  row: { left: number; right: number }
  sentence: { left: number; right: number; bottom: number; height: number }
  aside: { left: number; top: number }
}

layout('PageSummary aside placement', () => {
  const read = async (viewport: typeof PHONE, sentence?: string): Promise<Boxes> => {
    const page = await openFixture(spec, viewport)
    return page.raw.evaluate((text: string | null) => {
      const root = document.querySelector<HTMLElement>('[data-page-summary]')
      const h2 = root?.querySelector<HTMLElement>('h2')
      const aside = h2?.nextElementSibling as HTMLElement | null
      if (!root || !h2 || !aside) throw new Error('LAYOUT: PageSummary sentence + aside missing')
      if (text !== null) h2.textContent = text
      const top = h2.parentElement as HTMLElement
      const row = top.getBoundingClientRect()
      const s = h2.getBoundingClientRect()
      const a = aside.getBoundingClientRect()
      return {
        row: { left: row.left, right: row.right },
        sentence: { left: s.left, right: s.right, bottom: s.bottom, height: s.height },
        aside: { left: a.left, top: a.top },
      }
    }, sentence ?? null)
  }

  test('desktop: the aside follows the sentence within one gap, not at the far edge', async () => {
    const m = await read(DESKTOP_1440)
    const gap = m.aside.left - m.sentence.right
    expect(gap, 'aside starts right after the sentence').toBeGreaterThanOrEqual(0)
    expect(gap, 'and within a gap or two of it').toBeLessThan(48)
    expect(m.row.right - m.aside.left, 'far from the row edge').toBeGreaterThan(300)
  })

  test('390: a full line wraps the aside under its sentence, flush with the start', async () => {
    const m = await read(PHONE, LONG)
    expect(m.aside.top, 'aside sits below the sentence').toBeGreaterThanOrEqual(
      m.sentence.bottom - 1,
    )
    expect(m.aside.left, 'and starts at the row start').toBeCloseTo(m.row.left, 0)
    expect(m.sentence.right, 'the sentence keeps the full width').toBeLessThanOrEqual(
      m.row.right + 1,
    )
  })
})
