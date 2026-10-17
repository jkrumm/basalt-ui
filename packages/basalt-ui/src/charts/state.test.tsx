import { render } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { ChartPlaceholder } from './state'

describe('ChartPlaceholder error idiom', () => {
  test('non-compact: a dot, the word, the message and the action', () => {
    const { container } = render(
      <ChartPlaceholder state={{ error: new Error('boom') }} action={<button>Retry</button>} />,
    )
    const alert = container.querySelector('[role="alert"]')
    expect(alert?.querySelector('[data-basalt-status-dot]')).not.toBeNull()
    // StatCard's anatomy: the same title pattern, then the message, then the action.
    expect(alert?.textContent).toContain('Could not load this chart')
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
