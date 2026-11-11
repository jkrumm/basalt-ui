import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { useState } from 'react'
import type { ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import { Segmented, SegmentedItem, segmentedParts } from './segmented'

afterEach(cleanup)

const OPTIONS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

const slots = (root: ParentNode): string[] =>
  [...root.querySelectorAll('[data-slot]')].map((el) => el.getAttribute('data-slot') ?? '')

const pressed = (root: ParentNode): string[] =>
  [...root.querySelectorAll('[data-slot="segmented-item"]')]
    .filter((el) => el.getAttribute('aria-pressed') === 'true')
    .map((el) => el.textContent ?? '')

function Controlled(props: { onChange?: (v: string) => void }): ReactElement {
  const [value, setValue] = useState('day')
  return (
    <Segmented
      aria-label="Range"
      value={value}
      options={OPTIONS}
      onValueChange={(next) => {
        setValue(next)
        props.onChange?.(next)
      }}
    />
  )
}

describe('segmented module', () => {
  test('renders with no provider; the group and items carry data-slot', () => {
    const { container } = render(
      <Segmented aria-label="Range" options={OPTIONS} defaultValue="day" />,
    )
    const found = new Set(slots(container))
    expect(found.has('segmented')).toBe(true)
    expect(found.has('segmented-item')).toBe(true)
    for (const slot of found) expect(segmentedParts).toContain(slot as never)
  })

  test('server render shows the selection on the item and draws no indicator', () => {
    const html = renderToString(
      <Segmented aria-label="Range" options={OPTIONS} defaultValue="week" />,
    )
    expect(html).toContain('data-slot="segmented-item"')
    expect(html).toContain('data-indicator="false"')
    expect(html).not.toContain('data-pill')
  })

  test('the options form and the parts form render the same items', () => {
    const a = render(<Segmented aria-label="R" options={OPTIONS} defaultValue="week" />)
    const byOptions = pressed(a.container)
    cleanup()
    const b = render(
      <Segmented aria-label="R" defaultValue="week">
        {OPTIONS.map((o) => (
          <SegmentedItem key={o.value} value={o.value}>
            {o.label}
          </SegmentedItem>
        ))}
      </Segmented>,
    )
    expect(pressed(b.container)).toEqual(byOptions)
    expect(byOptions).toEqual(['Week'])
  })

  test('clicking selects; clicking the selected option keeps it', () => {
    const seen: string[] = []
    const { container, getByText } = render(<Controlled onChange={(v) => seen.push(v)} />)
    fireEvent.click(getByText('Week'))
    expect(seen).toEqual(['week'])
    expect(pressed(container)).toEqual(['Week'])
    fireEvent.click(getByText('Week'))
    expect(seen).toEqual(['week'])
    expect(pressed(container)).toEqual(['Week'])
  })

  test('an uncontrolled group keeps its own selection', () => {
    const { container, getByText } = render(
      <Segmented aria-label="R" options={OPTIONS} defaultValue="day" />,
    )
    fireEvent.click(getByText('Month'))
    expect(pressed(container)).toEqual(['Month'])
  })

  test('focus that an arrow key moves becomes the selection; focus from Tab does not', () => {
    // happy-dom does not move focus on an arrow key; the real keys run in ui-range.layout.test.ts.
    const seen: string[] = []
    const { container, getByText } = render(<Controlled onChange={(v) => seen.push(v)} />)
    const group = container.querySelector('[data-slot="segmented"]')!
    fireEvent.keyDown(group, { key: 'Tab' })
    act(() => getByText('Month').focus())
    expect(seen).toEqual([])
    fireEvent.keyDown(group, { key: 'ArrowRight' })
    act(() => getByText('Week').focus())
    expect(seen).toEqual(['week'])
    fireEvent.keyUp(group, { key: 'ArrowRight' })
    act(() => getByText('Month').focus())
    expect(seen).toEqual(['week'])
    expect(pressed(container)).toEqual(['Week'])
  })

  test('a disabled option is skipped by the click and flagged', () => {
    const { getByText } = render(
      <Segmented
        aria-label="R"
        options={[...OPTIONS.slice(0, 2), { value: 'x', label: 'Locked', disabled: true }]}
        defaultValue="day"
      />,
    )
    expect(getByText('Locked').hasAttribute('data-disabled')).toBe(true)
  })

  test('multiple keeps several on and draws no indicator', () => {
    const { container, getByText } = render(
      <Segmented aria-label="Series" multiple options={OPTIONS} defaultValue={['day']} />,
    )
    fireEvent.click(getByText('Week'))
    expect(pressed(container).toSorted()).toEqual(['Day', 'Week'])
    expect(container.querySelector('[data-pill]')).toBeNull()
    expect(container.querySelector('[data-slot="segmented"]')?.getAttribute('data-indicator')).toBe(
      'false',
    )
  })

  test('size drives the track height', () => {
    const { container } = render(<Segmented aria-label="R" options={OPTIONS} size="sm" />)
    expect(container.querySelector('[data-slot="segmented"]')?.className).toContain('h-6')
  })
})
