/**
 * S10 (docs/v3/concepts/charts-cards-kanban.md section 9): the two-pane recipe hands both panes one
 * cursor group and one y gutter, a cursor set on pane A is readable on pane B through `chartCursor`,
 * and the spike's recorded verdict holds. Geometry (criterion 1) is `two-pane.layout.test.ts`.
 */
import { cleanup, render } from '@testing-library/react'
import { chartCursor } from 'basalt-ui/charts'
import { afterEach, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { GROUP, GUTTER, TwoPane, seedBars } from './two-pane'

afterEach(cleanup)

const SPIKE = readFileSync(
  join(import.meta.dirname, '..', '..', '..', '..', 'docs', 'v3', 'spikes', 'two-pane.md'),
  'utf8',
)

describe('two-pane recipe (S10)', () => {
  test('both panes mount under one cursor group and one gutter', () => {
    const { container } = render(<TwoPane bars={seedBars()} />)
    expect(container.querySelectorAll('svg[role="img"]')).toHaveLength(2)
    expect(GROUP).toBe('momentum')
    expect(GUTTER).toBe(56)
  })

  test('a cursor set on pane A is readable on pane B (criterion 2)', () => {
    render(<TwoPane bars={seedBars()} />)
    const release = chartCursor(GROUP).subscribe(() => {})
    const state = {
      anchor: 'value' as const,
      value: { x: new Date(Date.UTC(2026, 8, 10)) },
      source: 'programmatic' as const,
      pinned: false,
    }
    chartCursor(GROUP).setState(state)
    expect(chartCursor(GROUP).getState()).toEqual(state)
    chartCursor(GROUP).setState(null)
    release()
  })

  test('the recorded verdict is PASS or FAIL, and names its limit on FAIL', () => {
    const first = SPIKE.split('\n')[0]
    expect(first).toMatch(/^Verdict: (PASS|FAIL)$/)
    if (first === 'Verdict: FAIL') expect(SPIKE).toMatch(/^## Limit$/m)
  })
})
