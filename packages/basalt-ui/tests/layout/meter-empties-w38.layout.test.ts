/**
 * Wave 38 empty cells and Meters in a real browser: a null or loading Meter stands at the loaded
 * Meter's height with no dash under its track, and a strip cell with a stated reason prints no
 * placeholder glyph in the value's place.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import type { LayoutPage } from './harness'
import { CLOSE_BUDGET_MS, PHONE, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

const SPEC: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  dash: true,
}

const SUBPIXEL = 1

const heightOf = (p: LayoutPage, id: string): Promise<number> =>
  p.raw.evaluate((id) => {
    const el = document.querySelector(`[data-testid="${id}"]`)
    if (!el) throw new Error(`LAYOUT: no ${id}`)
    return el.getBoundingClientRect().height
  }, id)

const textOf = (p: LayoutPage, id: string): Promise<string> =>
  p.raw.evaluate((id) => document.querySelector(`[data-testid="${id}"]`)?.textContent ?? '', id)

layout('empty cells and Meters (Wave 38)', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)
  let p: LayoutPage
  beforeAll(async () => {
    p = await openFixture(SPEC, PHONE)
    await p.settle()
  }, CLOSE_BUDGET_MS)

  test.each(['bar', 'zoned'])(
    'a null %s Meter stands at the loaded height, with no dash',
    async (kind) => {
      const loaded = await heightOf(p, `dash-w38-${kind}-loaded`)
      expect(Math.abs((await heightOf(p, `dash-w38-${kind}-empty`)) - loaded)).toBeLessThanOrEqual(
        SUBPIXEL,
      )
      expect(await textOf(p, `dash-w38-${kind}-empty`)).not.toContain('—')
    },
  )

  test.each(['bar', 'zoned'])('a loading %s Meter stands at the loaded height', async (kind) => {
    const loaded = await heightOf(p, `dash-w38-${kind}-loaded`)
    expect(Math.abs((await heightOf(p, `dash-w38-${kind}-loading`)) - loaded)).toBeLessThanOrEqual(
      SUBPIXEL,
    )
  })

  test('an empty strip cell with a reason prints no dash; without one it prints the dash', async () => {
    const cells = await p.raw.evaluate(() => {
      const text = (key: string) =>
        document.querySelector(`[data-testid="dash-w38-strip-empty"] [data-strip-cell="${key}"]`)
          ?.textContent ?? ''
      return { pace: text('pace'), bare: text('bare') }
    })
    expect(cells.pace).toContain('No walks')
    expect(cells.pace).not.toContain('—')
    expect(cells.bare).toContain('—')
  })
})
