/**
 * Layout invariants for the theme-owned card inset (Wave 35, ledger rows 163/165): a bare `Card` and
 * `Paper` resolve to the 12/16 tokens, `variant="flush"` is 0, a `Card.Section` bleeds to the card
 * edge, a consumer's class-based padding wins, density and the compact width move the inset, and the
 * Mantine components that render a `Paper` of their own gain nothing. Real Chrome, because Bun maps
 * `.module.css` to `{}` and happy-dom computes no stylesheet.
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

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

const SPEC: FixtureSpec = {
  sections: [{ label: 'Home', items: [{ key: 'home', label: 'Home', active: true }] }],
  cardInset: true,
  confirm: true,
}

const id = (name: string): string => `[data-testid="${name}"]`
const SIDES = ['top', 'right', 'bottom', 'left'] as const

async function padding(
  p: Awaited<ReturnType<typeof openFixture>>,
  selector: string,
): Promise<string[]> {
  return Promise.all(SIDES.map((side) => p.computed(selector, `padding-${side}`)))
}

layout('card inset is the theme’s', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  test('a bare Card and a bare Paper are 12 / 16 at desktop width', async () => {
    const p = await openFixture(SPEC, DESKTOP_1440)
    const want = ['12px', '16px', '12px', '16px']
    expect(await padding(p, id('inset-card'))).toEqual(want)
    expect(await padding(p, id('inset-paper'))).toEqual(want)
  })

  test('variant="flush" is 0 on every side', async () => {
    const p = await openFixture(SPEC, DESKTOP_1440)
    expect(await padding(p, id('inset-flush'))).toEqual(['0px', '0px', '0px', '0px'])
  })

  test('a Card.Section bleeds to the card edge (margin-inline -16, same width as the card)', async () => {
    const p = await openFixture(SPEC, DESKTOP_1440)
    const section = id('inset-section-bar')
    expect(await p.computed(section, 'margin-left')).toBe('-16px')
    expect(await p.computed(section, 'margin-right')).toBe('-16px')
    expect(await p.computed(section, 'margin-top')).toBe('-12px')
    const card = (await p.box('card', id('inset-section'))).box
    const bar = (await p.box('section', section)).box
    expect(bar.x).toBeCloseTo(card.x, 0)
    expect(bar.width).toBeCloseTo(card.width, 0)
    expect(bar.y).toBeCloseTo(card.y, 0)
  })

  test('a consumer class-based `padding: 0` beats the theme inset', async () => {
    const p = await openFixture(SPEC, DESKTOP_1440)
    expect(await padding(p, id('inset-override'))).toEqual(['0px', '0px', '0px', '0px'])
  })

  test('at the compact width the horizontal inset steps down with the token, vertical holds', async () => {
    const p = await openFixture(SPEC, PHONE_375)
    const card = await padding(p, id('inset-card'))
    expect(card).toEqual(['12px', '12px', '12px', '12px'])
    expect(await padding(p, id('inset-paper'))).toEqual(card)
  })

  test('a density level other than 0 scales the inset through the same tokens', async () => {
    const level0 = await openFixture(SPEC, DESKTOP_1440)
    const base = await padding(level0, id('inset-card'))
    const dense = await openFixture({ ...SPEC, density: -3 }, DESKTOP_1440)
    const roomy = await openFixture({ ...SPEC, density: 3 }, DESKTOP_1440)
    const px = (v: string[]): number[] => v.map(Number.parseFloat)
    const [d, r, b] = [
      px(await padding(dense, id('inset-card'))),
      px(await padding(roomy, id('inset-card'))),
      px(base),
    ]
    expect(d[0]).toBeLessThan(b[0] as number)
    expect(r[0]).toBeGreaterThan(b[0] as number)
    // The token is the single source: the Paper resolves to the very same numbers.
    expect(px(await padding(roomy, id('inset-paper')))).toEqual(r)
  })

  test('a Modal content (a Paper Mantine renders itself) gains no padding', async () => {
    const p = await openFixture(SPEC, DESKTOP_1440)
    const CONTENT = '.mantine-Modal-content'
    for (let attempt = 0; attempt < 10; attempt++) {
      await p.tap('[data-testid="open-confirm"]')
      if (
        await p.raw.waitForSelector(CONTENT, { state: 'visible', timeout: 1500 }).catch(() => null)
      )
        break
    }
    await p.waitFor(CONTENT)
    await p.raw.waitForTimeout(400)
    expect(await padding(p, CONTENT)).toEqual(['0px', '0px', '0px', '0px'])
  })
})
