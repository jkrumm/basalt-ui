/**
 * Expression cycle 7 (`v3-expr-7-kit-fixes` 2): a `StatGroup` whose cells all fail alike, or are
 * all empty for the same cause, draws one message and one Retry for the group, not one per cell.
 */
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import { StatCell } from './stat-cell'
import { StatGroup } from './stat-group'

afterEach(cleanup)

const LABELS = ['Downstream', 'Upstream', 'Latency', 'Loss'] as const

describe('StatGroup shared failure', () => {
  for (const variant of ['strip', 'cards'] as const) {
    test(`${variant}: four cells in error draw one message and one Retry`, () => {
      const retries = LABELS.map(() => mock(() => undefined))
      const { container, getAllByRole } = render(
        <StatGroup variant={variant} label="Link health">
          {LABELS.map((label, i) => (
            <StatCell
              key={label}
              title={label}
              phase={{ tag: 'error', retry: retries[i] as () => void }}
            />
          ))}
        </StatGroup>,
      )
      expect(container.querySelectorAll('[role="alert"]').length).toBe(1)
      expect(container.querySelector('[role="alert"]')?.textContent).toContain(
        'Could not load link health.',
      )
      const buttons = getAllByRole('button', { name: 'Retry' })
      expect(buttons.length).toBe(1)
      fireEvent.click(buttons[0] as HTMLElement)
      for (const retry of retries) expect(retry).toHaveBeenCalledTimes(1)
    })

    test(`${variant}: four empty cells print their cause once`, () => {
      const { container } = render(
        <StatGroup variant={variant} label="Link health">
          {LABELS.map((label) => (
            <StatCell key={label} title={label} value={1} empty={{ cause: 'No readings yet' }} />
          ))}
        </StatGroup>,
      )
      const printed = container.textContent?.split('No readings yet').length ?? 0
      expect(printed - 1).toBe(1)
    })
  }

  test('the strip keeps every caption; the cards hold their height invisibly', () => {
    const strip = render(
      <StatGroup variant="strip">
        <StatCell title="Downstream" phase={{ tag: 'error' }} />
        <StatCell title="Upstream" phase={{ tag: 'error' }} />
      </StatGroup>,
    )
    expect(strip.container.textContent).toContain('Downstream')
    expect(strip.container.textContent).toContain('Upstream')
    cleanup()
    const cards = render(
      <StatGroup variant="cards">
        <StatCell title="Downstream" phase={{ tag: 'error' }} />
        <StatCell title="Upstream" phase={{ tag: 'error' }} />
      </StatGroup>,
    )
    for (const cell of cards.container.querySelectorAll('[data-slot="stat-cell"]'))
      expect(cell.className).toContain('invisible')
  })

  test('cells that differ keep their own state', () => {
    const { container } = render(
      <StatGroup variant="strip">
        <StatCell title="Downstream" phase={{ tag: 'error', retry: () => undefined }} />
        <StatCell title="Upstream" value={44} />
      </StatGroup>,
    )
    expect(container.querySelector('[data-slot="stat-group-message"]')).toBeNull()
    expect(container.querySelectorAll('[role="alert"]').length).toBe(1)
    cleanup()
    const kinds = render(
      <StatGroup variant="strip">
        <StatCell title="A" phase={{ tag: 'error', kind: 'forbidden' }} />
        <StatCell title="B" phase={{ tag: 'error' }} />
      </StatGroup>,
    )
    expect(kinds.container.querySelectorAll('[role="alert"]').length).toBe(2)
  })

  test('a group of one cell is not collapsed', () => {
    const { container } = render(
      <StatGroup variant="strip">
        <StatCell title="Downstream" phase={{ tag: 'error' }} />
      </StatGroup>,
    )
    expect(container.querySelector('[data-slot="stat-group-message"]')).toBeNull()
  })
})
