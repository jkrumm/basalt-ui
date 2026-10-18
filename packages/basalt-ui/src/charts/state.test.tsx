import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { ChartPlaceholder } from './state'

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
