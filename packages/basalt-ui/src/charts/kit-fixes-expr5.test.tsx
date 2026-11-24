/**
 * The chart kit fixes of expression cycle 5 (`v3-expr-5-kit-fixes`) a happy-dom page can show:
 * lines that answer to focus and the dark dim floor. An all-zero axis is in `all-zero-axis.test.ts`,
 * label placement against the host's obstacles in `chart-labels-obstacles.test.tsx`, the card ones
 * in `chart-card.test.tsx`.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { act } from 'react'
import type { ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { useChartFocus } from './focus'
import { CartesianChart } from './parts/cartesian'

let root: ReturnType<typeof createRoot> | undefined
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  document.body.innerHTML = ''
})

async function mount(node: ReactElement): Promise<HTMLElement> {
  const el = document.createElement('div')
  document.body.append(el)
  root = createRoot(el)
  await act(async () => root?.render(node))
  await act(async () => new Promise((r) => setTimeout(r, 20)))
  return el
}

const press = (target: Element, key: string) =>
  act(async () => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  })

const COLOR = { light: 'var(--basalt-line)', dark: 'var(--basalt-line)' }

type Hour = { h: number; a: number; b: number }
const HOURS: readonly Hour[] = [0, 1, 2, 3].map((h) => ({ h, a: h + 1, b: 5 - h }))

function TwoLines() {
  const focus = useChartFocus(HOURS, { announce: (d) => `hour ${d.h}` })
  return (
    <CartesianChart<Hour>
      label="Models"
      data={HOURS}
      x={{ value: (d) => d.h }}
      series={[
        { key: 'a', label: 'A', color: COLOR, mark: 'line', y: (d) => d.a },
        { key: 'b', label: 'B', color: COLOR, mark: 'line', y: (d) => d.b },
      ]}
      cursor="expr5-lines"
      focus={focus}
    />
  )
}

const strokes = (el: HTMLElement) =>
  ['a', 'b'].map(
    (k) => el.querySelector(`path[data-ts-key^="${k}:"]`)?.getAttribute('stroke') ?? 'none',
  )
const focusDots = (el: HTMLElement) => el.querySelectorAll('circle[data-ts-key*="-focus:"]')

describe('lines answer to focus', () => {
  test('without a focus every line draws at full strength and no dot is marked', async () => {
    const el = await mount(<TwoLines />)
    for (const stroke of strokes(el)) expect(stroke).not.toContain('color-mix')
    expect(focusDots(el).length).toBe(0)
  })

  test('with a focus each of two lines dims in its own hue and every line marks the focused x', async () => {
    const el = await mount(<TwoLines />)
    const wrap = el.querySelector('[data-chart-focus]') as Element
    await press(wrap, 'ArrowRight')
    await press(wrap, 'ArrowRight')
    for (const stroke of strokes(el)) {
      // Two lines keep their hue at 80% (`kit-fixes-expr7-focus.test.tsx`); a lone line dims as a bar does.
      expect(stroke).toStartWith('light-dark(color-mix')
      expect(stroke).toContain(' 80%')
    }
    // One dot per line, on the focused hour.
    expect(focusDots(el).length).toBe(2)
  })

  test('a cleared focus draws the lines whole again', async () => {
    const el = await mount(<TwoLines />)
    const wrap = el.querySelector('[data-chart-focus]') as Element
    await press(wrap, 'ArrowRight')
    await press(wrap, 'Escape')
    for (const stroke of strokes(el)) expect(stroke).not.toContain('color-mix')
    expect(focusDots(el).length).toBe(0)
  })
})

describe('the dark dim floor', () => {
  type Stage = { stage: string; ms: number }
  const STAGES: readonly Stage[] = [
    { stage: 'Build', ms: 12 },
    { stage: 'Test', ms: 94 },
    { stage: 'Deploy', ms: 8 },
  ]
  function Bars() {
    const focus = useChartFocus(STAGES, { announce: (d) => d.stage })
    return (
      <CartesianChart<Stage>
        label="Pace"
        data={STAGES}
        x={{ value: (d) => d.stage }}
        series={[{ key: 'ms', label: 'ms', color: COLOR, mark: 'bar', y: (d) => d.ms }]}
        cursor="expr5-dim"
        focus={focus}
      />
    )
  }

  test('a dimmed bar mixes the card muted ink in both schemes, more in light', async () => {
    const el = await mount(<Bars />)
    const wrap = el.querySelector('[data-chart-focus]') as Element
    await press(wrap, 'ArrowRight')
    const dimmed = [...el.querySelectorAll('[data-ts-key^="bars"]:not(g)')]
      .map((b) => b.getAttribute('fill') ?? '')
      .filter((f) => f.startsWith('light-dark(color-mix'))
    expect(dimmed.length).toBe(2)
    for (const fill of dimmed) {
      const [light, dark] = [
        fill.indexOf('light-dark('),
        fill.indexOf(', color-mix(in srgb, color-mix'),
      ]
      expect(light).toBe(0)
      expect(dark).toBeGreaterThan(0)
      expect(fill.slice(0, dark)).toContain('var(--basalt-ink-muted) 60%')
      expect(fill.slice(dark)).toContain('var(--basalt-ink-muted) 30%')
    }
  })
})
