/**
 * Expression cycle 18, the contract row (`v3-expr-18-contract`; n87 .2 and .8, n90 .27, n91 .30, n92 .39,
 * .40 and .42): a meter's caption is drawn whole beside its value, a zoned meter's range ticks sit at
 * their values on the track with their numbers under them, four meters take one focus with arrow keys,
 * a readout and an announcement, and a mono `StatRow` value and summary fact render in the mono face.
 * At 1800 and 390. Fixture: `fixture/kit-expr18-meters-fixture.tsx`.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import { buildExpr12Document } from './expr12-support'
import type { Expr12Document } from './expr12-support'
import { CLOSE_BUDGET_MS, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'
import type { LayoutPage, Viewport } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const EMPTY_SPEC = { sections: [] } as FixtureSpec
const WIDE: Viewport = { name: 'wide 1800', width: 1800, height: 1200 }
const PHONE: Viewport = { name: 'phone 390', width: 390, height: 1200 }

let doc: Expr12Document | undefined
beforeAll(async () => {
  doc = await buildExpr12Document('meters', 'expr18')
})
afterAll(() => doc?.cleanup())

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, doc!.path, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="k18-pairs"] [role="meter"]')
  await page.settle()
  return page
}

type Caption = { text: string; width: number; inside: boolean; oneLine: boolean }

/** Each StatCell meter's readout: its text, whether its caption is drawn, one line, inside the meter slot. */
const captions = (page: LayoutPage): Promise<Caption[]> =>
  page.raw.evaluate(() =>
    [...document.querySelectorAll('[data-testid="k18-cells"] [data-slot="stat-meter"]')].map(
      (slot) => {
        const box = slot.getBoundingClientRect()
        const readout = slot.querySelector('[data-readout]')!
        const caption = slot.querySelector('[data-meter-caption]')!
        const c = caption.getBoundingClientRect()
        const line = parseFloat(getComputedStyle(caption).lineHeight)
        return {
          text: readout.textContent ?? '',
          width: c.width,
          inside:
            c.left >= box.left - 1 &&
            c.right <= box.right + 1 &&
            c.top >= box.top - 1 &&
            c.bottom <= box.bottom + 1,
          oneLine: c.height <= line + 1,
        }
      },
    ),
  )

type Tick = { at: number; expected: number; label: string; labelInside: boolean }

/** Every tick on n92's meters: where it is drawn and where its value puts it on the track. */
const ticks = (page: LayoutPage): Promise<Tick[][]> =>
  page.raw.evaluate(() =>
    [...document.querySelectorAll('[data-testid="k18-pairs"] [role="meter"]')].map((meter) => {
      const min = Number(meter.getAttribute('aria-valuemin'))
      const max = Number(meter.getAttribute('aria-valuemax'))
      const box = meter.getBoundingClientRect()
      const track = meter.querySelector('[data-meter-tick]')!.parentElement!.getBoundingClientRect()
      const labels = [...meter.querySelectorAll('[data-meter-tick-label]')]
      return [...meter.querySelectorAll('[data-meter-tick]')].map((tick, i) => {
        const r = tick.getBoundingClientRect()
        const label = labels[i]!
        const l = label.getBoundingClientRect()
        const value = Number(label.textContent)
        return {
          at: r.left + r.width / 2,
          expected: track.left + ((value - min) / (max - min)) * track.width,
          label: label.textContent ?? '',
          labelInside: l.left >= box.left - 1 && l.right <= box.right + 1,
        }
      })
    }),
  )

type Focus = { focused: number[]; dimmed: number; live: string; sub: string }

const focusState = (page: LayoutPage): Promise<Focus> =>
  page.raw.evaluate(() => {
    const meters = [...document.querySelectorAll('[data-testid="k18-pairs"] [role="meter"]')]
    return {
      focused: meters.flatMap((m, i) => (m.hasAttribute('data-focused') ? [i] : [])),
      dimmed: meters.filter((m) => m.hasAttribute('data-dimmed')).length,
      live: [...document.querySelectorAll('[aria-live="polite"]')]
        .map((n) => n.textContent ?? '')
        .join(' '),
      sub:
        document.querySelector('[data-testid="k18-balance"] [data-slot="stat-sub"]')?.textContent ??
        '',
    }
  })

const faces = (page: LayoutPage) =>
  page.raw.evaluate(() => {
    const face = (el: Element | null): string => (el ? getComputedStyle(el).fontFamily : '')
    const find = (text: string): Element | null =>
      [...document.querySelectorAll('span')].find((s) => s.textContent === text) ?? null
    return {
      mono: face(document.querySelector('[data-testid="k18-mono-ref"]')),
      body: face(document.body),
      row: face(find('integration-api')),
      fact: face(find('21 Nov 2026, 6:10')),
    }
  })

layout('expression cycle 18: meter captions, range ticks, one focus and mono slots', () => {
  for (const viewport of [WIDE, PHONE]) {
    test(`${viewport.name}: a meter's caption is drawn whole beside its value`, async () => {
      const page = await open(viewport)
      const read = await captions(page)
      expect(read.map((c) => c.text)).toEqual(['100 of 150 listed', 'US$13.89 spent'])
      for (const c of read) {
        expect(c.width, c.text).toBeGreaterThan(0)
        expect(c.inside, `${c.text} inside its meter slot`).toBe(true)
        expect(c.oneLine, `${c.text} on one line`).toBe(true)
      }
    })

    test(`${viewport.name}: a zoned meter draws its range ticks at their values`, async () => {
      const page = await open(viewport)
      const read = await ticks(page)
      expect(read.map((m) => m.map((t) => t.label))).toEqual([
        ['0.40', '0.70'],
        ['1.00', '1.25'],
        ['1.20', '1.50'],
        ['1.50', '2.00'],
      ])
      for (const t of read.flat()) {
        expect(Math.abs(t.at - t.expected), t.label).toBeLessThanOrEqual(1.5)
        expect(t.labelInside, `${t.label} inside its meter`).toBe(true)
      }
    })

    test(`${viewport.name}: four meters take one focus with arrow keys and a readout`, async () => {
      const page = await open(viewport)
      const rest = await focusState(page)
      expect(rest.focused).toEqual([])
      expect(rest.sub).toBe('Furthest out: Pull-up to bodyweight')
      await page.raw.focus('[data-testid="k18-pairs"]')
      await page.raw.keyboard.press('ArrowDown')
      await page.settle()
      const first = await focusState(page)
      expect(first.focused).toEqual([0])
      expect(first.dimmed).toBe(3)
      expect(first.sub).toBe('Pull-up to bodyweight, 0.12')
      await page.raw.keyboard.press('ArrowDown')
      await page.raw.waitForTimeout(300)
      await page.settle()
      const second = await focusState(page)
      expect(second.focused).toEqual([1])
      expect(second.dimmed).toBe(3)
      expect(second.sub).toBe('Deadlift to squat, 1.50')
      expect(second.live).toContain('Deadlift to squat: 1.50')
    })

    test(`${viewport.name}: a mono stat row value and summary fact render in the mono face`, async () => {
      const page = await open(viewport)
      const f = await faces(page)
      expect(f.mono).not.toBe(f.body)
      expect(f.row).toBe(f.mono)
      expect(f.fact).toBe(f.mono)
    })
  }
})
