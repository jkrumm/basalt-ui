/**
 * Wave 46 chrome in a real browser: a filled primary Button takes a hover step in both schemes (the
 * Wave 45 r3 S5 crop showed hover == rest: the shot hovered the anchor's centre, not the button) and
 * the Sparkline readout keeps clear of its reference caption.
 */
import { afterAll, describe, expect, test } from 'bun:test'
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

/** The background transitions on hover: how long to wait for it to leave rest. */
const HOVER_SETTLE_MS = 2_000
/** Pointer stops across a sparkline, as shares of its width (both edges and the middle). */
const POINTER_STOPS = [0.05, 0.25, 0.5, 0.75, 0.95] as const
/** The engine's reference caption group (`ref-label.ts` → the `reference-label` text mark). */
const CAPTION = '[data-ts-key="reference-label"]'
/** The hovered fill must read against rest at button size: a luminance ratio the old 4.8-tone step missed. */
const MIN_HOVER_CONTRAST = 1.25
/** Consecutive equal reads that mean the hover transition has finished. */
const STABLE_READS = 3
/** The longest the hovered fill may keep changing before the test reports the last colour it saw. */
const SETTLE_DEADLINE_MS = 3_000
/** Pause between settle reads. */
const SETTLE_POLL_MS = 50
const READOUT = '[data-basalt-sparkline-readout]'
const SPARK_HOSTS = ['w43-spark', 'w43-spark-wide'] as const
/** Sparklines per host in the w43 fixture. */
const SPARKS_PER_HOST = 2

const specFor = (colorScheme: 'light' | 'dark'): FixtureSpec => ({
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  colorScheme,
  buttonSections: true,
})

type Reading = { readout: boolean; captions: number; visible: number; overlap: boolean }

/** The caption and readout state of the n-th sparkline under `selector`. */
const read = (p: LayoutPage, selector: string, n: number): Promise<Reading> =>
  p.raw.evaluate(
    ([sel, i, captionSel, readoutSel]) => {
      const root = document.querySelectorAll(sel as string)[i as number]!
      const chip = root.querySelector(readoutSel as string)
      const box = chip?.getBoundingClientRect()
      const captions = [...root.querySelectorAll(captionSel as string)]
      const visible = captions.filter((c) => getComputedStyle(c).visibility !== 'hidden')
      const overlap = visible.some((c) => {
        const b = c.getBoundingClientRect()
        return (
          box !== undefined &&
          b.left < box.right &&
          b.right > box.left &&
          b.top < box.bottom &&
          b.bottom > box.top
        )
      })
      return {
        readout: chip !== null,
        captions: captions.length,
        visible: visible.length,
        overlap,
      }
    },
    [selector, n, CAPTION, READOUT] as const,
  )

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
      // The pointer must really be over the button, or an unchanged colour proves nothing.
      expect(
        await p.raw.evaluate((s) => document.querySelector(s)!.matches(':hover'), button),
      ).toBe(true)
      await p.raw.waitForFunction(
        ([sel, before]) =>
          getComputedStyle(document.querySelector(sel!)!).backgroundColor !== before,
        [button, rest] as const,
        { timeout: HOVER_SETTLE_MS },
      )
      // Read the colour once the transition has finished, then compare it to rest.
      let hovered = await bg()
      const deadline = Date.now() + SETTLE_DEADLINE_MS
      for (let stable = 0; stable < STABLE_READS;) {
        if (Date.now() > deadline)
          throw new Error(
            `LAYOUT: the hovered fill never settled; last colour ${hovered}, rest ${rest}`,
          )
        await p.raw.waitForTimeout(SETTLE_POLL_MS)
        const next = await bg()
        stable = next === hovered ? stable + 1 : 0
        hovered = next
      }
      expect(hovered).not.toBe(rest)
      const ratio = await p.raw.evaluate(
        ([a, b]) => {
          const lum = (css: string): number => {
            const [r = 0, g = 0, bl = 0] = (css.match(/[\d.]+/g) ?? []).map(Number).slice(0, 3)
            const lin = (c: number): number => {
              const v = c / 255
              return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
            }
            return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(bl)
          }
          const [hi, lo] = [Math.max(lum(a!), lum(b!)), Math.min(lum(a!), lum(b!))]
          return (hi + 0.05) / (lo + 0.05)
        },
        [rest, hovered] as const,
      )
      expect(ratio).toBeGreaterThanOrEqual(MIN_HOVER_CONTRAST)
    })
  }

  test('the Sparkline readout never overlaps its reference caption: hidden while it shows', async () => {
    const p = await openFixture(
      { ...specFor('light'), w43Spark: true },
      DESKTOP_1440,
      '/',
      'reduce',
      'fine',
    )
    await p.settle()
    for (const id of SPARK_HOSTS) {
      const spark = `[data-testid="${id}"] [data-basalt-sparkline]`
      for (let n = 0; n < SPARKS_PER_HOST; n++) {
        const box = await p.raw.evaluate(
          ([q, i]) => {
            const el = document.querySelectorAll(q as string)[i as number]!
            el.scrollIntoView({ block: 'center' })
            const b = el.getBoundingClientRect()
            return { x: b.x, y: b.y, w: b.width, h: b.height }
          },
          [spark, n] as const,
        )
        await p.raw.mouse.move(0, 0)
        const rest = await read(p, spark, n)
        expect(rest.readout).toBe(false)
        expect(rest.captions).toBeGreaterThan(0)
        expect(rest.visible).toBe(rest.captions)

        // The readout comes first, then the caption is judged against it.
        const expectClear = async (): Promise<void> => {
          const r = await read(p, spark, n)
          expect(r.readout).toBe(true)
          expect(r.overlap).toBe(false)
          expect(r.visible).toBe(0)
        }
        for (const stop of POINTER_STOPS) {
          await p.raw.mouse.move(box.x + box.w * stop - 2, box.y + box.h / 2)
          await p.raw.mouse.move(box.x + box.w * stop, box.y + box.h / 2)
          await expectClear()
        }
        await p.raw.mouse.move(0, 0)
        expect((await read(p, spark, n)).visible).toBe(rest.captions)

        // The keyboard path: focus lands on the latest point, an arrow steps it.
        await p.raw.locator(spark).nth(n).locator('svg').focus()
        await expectClear()
        await p.raw.keyboard.press('ArrowLeft')
        await expectClear()
        await p.raw.keyboard.press('Escape')
        expect((await read(p, spark, n)).visible).toBe(rest.captions)
        await p.raw.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
      }
    }
  })
})
