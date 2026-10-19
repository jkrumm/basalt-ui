/**
 * Wave 41: argo's Reading pace strip cell (headline value and unit, a slotted `Bars` at height 28,
 * a footer) at keyboard focus: the readout chip clears the host's focus ring and the cell's value.
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

const spec: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  w38BarsSlot: true,
}

layout('Wave 41 slotted Bars chip at keyboard focus', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  test.each([
    ['1440', DESKTOP_1440],
    ['390', PHONE],
  ] as const)(
    '%s: the chip sits above the focus ring, below the value, and opaque',
    async (_, viewport) => {
      const p = await openFixture(spec, viewport)
      await p.settle()
      await p.raw.evaluate(() =>
        document
          .querySelector('[data-testid="w41-chip-strip"]')
          ?.scrollIntoView({ block: 'center' }),
      )
      // Sequential focus, as `basalt-ui shot` reaches its focus state: Tab until the host holds :focus-visible.
      for (let i = 0; i < 40; i += 1) {
        await p.raw.keyboard.press('Tab')
        const landed = await p.raw.evaluate(
          () =>
            document.activeElement?.matches(':focus-visible') === true &&
            document.activeElement.closest('[data-testid="w41-chip-strip"]') !== null,
        )
        if (landed) break
      }
      await p.raw.waitForSelector('.ts-chart-tooltip[data-basalt-slot]:not([hidden])')
      const m = await p.raw.evaluate(() => {
        const root = document.querySelector('[data-testid="w41-chip-strip"]')
        const tip = document.querySelector('.ts-chart-tooltip[data-basalt-slot]:not([hidden])')
        const ring = document.activeElement
        if (!root || !tip || !ring) throw new Error('LAYOUT: missing root, chip or focus')
        const cs = getComputedStyle(ring)
        const t = tip.getBoundingClientRect()
        const figure = tip
          .querySelector('.ts-chart-tooltip__row > span:last-child')
          ?.getBoundingClientRect()
        const value = [...root.querySelectorAll('*')].find(
          (el) => el.children.length === 0 && el.textContent === '51',
        )
        return {
          focused: ring.matches(':focus-visible'),
          ringStyle: cs.outlineStyle,
          // Air between the chip and the ring's outer edge (outline width + offset above the plot).
          airToRing:
            ring.getBoundingClientRect().top -
            parseFloat(cs.outlineOffset) -
            parseFloat(cs.outlineWidth) -
            t.bottom,
          figureOff: figure
            ? Math.abs(figure.top + figure.height / 2 - (t.top + t.height / 2))
            : 99,
          aboveValue: t.top - (value?.parentElement?.getBoundingClientRect().bottom ?? Infinity),
          swatchShown: tip.querySelector('.ts-chart-tooltip__swatch')?.checkVisibility() ?? false,
          bg: getComputedStyle(tip).backgroundColor,
        }
      })
      expect(m.focused).toBe(true)
      expect(m.ringStyle).toBe('solid')
      expect(m.airToRing).toBeGreaterThanOrEqual(0.5)
      // The figure is centred in the chip: a stacked swatch pushed it down and `overflow: hidden` cut it.
      expect(m.figureOff).toBeLessThanOrEqual(1)
      expect(m.aboveValue).toBeGreaterThanOrEqual(-1)
      expect(m.swatchShown).toBe(false)
      expect(m.bg).not.toMatch(/rgba|\//)
    },
  )
})
