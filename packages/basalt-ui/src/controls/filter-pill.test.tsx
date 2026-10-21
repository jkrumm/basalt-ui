/**
 * `FilterPill` — a string label that CSS truncates past the pill's 24rem cap must stay readable in
 * full: the pill carries it as `title`.
 */
import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { FilterPill, filterReading } from './filter-pill'

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

describe('FilterPill anatomy — muted label, bright value', () => {
  const spans = (): { name: string | null; value: string | null } => {
    const button = screen.getByRole('button')
    return {
      name: button.querySelector('[data-pill-part="name"]')?.textContent ?? null,
      value: button.querySelector('[data-pill-part="value"]')?.textContent ?? null,
    }
  }
  const mount = (node: React.ReactNode): void => {
    render(<MantineProvider>{node}</MantineProvider>)
  }

  test('a selection renders the label in the muted span and the value in the ink span', () => {
    mount(<FilterPill label="Exercise" value="Squat" active />)
    expect(spans()).toEqual({ name: 'Exercise', value: 'Squat' })
    expect(screen.getByRole('button').getAttribute('data-active')).toBe('true')
    expect(screen.getByRole('button', { name: 'Exercise Squat' })).toBeDefined()
  })

  test('multi: the count is the value', () => {
    mount(<FilterPill label="Channels" value="3 selected" active />)
    expect(spans()).toEqual({ name: 'Channels', value: '3 selected' })
  })

  test('unset: one muted span, no value span', () => {
    mount(<FilterPill label="All exercises" unset />)
    expect(spans()).toEqual({ name: 'All exercises', value: null })
    expect(screen.getByRole('button').getAttribute('data-active')).toBeNull()
  })

  test('open: the popover target keeps aria-expanded and the split', () => {
    mount(
      <FilterPill label="Exercise" value="Squat" active>
        <div>body</div>
      </FilterPill>,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('true')
    expect(spans()).toEqual({ name: 'Exercise', value: 'Squat' })
  })

  test('disabled keeps the split and refuses the press', () => {
    mount(<FilterPill label="Exercise" value="Squat" disabled />)
    expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true)
    expect(spans()).toEqual({ name: 'Exercise', value: 'Squat' })
  })

  test('a press-to-act pill (no value, not unset) keeps its single plain label', () => {
    mount(<FilterPill label="Errors only" pressed onClick={() => undefined} />)
    expect(spans()).toEqual({ name: null, value: null })
    expect(screen.getByRole('button', { name: 'Errors only' })).toBeDefined()
  })
})

describe('filterReading — the one place a facet turns state into a pill reading', () => {
  const input = { name: 'Exercise', value: 'Squat', unsetText: 'Any exercise' }

  test('informative: name + value', () => {
    expect(filterReading({ ...input, informative: true })).toEqual({
      label: 'Exercise',
      value: 'Squat',
    })
  })

  test('not informative: the control’s own unset copy', () => {
    expect(filterReading({ ...input, informative: false })).toEqual({
      label: 'Any exercise',
      unset: true,
    })
  })

  test('an empty value is not a selection', () => {
    expect(filterReading({ ...input, informative: true, value: '' })).toEqual({
      label: 'Any exercise',
      unset: true,
    })
  })
})

describe('FilterPill — an empty value reads as unset', () => {
  test('no value span, one muted name span, and the title stays the bare label', () => {
    render(
      <MantineProvider>
        <FilterPill label="Exercise" value="" />
      </MantineProvider>,
    )
    const button = screen.getByRole('button')
    expect(button.querySelector('[data-pill-part="value"]')).toBeNull()
    expect(button.getAttribute('title')).toBe('Exercise')
  })
})
