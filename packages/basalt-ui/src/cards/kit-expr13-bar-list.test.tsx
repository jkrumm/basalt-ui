import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { act, useEffect } from 'react'
import { useChartFocus } from '../charts/focus'
import { BarList } from './bar-list'

afterEach(cleanup)

const HOURS = Array.from({ length: 6 }, (_, h) => ({ h }))
type Hour = (typeof HOURS)[number]

let hours: ReturnType<typeof useChartFocus<Hour>> | undefined

function Windows() {
  const focus = useChartFocus(HOURS, { announce: (d) => `hour ${d.h}` })
  useEffect(() => {
    hours = focus
  }, [focus])
  return (
    <BarList
      title="Windows"
      items={[
        { key: 'early', label: 'early', value: 3 },
        { key: 'late', label: 'late', value: 2 },
        { key: 'running', label: 'Running', value: 0 },
      ]}
      focusItems={{
        focus,
        holds: (row, hour: Hour) =>
          row.key === 'early' ? hour.h < 3 : row.key === 'late' ? hour.h >= 4 : false,
      }}
    />
  )
}

const rows = (root: ParentNode): Element[] => [
  ...root.querySelectorAll('[data-slot="bar-list-row"]'),
]
const marks = (root: ParentNode, attr: string): boolean[] =>
  rows(root).map((el) => el.hasAttribute(attr))
const liveOf = (root: ParentNode): string =>
  root.querySelector('[data-slot="bar-list-live"]')?.textContent ?? ''

describe('a BarList row that holds no item (kit-expr13)', () => {
  test('the first ArrowDown onto it announces its label and value', () => {
    const { container } = render(<Windows />)
    const list = container.querySelector('ul') as Element
    fireEvent.keyDown(list, { key: 'ArrowDown' })
    fireEvent.keyDown(list, { key: 'ArrowDown' })
    fireEvent.keyDown(list, { key: 'ArrowDown' })
    expect(liveOf(container)).toBe('Running, 0')
  })

  test('the announcement goes silent once the chart focus is set elsewhere', () => {
    const { container } = render(<Windows />)
    const list = container.querySelector('ul') as Element
    for (let i = 0; i < 3; i++) fireEvent.keyDown(list, { key: 'ArrowDown' })
    expect(liveOf(container)).toBe('Running, 0')
    act(() => hours?.set(1))
    expect(liveOf(container)).toBe('')
  })

  test('its row carries the chart mark, so it dims with the rest while an item is focused', () => {
    const { container } = render(<Windows />)
    act(() => hours?.set(1))
    expect(marks(container, 'data-chart-mark')).toEqual([true, true, true])
    expect(marks(container, 'data-dimmed')).toEqual([false, true, true])
  })
})
