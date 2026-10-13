/**
 * `BandStrip` behaviour through its public props and the rendered DOM: gap-free state bands,
 * intensity fills, markers, fold, the legend toggle and the derived tooltip row.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { BandStrip } from './BandStrip'
import type { BandSpan, BandStripProps, BandStripState } from './BandStrip'

type Slot = { t: string; s: string; loss?: number }
const slots = (n: number, state: (i: number) => string = () => 'up'): Slot[] =>
  Array.from({ length: n }, (_, i) => ({ t: `s${String(i).padStart(3, '0')}`, s: state(i) }))

const up: BandStripState<Slot> = { key: 'up', label: 'Up', color: 'var(--vx-good)' }
const down: BandStripState<Slot> = {
  key: 'down',
  label: 'Down',
  color: 'var(--vx-bad)',
  formatValue: (d) => (d.loss === undefined ? null : `${d.loss}% loss`),
}
const none: BandStripState<Slot> = {
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
    expect(fills(doc)).toEqual(new Set(['color-mix(in srgb, var(--vx-neutral) 100%, transparent)']))
    expect(doc.querySelector('pattern')).toBeNull()
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
    ).toThrow('names no `states` entry')
  })

  test('the tooltip shows one row for the hovered band: its state and formatted reading', async () => {
    const data = slots(10, () => 'down').map((d) => ({ ...d, loss: 5 }))
    const el = await mount(<BandStrip {...props({ data })} />)
    const svg = el.querySelector('svg')
    if (!svg) throw new Error('chart did not mount')
    await act(async () => {
      svg.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 300, clientY: 100, bubbles: true }),
      )
      await new Promise((r) => setTimeout(r, 30))
    })
    const tip = document.querySelector('.ts-chart-tooltip')
    expect(tip?.textContent).toContain('Down')
    expect(tip?.textContent).toContain('5% loss')
    expect(tip?.textContent).not.toContain('Up')
  })

  test('a null reading renders an em dash, not an empty value', async () => {
    const el = await mount(<BandStrip {...props({ data: slots(10, () => 'down') })} />)
    const svg = el.querySelector('svg')
    if (!svg) throw new Error('chart did not mount')
    await act(async () => {
      svg.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 300, clientY: 100, bubbles: true }),
      )
      await new Promise((r) => setTimeout(r, 30))
    })
    expect(document.querySelector('.ts-chart-tooltip')?.textContent).toContain('—')
  })

  test('draws no y axis labels', () => {
    const doc = html(<BandStrip {...props()} />)
    expect(doc.querySelector('[data-ts-key^="y-tick-label"]')).toBeNull()
  })
})
