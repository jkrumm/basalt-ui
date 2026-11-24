/**
 * Expression cycle 15 (`v3-expr-15-kit-fixes` 5): a StatGroup whose failed cells say different things
 * draws each cell's own banner and Retry. Cells that fail with one message and one kind still share one.
 */
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import { StatCell } from './stat-cell'
import { StatGroup } from './stat-group'

afterEach(cleanup)

describe('StatGroup failures that differ', () => {
  test('cells with different messages each draw their own banner and Retry', () => {
    const items = mock(() => undefined)
    const sessions = mock(() => undefined)
    const { container, getAllByRole } = render(
      <StatGroup variant="strip" label="Review">
        <StatCell
          title="Due now"
          phase={{ tag: 'error', message: 'The server did not answer.', retry: items }}
        />
        <StatCell
          title="Last session"
          phase={{ tag: 'error', message: 'The log did not answer.', retry: sessions }}
        />
      </StatGroup>,
    )
    expect(container.querySelector('[data-slot="stat-group-message"]')).toBeNull()
    expect(container.querySelectorAll('[role="alert"]').length).toBe(2)
    const buttons = getAllByRole('button', { name: 'Retry' })
    expect(buttons.length).toBe(2)
    fireEvent.click(buttons[1] as HTMLElement)
    expect(sessions).toHaveBeenCalledTimes(1)
    expect(items).toHaveBeenCalledTimes(0)
  })

  test('cells with one message and one kind still share one banner', () => {
    const { container } = render(
      <StatGroup variant="strip" label="Review">
        <StatCell title="Due now" phase={{ tag: 'error', message: 'The server did not answer.' }} />
        <StatCell title="Slipped" phase={{ tag: 'error', message: 'The server did not answer.' }} />
      </StatGroup>,
    )
    expect(container.querySelector('[data-slot="stat-group-message"]')).not.toBeNull()
    expect(container.querySelectorAll('[role="alert"]').length).toBe(1)
  })
})
