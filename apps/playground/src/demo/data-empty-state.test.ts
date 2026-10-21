/**
 * Wave 42 r1: the /data tables share one empty-state pattern — the action appears only when the
 * filters are the cause, and the unfiltered copy never blames them.
 */
import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'bun:test'
import { tableEmptyState } from './DataDemoPage'

afterEach(cleanup)

const mount = (node: ReturnType<typeof tableEmptyState>) =>
  render(createElement(MantineProvider, null, node)).container

describe('tableEmptyState', () => {
  it('offers Clear filters when the filters are the cause', () => {
    const c = mount(
      tableEmptyState({
        noun: 'employees',
        total: 20,
        cause: 'x',
        filtered: true,
        onClear: () => {},
      }),
    )
    expect(c.textContent).toContain('No employees match')
    expect([...c.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Clear filters'])
  })

  it('states the honest cause, without an action or a filter blame, when none is set', () => {
    const c = mount(
      tableEmptyState({
        noun: 'employees',
        total: 20,
        cause: 'The directory is empty.',
        filtered: false,
        onClear: () => {},
      }),
    )
    expect(c.textContent).toContain('The directory is empty.')
    expect(c.textContent).not.toMatch(/filter|search/i)
    expect(c.querySelector('button')).toBeNull()
  })
})
