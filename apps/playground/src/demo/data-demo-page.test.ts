/**
 * W42 r2 /data copy: no circular empty states, no demo name in a title, tab labels short enough
 * for the 390 picker.
 */
import { MantineProvider } from '@mantine/core'
import { cleanup, render, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'bun:test'
import { DataDemoPage } from './DataDemoPage'
import { RELOAD_STEP } from './table-copy'

afterEach(cleanup)

const mount = (shotState: 'empty' | undefined) =>
  render(createElement(MantineProvider, null, createElement(DataDemoPage, { shotState }))).container

describe('DataDemoPage copy', () => {
  it('titles the roster by a scope noun, not by the demo it is', () => {
    const c = mount(undefined)
    const text = c.querySelector('[data-shot="roster-table"]')?.textContent ?? ''
    expect(text).toContain('Employee roster, 4 locations')
    expect(text).not.toContain('wide view')
  })

  it('states a cause, not a circle, when the tables are empty', () => {
    const c = mount('empty')
    for (const name of ['employees-table', 'roster-table']) {
      const text = c.querySelector(`[data-shot="${name}"]`)?.textContent ?? ''
      expect(text).toContain('records were returned')
      expect(text).not.toMatch(/is empty|once they are added/)
    }
  })

  it('names the first tab for what it shows, with no Employees tab', () => {
    const { container, queryByRole, getByRole } = render(
      createElement(MantineProvider, null, createElement(DataDemoPage, { shotState: undefined })),
    )
    // `ViewTabs` draws the switch as a SegmentedControl radiogroup (a phone Select past three options).
    const tabs = within(getByRole('radiogroup', { name: 'Demo' }))
      .getAllByRole('radio')
      .map((t) => t.getAttribute('value'))
    expect(tabs[0]).toBe('overview')
    expect(getByRole('radio', { name: 'Tables' })).toBeDefined()
    expect(queryByRole('radio', { name: 'Employees' })).toBeNull()
    expect(container.querySelector('[data-shot="employees-table"]')).not.toBeNull()
  })

  it('states the employees cause and its one step', () => {
    const text = mount('empty').querySelector('[data-shot="employees-table"]')?.textContent ?? ''
    expect(text).toContain(RELOAD_STEP)
  })

  it('leaves Role a one-line column: only notes wrap', () => {
    const roster = mount(undefined).querySelector('[data-shot="roster-table"]')
    expect(roster).not.toBeNull()
    const heads = [...(roster?.querySelectorAll('th') ?? [])].map((h) => h.textContent)
    const cellKind = (name: string) =>
      roster
        ?.querySelector(`tbody tr td:nth-child(${heads.indexOf(name) + 1})`)
        ?.getAttribute('data-kind')
    expect(heads).toContain('Role')
    // Positive control: a column that opts into `kind: 'text'` carries it on its cells.
    expect(cellKind('Department')).toBe('text')
    expect(cellKind('Role')).not.toBe('text')
  })
})
