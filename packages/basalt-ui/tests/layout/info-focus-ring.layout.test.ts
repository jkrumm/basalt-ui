/**
 * Layout invariant for the `info` glyph's keyboard focus ring: the ring hugs the 11px glyph and
 * never paints over the title text beside it, while the trigger stays a 24x24 hit target
 * (WCAG 2.5.8). The ring used to be drawn on the 24px box, which reaches 6.5px past the glyph.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
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
  cards: { widths: [], foldNote: [700] },
}

layout('info glyph focus ring', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  test('the ring clears the title text and the trigger keeps its 24px hit box', async () => {
    const p = await openFixture(SPEC, DESKTOP_1440, '/', 'reduce', 'fine')
    await p.settle()

    const trigger = '[data-testid="fold-700"] button[aria-label^="More information"]'
    await p.raw.focus(trigger)
    await p.raw.keyboard.press('Shift+Tab')
    await p.raw.keyboard.press('Tab')

    const m = await p.raw.evaluate((sel) => {
      const button = document.querySelector<HTMLElement>(sel)
      if (!button) throw new Error('no info trigger')
      const svg = button.querySelector('svg')
      const title = button
        .closest('[data-testid]')
        ?.querySelector<HTMLElement>('[class*="titleText"]')
      if (!svg || !title) throw new Error('no glyph or title')
      const glyph = svg.getBoundingClientRect()
      const style = getComputedStyle(svg)
      const reach = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset)
      const range = document.createRange()
      range.selectNodeContents(title)
      const text = range.getBoundingClientRect()
      const hit = button.getBoundingClientRect()
      return {
        focused: document.activeElement === button && button.matches(':focus-visible'),
        outlineStyle: style.outlineStyle,
        boxOutline: getComputedStyle(button).outlineStyle,
        reach,
        ring: { left: glyph.left - reach, right: glyph.right + reach },
        text: { right: text.right },
        hit: { width: hit.width, height: hit.height },
      }
    }, trigger)

    expect(m.focused).toBe(true)
    expect(m.outlineStyle).toBe('solid')
    expect(m.boxOutline).toBe('none')
    expect(m.reach).toBeGreaterThan(0)
    expect(m.ring.left).toBeGreaterThanOrEqual(m.text.right)
    expect(m.hit.width).toBeGreaterThanOrEqual(24)
    expect(m.hit.height).toBeGreaterThanOrEqual(24)
  })
})
