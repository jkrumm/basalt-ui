/**
 * Wave 39: no Meter zone name and no tick label is lost for width. argo's Garmin and Home ACWR
 * Meters, the Agents oldest-wait Meter swept over seven readings (in argo's cell composition: value,
 * footer, colour) and a wide ACWR row, at 390 and 1440, light and dark: every name and tick label
 * is visible, inside the track's box and a gap step clear of its neighbours on its row; at 1440 the
 * ACWR names are the FULL names on one row.
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

const spec: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  w39Meter: true,
}

type Probe = {
  trackWidth: number
  gap: number
  zones: string[]
  ticks: string[]
  hiddenNames: string[]
  boxes: { text: string; row: number; left: number; right: number; top: number }[]
  inside: boolean
  rows: string | null
}

const probe = (p: Awaited<ReturnType<typeof openFixture>>, id: string): Promise<Probe> =>
  p.raw.evaluate((id) => {
    const host = document.querySelector(`[data-testid="${id}"]`) as Element
    const band = host.querySelector('[data-meter-zone-band], [data-meter-tick-band]') as HTMLElement
    const track = host.querySelector('[data-meter-track]') as HTMLElement
    const t = track.getBoundingClientRect()
    const labels = [
      ...host.querySelectorAll(
        '[data-meter-zone-label], [data-meter-zone-short], [data-meter-tick-label]',
      ),
    ]
    const shown = labels.filter((e) => !e.hasAttribute('data-hidden'))
    const boxes = shown.map((e) => {
      const r = e.getBoundingClientRect()
      return {
        text: e.textContent ?? '',
        row: e.hasAttribute('data-row2') ? 2 : 1,
        left: r.left,
        right: r.right,
        top: r.top,
      }
    })
    const names = (attr: string) =>
      [...host.querySelectorAll(`[${attr}]`)].map((e) => e.getAttribute(attr) ?? '')
    return {
      trackWidth: t.width,
      gap: Number.parseFloat(getComputedStyle(band).columnGap) || 0,
      zones: names('data-meter-zone-label'),
      ticks: [...host.querySelectorAll('[data-meter-tick-label]')].map((e) => e.textContent ?? ''),
      hiddenNames: [...host.querySelectorAll('[data-meter-zone-label]:not([data-hidden])')].map(
        (e) => e.getAttribute('data-meter-zone-label') ?? '',
      ),
      boxes,
      inside: boxes.every((b) => b.left >= t.left - 0.5 && b.right <= t.right + 0.5),
      rows: band.getAttribute('data-meter-rows'),
    }
  }, id)

/** The zone names that stand on screen: the full name, or its short twin when that is the one shown. */
const standing = (p: Probe, zones: readonly { full: string; short?: string }[]) =>
  zones.map((z) => p.boxes.some((b) => b.text === z.full || b.text === z.short))

const WAITS = ['10min', '3h', '5h', '1d', '3d', '6.5d', '7d'] as const
const ACWR_FULL = [{ full: 'Low' }, { full: 'Optimal' }, { full: 'Caution' }, { full: 'Danger' }]
const ACWR_ANY = [
  { full: 'Low' },
  { full: 'Optimal' },
  { full: 'Caution', short: 'Caut.' },
  { full: 'Danger' },
]

const CASES = [
  ...(['w39-garmin', 'w39-homeacwr', 'w39-home'] as const).flatMap((id) =>
    [PHONE, DESKTOP_1440].flatMap((vp) =>
      (['light', 'dark'] as const).map((c) => [id, vp, c] as const),
    ),
  ),
  ...WAITS.flatMap((w) =>
    [PHONE, DESKTOP_1440].flatMap((vp) =>
      (['light', 'dark'] as const).map((c) => [`w39-agents-${w}`, vp, c] as const),
    ),
  ),
] as const

layout('Meter labels are never lost for width (Wave 39)', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  test.each(CASES)(
    '%s at %p (%s): every label stands, inside the track, a gap step apart',
    async (id, vp, scheme) => {
      const p = await openFixture(spec, vp)
      await p.raw.evaluate(
        (c) => document.documentElement.setAttribute('data-mantine-color-scheme', c),
        scheme,
      )
      await p.settle()
      const got = await probe(p, id)
      if (id.startsWith('w39-agents')) {
        expect(got.ticks).toEqual(['warn at\u00a024\u00a0h', 'abandoned at\u00a07\u00a0d'])
        for (const t of got.ticks) expect(got.boxes.some((b) => b.text === t)).toBe(true)
      } else {
        expect(standing(got, ACWR_ANY)).toEqual([true, true, true, true])
      }
      // At 1440 a Home/Garmin strip cell (and the 360 row) holds the four FULL names on one row.
      if (vp === DESKTOP_1440 && !id.startsWith('w39-agents')) {
        expect(standing(got, ACWR_FULL)).toEqual([true, true, true, true])
        expect(got.rows).toBe('1')
        expect(got.boxes.filter((b) => b.text === 'Caut.')).toEqual([])
      }
      expect(got.inside).toBe(true)
      for (const row of [1, 2]) {
        const onRow = got.boxes.filter((b) => b.row === row).toSorted((a, b) => a.left - b.left)
        for (let k = 1; k < onRow.length; k++) {
          const prev = onRow[k - 1] as { right: number }
          expect((onRow[k] as { left: number }).left).toBeGreaterThanOrEqual(
            prev.right + got.gap - 0.5,
          )
        }
      }
    },
  )

  test.each(['w39-wide-start', 'w39-wide-end', 'w39-wide-rtl'])(
    '%s: a tick label wider than the room beside its mark renders whole inside the row',
    async (id) => {
      const p = await openFixture(spec, DESKTOP_1440)
      await p.settle()
      const m = await p.raw.evaluate((id) => {
        const host = document.querySelector(`[data-testid="${id}"]`) as Element
        const label = host.querySelector('[data-meter-tick-label]') as HTMLElement
        const row = host.querySelector('[data-meter-tick-band]') as HTMLElement
        const r = label.getBoundingClientRect()
        const b = row.getBoundingClientRect()
        return {
          hidden: label.hasAttribute('data-hidden'),
          left: r.left,
          right: r.right,
          rowLeft: b.left,
          rowRight: b.right,
          nudge: label.style.getPropertyValue('--basalt-nudge'),
          clipped: label.scrollWidth > label.clientWidth,
        }
      }, id)
      expect(m.hidden).toBe(false)
      expect(m.nudge).not.toBe('')
      expect(m.left).toBeGreaterThanOrEqual(m.rowLeft - 0.5)
      expect(m.right).toBeLessThanOrEqual(m.rowRight + 0.5)
      expect(m.clipped).toBe(false)
    },
  )

  test('the S2 goal Meter at 390 keeps one label row: the start figure drops instead of taking a second row', async () => {
    const p = await openFixture(spec, PHONE)
    await p.settle()
    const m = await p.raw.evaluate(() => {
      const host = document.querySelector('[data-testid="w39-goal-348"]') as Element
      const band = host.querySelector('[data-meter-tick-band]') as HTMLElement
      const labels = [...host.querySelectorAll<HTMLElement>('[data-meter-tick-label]')]
      return {
        rows: band.getAttribute('data-meter-rows'),
        height: band.getBoundingClientRect().height,
        shown: labels.filter((l) => !l.hasAttribute('data-hidden')).map((l) => l.textContent),
        second: labels.filter((l) => l.hasAttribute('data-row2')).length,
        fontSize: Number.parseFloat(getComputedStyle(band).fontSize),
      }
    })
    expect(m.rows).toBe('1')
    expect(m.second).toBe(0)
    expect(m.shown).toEqual(['Pace 14 sessions by 16 Oct'])
    // One caption-sized line (1.25em), not two.
    expect(m.height).toBeLessThanOrEqual(m.fontSize * 1.25 + 1)
  })

  test('the same Meter on a wide row keeps its start figure on the one row', async () => {
    const p = await openFixture(spec, DESKTOP_1440)
    await p.settle()
    const shown = await p.raw.evaluate(() =>
      [...document.querySelectorAll('[data-testid="w39-goal-640"] [data-meter-tick-label]')]
        .filter((l) => !l.hasAttribute('data-hidden') && !l.hasAttribute('data-row2'))
        .map((l) => l.textContent),
    )
    expect(shown).toEqual(['0 sessions', 'Pace 14 sessions by 16 Oct'])
  })
})
