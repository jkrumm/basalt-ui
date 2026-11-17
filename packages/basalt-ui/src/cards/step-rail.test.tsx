import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { createFormat } from '../core/format'
import { lists } from '../core/messages/lists'
import { StepRail } from './step-rail'
import type { StepRailProps, StepRailRow } from './step-rail'

afterEach(cleanup)

const AT = Date.UTC(2026, 8, 3, 14, 2, 11)

const STEPS: readonly StepRailRow[] = [
  { id: 'build', label: 'Build image', durationMs: 40_000, at: AT },
  { id: 'push', label: 'Push', durationMs: 10_000, at: AT + 40_000 },
  { id: 'wait', label: 'Queued', durationMs: null, at: AT + 50_000 },
  {
    id: 'probe',
    label: 'Probe',
    durationMs: 20_000,
    at: AT + 51_000,
    tone: 'bad',
    detail: 'Timed out on /health',
  },
]

const draw = (props: Partial<StepRailProps> = {}): ReturnType<typeof render> =>
  render(<StepRail label="Deploy steps" steps={STEPS} {...props} />)

const widthOf = (container: HTMLElement, id: string): string | undefined =>
  container.querySelector<HTMLElement>(`[data-step-id="${id}"] [data-slot="step-rail-fill"]`)?.style
    .width

describe('StepRail', () => {
  test('scales each bar against the longest duration', () => {
    const { container } = draw()
    expect(widthOf(container, 'build')).toBe('100%')
    expect(widthOf(container, 'push')).toBe('25%')
    expect(widthOf(container, 'probe')).toBe('50%')
  })

  test('a null duration draws no bar and no duration text', () => {
    const { container } = draw()
    const row = container.querySelector('[data-step-id="wait"]')
    expect(row?.querySelector('[data-slot="step-rail-bar"]')).toBeNull()
    expect(row?.textContent).not.toContain('ms')
  })

  test('a zero or tiny duration still draws the minimum sliver', () => {
    const { container } = draw({
      steps: [
        { id: 'a', label: 'A', durationMs: 0, at: AT },
        { id: 'b', label: 'B', durationMs: 100_000, at: AT },
      ],
    })
    expect(widthOf(container, 'a')).toBe('2%')
  })

  test('all-zero durations draw the minimum sliver, never NaN', () => {
    const { container } = draw({ steps: [{ id: 'a', label: 'A', durationMs: 0, at: AT }] })
    expect(widthOf(container, 'a')).toBe('2%')
  })

  test('a negative or non-finite duration reads as none', () => {
    const { container } = draw({
      steps: [
        { id: 'a', label: 'A', durationMs: -5, at: AT },
        { id: 'b', label: 'B', durationMs: Number.NaN, at: AT },
      ],
    })
    expect(container.querySelector('[data-slot="step-rail-bar"]')).toBeNull()
  })

  test('the tone is a data attribute and paints the bar; neutral is the default', () => {
    const { container } = draw()
    expect(container.querySelector('[data-step-id="probe"]')?.getAttribute('data-tone')).toBe('bad')
    expect(container.querySelector('[data-step-id="build"]')?.getAttribute('data-tone')).toBe(
      'neutral',
    )
    expect(
      container
        .querySelector('[data-step-id="probe"] [data-slot="step-rail-fill"]')
        ?.className.includes('bg-bad'),
    ).toBe(true)
  })

  test('a detail shows under its row', () => {
    const { container } = draw()
    expect(
      container.querySelector('[data-step-id="probe"] [data-slot="step-rail-detail"]')?.textContent,
    ).toBe('Timed out on /health')
    expect(
      container.querySelector('[data-step-id="build"] [data-slot="step-rail-detail"]'),
    ).toBeNull()
  })

  test('the picture is hidden and a table says the same, scale included', () => {
    const { container } = draw()
    expect(container.querySelector('ol')?.getAttribute('aria-hidden')).toBe('true')
    const table = container.querySelector('table')
    expect(table?.querySelector('caption')?.textContent).toBe(
      'Deploy steps. Bars are scaled to the longest step, 40.0 s',
    )
    const rows = [...(table?.querySelectorAll('tbody tr') ?? [])].map((tr) =>
      [...tr.children].map((c) => c.textContent),
    )
    expect(rows[0]).toEqual(['Build image', '40.0 s', '2:02 PM', ''])
    expect(rows[2]?.[1]).toBe('')
    expect(rows[3]).toEqual(['Probe (Failed)', '20.0 s', '2:03 PM', 'Timed out on /health'])
  })

  test('the table has no detail column when no step has a detail', () => {
    const { container } = draw({ steps: STEPS.slice(0, 2) })
    expect(container.querySelectorAll('thead th')).toHaveLength(3)
  })

  test('with no duration at all the caption names only the rail', () => {
    const { container } = draw({ steps: [{ id: 'a', label: 'A', durationMs: null, at: AT }] })
    expect(container.querySelector('caption')?.textContent).toBe('Deploy steps')
  })

  test('an empty list renders an empty rail', () => {
    const { container } = draw({ steps: [] })
    expect(container.querySelectorAll('[data-slot="step-rail-row"]')).toHaveLength(0)
  })

  test('an invalid time prints a dash', () => {
    const { container } = draw({ steps: [{ id: 'a', label: 'A', durationMs: 1, at: Number.NaN }] })
    expect(container.querySelector('[data-slot="step-rail-time"]')?.textContent).toBe('—')
  })

  test('a custom icon replaces the dot', () => {
    const { container } = draw({
      steps: [{ id: 'a', label: 'A', durationMs: 1, at: AT, icon: () => <svg data-testid="i" /> }],
    })
    expect(container.querySelector('[data-testid="i"]')).not.toBeNull()
  })

  test('server render and hydrating render match markup', () => {
    const html = renderToString(<StepRail label="Deploy steps" steps={STEPS} />)
    expect(html).toContain('data-step-id="build"')
    expect(html).toContain('<caption>')
  })
})

describe('lists.stepDuration', () => {
  const f = createFormat({ locale: 'en' })
  const read = (ms: number): string => lists['lists.stepDuration'](f, ms)

  test('reads milliseconds, seconds, minutes and hours', () => {
    expect(read(850)).toBe('850 ms')
    expect(read(4200)).toBe('4.2 s')
    expect(read(59_949)).toBe('59.9 s')
    expect(read(59_980)).toBe('1 min')
    expect(read(999.6)).toBe('1.0 s')
    expect(read(180_000)).toBe('3 min')
    expect(read(3_600_000)).toBe('1 h')
    expect(read(3_900_000)).toBe('1 h 5 min')
  })
})
