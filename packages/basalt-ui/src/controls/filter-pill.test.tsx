/**
 * `FilterPill` — a string label that CSS truncates past the pill's 24rem cap must stay readable in
 * full: the pill carries it as `title`.
 */
import { MantineProvider } from '@mantine/core'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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

describe('FilterPill anatomy — the two colours', () => {
  const CSS = readFileSync(join(import.meta.dir, 'controls.module.css'), 'utf8')
  const rule = (selector: string): string =>
    new RegExp(`${selector}\\s*\\{([^}]*)\\}`).exec(CSS)?.[1] ?? ''

  test('the name span is muted and the value span is ink', () => {
    expect(rule('\\.pillName')).toContain('color: var(--vx-muted)')
    expect(rule('\\.pillValue')).toContain('color: var(--vx-ink)')
  })
})
