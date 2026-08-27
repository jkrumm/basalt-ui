/**
 * `ChartCard`'s header — the `''`-as-hidden-header sentinel is gone (docs/CONTROLS-SPEC.md §2.2):
 * the header now renders only when at least one of title/info/value/actions/icon/count is set.
 * Mantine-free (`src/charts/**`), so no `MantineProvider` wrapper is needed — mirrors
 * `ChartFrame.test.tsx`'s rationale.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { ChartCard } from './ChartCard'

describe('the header renders only when it has something to show', () => {
  test('nothing set — no heading at all', () => {
    render(
      <ChartCard>
        <svg />
      </ChartCard>,
    )
    expect(screen.queryByRole('heading')).toBeNull()
  })

  test('title alone renders the h3', () => {
    render(
      <ChartCard title="Revenue over time">
        <svg />
      </ChartCard>,
    )
    expect(screen.getByRole('heading', { level: 3, name: 'Revenue over time' })).toBeDefined()
  })

  test('count alone (no title) still renders the header, with an empty title', () => {
    render(
      <ChartCard count={4}>
        <svg />
      </ChartCard>,
    )
    expect(screen.getByText('4')).toBeDefined()
  })

  test('value alone renders the header', () => {
    render(
      <ChartCard value="$12,483">
        <svg />
      </ChartCard>,
    )
    expect(screen.getByText('$12,483')).toBeDefined()
  })

  test('actions alone renders the header, carrying data-basalt-tier="widget"', () => {
    const { container } = render(
      <ChartCard actions={<button type="button">Export</button>}>
        <svg />
      </ChartCard>,
    )
    expect(screen.getByRole('button', { name: 'Export' })).toBeDefined()
    expect(container.querySelector('[data-basalt-tier="widget"]')).not.toBeNull()
  })

  test('subtitle alone does NOT render the header', () => {
    render(
      <ChartCard subtitle="Net revenue per day">
        <svg />
      </ChartCard>,
    )
    expect(screen.queryByText('Net revenue per day')).toBeNull()
  })
})
