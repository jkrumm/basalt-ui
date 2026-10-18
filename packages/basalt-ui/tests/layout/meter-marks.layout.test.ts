/**
 * Wave 37 r2: a Meter keeps its end figures and its captions at their marks, in a real browser at
 * the 390 card width. Layout outcomes happy-dom cannot observe.
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

const SNAP = 1
const SUBPIXEL = 0.5

type Box = { text: string | null; left: number; right: number }
type Shot = {
  anchored: boolean
  described: string
  zoneSpans: { name: string | null; left: number; right: number }[]
  zoneBoxes: { name: string | null; shown: boolean; left: number; right: number }[]
  track: [number, number]
  tickLabels: Box[]
  zoneNames: Box[]
  captions: Box[]
  marks: Record<string, number>
  parts: { text: string | null; left: number; right: number; whiteSpace: string; lines: number }[]
}

const measure = (p: LayoutPage, id: string): Promise<Shot> =>
  p.raw.evaluate((id) => {
    const host = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)
    const track = host?.querySelector<HTMLElement>('[data-meter-track]')
    if (!host || !track) throw new Error(`LAYOUT: no Meter in ${id}`)
    const box = (el: Element): { text: string | null; left: number; right: number } => {
      const r = el.getBoundingClientRect()
      return { text: el.textContent, left: r.left, right: r.right }
    }
    const shown = (el: Element) => !el.hasAttribute('data-hidden')
    const k = track.getBoundingClientRect()
    const marks: Record<string, number> = {}
    for (const t of host.querySelectorAll<HTMLElement>('[data-meter-tick]')) {
      const r = t.getBoundingClientRect()
      marks[t.getAttribute('data-meter-tick') ?? ''] = (r.left + r.right) / 2
    }
    const meter = host.querySelector('[role="meter"]')
    const describedId = meter?.getAttribute('aria-describedby')
    return {
      anchored: host.querySelector('[data-meter-captions]')?.hasAttribute('data-anchored') ?? false,
      described: describedId ? (document.getElementById(describedId)?.textContent ?? '') : '',
      zoneSpans: [...host.querySelectorAll('[data-meter-zone]')].map((z) => ({
        name: z.getAttribute('data-meter-zone'),
        left: z.getBoundingClientRect().left,
        right: z.getBoundingClientRect().right,
      })),
      zoneBoxes: [...host.querySelectorAll('[data-meter-zone-label], [data-meter-zone-short]')].map(
        (l) => ({
          name: l.getAttribute('data-meter-zone-label') ?? l.getAttribute('data-meter-zone-short'),
          shown: !l.hasAttribute('data-hidden'),
          left: l.getBoundingClientRect().left,
          right: l.getBoundingClientRect().right,
        }),
      ),
      track: [k.left, k.right],
      tickLabels: [...host.querySelectorAll('[data-meter-tick-label]')].filter(shown).map(box),
      zoneNames: [...host.querySelectorAll('[data-meter-zone-label], [data-meter-zone-short]')]
        .filter(shown)
        .map(box),
      captions: [...host.querySelectorAll('[data-meter-captions] > span')].map(box),
      marks,
      parts: [...host.querySelectorAll<HTMLElement>('[data-meter-parts] > li')].map((li) => {
        const r = li.getBoundingClientRect()
        const lh = Number.parseFloat(getComputedStyle(li).lineHeight) || r.height
        return {
          text: li.textContent,
          left: r.left,
          right: r.right,
          whiteSpace: getComputedStyle(li).whiteSpace,
          lines: Math.round(r.height / lh),
        }
      }),
    }
  }, id)

const centre = (b: Box) => (b.left + b.right) / 2
const touch = (a: Box, b: Box) => !(a.right <= b.left + SUBPIXEL || b.right <= a.left + SUBPIXEL)

layout('Meter marks at 390', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)
  let p: LayoutPage
  beforeAll(async () => {
    p = await openFixture(SPEC, PHONE)
    await p.settle()
  }, CLOSE_BUDGET_MS)

  test.each([
    ['dash-r2-load', ['0', '2.0']],
    ['dash-r2-readiness', ['0', '100']],
  ])('%s keeps both end figures; zone names yield to them', async (id, ends) => {
    const m = await measure(p, id)
    expect(m.tickLabels.map((t) => t.text)).toEqual(ends)
    const [start, end] = m.tickLabels as [Box, Box]
    expect(start.left).toBeGreaterThanOrEqual(m.track[0] - SUBPIXEL)
    expect(end.right).toBeLessThanOrEqual(m.track[1] + SUBPIXEL)
    for (const name of m.zoneNames) {
      expect(touch(name, start)).toBe(false)
      expect(touch(name, end)).toBe(false)
    }
  })

  test.each(['dash-zl-s2', 'dash-r2-load', 'dash-r2-readiness'])(
    '%s: a zone shows its name or short label whenever either fits clear of the end figures',
    async (id) => {
      const m = await measure(p, id)
      const [start, end] = m.tickLabels as [Box, Box]
      const gap = 6
      for (const z of m.zoneSpans) {
        const boxes = m.zoneBoxes.filter((b) => b.name === z.name)
        const fits = boxes.some(
          (b) =>
            b.left >= z.left - SUBPIXEL &&
            b.right <= z.right + SUBPIXEL &&
            b.left >= start.right + gap - SUBPIXEL &&
            b.right <= end.left - gap + SUBPIXEL,
        )
        if (fits) expect(boxes.some((b) => b.shown)).toBe(true)
        expect(m.described).toContain(z.name ?? '')
      }
    },
  )

  test('crowded captions are pushed apart, stay near their marks and never overlap', async () => {
    const m = await measure(p, 'dash-r2-crowd')
    expect(m.anchored).toBe(true)
    const pace = m.captions.find((c) => c.text?.includes('sessions by'))
    const target = m.captions.find((c) => c.text?.startsWith('Target'))
    const reading = m.captions.find((c) => c.text === '17 sessions')
    const tick = m.marks['tick']
    if (!pace || !target || !reading || tick === undefined) throw new Error('LAYOUT: no captions')
    // Pace gives way to Target (which sits at the track end): pushed left, and not far.
    const offset = centre(pace) - tick
    expect(offset).toBeLessThan(-SNAP)
    expect(Math.abs(offset)).toBeLessThanOrEqual(24)
    expect(Math.abs(target.right - m.track[1])).toBeLessThanOrEqual(SNAP)
    const sorted = [reading, pace, target]
    for (const [i, c] of sorted.entries()) {
      expect(c.left).toBeGreaterThanOrEqual(m.track[0] - SUBPIXEL)
      expect(c.right).toBeLessThanOrEqual(m.track[1] + SUBPIXEL)
      const next = sorted[i + 1]
      if (next) expect(c.right).toBeLessThanOrEqual(next.left + SUBPIXEL)
    }
  })

  test('goal: the tick caption, centred on its mark and inside the track', async () => {
    const m = await measure(p, 'dash-r2-goal')
    const cap = m.captions.find((c) => c.text?.includes('sessions by'))
    if (!cap || m.marks['tick'] === undefined) throw new Error('LAYOUT: no pace caption')
    expect(Math.abs(centre(cap) - m.marks['tick'])).toBeLessThanOrEqual(SNAP)
    expect(cap.left).toBeGreaterThanOrEqual(m.track[0] - SUBPIXEL)
    expect(cap.right).toBeLessThanOrEqual(m.track[1] + SUBPIXEL)
  })

  test('goal: the start and target figures render with the Meter format', async () => {
    const m = await measure(p, 'dash-r2-goal')
    expect(m.tickLabels.map((t) => t.text)).toContain('0 sessions')
    const target = m.captions.find((c) => c.text === 'Target 28 sessions')
    if (!target || m.marks['target'] === undefined) throw new Error('LAYOUT: no target figure')
    expect(Math.abs(target.right - m.track[1])).toBeLessThanOrEqual(SNAP)
  })

  test('goal: startCaption={null} and endCaption={null} opt out of both figures', async () => {
    const m = await measure(p, 'dash-r2-goal-optout')
    expect(m.tickLabels).toEqual([])
    expect(m.captions).toEqual([])
  })

  test('forecast: the caption sits at the forecast boundary, not at the track end', async () => {
    const m = await measure(p, 'dash-r2-forecast')
    const cap = m.captions.find((c) => c.text === 'Forecast')
    if (!cap || m.marks['boundary'] === undefined) throw new Error('LAYOUT: no forecast caption')
    expect(Math.abs(centre(cap) - m.marks['boundary'])).toBeLessThanOrEqual(SNAP)
    expect(cap.right).toBeLessThan(m.track[1] - 40)
  })

  test('session mix: no caption entry wraps and the list starts under the track', async () => {
    const m = await measure(p, 'dash-r2-mix')
    expect(m.parts).toHaveLength(3)
    for (const part of m.parts) {
      expect(part.whiteSpace).toBe('nowrap')
      expect(part.lines).toBe(1)
      expect(part.right).toBeLessThanOrEqual(m.track[1] + SUBPIXEL)
    }
    expect(Math.abs((m.parts[0]?.left ?? 0) - m.track[0])).toBeLessThanOrEqual(SNAP)
  })
})
