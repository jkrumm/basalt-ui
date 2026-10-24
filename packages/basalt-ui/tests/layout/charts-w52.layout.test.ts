/**
 * Wave 52, chart cards: one header anatomy for a headline card (the value, its unit and period sit
 * under the title, never at the far edge), sibling cards in a row share the title baseline whether or
 * not they carry a value or fold short, and the keyboard-focus tooltip stays inside the plot, clear of
 * the tick labels, exactly like the hover one.
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
  w52Charts: true,
}

type Rect = { left: number; right: number; top: number; bottom: number }
const EPS = 1

layout('Wave 52 chart cards', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  /** Title, headline value, first plot box and (when present) the unit of every card under `host`. */
  async function cards(host: string, viewport = DESKTOP_1440) {
    const p = await openFixture(spec, viewport)
    await p.settle()
    return p.raw.evaluate((id) => {
      const rect = (el: Element | null | undefined): Rect | null => {
        const r = el?.getBoundingClientRect()
        return r ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom } : null
      }
      return [...document.querySelectorAll(`[data-testid="${id}"] [data-basalt-chart-card]`)].map(
        (card) => ({
          card: rect(card),
          title: rect(card.querySelector('[data-widget-title]')),
          value: rect(card.querySelector('[data-basalt-fact-value]')),
          facts: rect(card.querySelector('[data-basalt-facts-row]')),
          plot: rect(card.querySelector('[data-basalt-box]')),
          unit: card.querySelector('[data-basalt-fact] > span:nth-child(2)')
            ? rect(card.querySelector('[data-basalt-fact] > span:nth-child(2)'))
            : null,
          deltaLines: [...card.querySelectorAll('[data-delta]')].map(
            (d) => d.getBoundingClientRect().height,
          ),
        }),
      )
    }, host)
  }

  test('1440: a value card and a facts card in one row share one anatomy and plot top', async () => {
    const [a, b] = await cards('w52-row')
    if (!a?.title || !a.value || !a.plot || !b?.title || !b.value || !b.plot)
      throw new Error('LAYOUT: missing card part')
    // The value sits under its own title, near its left edge, not at the card's far right.
    for (const c of [a, b]) {
      expect(c.value!.left - c.title!.left).toBeLessThanOrEqual(24)
      expect(c.value!.top).toBeGreaterThanOrEqual(c.title!.bottom - EPS)
    }
    expect(Math.abs(a.title.top - b.title.top)).toBeLessThanOrEqual(EPS)
    expect(Math.abs(a.value.top - b.value.top)).toBeLessThanOrEqual(EPS)
    expect(Math.abs(a.plot.top - b.plot.top)).toBeLessThanOrEqual(EPS)
  })

  test('1440: a short card and a tall card in one row share the title baseline', async () => {
    const [short, tall] = await cards('w52-plain')
    if (!short?.title || !tall?.title) throw new Error('LAYOUT: missing card part')
    expect(Math.abs(short.title.top - tall.title.top)).toBeLessThanOrEqual(EPS)
  })

  test.each([
    ['facts', 'w52-phone'],
    ['legacy value', 'w52-phone-legacy'],
  ])('390: a %s headline wraps no unit and no delta period', async (_, host) => {
    const [c] = await cards(host, PHONE)
    if (!c?.value || !c.card) throw new Error('LAYOUT: missing card part')
    expect(c.card.right - c.card.left).toBeLessThanOrEqual(340.5)
    // The value, unit and delta each stay one line (a wrapped unit doubles its box).
    if (host === 'w52-phone') expect(c.unit).not.toBeNull()
    if (c.unit) expect(c.unit.bottom - c.unit.top).toBeLessThan(24)
    for (const h of c.deltaLines) expect(h).toBeLessThan(24)
    expect(c.value.right).toBeLessThanOrEqual(c.card.right)
  })

  /** The tooltip, the plot's tick labels and the chart box after `open` drove the chart. */
  async function readout(open: 'hover' | 'focus', id = 'w52-focus') {
    const p = await openFixture(spec, DESKTOP_1440)
    await p.settle()
    const box = await p.raw.evaluate((host) => {
      const svg = document.querySelector(`[data-testid="${host}"] [data-basalt-box] svg`)
      svg?.scrollIntoView({ block: 'center' })
      const r = svg?.getBoundingClientRect()
      if (!r) throw new Error('LAYOUT: no chart svg')
      return { x: r.x, y: r.y, w: r.width, h: r.height }
    }, id)
    if (open === 'hover') {
      await p.raw.mouse.move(box.x + box.w / 2, box.y + box.h / 2)
      await p.raw.mouse.move(box.x + 2, box.y + box.h / 2)
    } else {
      // Keyboard path: Tab onto the chart; the focus alone opens the tooltip at its first point.
      for (let i = 0; i < 12; i += 1) {
        const inside = await p.raw.evaluate(
          (host) => document.activeElement?.closest(`[data-testid="${host}"]`) !== null,
          id,
        )
        if (inside) break
        await p.raw.keyboard.press('Tab')
      }
      // No further key: the tooltip is placed once, by the focus alone.
    }
    // DIAG-TEMP
    if (open === 'focus')
      console.log(
        'DIAG-FOCUS',
        JSON.stringify(
          await p.raw.evaluate((host) => {
            const a = document.activeElement
            const root = document.querySelector(`[data-testid="${host}"]`)
            return {
              active: a
                ? `${a.tagName}.${a.getAttribute('class')}#${a.getAttribute('tabindex')}`
                : null,
              inside: root?.contains(a) ?? false,
              focusables: [...(root?.querySelectorAll('[tabindex]') ?? [])].map(
                (e) => `${e.tagName}.${e.getAttribute('class')}#${e.getAttribute('tabindex')}`,
              ),
              tips: document.querySelectorAll('.ts-chart-tooltip').length,
              tipHidden: [...document.querySelectorAll('.ts-chart-tooltip')].map((t) =>
                t.hasAttribute('hidden'),
              ),
              focusVisible: a?.matches(':focus-visible'),
              hasFocus: document.hasFocus(),
            }
          }, id),
        ),
      )
    await p.raw.waitForSelector('.ts-chart-tooltip:not([hidden])', { timeout: 3000 })
    await p.settle()
    return p.raw.evaluate((host) => {
      const tip = document.querySelector('.ts-chart-tooltip:not([hidden])')
      const svg = document.querySelector(`[data-testid="${host}"] [data-basalt-box] svg`)
      const title = document.querySelector(`[data-testid="${host}"] [data-widget-title]`)
      if (!tip || !svg || !title) throw new Error('LAYOUT: no tooltip, chart or title')
      const t = tip.getBoundingClientRect()
      const s = svg.getBoundingClientRect()
      const labels = [...svg.querySelectorAll('text')].map((el) => {
        const r = el.getBoundingClientRect()
        return {
          text: el.textContent ?? '',
          left: r.left,
          right: r.right,
          top: r.top,
          bottom: r.bottom,
        }
      })
      const hit = labels.filter(
        (l) =>
          l.right > 0 &&
          l.text !== '' &&
          t.left < l.right &&
          t.right > l.left &&
          t.top < l.bottom &&
          t.bottom > l.top,
      )
      return {
        tip: { left: t.left, right: t.right, top: t.top, bottom: t.bottom },
        svg: { left: s.left, right: s.right, top: s.top, bottom: s.bottom },
        titleBottom: title.getBoundingClientRect().bottom,
        labels: labels.length,
        hit: hit.map((l) => l.text),
      }
    }, id)
  }

  test.each(['hover', 'focus'] as const)(
    '1440: the first-point tooltip on %s covers no tick label',
    async (open) => {
      const m = await readout(open)
      expect(m.labels).toBeGreaterThan(3)
      expect(m.hit).toEqual([])
    },
  )

  test.each(['hover', 'focus'] as const)(
    '1440: a roomy chart keeps its first-point tooltip inside the plot box and under the title on %s',
    async (open) => {
      const m = await readout(open, 'w52-focus-roomy')
      expect(m.hit).toEqual([])
      expect(m.tip.top).toBeGreaterThanOrEqual(m.titleBottom)
      expect(m.tip.bottom).toBeLessThanOrEqual(m.svg.bottom)
      expect(m.tip.left).toBeGreaterThanOrEqual(m.svg.left)
    },
  )

  test('1440: a BandStrip hover tooltip opens below the x tick labels', async () => {
    const p = await openFixture(spec, DESKTOP_1440)
    await p.settle()
    const box = await p.raw.evaluate(() => {
      const svg = document.querySelector('[data-testid="w52-band"] [data-basalt-box] svg')
      svg?.scrollIntoView({ block: 'center' })
      const r = svg?.getBoundingClientRect()
      if (!r) throw new Error('LAYOUT: no band svg')
      return { x: r.x, y: r.y, w: r.width, h: r.height }
    })
    await p.raw.mouse.move(box.x + box.w / 2, box.y + 20)
    await p.raw.mouse.move(box.x + box.w * 0.55, box.y + 20)
    await p.raw.waitForSelector('.ts-chart-tooltip:not([hidden])')
    await p.settle()
    const m = await p.raw.evaluate(() => {
      const tip = document.querySelector('.ts-chart-tooltip:not([hidden])')
      const svg = document.querySelector('[data-testid="w52-band"] [data-basalt-box] svg')
      if (!tip || !svg) throw new Error('LAYOUT: no tooltip or chart')
      const t = tip.getBoundingClientRect()
      const ticks = [...svg.querySelectorAll('text')].filter((el) => (el.textContent ?? '') !== '')
      return {
        ticks: ticks.length,
        lowestTick: Math.max(...ticks.map((el) => el.getBoundingClientRect().bottom)),
        tipTop: t.top,
        covered: ticks
          .filter((el) => {
            const r = el.getBoundingClientRect()
            return t.left < r.right && t.right > r.left && t.top < r.bottom && t.bottom > r.top
          })
          .map((el) => el.textContent),
      }
    })
    expect(m.ticks).toBeGreaterThan(2)
    expect(m.covered).toEqual([])
    expect(m.tipTop).toBeGreaterThanOrEqual(m.lowestTick)
  })
})
