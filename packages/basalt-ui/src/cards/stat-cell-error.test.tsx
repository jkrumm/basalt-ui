import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, render } from '@testing-library/react'
import { StatCell } from './stat-cell'

afterEach(cleanup)

const text = (container: HTMLElement): string | null | undefined =>
  container.querySelector('[data-slot="stat-error"] p')?.textContent

describe('StatCell error title', () => {
  test('the default error names the cell, as a ChartCard names its title', () => {
    const { container } = render(
      <StatCell label="Wi-Fi signal" phase={{ tag: 'error', retry: () => undefined }} />,
    )
    expect(text(container)).toBe('Could not load Wi-Fi signal.')
  })

  test('a lowercased plain label and a kind keep their text', () => {
    const named = render(
      <StatCell label="Recovery" phase={{ tag: 'error', retry: () => undefined }} />,
    )
    expect(text(named.container)).toBe('Could not load recovery.')
    cleanup()
    const forbidden = render(
      <StatCell label="Recovery" phase={{ tag: 'error', kind: 'forbidden' }} />,
    )
    expect(text(forbidden.container)).toBe('You do not have access to this.')
  })
})
