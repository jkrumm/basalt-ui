/**
 * Wave 43: a `Paper` floating over a `Card variant="flush"` (argo's astro Map tab: a time scrubber
 * over a full-bleed map) steps DOWN the radius scale instead of sharing the card's radius, which
 * `shot detect` flags as `craft-1/nested-radius-step` (< 3 px apart). The overlay is a clone of the
 * fixture's real Mantine `Paper`, so the cascade under test is the theme's own.
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

const specAt = (radius: FixtureSpec['radius'] = 0): FixtureSpec => ({
  sections: [{ label: 'Home', items: [{ key: 'home', label: 'Home', active: true }] }],
  cardInset: true,
  radius,
})
const SPEC = specAt()

/** `NESTED_MIN_STEP_PX` in `src/cli/shot/detect.ts`. */
const NESTED_MIN_STEP_PX = 3
/** The level-0 radius scale: Mantine's xs/sm/md steps plus the `--vx-radius-*` tiers (px). */
const SCALE = [0, 2, 4, 5, 6, 10, 11, 16, 32]

async function radii(
  viewport: typeof DESKTOP_1440,
  overlayStyle = '',
  overlayClass = '',
  radius: FixtureSpec['radius'] = 0,
): Promise<{ card: number; overlay: number }> {
  const p = await openFixture(specAt(radius), viewport)
  return p.raw.evaluate(
    ([style, cls]) => {
      const card = document.querySelector('[data-testid="inset-flush"]') as HTMLElement
      const overlay = (
        document.querySelector('[data-testid="inset-paper"]') as HTMLElement
      ).cloneNode(true) as HTMLElement
      overlay.dataset['testid'] = 'w43-overlay'
      overlay.style.cssText += style
      if (cls) overlay.className += ` ${cls}`
      card.append(overlay)
      return {
        card: parseFloat(getComputedStyle(card).borderTopLeftRadius),
        overlay: parseFloat(getComputedStyle(overlay).borderTopLeftRadius),
      }
    },
    [overlayStyle, overlayClass] as const,
  )
}

layout('Wave 43 overlay Paper over a flush Card', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  test.each([
    ['1440', DESKTOP_1440],
    ['390', PHONE],
  ] as const)('%s: the overlay is a scale step at least 3 px under the card', async (_, vp) => {
    const { card, overlay } = await radii(vp)
    expect(card - overlay).toBeGreaterThanOrEqual(NESTED_MIN_STEP_PX)
    expect(SCALE).toContain(overlay)
  })

  test('an explicit radius (Mantine writes --paper-radius) wins over the step', async () => {
    const { overlay } = await radii(DESKTOP_1440, '--paper-radius: 2px;')
    expect(overlay).toBe(2)
  })

  test.each([-5, 5] as const)(
    'radius knob %i: the overlay is exactly 4 px under the card',
    async (radius) => {
      const { card, overlay } = await radii(DESKTOP_1440, '', '', radius)
      expect(card - overlay).toBe(4)
    },
  )

  // The fixture has no Popover, so the clone carries Mantine's static class names: what the rule's
  // exclusion reads. A `withinPortal={false}` Popover/Menu dropdown renders inside the card.
  test.each(['mantine-Popover-dropdown', 'mantine-Menu-dropdown', 'mantine-Modal-content'])(
    'a %s Paper inside the card keeps the card radius',
    async (cls) => {
      const { card, overlay } = await radii(DESKTOP_1440, '', cls)
      expect(overlay).toBe(card)
    },
  )

  test('a Paper outside a flush card keeps the card radius', async () => {
    const p = await openFixture(SPEC, DESKTOP_1440)
    expect(await p.computed('[data-testid="inset-paper"]', 'border-top-left-radius')).toBe('10px')
  })
})
