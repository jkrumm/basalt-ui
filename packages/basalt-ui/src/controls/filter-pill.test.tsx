/**
 * `FilterPill` — a string label that CSS truncates past the pill's 24rem cap must stay readable in
 * full: the pill carries it as `title`.
 */
import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { FilterPill } from './filter-pill'

afterEach(cleanup)

describe('FilterPill title', () => {
  test('the full label is the title, so a truncated name is still readable on hover', () => {
    const label = 'Kitt Peak National Observatory Dark Sky Reserve'
    render(
      <MantineProvider>
        <FilterPill label={label} />
      </MantineProvider>,
    )
    expect(screen.getByRole('button').getAttribute('title')).toBe(label)
  })
})
