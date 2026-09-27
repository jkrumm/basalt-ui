/**
 * Layout invariants for `overlays.confirm` as a bottom sheet at the `compact` size class
 * (`docs/DESIGN-CORE.md` § Layout, elevation, shapes). A real browser, because the sheet is a cascade outcome
 * (a `@media` rule over Mantine's own inner/content geometry) that happy-dom cannot resolve.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
  PHONE_375,
  closeLayoutSuite,
  initLayoutSuite,
  openFixture,
} from './harness'
import type { Viewport } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

const SPEC: FixtureSpec = {
  sections: [{ label: 'Home', items: [{ key: 'home', label: 'Home', active: true }] }],
  confirm: true,
}
const CONTENT = '.mantine-Modal-content'
const BUTTONS = `${CONTENT} .mantine-Group-root > button`
/** The WCAG 2.5.5 target size `--vx-hit` resolves to under a coarse pointer (the harness is one). */
const HIT_MIN = 44

/**
 * `BasaltOverlays` lazy-loads `@mantine/modals`, so a tap can land before the provider is live and
 * `overlays.confirm` rejects (a named error, by design). Retrying the tap is the honest wait.
 */
async function openConfirm(viewport: Viewport) {
  const p = await openFixture(SPEC, viewport)
  for (let attempt = 0; attempt < 10; attempt++) {
    await p.tap('[data-testid="open-confirm"]')
    if (await p.raw.waitForSelector(CONTENT, { state: 'visible', timeout: 1500 }).catch(() => null))
      break
  }
  await p.waitFor(CONTENT)
  await p.raw.waitForTimeout(400) // Mantine's slide/fade runs its own clock; measure the settled frame
  return p
}

layout('overlays.confirm — sheet vs modal', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  test('at 375px it is a full-width bottom sheet with hit-floor buttons', async () => {
    const p = await openConfirm(PHONE_375)
    const content = await p.box('confirm content', CONTENT)
    const { x, y, width, height } = content.box
    expect(x).toBeLessThanOrEqual(1)
    expect(width).toBeGreaterThanOrEqual(PHONE_375.width - 2)
    expect(y + height).toBeGreaterThanOrEqual(PHONE_375.height - 1)

    const radius = await p.computed(CONTENT, 'border-bottom-left-radius')
    expect(Number.parseFloat(radius)).toBe(0)

    const buttons = await p.boxes(BUTTONS)
    expect(buttons.length).toBe(2)
    for (const b of buttons) {
      expect(b.height).toBeGreaterThanOrEqual(HIT_MIN)
      expect(b.width).toBeGreaterThan(PHONE_375.width / 3)
    }
  })

  test('at 1440px it stays a floating modal, not a sheet', async () => {
    const p = await openConfirm(DESKTOP_1440)
    const { width, y, height } = (await p.box('confirm content', CONTENT)).box
    expect(width).toBeLessThan(DESKTOP_1440.width / 2)
    expect(y + height).toBeLessThan(DESKTOP_1440.height - 40)
  })
})
