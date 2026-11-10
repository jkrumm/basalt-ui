import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { Input, inputParts } from './input'

afterEach(cleanup)

const slots = (root: ParentNode): string[] =>
  [...root.querySelectorAll('[data-slot]')].map((el) => el.getAttribute('data-slot') ?? '')

describe('input module', () => {
  test('renders with no provider; every part carries data-slot and inputParts lists them', () => {
    const { container } = render(<Input aria-label="Name" />)
    expect(slots(container)).toEqual([...inputParts])
    expect(container.querySelector('input')?.getAttribute('data-slot')).toBe('input')
  })

  test('server render keeps the slot', () => {
    const html = renderToString(<Input aria-label="Name" />)
    for (const part of inputParts) expect(html).toContain(`data-slot="${part}"`)
  })

  test('size drives the height and does not reach the native size attribute', () => {
    const { getByLabelText } = render(<Input size="sm" aria-label="Qty" />)
    const el = getByLabelText('Qty')
    expect(el.className).toContain('h-6')
    expect(el.hasAttribute('size')).toBe(false)
  })

  test('is controlled through onValueChange', () => {
    let value = ''
    const { getByLabelText } = render(
      <Input aria-label="Q" onValueChange={(next) => (value = next)} />,
    )
    fireEvent.change(getByLabelText('Q'), { target: { value: 'abc' } })
    expect(value).toBe('abc')
  })
})
