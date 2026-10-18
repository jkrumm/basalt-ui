/**
 * Head-face numerals in a real browser: Hubot Sans has no `zero` feature and draws a slashed zero,
 * so the head stack leads with a digits-only face cut from the sans (`Basalt Head Digits`). A digit
 * in a head-face title must measure like the sans digit, not the Hubot one; letters stay Hubot.
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
}

layout('heading numerals use the sans digits', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  let p: LayoutPage
  beforeAll(async () => {
    p = await openFixture(SPEC, DESKTOP_1440)
    await p.settle()
  }, CLOSE_BUDGET_MS)

  test('"0" in a head-face title measures as the Nunito digit, not the Hubot one', async () => {
    const w = await p.raw.evaluate(async () => {
      const fonts = ['Nunito Sans Variable', 'Hubot Sans Variable']
      await Promise.all(fonts.map((f) => document.fonts.load(`400 40px "${f}"`, '0A')))
      await document.fonts.load('400 40px var(--basalt-font-head)', '0').catch(() => [])
      const measure = (family: string, text: string, stretch = 'normal'): number => {
        const el = document.createElement('span')
        el.textContent = text
        el.style.cssText = `position:absolute;white-space:pre;font:400 40px ${family};font-stretch:${stretch};font-variant-numeric:lining-nums`
        document.body.append(el)
        const width = el.getBoundingClientRect().width
        el.remove()
        return width
      }
      const head = 'var(--basalt-font-head)'
      return {
        sans0: measure(`"Nunito Sans Variable"`, '0'),
        hubot0: measure(`"Hubot Sans Variable"`, '0'),
        headZero: measure(head, '0'),
        headA: measure(head, 'A'),
        hubotA: measure(`"Hubot Sans Variable"`, 'A'),
        headZero88: measure(head, '0', '88%'),
        headA88: measure(head, 'A', '88%'),
      }
    })
    expect(w.sans0).not.toBeCloseTo(w.hubot0, 1)
    expect(w.headZero).toBeCloseTo(w.sans0, 1)
    expect(w.headA).toBeCloseTo(w.hubotA, 1)

    // The shipped Hubot file is the wght-only cut (no `wdth` axis), so the head surfaces'
    // `font-stretch: 88%` condenses neither letters nor digits: digits cannot mismatch the letters.
    // If the head face ever moves to the wdth cut, the digit face must follow or this fails.
    expect(w.headA88).toBeCloseTo(w.headA, 1)
    expect(w.headZero88).toBeCloseTo(w.headZero, 1)
  })
})
