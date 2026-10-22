/**
 * Wave 43 (argo UPSTREAM § Wave 52 row 3): a lone `danger` row action rests as the same neutral as
 * any row action and turns to the danger colour on the control's OWN hover or keyboard focus only.
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

const DANGER = '[data-testid="w43-danger-table"] tbody tr:nth-child(1) button[aria-label^="Delete"]'
const SECOND = '[data-testid="w43-danger-table"] tbody tr:nth-child(2) button[aria-label^="Delete"]'
const PLAIN = '[data-testid="w43-plain-table"] tbody tr:nth-child(1) button[aria-label^="Edit"]'

const spec: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  w43Danger: true,
}

layout('Wave 43 lone danger row action', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  test('neutral at rest, danger on its own hover and focus-visible, never on the row hover', async () => {
    const p = await openFixture(spec, DESKTOP_1440, '/', 'reduce', 'fine')
    await p.settle()
    const colorOf = (sel: string) =>
      p.raw.evaluate((q) => getComputedStyle(document.querySelector(q) as Element).color, sel)

    const rest = await colorOf(DANGER)
    expect(rest).toBe(await colorOf(PLAIN))

    // Hovering the row (a cell away from the button) must not light the icon.
    await p.raw.hover('[data-testid="w43-danger-table"] tbody tr:nth-child(1) td:first-child')
    expect(await colorOf(DANGER)).toBe(rest)

    await p.raw.hover(DANGER)
    const hovered = await colorOf(DANGER)
    expect(hovered).not.toBe(rest)
    // Row 2 is still neutral while row 1's icon is hovered.
    expect(await colorOf(SECOND)).toBe(rest)

    await p.raw.mouse.move(0, 0)
    await p.raw.focus(DANGER)
    await p.raw.keyboard.press('Shift+Tab')
    await p.raw.keyboard.press('Tab')
    expect(await p.raw.evaluate((q) => document.activeElement?.matches(q), DANGER)).toBe(true)
    expect(await colorOf(DANGER)).toBe(hovered)
  })
})
