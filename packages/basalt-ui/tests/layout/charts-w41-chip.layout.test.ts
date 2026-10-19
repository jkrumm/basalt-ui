/**
 * Wave 41: argo's Reading pace strip cell (headline value and unit, a slotted `Bars` at height 28,
 * a footer) at keyboard focus: the readout chip clears the plot's focus ring and the cell's value.
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

const STRIP = '[data-testid="w41-chip-strip"]'
const CHIP = '.ts-chart-tooltip[data-basalt-slot]:not([hidden])'
/** Tab presses before giving up on reaching the strip's plot. */
const TAB_PRESSES = 40
/** The headline figure in the fixture's cell. */
const HEADLINE = '51'
/** Sub-pixel slack on a measured edge, px. */
const EDGE_EPS = 0.5
/** The figure may sit this far off the chip's centre (rounding of two line boxes), px. */
const CENTRE_TOLERANCE = 1
/** The chip may start this far above the headline's box bottom (its descender air), px. */
const VALUE_OVERLAP = 1

const spec: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  w41ChipStrip: true,
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
      await p.raw.evaluate(
        (q) => document.querySelector(q)?.scrollIntoView({ block: 'center' }),
        STRIP,
      )
      // Sequential focus, as `basalt-ui shot` reaches its focus state: Tab until the plot holds :focus-visible.
      let landed = false
      for (let i = 0; i < TAB_PRESSES && !landed; i += 1) {
        await p.raw.keyboard.press('Tab')
        landed = await p.raw.evaluate(
          (q) =>
            document.activeElement?.matches(':focus-visible') === true &&
            document.activeElement.closest(q) !== null,
          STRIP,
        )
      }
      if (!landed) throw new Error('LAYOUT: focus never reached the chip strip')
      await p.raw.waitForSelector(CHIP)
      const m = await p.raw.evaluate(
        ({ strip, chip, headline }) => {
          const root = document.querySelector(strip)
          const tip = document.querySelector(chip)
          const focused = document.activeElement
          if (!root || !tip || !focused) throw new Error('LAYOUT: missing strip, chip or focus')
          const value = [...root.querySelectorAll('*')].find(
            (el) => el.children.length === 0 && el.textContent === headline,
          )
          if (!value?.parentElement) throw new Error('LAYOUT: no headline value cell')
          const cs = getComputedStyle(focused)
          const t = tip.getBoundingClientRect()
          const figure = tip
            .querySelector('.ts-chart-tooltip__row > span:last-child')
            ?.getBoundingClientRect()
          if (!figure) throw new Error('LAYOUT: no figure in the chip')
          return {
            focused: focused.matches(':focus-visible'),
            ringStyle: cs.outlineStyle,
            // Air between the chip and the ring's outer edge (outline width + offset above the plot).
            airToRing:
              focused.getBoundingClientRect().top -
              parseFloat(cs.outlineOffset) -
              parseFloat(cs.outlineWidth) -
              t.bottom,
            figureOff: Math.abs(figure.top + figure.height / 2 - (t.top + t.height / 2)),
            aboveValue: t.top - value.parentElement.getBoundingClientRect().bottom,
            swatchShown: tip.querySelector('.ts-chart-tooltip__swatch')?.checkVisibility() ?? false,
            bg: getComputedStyle(tip).backgroundColor,
          }
        },
        { strip: STRIP, chip: CHIP, headline: HEADLINE },
      )
      expect(m.focused).toBe(true)
      expect(m.ringStyle).toBe('solid')
      expect(m.airToRing).toBeGreaterThanOrEqual(EDGE_EPS)
      // The figure is centred in the chip: a stacked swatch pushed it down and `overflow: hidden` cut it.
      expect(m.figureOff).toBeLessThanOrEqual(CENTRE_TOLERANCE)
      expect(m.aboveValue).toBeGreaterThanOrEqual(-VALUE_OVERLAP)
      expect(m.swatchShown).toBe(false)
      expect(m.bg).not.toMatch(/rgba|\//)
    },
  )
})
