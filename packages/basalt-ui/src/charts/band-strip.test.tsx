/**
 * `BandStrip` behaviour through its public props and the rendered DOM: gap-free state bands,
 * intensity fills, markers, fold, the legend toggle and the derived tooltip row.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { alpha, VX } from '../tokens'
import { BandStrip } from './BandStrip'
import type { BandSpan, BandStripProps, BandStripSeries } from './BandStrip'

type Slot = { t: string; s: string; loss?: number; a?: number }
const slots = (n: number, state: (i: number) => string = () => 'up'): Slot[] =>
  Array.from({ length: n }, (_, i) => ({ t: `s${String(i).padStart(3, '0')}`, s: state(i) }))

const up: BandStripSeries<Slot> = { key: 'up', label: 'Up', color: 'var(--vx-good)' }
const down: BandStripSeries<Slot> = {
  key: 'down',
  label: 'Down',
  color: 'var(--vx-bad)',
  formatValue: (d) => (d.loss === undefined ? null : `${d.loss}% loss`),
}
const none: BandStripSeries<Slot> = {
  key: 'none',
  label: 'Not measured',
  color: 'var(--vx-neutral)',
}

const getBand = (d: Slot): BandSpan => ({ state: d.s })

const props = (over: Partial<BandStripProps<Slot, string>> = {}): BandStripProps<Slot, string> => ({
  ariaLabel: 'Availability',
  data: slots(10, (i) => (i % 3 === 0 ? 'down' : 'up')),
  x: (d) => d.t,
  states: [up, down],
  getBand,
  ...over,
})

/** The drawn bands: every rect of a `band-N` mark. */
const bands = (root: ParentNode): Element[] => [
  ...root.querySelectorAll('[data-ts-key^="band-"] rect'),
]
const html = (node: React.ReactElement): Document => {
  const doc = document.implementation.createHTMLDocument('')
  doc.body.innerHTML = renderToString(node)
  return doc
}
const fills = (root: ParentNode): Set<string | null> =>
  new Set(bands(root).map((r) => r.getAttribute('fill')))

let root: ReturnType<typeof createRoot> | undefined
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  document.body.innerHTML = ''
})
async function mount(node: React.ReactNode): Promise<HTMLElement> {
  const el = document.createElement('div')
  document.body.append(el)
  root = createRoot(el)
  await act(async () => {
    root?.render(node)
  })
  return el
}

/** Moves the pointer over the first chart in `el` and waits for the tooltip to paint. */
async function hover(el: HTMLElement): Promise<string> {
  const svg = el.querySelector('svg')
  if (!svg) throw new Error('chart did not mount')
  await act(async () => {
    svg.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 300, clientY: 100, bubbles: true }),
    )
    await new Promise((r) => setTimeout(r, 30))
  })
  return document.querySelector('.ts-chart-tooltip')?.textContent ?? ''
}

/** The `band-N` groups in paint order, as the fill of their first rect. */
const layerFills = (root: ParentNode): (string | null | undefined)[] =>
  [...root.querySelectorAll('g[data-ts-key^="band-"]')].map((g) =>
    g.querySelector('rect')?.getAttribute('fill'),
  )

const NEUTRAL = alpha(VX.neutral, 1)
const GOOD = alpha(VX.good, 1)
const width = (r: Element): number => Number(r.getAttribute('width'))
const sumWidth = (rs: Element[]): number => rs.reduce((n, r) => n + width(r), 0)
const isMeasured = (r: Element): boolean => r.getAttribute('fill') === GOOD
const isMarker = (r: Element): boolean => r.getAttribute('fill') === 'var(--vx-good)'
const partial = (fraction: number | undefined): BandStripProps<Slot, string> =>
  props({
    states: [up, none],
    absentState: 'none',
    data: slots(4),
    getBand: (): BandSpan => ({ state: 'up', absentFraction: fraction }),
  })
const withMarker = (f: number): Document =>
  html(
    <BandStrip
      {...props({
        states: [up, none],
        absentState: 'none',
        data: slots(4),
        getBand: (): BandSpan => ({ state: 'up', absentFraction: f, marker: {} }),
      })}
    />,
  )
async function toggleLegend(el: HTMLElement, key: string): Promise<void> {
  const toggle = el.querySelector(`button[data-legend-key="${key}"]`)
  if (!(toggle instanceof HTMLButtonElement)) throw new Error('no toggleable legend entry')
  await act(async () => toggle.click())
}

describe('BandStrip', () => {
  test('draws one gap-free band per slot, each in its state color', () => {
    const doc = html(<BandStrip {...props()} />)
    const rects = bands(doc)
    expect(rects.length).toBe(10)
    const spans = rects
      .map((r) => [Number(r.getAttribute('x')), Number(r.getAttribute('width'))] as const)
      .toSorted((a, b) => a[0] - b[0])
    // Adjacent slots abut: the strip owns the width, a band scale's padding does not.
    for (let i = 1; i < spans.length; i++)
      expect(
        (spans[i]?.[0] ?? 0) - ((spans[i - 1]?.[0] ?? 0) + (spans[i - 1]?.[1] ?? 0)),
      ).toBeCloseTo(0, 3)
    expect(fills(doc)).toEqual(
      new Set([
        'color-mix(in srgb, var(--vx-good) 100%, transparent)',
        'color-mix(in srgb, var(--vx-bad) 100%, transparent)',
      ]),
    )
  })

  test('a state fillOpacity and a span fill tint the band', () => {
    const doc = html(
      <BandStrip
        {...props({
          states: [{ ...up, fillOpacity: 0.5 }, down],
          getBand: (d) => ({
            state: d.s,
            ...(d.s === 'down' && { fill: 'color-mix(in srgb, var(--vx-bad) 30%, transparent)' }),
          }),
        })}
      />,
    )
    expect(fills(doc)).toEqual(
      new Set([
        'color-mix(in srgb, var(--vx-good) 50%, transparent)',
        'color-mix(in srgb, var(--vx-bad) 30%, transparent)',
      ]),
    )
  })

  test('the absent state is a flat neutral fill with no hatch pattern', () => {
    const doc = html(
      <BandStrip {...props({ states: [up, none], data: slots(4, () => 'none'), getBand })} />,
    )
    expect(fills(doc)).toEqual(new Set([NEUTRAL]))
    expect(doc.querySelector('pattern')).toBeNull()
  })

  describe('absentFraction', () => {
    test('paints the unmeasured share flat neutral from the right edge, no hatch', () => {
      const doc = html(<BandStrip {...partial(0.25)} />)
      const rects = bands(doc)
      const measured = rects.filter((r) => isMeasured(r))
      const absent = rects.filter((r) => r.getAttribute('fill') === NEUTRAL)
      expect(measured.length).toBe(4)
      expect(absent.length).toBe(4)
      const m = measured[0] as Element
      const a = absent[0] as Element
      expect(width(a) / (width(a) + width(m))).toBeCloseTo(0.25, 2)
      expect(Number(a.getAttribute('x'))).toBeCloseTo(Number(m.getAttribute('x')) + width(m), 1)
      expect(doc.querySelector('pattern')).toBeNull()
    })

    test('0, undefined and NaN paint no absent share; 1 paints only the absent fill', () => {
      for (const f of [0, undefined, Number.NaN]) {
        const rects = bands(html(<BandStrip {...partial(f)} />))
        expect(rects.some((r) => r.getAttribute('fill') === NEUTRAL)).toBe(false)
      }
      const full = bands(html(<BandStrip {...partial(1)} />))
      expect(full.every((r) => r.getAttribute('fill') === NEUTRAL)).toBe(true)
    })

    test('a band in the absent state ignores the fraction', () => {
      const doc = html(
        <BandStrip
          {...props({
            states: [up, none],
            absentState: 'none',
            data: slots(2, () => 'none'),
            getBand: (): BandSpan => ({ state: 'none', absentFraction: 0.5 }),
          })}
        />,
      )
      expect(fills(doc)).toEqual(new Set([NEUTRAL]))
    })

    test('a fold merge reporting 2/3 absent paints two thirds of each folded band', () => {
      const doc = html(
        <BandStrip
          {...props({
            states: [up, none],
            absentState: 'none',
            data: slots(600),
            fold: { merge: (g) => ({ ...(g[0] as Slot), a: 2 / 3 }) },
            getBand: (d): BandSpan => ({ state: d.s, absentFraction: d.a }),
          })}
        />,
      )
      const rects = bands(doc)
      const absent = rects.filter((r) => r.getAttribute('fill') === NEUTRAL)
      const measured = rects.filter((r) => isMeasured(r))
      expect(absent.length).toBe(measured.length)
      expect(sumWidth(absent) / (sumWidth(absent) + sumWidth(measured))).toBeCloseTo(2 / 3, 2)
    })

    test('a marker covers only the measured width, and is suppressed at 1', () => {
      const half = bands(withMarker(0.5))
      const band = half.find(isMeasured) as Element
      const marker = half.find(isMarker) as Element
      expect(Number(marker.getAttribute('width'))).toBeCloseTo(
        Number(band.getAttribute('width')),
        3,
      )
      expect(bands(withMarker(1)).some(isMarker)).toBe(false)
    })

    test('at 1 the primary state answers no pointer: only "Not measured" shows', async () => {
      const text = await hover(await mount(<BandStrip {...partial(1)} />))
      expect(text).toContain('Not measured')
      expect(text).not.toContain('Up')
    })

    test('a hidden absent state leaves no hole and no row', async () => {
      const el = await mount(<BandStrip {...partial(0.5)} />)
      await toggleLegend(el, 'none')
      const rects = bands(el)
      expect(rects.length).toBe(4)
      expect(rects.every((r) => isMeasured(r))).toBe(true)
      const [first, second] = rects as [Element, Element]
      expect(Number(second.getAttribute('x')) - Number(first.getAttribute('x'))).toBeCloseTo(
        width(first),
        3,
      )
      const text = await hover(el)
      expect(text).toContain('Up')
      expect(text).not.toContain('Not measured')
    })

    test('hidden absent state + fraction 1: the primary fill and row take the slot back', async () => {
      const el = await mount(<BandStrip {...partial(1)} />)
      await toggleLegend(el, 'none')
      expect(bands(el).length).toBe(4)
      expect(bands(el).every(isMeasured)).toBe(true)
      const text = await hover(el)
      expect(text).toContain('Up')
      expect(text).not.toContain('Not measured')
    })

    test('a hidden primary state leaves its part unpainted; the absent part stays, with its row', async () => {
      const el = await mount(<BandStrip {...partial(0.5)} />)
      await toggleLegend(el, 'up')
      const rects = bands(el)
      expect(rects.length).toBe(4)
      expect(rects.every((r) => r.getAttribute('fill') === NEUTRAL)).toBe(true)
      const text = await hover(el)
      expect(text).toContain('Not measured')
      expect(text).not.toContain('Up')
    })

    test('fractions clamp: 1.5 and Infinity paint all absent, -0.25 and NaN none', () => {
      for (const f of [1.5, Number.POSITIVE_INFINITY]) {
        const rects = bands(html(<BandStrip {...partial(f)} />))
        expect(rects.every((r) => r.getAttribute('fill') === NEUTRAL)).toBe(true)
      }
      expect(bands(html(<BandStrip {...partial(-0.25)} />)).every(isMeasured)).toBe(true)
    })

    test('absentFraction without an absentState throws in dev', () => {
      expect(() => renderToString(<BandStrip {...partial(0.5)} absentState={undefined} />)).toThrow(
        'absentState',
      )
    })

    test('an unknown absentState throws in dev', () => {
      expect(() => renderToString(<BandStrip {...partial(0.5)} absentState="typo" />)).toThrow(
        'BandStrip.absentState',
      )
    })

    test('the tooltip names "Not measured" beside the band state', async () => {
      const el = await mount(<BandStrip {...partial(0.5)} />)
      const text = await hover(el)
      expect(text).toContain('Up')
      expect(text).toContain('Not measured')
    })
  })

  test('a marker draws an inset bar in its state color over the band', () => {
    const doc = html(
      <BandStrip
        {...props({
          getBand: (d) => ({ state: d.s, ...(d.s === 'down' && { marker: { inset: 10 } }) }),
        })}
      />,
    )
    const inset = bands(doc).filter((r) => r.getAttribute('fill') === 'var(--vx-bad)')
    const full = bands(doc).filter((r) => r.getAttribute('fill')?.includes('--vx-bad) 100%'))
    expect(inset.length).toBe(4)
    expect(full.length).toBe(4)
    expect(Number(inset[0]?.getAttribute('y'))).toBeGreaterThan(Number(full[0]?.getAttribute('y')))
    expect(Number(inset[0]?.getAttribute('height'))).toBeLessThan(
      Number(full[0]?.getAttribute('height')),
    )
  })

  test('fold collapses adjacent slots through the consumer merge', () => {
    const data = slots(600, (i) => (i < 300 ? 'up' : 'down'))
    const merged: number[] = []
    const doc = html(
      <BandStrip
        {...props({
          data,
          fold: {
            merge: (group) => {
              merged.push(group.length)
              return group.find((d) => d.s === 'down') ?? (group[0] as Slot)
            },
          },
        })}
      />,
    )
    // 640px / 3px floor = 213 groups of ceil(600 / 213) = 3 slots.
    expect(bands(doc).length).toBe(200)
    expect(merged.every((n) => n === 3)).toBe(true)
    // The folded bands still tile the strip: their widths sum to the span they cover.
    const edges = bands(doc).map((r) => [
      Number(r.getAttribute('x')),
      Number(r.getAttribute('width')),
    ])
    const covered = edges.reduce((sum, [, w]) => sum + (w ?? 0), 0)
    const left = Math.min(...edges.map(([x]) => x ?? 0))
    const right = Math.max(...edges.map(([x, w]) => (x ?? 0) + (w ?? 0)))
    // The SVG rounds each rect to 0.01px, so 200 rects drift under a pixel.
    expect(Math.abs(right - left - covered)).toBeLessThan(1)
  })

  test('data that fits is never folded', () => {
    let calls = 0
    const doc = html(
      <BandStrip
        {...props({
          fold: {
            merge: (g) => {
              calls++
              return g[0] as Slot
            },
          },
        })}
      />,
    )
    expect(calls).toBe(0)
    expect(bands(doc).length).toBe(10)
  })

  test('a legend toggle hides a state from the strip', async () => {
    const el = await mount(<BandStrip {...props()} />)
    expect(bands(el).length).toBe(10)
    const toggle = el.querySelector('button[data-legend-key="down"]')
    if (!(toggle instanceof HTMLButtonElement)) throw new Error('no toggleable legend entry')
    await act(async () => toggle.click())
    expect(bands(el).length).toBe(6)
    expect(fills(el)).toEqual(new Set(['color-mix(in srgb, var(--vx-good) 100%, transparent)']))
  })

  test('a state outside `states` throws in development', () => {
    expect(() =>
      renderToString(<BandStrip {...props({ getBand: () => ({ state: 'typo' }) })} />),
    ).toThrow('BandSpan.state')
  })

  test('the tooltip shows one row for the hovered band: its state and formatted reading', async () => {
    const data = slots(10, () => 'down').map((d) => ({ ...d, loss: 5 }))
    const el = await mount(<BandStrip {...props({ data })} />)
    const text = await hover(el)
    expect(text).toContain('Down')
    expect(text).toContain('5% loss')
    expect(text).not.toContain('Up')
  })

  test('a null reading renders an em dash, not an empty value', async () => {
    const el = await mount(<BandStrip {...props({ data: slots(10, () => 'down') })} />)
    const text = await hover(el)
    expect(text).toContain('—')
  })

  test('draws no y axis labels', () => {
    const doc = html(<BandStrip {...props()} />)
    expect(doc.querySelector('[data-ts-key^="y-tick-label"]')).toBeNull()
  })

  test('markers paint after every base band, even a marker in another state', () => {
    // An up band carrying a down marker, then a down band: the marker must not sit under it.
    const data = slots(4, (i) => (i < 2 ? 'up' : 'down'))
    const doc = html(
      <BandStrip
        {...props({
          data,
          getBand: (d) => ({ state: d.s, ...(d.s === 'up' && { marker: { state: 'down' } }) }),
        })}
      />,
    )
    const order = layerFills(doc)
    expect(order.at(-1)).toBe('var(--vx-bad)')
    expect(order.slice(0, -1).every((f) => f?.startsWith('color-mix'))).toBe(true)
    expect(order.length).toBe(3)
  })

  test('a marker naming no state throws in development, like a band does', () => {
    expect(() =>
      renderToString(
        <BandStrip {...props({ getBand: (d) => ({ state: d.s, marker: { state: 'typo' } }) })} />,
      ),
    ).toThrow('BandSpan.marker.state')
  })

  test('hovering a legend entry dims the other states', async () => {
    const el = await mount(<BandStrip {...props()} />)
    const entry = el.querySelector('button[data-legend-key="down"]')
    if (!entry) throw new Error('no legend entry')
    await act(async () => {
      entry.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    })
    const opacity = (fill: string): string | null | undefined =>
      [...el.querySelectorAll('[data-ts-key^="band-"]')]
        .find((g) => g.querySelector('rect')?.getAttribute('fill')?.includes(fill))
        ?.getAttribute('fill-opacity') ??
      el.querySelector(`[fill*="${fill}"]`)?.getAttribute('fill-opacity')
    expect(opacity('--vx-bad')).toBeNull()
    expect(Number(opacity('--vx-good'))).toBeLessThan(1)
  })

  test('empty data and a single datum render', () => {
    expect(bands(html(<BandStrip {...props({ data: [] })} />)).length).toBe(0)
    const one = html(<BandStrip {...props({ data: slots(1) })} />)
    expect(bands(one).length).toBe(1)
    expect(Number(bands(one)[0]?.getAttribute('width'))).toBeGreaterThan(600)
  })

  test('fold: data that equals the cap is drawn whole, one more folds in pairs', () => {
    const fold = { merge: (g: Slot[]) => g[0] as Slot }
    // 640px / 3px floor = 213 bands.
    expect(bands(html(<BandStrip {...props({ data: slots(213), fold })} />)).length).toBe(213)
    expect(bands(html(<BandStrip {...props({ data: slots(214), fold })} />)).length).toBe(107)
  })

  test('fold: a count that does not divide leaves a shorter final group', () => {
    const sizes: number[] = []
    const fold = {
      merge: (g: Slot[]) => {
        sizes.push(g.length)
        return g[0] as Slot
      },
    }
    const doc = html(<BandStrip {...props({ data: slots(500), fold })} />)
    // ceil(500 / 213) = 3 per group: 166 full groups and one of 2.
    expect(bands(doc).length).toBe(167)
    expect(sizes.filter((n) => n === 3).length).toBe(166)
    expect(sizes.at(-1)).toBe(2)
  })

  test('hovering a folded band reads the merged datum', async () => {
    const data = slots(600, () => 'up')
    const fold = { merge: (g: Slot[]) => ({ ...(g[0] as Slot), s: 'down', loss: g.length }) }
    const el = await mount(<BandStrip {...props({ data, fold })} />)
    const text = await hover(el)
    expect(text).toContain('Down')
    expect(text).toContain('3% loss')
  })
})
