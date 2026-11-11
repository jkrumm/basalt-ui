import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { useState } from 'react'
import type { ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import { Checkbox, CheckboxGroup, checkboxParts } from './checkbox'

afterEach(cleanup)

const slots = (root: ParentNode): string[] =>
  [...root.querySelectorAll('[data-slot]')].map((el) => el.getAttribute('data-slot') ?? '')

function Tags(): ReactElement {
  const [value, setValue] = useState<string[]>(['ops'])
  return (
    <CheckboxGroup aria-label="Tags" value={value} onValueChange={setValue}>
      {['ops', 'dev', 'qa'].map((v) => (
        <label key={v}>
          <Checkbox value={v} />
          {`Tag ${v}`}
        </label>
      ))}
    </CheckboxGroup>
  )
}

describe('checkbox module', () => {
  test('renders with no provider; every part carries data-slot and checkboxParts lists them', () => {
    const { container } = render(<Tags />)
    expect([...new Set(slots(container))].toSorted()).toEqual([...checkboxParts].toSorted())
    expect(container.querySelector('[role="group"]')?.getAttribute('data-slot')).toBe(
      'checkbox-group',
    )
  })

  test('server render keeps the slots', () => {
    const html = renderToString(<Tags />)
    for (const part of checkboxParts) expect(html).toContain(`data-slot="${part}"`)
  })

  test('the root is a span with role checkbox, named by its label', () => {
    const { getByRole, queryAllByRole } = render(<Tags />)
    const box = getByRole('checkbox', { name: 'Tag dev' })
    expect(box.tagName).toBe('SPAN')
    expect(queryAllByRole('checkbox')).toHaveLength(3)
  })

  test('a click toggles a group member and reports the list', () => {
    // aria-label, not a wrapping <label>: happy-dom also dispatches the label's own activation click
    const seen: string[][] = []
    const { getByRole } = render(
      <CheckboxGroup aria-label="Tags" defaultValue={['ops']} onValueChange={(v) => seen.push(v)}>
        <Checkbox value="ops" aria-label="ops" />
        <Checkbox value="dev" aria-label="dev" />
      </CheckboxGroup>,
    )
    const dev = getByRole('checkbox', { name: 'dev' })
    expect(dev.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(dev)
    expect(dev.getAttribute('aria-checked')).toBe('true')
    expect(seen).toEqual([['ops', 'dev']])
  })

  test('a lone checkbox reports the next value; indeterminate shows mixed', () => {
    const seen: boolean[] = []
    const { getByRole, rerender } = render(
      <Checkbox aria-label="Agree" onCheckedChange={(next) => seen.push(next)} />,
    )
    fireEvent.click(getByRole('checkbox'))
    expect(seen).toEqual([true])
    rerender(<Checkbox aria-label="Agree" indeterminate />)
    expect(getByRole('checkbox').getAttribute('aria-checked')).toBe('mixed')
  })

  test('a disabled checkbox ignores a click', () => {
    const seen: boolean[] = []
    const { getByRole } = render(
      <Checkbox aria-label="Agree" disabled onCheckedChange={(next) => seen.push(next)} />,
    )
    fireEvent.click(getByRole('checkbox'))
    expect(seen).toEqual([])
  })
})
