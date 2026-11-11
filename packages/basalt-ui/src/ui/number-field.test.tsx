import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { NumberField, numberFieldParts } from './number-field'

afterEach(cleanup)

const textOf = (root: ParentNode): string =>
  root.querySelector<HTMLInputElement>('input[inputmode], input[type="text"]')?.value ?? ''

describe('number-field module', () => {
  test('renders with no provider; the root carries data-slot and numberFieldParts lists it', () => {
    const { container } = render(<NumberField aria-label="Qty" />)
    const slots = [...container.querySelectorAll('[data-slot]')].map((el) =>
      el.getAttribute('data-slot'),
    )
    expect(slots).toEqual([...numberFieldParts])
  })

  test('the label names the text input, not the root', () => {
    const { getByLabelText } = render(<NumberField aria-label="Qty" />)
    expect(getByLabelText('Qty').tagName).toBe('INPUT')
  })

  test('de-DE renders 1.234,5 for 1234.5, the same string on the server and the client', () => {
    const node = <NumberField aria-label="Qty" locale="de-DE" defaultValue={1234.5} />
    const server = renderToString(node)
    expect(server).toContain('value="1.234,5"')
    expect(textOf(render(node).container)).toBe('1.234,5')
  })

  test('with no locale the text is English', () => {
    const { container } = render(<NumberField aria-label="Qty" defaultValue={1234.5} />)
    expect(textOf(container)).toBe('1,234.5')
  })

  test('format takes Intl options', () => {
    const { container } = render(
      <NumberField
        aria-label="Price"
        locale="de-DE"
        defaultValue={12.5}
        format={{ style: 'currency', currency: 'EUR' }}
      />,
    )
    expect(textOf(container)).toBe('12,50 €')
  })

  test('size drives the height', () => {
    const { container } = render(<NumberField aria-label="Qty" size="sm" />)
    expect(container.querySelector('[data-slot="number-field"]')?.className).toContain('h-6')
  })

  test('typing reports the parsed number in the locale', () => {
    const seen: (number | null)[] = []
    const { getByLabelText } = render(
      <NumberField aria-label="Qty" locale="de-DE" onValueChange={(next) => seen.push(next)} />,
    )
    fireEvent.change(getByLabelText('Qty'), { target: { value: '1.234,5' } })
    expect(seen.at(-1)).toBe(1234.5)
  })

  test('the buttons step the value', () => {
    const seen: (number | null)[] = []
    const { getByLabelText } = render(
      <NumberField aria-label="Qty" defaultValue={2} onValueChange={(next) => seen.push(next)} />,
    )
    fireEvent.click(getByLabelText('Increase'))
    expect(seen.at(-1)).toBe(3)
  })
})
