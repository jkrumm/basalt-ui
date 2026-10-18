/**
 * Wave 38 list states in a real browser: a `BarList` in a card ends its error and empty bodies at
 * their content (no kept chart height), and its loading skeleton keeps the loaded footprint.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import type { LayoutPage } from './harness'
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
  barListStates: true,
}

/** Rounding slack for subpixel text metrics. */
const SLACK = 2

/** The states whose body must end at its content. */
const STATES_AT_CONTENT = ['empty', 'error', 'cardEmpty']

type Card = { card: number; body: number; content: number }

/** The body's box and the bottom of its last painted descendant, relative to the body's top. */
const read = (p: LayoutPage, state: string, width: string): Promise<Card> =>
  p.raw.evaluate(
    ([state, width]) => {
      const card = document.querySelector<HTMLElement>(
        `[data-testid="list-${state}-${width}"] [data-basalt-chart-card]`,
      )
      const body = card?.lastElementChild
      if (!card || !body) throw new Error(`LAYOUT: no card for ${state}-${width}`)
      const top = body.getBoundingClientRect().top
      const bottoms = [...body.querySelectorAll('*')]
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.height > 0)
        .map((r) => r.bottom)
      return {
        card: card.getBoundingClientRect().height,
        body: body.getBoundingClientRect().height,
        content: Math.max(...bottoms) - top,
      }
    },
    [state, width] as const,
  )

layout('BarList in a card: error, empty, loading', () => {
  let page: LayoutPage
  beforeAll(async () => {
    page = await openFixture(SPEC, DESKTOP_1440)
    await page.settle()
  })
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  for (const width of ['narrow', 'wide']) {
    for (const state of STATES_AT_CONTENT) {
      test(`${state} ends at its content (${width})`, async () => {
        // The body's own bottom inset is the loaded list's too: compare against it, not zero.
        const inset = await read(page, 'loaded', width)
        const r = await read(page, state, width)
        expect(r.body - r.content).toBeLessThanOrEqual(inset.body - inset.content + SLACK)
        expect(r.body).toBeLessThan(inset.body)
      })
    }

    for (const state of ['loading', 'cardLoading']) {
      test(`${state} keeps the loaded footprint (${width})`, async () => {
        const loaded = await read(page, 'loaded', width)
        const loading = await read(page, state, width)
        expect(Math.abs(loading.body - loaded.body)).toBeLessThanOrEqual(SLACK)
      })
    }
  }
})
