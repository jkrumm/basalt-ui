/**
 * Expression cycle 6, c16 .13: a pointer that crosses a chart on its way to a linked row. The chart's
 * own clear (its cursor emptying, or the engine's null datum) lands after the row's pointer enter in
 * either order the browser fires them in, and must not undo the row's focus.
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { useEffect } from 'react'
import { chartCursor } from './core/cursor'
import { engineFocusHandler, useChartFocus } from './focus'
import { CartesianChart } from './parts/cartesian'

afterEach(cleanup)

type Stage = { stage: string; at: number }
const STAGES: readonly Stage[] = [
  { stage: 'Build', at: 1 },
  { stage: 'Test', at: 2 },
  { stage: 'Deploy', at: 3 },
]
const COLOR = { light: 'var(--basalt-line)', dark: 'var(--basalt-line)' }
const GROUP = 'row-crossing'
let handle: ReturnType<typeof useChartFocus<Stage>> | undefined

function Linked() {
  const focus = useChartFocus(STAGES, { announce: (d) => d.stage })
  useEffect(() => {
    handle = focus
  })
  return (
    <div>
      <CartesianChart
        label="Pace"
        data={STAGES}
        x={{ value: (d) => d.stage }}
        series={[{ key: 'at', label: 'At', color: COLOR, mark: 'bar', y: (d) => d.at }]}
        cursor={GROUP}
        focus={focus}
      />
      <ul onPointerLeave={() => focus.set(null)}>
        {STAGES.map((d, i) => (
          <li key={d.stage} data-row={d.stage} {...focus.item(i)}>
            {d.stage}
          </li>
        ))}
      </ul>
    </div>
  )
}

const live = (el: HTMLElement) => el.querySelector('[data-chart-focus-live]')?.textContent
const focused = (el: HTMLElement) =>
  el.querySelector('li[data-focused]')?.getAttribute('data-row') ?? null
const settle = () => act(async () => new Promise((r) => setTimeout(r, 20)))

describe('a row focus survives the chart-to-row crossing', () => {
  test("the chart's cleared cursor after the row's enter leaves the row focused", async () => {
    const { container } = render(<Linked />)
    await settle()
    await act(async () => {
      chartCursor(GROUP).setState({
        anchor: 'value',
        value: { x: 'Build' },
        source: 'pointer',
        pinned: false,
      })
    })
    expect(live(container)).toBe('Build')
    fireEvent.pointerEnter(container.querySelector('[data-row="Test"]') as Element)
    expect(focused(container)).toBe('Test')
    await act(async () => chartCursor(GROUP).setState(null))
    expect(focused(container)).toBe('Test')
    expect(live(container)).toBe('Test')
  })

  test("the engine's null datum after the row's enter leaves the row focused", async () => {
    const { container } = render(<Linked />)
    await settle()
    fireEvent.pointerEnter(container.querySelector('[data-row="Deploy"]') as Element)
    act(() => engineFocusHandler(handle)?.(null))
    expect(focused(container)).toBe('Deploy')
  })

  test('the row leaving, a chart datum and a key still replace the row focus', async () => {
    const { container } = render(<Linked />)
    await settle()
    fireEvent.pointerEnter(container.querySelector('[data-row="Test"]') as Element)
    fireEvent.pointerLeave(container.querySelector('ul') as Element)
    expect(focused(container)).toBeNull()
    expect(live(container)).toBe('')
    fireEvent.pointerEnter(container.querySelector('[data-row="Test"]') as Element)
    act(() => engineFocusHandler(handle)?.(STAGES[0]))
    expect(focused(container)).toBe('Build')
    expect(live(container)).toBe('Build')
    // After the chart took the focus, its own clear works again.
    act(() => engineFocusHandler(handle)?.(null))
    expect(live(container)).toBe('')
  })
})

function Shared() {
  const focus = useChartFocus(STAGES, { announce: (d) => d.stage })
  return (
    <div>
      {[0, 1].map((n) => (
        <CartesianChart
          key={n}
          label={`Pace ${n}`}
          data={STAGES}
          x={{ value: (d) => d.stage }}
          series={[{ key: 'at', label: 'At', color: COLOR, mark: 'bar', y: (d) => d.at }]}
          cursor={`${GROUP}-shared-${n}`}
          focus={focus}
        />
      ))}
      <button type="button" onClick={() => focus.set(1)}>
        go
      </button>
    </div>
  )
}

function Swap({ first }: { first: boolean }) {
  const focus = useChartFocus(STAGES, { announce: (d) => d.stage })
  return (
    <div>
      {first && <span key="a">{focus.live}</span>}
      <span key="b">{focus.live}</span>
    </div>
  )
}

describe('charts on one focus announce a move once', () => {
  test('two charts draw one live region that says the focused datum', async () => {
    const { container } = render(<Shared />)
    await settle()
    expect(container.querySelectorAll('[data-chart-focus-live]').length).toBe(1)
    fireEvent.click(container.querySelector('button') as Element)
    await settle()
    const regions = [...container.querySelectorAll('[data-chart-focus-live]')]
    expect(regions.map((r) => r.textContent)).toEqual(['Test'])
  })

  test('the speaking region passes to the next when it unmounts', async () => {
    const { container, rerender } = render(<Swap first />)
    await settle()
    expect(container.querySelectorAll('[data-chart-focus-live]').length).toBe(1)
    rerender(<Swap first={false} />)
    await settle()
    expect(container.querySelectorAll('[data-chart-focus-live]').length).toBe(1)
  })
})
