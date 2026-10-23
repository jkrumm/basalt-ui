/**
 * Wave 37 round r2 in a real browser: a BarList's text secondary lines up on its start edge and never
 * overruns the track, a column of deltas keeps one glyph-to-figure gap, and a status Badge keeps its sentence case.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
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

const specFor = (colorScheme: 'light' | 'dark'): FixtureSpec => ({
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  colorScheme,
  dash: true,
  chromeW37: true,
})

const SNAP = 1

layout('Wave 37 r2 lists and chrome', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  test('a text secondary starts on one x at a desktop width (the dots line up)', async () => {
    const p = await openFixture(specFor('light'), DESKTOP_1440)
    await p.settle()
    const lefts = await p.raw.evaluate(() => {
      const host = document.querySelector('[data-testid="dash-bar-status-700"]')!
      return [...host.querySelectorAll('[data-verdict-word]')].map(
        (w) => (w.previousElementSibling ?? w).getBoundingClientRect().left,
      )
    })
    expect(lefts).toHaveLength(3)
    expect(Math.max(...lefts) - Math.min(...lefts)).toBeLessThanOrEqual(SNAP)
  })

  test('at 390 the secondary ends inside the track', async () => {
    const p = await openFixture(specFor('light'), PHONE)
    await p.settle()
    const rows = await p.raw.evaluate(() => {
      const host = document.querySelector('[data-testid="dash-bar-status-300"]')!
      return [...host.querySelectorAll('li')].map((li) => {
        const word = li.querySelector('[data-verdict-word]')!
        const cell = word.closest('li > span')!
        const range = document.createRange()
        range.selectNodeContents(word)
        return {
          // The painted edge: a truncated word's text range runs past its box, which clips it.
          right: Math.min(range.getBoundingClientRect().right, word.getBoundingClientRect().right),
          wordRight: word.getBoundingClientRect().right,
          trackRight: li.querySelector('[data-bar-track]')!.getBoundingClientRect().right,
          clipped:
            word.scrollWidth > word.clientWidth + 1 || cell.scrollWidth > cell.clientWidth + 1,
          title: cell.getAttribute('title') ?? word.getAttribute('title'),
        }
      })
    })
    for (const r of rows) {
      expect(r.right).toBeLessThanOrEqual(r.trackRight + 0.5)
      expect(r.wordRight).toBeLessThanOrEqual(r.trackRight + 0.5)
      if (r.clipped) expect(r.title).not.toBeNull()
    }
  })

  test('a column of deltas keeps one glyph-to-figure gap and aligned figures', async () => {
    const p = await openFixture(specFor('light'), DESKTOP_1440)
    await p.settle()
    const rows = await p.raw.evaluate(() => {
      const host = document.querySelector('[data-testid="dash-delta-column"]')!
      return [...host.querySelectorAll('[data-delta-row]')].map((row) => {
        const badge = row.firstElementChild!
        const glyph = badge.firstElementChild!
        const text = badge.lastChild!
        const range = document.createRange()
        range.setStart(text, 0)
        range.setEnd(text, text.textContent!.length)
        const fig = range.getBoundingClientRect()
        return { gap: fig.left - glyph.getBoundingClientRect().right, figRight: fig.right }
      })
    })
    expect(rows).toHaveLength(4)
    const gaps = rows.map((r) => r.gap)
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThanOrEqual(0.5)
    const rights = rows.map((r) => r.figRight)
    expect(Math.max(...rights) - Math.min(...rights)).toBeLessThanOrEqual(SNAP)
  })

  test('BarList DeltaBadge secondaries end-align as a unit: the figures share their right edge (Wave 38: the glyph x no longer does)', async () => {
    const p = await openFixture(specFor('light'), DESKTOP_1440)
    await p.settle()
    const rows = await p.raw.evaluate(() => {
      const host = document.querySelector('[data-testid="dash-bar-delta"]')!
      return [...host.querySelectorAll('[data-delta]')].map((badge) => {
        const text = badge.lastChild!
        const range = document.createRange()
        range.setStart(text, 0)
        range.setEnd(text, text.textContent!.length)
        return { figRight: range.getBoundingClientRect().right }
      })
    })
    expect(rows).toHaveLength(4)
    const spread = (xs: number[]) => Math.max(...xs) - Math.min(...xs)
    expect(spread(rows.map((r) => r.figRight))).toBeLessThanOrEqual(SNAP)
  })

  test("a BarList DeltaBadge sits on its value's baseline", async () => {
    const p = await openFixture(specFor('light'), DESKTOP_1440)
    await p.settle()
    const offsets = await p.raw.evaluate(() => {
      const host = document.querySelector<HTMLElement>('[data-testid="dash-bar-delta"]')!
      // The stacked (narrow) layout is where the offset showed.
      host.style.width = '340px'
      // A zero-size inline-block at the text's end sits on the baseline: its bottom IS the baseline.
      const baseline = (el: Element) => {
        const probe = document.createElement('span')
        probe.style.cssText = 'display:inline-block;width:0;height:0'
        el.append(probe)
        const y = probe.getBoundingClientRect().bottom
        probe.remove()
        return y
      }
      return [...host.querySelectorAll('li')].map((li) => {
        const value = li.children[1]!
        const delta = li.querySelector('[data-delta]')!
        return Math.abs(baseline(value) - baseline(delta))
      })
    })
    expect(offsets).toHaveLength(4)
    for (const off of offsets) expect(off).toBeLessThanOrEqual(1)
  })

  test('secondaryAlign="end" overrides the auto start alignment of status marks', async () => {
    const p = await openFixture(specFor('light'), DESKTOP_1440)
    await p.settle()
    const rights = await p.raw.evaluate(() =>
      [...document.querySelectorAll('[data-testid="dash-bar-override"] [data-verdict-word]')].map(
        (w) => w.getBoundingClientRect().right,
      ),
    )
    expect(rights).toHaveLength(3)
    expect(Math.max(...rights) - Math.min(...rights)).toBeLessThanOrEqual(SNAP)
  })

  for (const scheme of ['light', 'dark'] as const) {
    test(`${scheme}: a status Badge keeps the case it was written in`, async () => {
      const p = await openFixture(specFor(scheme), DESKTOP_1440)
      await p.settle()
      const cases = await p.raw.evaluate(() =>
        ['w37-badge-green', 'w37-badge-neutral'].map(
          (id) => getComputedStyle(document.querySelector(`[data-testid="${id}"]`)!).textTransform,
        ),
      )
      expect(cases).toEqual(['none', 'none'])
    })
  }
})
