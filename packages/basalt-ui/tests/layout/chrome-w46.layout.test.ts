/**
 * Wave 46 chrome in a real browser: a filled primary Button takes a hover step in both schemes (the
 * Wave 45 r3 S5 crop showed hover == rest: the shot hovered the anchor's centre, not the button), the
 * Sparkline readout keeps clear of its reference label, and the strip skeleton keeps the sparkline row.
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

const specFor = (colorScheme: 'light' | 'dark'): FixtureSpec => ({
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  colorScheme,
  buttonSections: true,
})

layout('Wave 46 chrome', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  for (const scheme of ['light', 'dark'] as const) {
    test(`${scheme}: a filled primary Button's hovered background differs from rest`, async () => {
      const p = await openFixture(specFor(scheme), DESKTOP_1440, '/', 'reduce', 'fine')
      await p.settle()
      const button = '[data-testid="btn-md-filled"] button'
      const bg = () => p.computed(button, 'background-color')
      const rest = await bg()
      await p.raw.hover(button)
      // The background transitions: wait for it to leave rest rather than sleeping.
      await p.raw
        .waitForFunction(
          ([sel, before]) =>
            getComputedStyle(document.querySelector(sel!)!).backgroundColor !== before,
          [button, rest] as const,
          { timeout: 2_000 },
        )
        .catch(() => undefined)
      expect(await bg()).not.toBe(rest)
    })
  }

  test('the Sparkline hover readout never overlaps its reference label', async () => {
    const p = await openFixture(
      { ...specFor('light'), w43Spark: true },
      DESKTOP_1440,
      '/',
      'reduce',
      'fine',
    )
    await p.settle()
    // A caption is drawn at rest and gone (or clear of the chip) while the readout shows.
    const probe = (
      q: string,
      n: number,
    ): Promise<{ labels: number; shown: number; hit: boolean }> =>
      p.raw.evaluate(
        ([sel, i]) => {
          const root = document.querySelectorAll(sel as string)[i as number]!
          const out = root.querySelector('[data-basalt-sparkline-readout]')
          const box = out?.getBoundingClientRect()
          const texts = [...root.querySelectorAll('svg text')].filter(
            (t) => t.getBoundingClientRect().width > 0,
          )
          const shown = texts.filter((t) => getComputedStyle(t).visibility !== 'hidden')
          const hit = shown.some((t) => {
            const b = t.getBoundingClientRect()
            return (
              box !== undefined &&
              b.left < box.right &&
              b.right > box.left &&
              b.top < box.bottom &&
              b.bottom > box.top
            )
          })
          return { labels: texts.length, shown: shown.length, hit }
        },
        [q, n] as const,
      )
    for (const id of ['w43-spark', 'w43-spark-wide']) {
      const spark = `[data-testid="${id}"] [data-basalt-sparkline]`
      for (let i = 0; i < 2; i++) {
        const r = await p.raw.evaluate(
          ([q, n]) => {
            const el = document.querySelectorAll(q as string)[n as number]!
            el.scrollIntoView({ block: 'center' })
            const b = el.getBoundingClientRect()
            return { x: b.x, y: b.y, w: b.width, h: b.height }
          },
          [spark, i] as const,
        )
        await p.raw.mouse.move(0, 0)
        const rest = await probe(spark, i)
        expect(rest.labels).toBeGreaterThan(0)
        expect(rest.shown).toBe(rest.labels)
        for (const f of [0.05, 0.25, 0.5, 0.75, 0.95]) {
          await p.raw.mouse.move(r.x + r.w * f - 2, r.y + r.h / 2)
          await p.raw.mouse.move(r.x + r.w * f, r.y + r.h / 2)
          const hovered = await probe(spark, i)
          expect(hovered.hit).toBe(false)
          expect(hovered.shown).toBe(0)
        }
      }
    }
  })
})
