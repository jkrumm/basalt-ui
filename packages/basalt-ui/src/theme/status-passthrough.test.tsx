/** `className` and `style` reach the root element of the status mark (audit item C8). */
import { render } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { StatusDot } from './status-dot'
import { StatusVerdict } from './status-verdict'

describe('status mark passthrough', () => {
  test('StatusDot appends className and merges style without losing its colour var', () => {
    const { container } = render(
      <StatusDot color="red" className="extra" style={{ marginLeft: 4 }} />,
    )
    const dot = container.querySelector('[data-basalt-status-dot]') as HTMLElement
    expect(dot.className).toContain('extra')
    expect(dot.style.marginLeft).toBe('4px')
    expect(dot.style.getPropertyValue('--basalt-status-dot')).toBe('red')
  })

  test('StatusVerdict puts className and style on its root span', () => {
    const { container } = render(
      <StatusVerdict color="red" word="Over" className="extra" style={{ marginLeft: 4 }} />,
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.className).toContain('extra')
    expect(root.style.marginLeft).toBe('4px')
  })
})
