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

describe('the card chrome', () => {
  test('root is a `basalt-card` inline-size container and a flex column; the body takes spare height', () => {
    const { container } = render(
      <ChartCard title="Revenue">
        <svg />
      </ChartCard>,
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.style.containerType).toBe('inline-size')
    expect(root.style.containerName).toBe('basalt-card')
    expect(root.style.display).toBe('flex')
    expect(root.style.flexDirection).toBe('column')
    const body = root.lastElementChild as HTMLElement
    expect(body.style.flex).toBe('1 1 auto')
    expect(body.style.minHeight).toBe('0')
  })

  test('an empty legend slot sits in the header band only when there is a header', () => {
    const withHeader = render(
      <ChartCard title="Revenue">
        <svg />
      </ChartCard>,
    )
    expect(withHeader.container.querySelectorAll('[data-basalt-legend-slot]')).toHaveLength(1)
    withHeader.unmount()
    const bare = render(
      <ChartCard>
        <svg />
      </ChartCard>,
    )
    expect(bare.container.querySelector('[data-basalt-legend-slot]')).toBeNull()
  })
})

describe('state replaces the body with a placeholder, header stays put', () => {
  const BODY = 'CHART_BODY_MARKER'

  test('pending: no children, header stays, aria-busy on the root', () => {
    const { container } = render(
      <ChartCard title="Revenue over time" state={{ pending: true }} placeholderHeight={320} />,
    )
    expect(screen.getByRole('heading', { level: 3, name: 'Revenue over time' })).toBeDefined()
    expect(screen.queryByText(BODY)).toBeNull()
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(screen.getByText('Loading…')).toBeDefined()
  })

  test('a title-less pending card is a valid Suspense fallback', () => {
    render(<ChartCard state={{ pending: true }} placeholderHeight={320} />)
    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.getByText('Loading…')).toBeDefined()
  })

  test('empty with a string label renders that copy, not the "No data" default', () => {
    render(
      <ChartCard title="Strength Scan" state={{ empty: 'No data — start logging workouts.' }}>
        {BODY}
      </ChartCard>,
    )
    expect(screen.getByText('No data — start logging workouts.')).toBeDefined()
    expect(screen.queryByText(BODY)).toBeNull()
  })

  test('error renders the thrown message and is not aria-busy', () => {
    const { container } = render(
      <ChartCard title="Revenue over time" state={{ error: new Error('boom') }}>
        {BODY}
      </ChartCard>,
    )
    expect(screen.getByText('boom')).toBeDefined()
    expect(container.querySelector('[aria-busy="true"]')).toBeNull()
  })

  test('state={{}} (all-falsy) renders children unchanged, same as omitting the prop', () => {
    render(
      <ChartCard title="Revenue over time" state={{}}>
        {BODY}
      </ChartCard>,
    )
    expect(screen.getByText(BODY)).toBeDefined()
  })

  test('stateAction renders under the empty placeholder', () => {
    render(
      <ChartCard state={{ empty: true }} stateAction={<button type="button">Clear filters</button>}>
        {BODY}
      </ChartCard>,
    )
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeDefined()
  })
})
