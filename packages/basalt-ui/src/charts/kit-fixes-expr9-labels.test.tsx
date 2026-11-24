/**
 * Expression cycle 9 (`v3-expr-9-kit-fixes` 2, 3 and 4): a mark clamped by a bounded `y.domain`
 * carries its true value beside the caret; `chartLabels.place` keeps a short label it can fit;
 * `chartLabels.row` places each row by that row's own width.
 */
import { describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { BASALT } from '../tokens'
import { chartLabels } from './chart-labels'
import { CartesianChart } from './parts/cartesian'
import { placeRefLabel, yRangeWithin } from './ref-label'

type Item = { age: number; behind: number }
const color = { light: 'var(--basalt-line)', dark: 'var(--basalt-line)' }

function html(rows: Item[], format?: (v: number) => string): string {
  return renderToString(
    <CartesianChart<Item>
      label="Queue"
      data={rows}
      x={{ value: (d) => d.age, domain: [0, 100] }}
      y={{ domain: [0, 14] }}
      series={[
        {
          mark: 'dot',
          key: 'v',
          label: 'Items',
          color,
          y: (d: Item) => d.behind,
          ...(format && { format }),
        },
      ]}
    />,
  )
}

/** The text of the clamped mark's value label, or `null` when none is drawn. */
const valueLabel = (out: string): string | null =>
  />([^<]*)<\/text>/.exec(
    /<text[^>]*off-scale-v-value[^>]*>[^<]*<\/text>/.exec(out)?.[0] ?? '',
  )?.[1] ?? null

describe('a clamped mark carries its true value', () => {
  test('a dot past the cap names its value beside the caret', () => {
    const out = html([
      { age: 20, behind: 3 },
      { age: 50, behind: 41 },
    ])
    expect(out).toContain('off-scale-v-top')
    expect(valueLabel(out)).toBe('41')
  })

  test('the series format writes the value', () => {
    const out = html(
      [
        { age: 20, behind: 3 },
        { age: 50, behind: 41 },
      ],
      (v) => `${v} Issues`,
    )
    expect(valueLabel(out)).toBe('41 Issues')
  })

  test('no value label where nothing is past the cap', () => {
    const out = html([
      { age: 20, behind: 3 },
      { age: 50, behind: 9 },
    ])
    expect(out).not.toContain('off-scale-v-value')
  })
})

describe('chartLabels.row places each label by the room it has', () => {
  const title = 'Quarterly planning with the platform team'
  const row = (from: number, to: number) =>
    chartLabels.row([{ key: 'e', text: title, from, to }], { share: 0.7 })

  test('a title too long for the narrow track shows from the class that holds it', () => {
    const { placed, dropped } = row(0.1, 0.2)
    expect(dropped).toEqual([])
    expect(placed[0]?.props.className).toContain('@regular:block')
  })

  test('a short label stays visible at every width', () => {
    const { placed } = chartLabels.row([{ key: 'e', text: '1 h', from: 0.1, to: 0.2 }], {
      share: 0.7,
    })
    expect(placed[0]?.props.className).not.toContain(':block')
  })

  test('rows of one list differ by their own mark: the one with room shows earlier', () => {
    const early = row(0.05, 0.1).placed[0]?.props.className ?? ''
    const late = row(0.5, 0.55).placed[0]?.props.className ?? ''
    expect(early).not.toBe(late)
  })

  test('a title no class can hold is dropped', () => {
    const { placed, dropped } = chartLabels.row(
      [{ key: 'e', text: title.repeat(8), from: 0.3, to: 0.4 }],
      { share: 0.7 },
    )
    expect(placed).toEqual([])
    expect(dropped).toHaveLength(1)
  })

  test('a page that states a width places once there', () => {
    const { placed } = chartLabels.row([{ key: 'e', text: title, from: 0.1, to: 0.2 }], {
      share: 0.7,
      width: 800,
    })
    expect(placed[0]?.props.className).not.toContain(':block')
  })
})

describe('a reference caption steps off its rule when every spot beside it meets a line', () => {
  // A line that swings 25 either side of the rule over the whole plot: no spot beside the rule is clear.
  const wave = Array.from({ length: 41 }, (_, i) => ({ fx: i / 40, y: 50 + 25 * Math.sin(i / 2) }))
  const base = {
    pinned: undefined,
    startFirst: false,
    value: 50,
    domain: [0, 100] as const,
    plotWidth: 300,
    plotHeight: 200,
    label: 'Crew limit 1.5 m',
    fontSize: 11,
    series: [wave],
  }

  test('the caption takes the nearest height clear of the line and says how far it moved', () => {
    const placed = placeRefLabel(base)
    expect(placed).not.toBeNull()
    expect(placed!.shift).toBeGreaterThan(0)
    const { box } = placed!
    const range = yRangeWithin(wave, box.fx0, box.fx1)
    expect(range).not.toBeNull()
    expect(box.y0 > range![1] || box.y1 < range![0]).toBe(true)
  })

  test('a caption with room beside its rule does not move', () => {
    const flat = [
      [
        { fx: 0, y: 5 },
        { fx: 1, y: 5 },
      ],
    ]
    expect(placeRefLabel({ ...base, series: flat })?.shift).toBe(0)
  })
})

describe('chartLabels.place keeps a label it can fit inside the plot', () => {
  const text = 'Decision 2018, 71 h'
  const width = chartLabels.width(text)
  // The worst item of n38 sits at the top of the plot, near its right edge; the room below is taken.
  const cases = [
    { name: '390', frame: { width: 270, height: 150 }, x: 208 },
    { name: '1800', frame: { width: 1500, height: 300 }, x: 1470 },
  ]
  for (const { name, frame, x } of cases) {
    test(`at ${name} the label slides to the side with room and stays whole`, () => {
      const { placed, dropped } = chartLabels.place([{ key: 'top', text, x, y: 6 }], frame, {
        obstacles: [{ left: x - 160, top: 14, width: 400, height: 80 }],
        gap: 7,
      })
      expect(dropped).toEqual([])
      const label = placed[0]!
      expect(label.spot).toBe('left')
      expect(label.left).toBeGreaterThanOrEqual(0)
      expect(label.top).toBeGreaterThanOrEqual(0)
      expect(label.left + label.width).toBeLessThanOrEqual(frame.width)
      expect(label.width).toBeCloseTo(width, 5)
    })
  }

  test('a placed label carries the size it was measured at', () => {
    const { placed } = chartLabels.place([{ key: 'k', text: '12', x: 50, y: 50 }], {
      width: 200,
      height: 100,
    })
    expect(placed[0]?.size).toBe(BASALT.text.micro)
  })
})
