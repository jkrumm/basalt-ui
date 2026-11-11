import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { Tooltip, tooltipParts } from './tooltip'

afterEach(cleanup)

describe('tooltip module', () => {
  test('closed, the trigger is the child itself and no popup renders', () => {
    const { container } = render(
      <Tooltip label="Copy link">
        <button type="button">Copy</button>
      </Tooltip>,
    )
    expect(container.querySelectorAll('button')).toHaveLength(1)
    expect(document.querySelector('[data-slot="tooltip"]')).toBeNull()
  })

  test('open, the popup carries the string label on the z-50 positioner', () => {
    render(
      <Tooltip label="Copy link" defaultOpen>
        <button type="button">Copy</button>
      </Tooltip>,
    )
    const popup = document.querySelector('[data-slot="tooltip"]')
    expect(popup?.textContent).toBe('Copy link')
    expect(popup?.parentElement?.className).toContain('z-50')
    expect(tooltipParts).toEqual(['tooltip'])
  })

  test('the trigger keeps its own name: the popup is a visual label, not the accessible name', () => {
    const { container } = render(
      <Tooltip label="Copy link" defaultOpen>
        <button type="button" aria-label="Copy link">
          <span aria-hidden="true">#</span>
        </button>
      </Tooltip>,
    )
    expect(container.querySelector('button')?.getAttribute('aria-label')).toBe('Copy link')
    expect(document.querySelector('[data-slot="tooltip"]')?.className).toContain(
      'pointer-events-none',
    )
  })
})
