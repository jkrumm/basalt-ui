/**
 * W42 r2 /data copy: no circular empty states, no demo name in a title, tab labels short enough
 * for the 390 picker.
 */
import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'bun:test'
import { DataDemoPage } from './DataDemoPage'

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
})
