/**
 * Wave 38 Meter captions in a real browser: the reading ends at its fill end, the target figure never
 * wraps, captions drop before anything wraps, zone names share one register, and part captions never
 * leave one entry alone on a row. Layout outcomes happy-dom cannot observe.
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

type Box = { text: string | null; left: number; right: number; top: number; hidden: boolean }
type Shot = {
  track: [number, number]
  fillEnd: number
  captions: Box[]
  zoneNames: Box[]
  parts: Box[]
  described: string
}

const measure = (p: LayoutPage, id: string): Promise<Shot> =>
  p.raw.evaluate((id) => {
    const host = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)
    const track = host?.querySelector<HTMLElement>('[data-meter-track]')
    if (!host || !track) throw new Error(`LAYOUT: no Meter in ${id}`)
    const box = (el: Element) => {
      const r = el.getBoundingClientRect()
      return {
        text: el.textContent,
        left: r.left,
        right: r.right,
        top: r.top,
        hidden: el.hasAttribute('data-hidden'),
      }
    }
    const k = track.getBoundingClientRect()
    const fills = [...host.querySelectorAll('[data-meter-fill="committed"]')]
    const meter = host.querySelector('[role="meter"]')
    const describedId = meter?.getAttribute('aria-describedby')
    return {
      track: [k.left, k.right],
      fillEnd: Math.max(k.left, ...fills.map((f) => f.getBoundingClientRect().right)),
      captions: [...host.querySelectorAll('[data-meter-captions] > span')].map(box),
      zoneNames: [...host.querySelectorAll('[data-meter-zone-label], [data-meter-zone-short]')]
        .filter((l) => !l.hasAttribute('data-hidden'))
        .map(box),
      parts: [...host.querySelectorAll('[data-meter-parts] > li')].map(box),
      described: describedId ? (document.getElementById(describedId)?.textContent ?? '') : '',
    }
  }, id)

const lines = (p: LayoutPage, id: string, selector: string): Promise<number[]> =>
  p.raw.evaluate(
    ([host, sel]) =>
      [...document.querySelectorAll<HTMLElement>(`[data-testid="${host}"] ${sel}`)].map((el) => {
        const lh = Number.parseFloat(getComputedStyle(el).lineHeight) || el.offsetHeight
        return Math.round(el.getBoundingClientRect().height / lh)
      }),
    [id, selector] as const,
  )

const shown = (b: Box[]) => b.filter((c) => !c.hidden)

layout('Meter captions (Wave 38)', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)
  let p: LayoutPage
  beforeAll(async () => {
    p = await openFixture(SPEC, PHONE)
    await p.settle()
  }, CLOSE_BUDGET_MS)

  test('the reading ends at its fill end, not at the track start', async () => {
    const m = await measure(p, 'dash-w38-goal-350')
    const reading = m.captions.find((c) => c.text === '17 sessions')
    if (!reading) throw new Error('LAYOUT: no reading caption')
    expect(Math.abs(reading.right - m.fillEnd)).toBeLessThanOrEqual(SNAP)
    expect(reading.left).toBeGreaterThanOrEqual(m.track[0] - SUBPIXEL)
  })

  test('readingAt="start" keeps the reading at the track start', async () => {
    const m = await measure(p, 'dash-w38-goal-start')
    const reading = m.captions.find((c) => c.text === '17 sessions')
    expect(Math.abs((reading?.left ?? 0) - m.track[0])).toBeLessThanOrEqual(SNAP)
  })

  test('a start caption override sits at the fill end too', async () => {
    const m = await measure(p, 'dash-w38-budget')
    const reading = m.captions.find((c) => c.text?.replaceAll('\u00A0', ' ') === '91% used')
    if (!reading) throw new Error('LAYOUT: no reading caption')
    expect(Math.abs(reading.right - m.fillEnd)).toBeLessThanOrEqual(SNAP)
  })

  test('the target figure is one line and every caption sits inside the track, on one row', async () => {
    for (const id of ['dash-w38-goal-350', 'dash-w38-goal-250']) {
      const m = await measure(p, id)
      const target = m.captions.find((c) => c.text === 'Target 28 sessions')
      if (!target) throw new Error('LAYOUT: no target figure')
      expect(await lines(p, id, '[data-meter-captions] > span')).toEqual(m.captions.map(() => 1))
      expect(Math.abs(target.right - m.track[1])).toBeLessThanOrEqual(SNAP)
      const kept = shown(m.captions)
      for (const [i, c] of kept.entries()) {
        expect(c.left).toBeGreaterThanOrEqual(m.track[0] - SUBPIXEL)
        expect(c.right).toBeLessThanOrEqual(m.track[1] + SUBPIXEL)
        const next = kept[i + 1]
        if (next) expect(c.right).toBeLessThanOrEqual(next.left + SUBPIXEL)
      }
    }
  })

  test('a narrow row drops the pace caption, never the reading or the target', async () => {
    const m = await measure(p, 'dash-w38-goal-250')
    const names = shown(m.captions).map((c) => c.text)
    expect(names).toContain('17 sessions')
    expect(names).toContain('Target 28 sessions')
    expect(names).not.toContain('14 sessions by 16 Oct')
    expect(m.described).toContain('Target 28 sessions')
    expect(m.described).toContain('Pace')
  })

  test('zone names share one register: once one falls back to its short, the siblings follow', async () => {
    const m = await measure(p, 'dash-w38-load')
    const texts = m.zoneNames.map((n) => n.text)
    const holding = 'Optimal'
    const full = texts.filter((t) => ['Low', 'Optimal', 'High', 'Overreaching'].includes(t ?? ''))
    const abbreviated = texts.filter((t) => ['Lo', 'Opt', 'Hi', 'Over'].includes(t ?? ''))
    if (abbreviated.length > 0) expect(full.filter((t) => t !== holding)).toEqual([])
  })

  test('part captions share a row or a grid: none stands alone on the last row', async () => {
    const m = await measure(p, 'dash-w38-fleet')
    expect(m.parts).toHaveLength(4)
    const rows = new Map<number, number>()
    for (const part of m.parts)
      rows.set(Math.round(part.top), (rows.get(Math.round(part.top)) ?? 0) + 1)
    const counts = [...rows.values()]
    if (counts.length > 1) expect(counts.at(-1)).toBeGreaterThan(1)
    for (const part of m.parts) expect(part.right).toBeLessThanOrEqual(m.track[1] + SUBPIXEL)
  })
})
