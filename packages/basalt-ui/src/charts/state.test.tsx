import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { ChartPlaceholder } from './state'
import { ChartCard } from './ChartCard'
import type { ChartState } from './types'

afterEach(cleanup)

describe('ChartPlaceholder error idiom', () => {
  test('non-compact: a dot, the word, the message and the action', () => {
    const { container } = render(
      <ChartPlaceholder state={{ error: new Error('boom') }} action={<button>Retry</button>} />,
    )
    const alert = container.querySelector('[role="alert"]')
    expect(alert?.querySelector('[data-basalt-status-dot]')).not.toBeNull()
    // StatCard's anatomy: the same title pattern, then the message, then the action.
    expect(alert?.textContent).toContain('Could not load')
    expect(alert?.textContent).toContain('boom')
    expect(alert?.querySelector('button')?.textContent).toBe('Retry')
  })

  test('compact keeps the bare dash with the label as its name', () => {
    const { container } = render(<ChartPlaceholder state={{ error: new Error('boom') }} compact />)
    const alert = container.querySelector('[role="alert"]')
    expect(alert?.querySelector('[data-basalt-status-dot]')).toBeNull()
    expect(alert?.textContent).toBe('—')
    expect(alert?.getAttribute('aria-label')).toBe('boom')
  })
})

describe('ChartPlaceholder Retry', () => {
  test('onRetry renders the shared Retry button and fires', () => {
    let n = 0
    const { container } = render(
      <ChartPlaceholder state={{ error: new Error('boom') }} onRetry={() => (n += 1)} />,
    )
    const retry = container.querySelector('[role="alert"] button') as HTMLButtonElement
    expect(retry.textContent).toBe('Retry')
    retry.click()
    expect(n).toBe(1)
  })

  test('retrying disables it and marks it busy; the action still renders after it', () => {
    const { container } = render(
      <ChartPlaceholder
        state={{ error: 'x' }}
        onRetry={() => {}}
        retrying
        action={<a href="#clear">Clear</a>}
      />,
    )
    const retry = container.querySelector('[role="alert"] button') as HTMLButtonElement
    expect(retry.disabled).toBe(true)
    expect(retry.getAttribute('aria-busy')).toBe('true')
    expect(container.querySelector('[role="alert"] a')?.textContent).toBe('Clear')
  })

  test('no Retry on pending or empty, and none without onRetry', () => {
    const empty = render(<ChartPlaceholder state={{ empty: true }} onRetry={() => {}} />)
    expect(empty.container.querySelector('button')).toBeNull()
    cleanup()
    const bare = render(<ChartPlaceholder state={{ error: 'x' }} />)
    expect(bare.container.querySelector('button')).toBeNull()
  })
})

describe('ChartPlaceholder default copy', () => {
  test('an error without a readable message says the shared fallback, not a restated title', () => {
    const { container } = render(<ChartPlaceholder state={{ error: {} }} />)
    const alert = container.querySelector('[role="alert"]')
    expect(alert?.textContent).toContain('The request failed.')
    expect(alert?.textContent).not.toContain('failed to load')
    expect(alert?.querySelector('svg')).toBeNull()
  })
})

describe('ChartPlaceholder height="content"', () => {
  test('error and empty render no chart box; pending and the default keep one', () => {
    const box = (state: ChartState, height?: 'content') =>
      render(
        <ChartPlaceholder state={state} {...(height && { height })} />,
      ).container.querySelector('[data-basalt-box]')
    expect(box({ error: new Error('x') }, 'content')).toBeNull()
    cleanup()
    expect(box({ empty: true }, 'content')).toBeNull()
    cleanup()
    expect(box({ pending: true }, 'content')).not.toBeNull()
    cleanup()
    expect(box({ error: new Error('x') })).not.toBeNull()
  })
})

describe('ChartCard placeholderHeight="content"', () => {
  const card = (state: ChartState) =>
    render(
      <ChartCard title="T" state={state} placeholderHeight="content">
        <p data-testid="body">rows</p>
      </ChartCard>,
    )

  test('error and empty replace the body with a boxless placeholder', () => {
    const { container, queryByTestId } = card({ error: new Error('boom') })
    expect(queryByTestId('body')).toBeNull()
    expect(container.querySelector('[data-basalt-box]')).toBeNull()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('boom')
  })

  test('pending leaves the body in place, marked busy', () => {
    const { container, queryByTestId } = card({ pending: true })
    expect(queryByTestId('body')).not.toBeNull()
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  test('pending draws the plot ghost; compact ghosts a line, in the same tone as every ghost', () => {
    const full = render(<ChartPlaceholder state={{ pending: true }} />)
    expect(full.container.querySelector('[data-basalt-plot-ghost]')).not.toBeNull()
    full.unmount()
    const compact = render(<ChartPlaceholder state={{ pending: true }} compact />)
    expect(
      compact.container
        .querySelector('[data-basalt-plot-ghost]')
        ?.getAttribute('data-basalt-plot-ghost'),
    ).toBe('line')
  })
})
