/**
 * §1's measured-equals-painted law, checked against the PAINTED DOM at the two phone widths the
 * round-2 critic measured (390 and 320) — the one place the law can be broken without any unit
 * test noticing, because the measurement and the paint live in different files.
 *
 * Two shapes were broken there and both are pinned here: a rotated x tick label crossed the SVG's
 * left edge (−3.2px at 390, −5.7px at 320) and sat exactly on the bottom clip line, because
 * `autoMargin` measured the unshifted box while `Axes.tsx` painted through `ROTATED_LABEL_OFFSET`;
 * and `Heatmap` — the one kind that renders its category labels as plain `<text>` rather than
 * through the `Axis*` primitives — printed all 12 columns at 390 with ten adjacent overlaps and
 * the last one past the right edge.
 *
 * The container has to be MEASURED for either to happen, and happy-dom ships no `ResizeObserver`
 * (`tests/setup/dom.ts` installs an inert shim), so this file swaps in one that reports a fixed
 * box on `observe()` — what a real observer does on its first callback — and puts the original
 * back afterwards.
 */
import { render, waitFor } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { CartesianChart } from '../primitives/CartesianChart'
import { chartTierMetrics } from '../primitives/chart-frame-layout'
import { Heatmap } from '../kinds/Heatmap'
import { measureText } from '../utils/measure-text'

const CHART_HEIGHT = 220

const originalResizeObserver = window.ResizeObserver

/** Report one fixed box for the whole `describe`, then restore the shared inert shim. */
function measuredAt(width: number, height: number = CHART_HEIGHT): void {
  class FixedBoxResizeObserver {
    constructor(private readonly callback: ResizeObserverCallback) {}
    observe(): void {
      this.callback([{ contentRect: { width, height, top: 0, left: 0 } }] as never, this as never)
    }
    unobserve(): void {}
    disconnect(): void {}
  }
  beforeAll(() => {
    window.ResizeObserver = FixedBoxResizeObserver as unknown as typeof ResizeObserver
  })
  afterAll(() => {
    window.ResizeObserver = originalResizeObserver
  })
}

const translateOf = (node: Element | null): { x: number; y: number } => {
  const m = /translate\(\s*(-?[\d.]+)[,\s]+(-?[\d.]+)\s*\)/.exec(
    node?.getAttribute('transform') ?? '',
  )
  return { x: Number(m?.[1] ?? '0'), y: Number(m?.[2] ?? '0') }
}

/**
 * Glyph metrics for the mono tick face as a fraction of the font size, split at the baseline.
 * Deliberately the values measured in Chrome on the round-2 artefacts (a ~1.17em box) rather than
 * the conservative 1.35em line box `autoMargin` reserves from — a test that reused the production
 * split would assert the code against itself.
 */
const ASCENT = 0.9
const DESCENT = 0.27

/**
 * The painted box of one rotated tick label, in the root SVG's own coordinates.
 *
 * `@visx/text` wraps the label in `<svg x={dx} y={dy}>` and rotates the `<text>` about its own
 * `(x, y)`, which with `text-anchor: end` is the baseline's right end — so the box runs
 * down-and-left from there.
 */
function rotatedLabelBox(
  label: Element,
  origin: { x: number; y: number },
  fontPx: number,
  degrees: number,
): { left: number; bottom: number } {
  const shift = label.parentElement
  const dx = Number(shift?.getAttribute('x') ?? '0')
  const dy = Number(shift?.getAttribute('y') ?? '0')
  const anchorX = origin.x + dx + Number(label.getAttribute('x') ?? '0')
  const anchorY = origin.y + dy + Number(label.getAttribute('y') ?? '0')
  const radians = (degrees * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const width = measureText(label.textContent ?? '', fontPx)
  return {
    left: anchorX - cos * (width + ASCENT * fontPx),
    bottom: anchorY + sin * width + cos * DESCENT * fontPx,
  }
}

type Row = { date: string; v: number }
const ROWS: Row[] = Array.from({ length: 14 }, (_, i) => ({
  date: `2026-03-${String(i + 1).padStart(2, '0')}`,
  v: 10 + i,
}))
const SERIES = [
  { key: 'v', label: 'v', color: '#000', mark: 'line' as const, getValue: (d: Row) => d.v },
]
const WIDE_X = (key: string): string => `Mar ${key.slice(-2)} 14:00`

const renderRotated = async (width: number): Promise<HTMLElement> => {
  const { container } = render(
    <CartesianChart
      data={ROWS}
      chartId={`rotated-${width}`}
      getX={(d: Row) => d.date}
      series={SERIES}
      formatX={WIDE_X}
      xLabelRotate={45}
      legend={false}
      height={CHART_HEIGHT}
    >
      {() => null}
    </CartesianChart>,
  )
  await waitFor(() => {
    expect(container.querySelectorAll('.visx-axis-bottom text').length).toBeGreaterThan(0)
  })
  return container
}

function assertRotatedLabelsInside(container: HTMLElement): void {
  const svg = container.querySelector('svg') as SVGSVGElement
  const svgHeight = Number(svg.getAttribute('height'))
  const plot = translateOf(container.querySelector('.visx-group'))
  const axis = translateOf(container.querySelector('.visx-axis-bottom'))
  const fontPx = chartTierMetrics('phone').axisFont
  const labels = [...container.querySelectorAll('.visx-axis-bottom text')]

  expect(labels.length).toBeGreaterThan(0)
  for (const label of labels) {
    const box = rotatedLabelBox(label, { x: plot.x, y: plot.y + axis.y }, fontPx, 45)
    expect(box.left).toBeGreaterThanOrEqual(0)
    expect(box.bottom).toBeLessThanOrEqual(svgHeight - 1)
  }
}

describe('a 45° x label stays inside the SVG at 390', () => {
  measuredAt(390)

  test('the first label’s box clears the left edge and the bottom clip line', async () => {
    assertRotatedLabelsInside(await renderRotated(390))
  })
})

describe('and at 320, where it used to overhang by 5.7px', () => {
  measuredAt(320)

  test('the deeper left gutter absorbs the whole rotated projection', async () => {
    assertRotatedLabelsInside(await renderRotated(320))
  })
})

describe('Heatmap column labels thin like an axis at 390', () => {
  measuredAt(338, 260)

  const HOURS = Array.from({ length: 12 }, (_, i) => `${i + 8}:00`)
  const cells = HOURS.flatMap((col) =>
    ['Mon', 'Tue', 'Wed'].map((row, ri) => ({ row, col, v: ri + 1 })),
  )

  const renderHeatmap = async (): Promise<HTMLElement> => {
    const { container } = render(
      <Heatmap<(typeof cells)[number]>
        data={cells}
        chartId="heat-thin"
        getRow={(d) => d.row}
        getCol={(d) => d.col}
        getValue={(d) => d.v}
        height={260}
      />,
    )
    await waitFor(() => {
      expect(container.querySelectorAll('text').length).toBeGreaterThan(0)
    })
    return container
  }

  /** Painted x range of a centred category label, in the root SVG's coordinates. */
  const columnBoxes = (container: HTMLElement): { left: number; right: number }[] => {
    const fontPx = chartTierMetrics('phone').axisFont
    return [...container.querySelectorAll('text[text-anchor="middle"]')].map((node) => {
      const group = translateOf(node.parentElement)
      const half = measureText(node.textContent ?? '', fontPx) / 2
      const cx = group.x + Number(node.getAttribute('x') ?? '0')
      return { left: cx - half, right: cx + half }
    })
  }

  test('no two adjacent painted labels overlap — 12 columns used to collide ten times', async () => {
    const boxes = columnBoxes(await renderHeatmap())
    expect(boxes.length).toBeGreaterThan(1)
    expect(boxes.length).toBeLessThan(HOURS.length)
    for (let i = 1; i < boxes.length; i += 1) {
      expect((boxes[i] as { left: number }).left).toBeGreaterThanOrEqual(
        (boxes[i - 1] as { right: number }).right,
      )
    }
  })

  test('the last one is inside the SVG — the right gutter reserves half its width', async () => {
    const container = await renderHeatmap()
    const svgWidth = Number(container.querySelector('svg')?.getAttribute('width'))
    const boxes = columnBoxes(container)
    expect((boxes[boxes.length - 1] as { right: number }).right).toBeLessThanOrEqual(svgWidth)
    expect((boxes[0] as { left: number }).left).toBeGreaterThanOrEqual(0)
  })

  test('the first and last hour still carry a label — a reader orients from the edges', async () => {
    const painted = [...(await renderHeatmap()).querySelectorAll('text[text-anchor="middle"]')].map(
      (n) => n.textContent,
    )
    expect(painted[0]).toBe('8:00')
    expect(painted[painted.length - 1]).toBe('19:00')
  })
})
