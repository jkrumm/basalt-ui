/**
 * `StatGroup variant="flush"`: the summary strip of a fill page. No card, cells on hairlines, a rule
 * below, and a cell without a sub-line or any context does not render.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { StatCell } from './stat-cell'
import { StatGroup } from './stat-group'
import { resetCardWarnings } from './stat-group-shared'

afterEach(() => {
  cleanup()
  resetCardWarnings()
})

describe('StatGroup flush', () => {
  test('draws the strip with no card: a rule below and cells ruled as the strip is', () => {
    render(
      <StatGroup variant="flush" label="Invoices">
        <StatCell title="Outstanding" value={186250} sub="33 invoices waiting" />
        <StatCell title="Overdue" value={81120} sub="17 invoices, oldest 118 days late" />
      </StatGroup>,
    )
    const group = document.querySelector('[data-slot="stat-group"]')!
    expect(group.getAttribute('data-variant')).toBe('flush')
    expect(group.className).toContain('border-b')
    expect(group.querySelector('[data-slot="card"]')).toBeNull()
    const cells = [...group.querySelectorAll('[data-slot="stat-cell"]')]
    expect(cells).toHaveLength(2)
    for (const cell of cells) expect(cell.className).toContain('border-l')
  })

  test('a cell with no sub-line or context is not rendered, and development says so', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    render(
      <StatGroup variant="flush" label="Invoices">
        <StatCell title="Outstanding" value={186250} sub="33 invoices waiting" />
        <StatCell title="Bare" value={12} />
        <StatCell title="Paid" value={167} status={{ tone: 'good', label: 'On time' }} />
      </StatGroup>,
    )
    expect(screen.queryByText('Bare')).toBeNull()
    expect(screen.getByText('Outstanding')).toBeDefined()
    expect(screen.getByText('Paid')).toBeDefined()
    expect(warn.mock.calls.some(([m]) => String(m).includes('Bare'))).toBe(true)
    warn.mockRestore()
  })

  test('a loading or failed cell keeps its slot; only a ready bare cell is dropped', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    render(
      <StatGroup variant="flush" label="Invoices">
        <StatCell title="Outstanding" value={186250} sub="33 invoices waiting" />
        <StatCell title="Overdue" value={undefined} phase="loading" />
        <StatCell title="Paid" value={undefined} phase={{ tag: 'error', message: 'down' }} />
      </StatGroup>,
    )
    expect(document.querySelectorAll('[data-slot="stat-cell"]')).toHaveLength(3)
    warn.mockRestore()
  })

  test('a ready cell with a null empty is still bare and dropped; an empty cause keeps its slot', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    render(
      <StatGroup variant="flush" label="Invoices">
        <StatCell title="Outstanding" value={186250} sub="33 invoices waiting" />
        <StatCell title="Open" value={42} empty={null} />
        <StatCell title="Paid" value={undefined} empty={{ cause: 'No invoices paid yet' }} />
      </StatGroup>,
    )
    expect(screen.queryByText('Open')).toBeNull()
    expect(screen.getByText('Paid')).toBeDefined()
    warn.mockRestore()
  })

  test('a flush strip whose every cell is bare draws nothing', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    const { container } = render(
      <StatGroup variant="flush" label="Invoices">
        <StatCell title="Open" value={42} />
        <StatCell title="Paid" value={7} />
      </StatGroup>,
    )
    expect(container.innerHTML).toBe('')
    warn.mockRestore()
  })

  test('a strip keeps a bare cell; only flush drops it', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    render(
      <StatGroup variant="strip" label="Fleet">
        <StatCell title="Deploys" value={164} sub="this week" />
        <StatCell title="Bare" value={12} />
      </StatGroup>,
    )
    expect(screen.getByText('Bare')).toBeDefined()
    warn.mockRestore()
  })
})
