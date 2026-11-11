import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import type { ReactElement } from 'react'
import type { ControlsSlot } from '../core/ports'
import { DataPanel } from './data-panel'
import { StatCell } from './stat-cell'
import type { StatCellProps } from './stat-cell'
import { StatGroup } from './stat-group'
import { resetCardWarnings } from './stat-group-shared'

const slot = (count: number): ControlsSlot => ({
  kind: 'controls-slot',
  count,
  render: () => null,
})

const row = (label: string): { label: string; value: number } => ({ label, value: 1 })

const panel = (children: ReactElement | null = null, controls?: ControlsSlot): ReactElement => (
  <DataPanel
    title="Open"
    skeleton={{ rows: 3 }}
    {...(controls !== undefined && { controls })}
    body={() => children}
  />
)

let warn: ReturnType<typeof spyOn<Console, 'warn'>>

beforeEach(() => {
  resetCardWarnings()
  warn = spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => {
  cleanup()
  warn.mockRestore()
})

describe('dev assertions', () => {
  test('more than two inline controls warn once', () => {
    render(panel(null, slot(3)))
    render(panel(null, slot(4)))
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('3 inline controls')
  })

  test('two inline controls are fine', () => {
    render(panel(null, slot(2)))
    expect(warn).not.toHaveBeenCalled()
  })

  test('more than four rows warn once and draw the first four', () => {
    const rows = ['a', 'b', 'c', 'd', 'e'].map(row) as unknown as NonNullable<StatCellProps['rows']>
    const { container } = render(<StatCell label="Recovery" rows={rows} />)
    render(<StatCell label="Sleep" rows={rows} />)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('5 rows')
    expect(container.querySelectorAll('[data-slot="stat-row"]')).toHaveLength(4)
  })

  test('four rows are fine', () => {
    render(<StatCell label="Recovery" rows={[row('a'), row('b'), row('c'), row('d')]} />)
    expect(warn).not.toHaveBeenCalled()
  })

  test('nesting depth over two warns once', () => {
    render(panel(panel(panel())))
    render(panel(panel(panel())))
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('2 frames deep')
  })

  test('a group inside a panel inside a panel is over depth', () => {
    render(
      panel(
        panel(
          <StatGroup variant="strip">
            <StatCell label="A" />
          </StatGroup>,
        ),
      ),
    )
    expect(warn).toHaveBeenCalledTimes(1)
  })

  test('depth two is fine', () => {
    render(panel(panel()))
    expect(warn).not.toHaveBeenCalled()
  })

  test('each assertion has its own once', () => {
    render(panel(panel(panel()), slot(5)))
    expect(warn).toHaveBeenCalledTimes(2)
  })

  test('the gate is the literal NODE_ENV read, silent in production', () => {
    const env = process.env.NODE_ENV ?? 'test'
    process.env.NODE_ENV = 'production'
    try {
      render(panel(panel(panel()), slot(5)))
      expect(warn).not.toHaveBeenCalled()
    } finally {
      process.env.NODE_ENV = env
    }
  })
})
