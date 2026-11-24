import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, render } from '@testing-library/react'
import { StatCell } from './stat-cell'

afterEach(cleanup)

const text = (container: HTMLElement): string | null | undefined =>
  container.querySelector('[data-slot="stat-error"] p')?.textContent

describe('StatCell error title', () => {
  test('the default error names the cell, as a ChartCard names its title', () => {
    const { container } = render(
      <StatCell title="Wi-Fi signal" phase={{ tag: 'error', retry: () => undefined }} />,
    )
    expect(text(container)).toBe('Could not load Wi-Fi signal.')
  })

  test("the page's message is the text, not only a tooltip", () => {
    const { container } = render(
      <StatCell
        title="Wi-Fi signal"
        phase={{ tag: 'error', message: 'The router did not answer.', retry: () => undefined }}
      />,
    )
    expect(text(container)).toBe('The router did not answer.')
  })

  test('a blank message and a kind keep their own text', () => {
    const blank = render(<StatCell title="Recovery" phase={{ tag: 'error', message: '  ' }} />)
    expect(text(blank.container)).toBe('Could not load recovery.')
    cleanup()
    const forbidden = render(
      <StatCell title="Recovery" phase={{ tag: 'error', kind: 'forbidden', message: 'No.' }} />,
    )
    expect(text(forbidden.container)).toBe('You do not have access to this.')
  })

  test('a lowercased plain label and a kind keep their text', () => {
    const named = render(
      <StatCell title="Recovery" phase={{ tag: 'error', retry: () => undefined }} />,
    )
    expect(text(named.container)).toBe('Could not load recovery.')
    cleanup()
    const forbidden = render(
      <StatCell title="Recovery" phase={{ tag: 'error', kind: 'forbidden' }} />,
    )
    expect(text(forbidden.container)).toBe('You do not have access to this.')
  })
})
