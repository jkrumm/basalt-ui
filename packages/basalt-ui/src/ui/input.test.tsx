import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import { Input, inputParts } from './input'

afterEach(cleanup)

const slots = (root: ParentNode): string[] =>
  [...root.querySelectorAll('[data-slot]')].map((el) => el.getAttribute('data-slot') ?? '')

function Mark(props: {
  className?: string
  'aria-hidden'?: boolean | 'true' | 'false'
}): ReactElement {
  return <svg data-testid="mark" className={props.className} aria-hidden={props['aria-hidden']} />
}

describe('input module', () => {
  test('renders with no provider; the bare input carries its slot and no wrapper', () => {
    const { container } = render(<Input aria-label="Name" />)
    expect(slots(container)).toEqual(['input'])
    const input = container.querySelector('input')
    expect(input?.getAttribute('data-slot')).toBe('input')
    expect(input?.parentElement).toBe(container)
  })

  test('with an adornment the wrapper and the input carry their slots; inputParts lists both', () => {
    const { container } = render(<Input aria-label="Name" start={Mark} />)
    expect(slots(container)).toEqual([...inputParts])
  })

  test('server render keeps the slots', () => {
    const html = renderToString(<Input aria-label="Name" />)
    expect(html).toContain('data-slot="input"')
    const adorned = renderToString(<Input aria-label="Name" end="ms" />)
    for (const part of inputParts) expect(adorned).toContain(`data-slot="${part}"`)
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

  test('without adornments the className lands on the input and no padding is added', () => {
    const { container } = render(<Input aria-label="Q" className="max-w-xs" />)
    const input = container.querySelector('input')
    expect(input?.className).toContain('max-w-xs')
    expect(input?.className).not.toContain('ps-8')
    expect(input?.className).not.toContain('pe-8')
    expect(container.querySelector('[data-slot="input-group"]')).toBeNull()
  })

  test('a start icon is aria-hidden in a non-interactive overlay, and the input is padded for it', () => {
    const { getByTestId, getByLabelText } = render(<Input aria-label="Search" start={Mark} />)
    const icon = getByTestId('mark')
    expect(icon.getAttribute('aria-hidden')).toBe('true')
    expect(icon.getAttribute('class')).toContain('size-icon')
    expect(icon.parentElement?.className).toContain('pointer-events-none')
    expect(icon.parentElement?.className).toContain('start-0')
    expect(getByLabelText('Search').className).toContain('ps-8')
  })

  test('an end adornment sits at the end and the input is padded for it', () => {
    const { getByText, getByLabelText } = render(<Input aria-label="Timeout" end="ms" />)
    expect(getByText('ms').className).toContain('end-0')
    expect(getByLabelText('Timeout').className).toContain('pe-8')
  })

  test('with an adornment the className moves to the wrapper, not the input', () => {
    const { container, getByLabelText } = render(
      <Input aria-label="Search" start={Mark} className="max-w-xs" />,
    )
    expect(container.querySelector('[data-slot="input-group"]')?.className).toContain('max-w-xs')
    expect(getByLabelText('Search').className).not.toContain('max-w-xs')
  })

  test('a read-only input carries the read-only look on the input itself', () => {
    const { getByLabelText } = render(<Input aria-label="Code" readOnly defaultValue="abc" />)
    const el = getByLabelText('Code')
    expect(el.hasAttribute('readonly')).toBe(true)
    expect(el.className).toContain('[&[readonly]]:bg-inset')
    expect(el.className).toContain('[&[readonly]]:border-transparent')
    expect(el.className).toContain('[&[readonly]]:cursor-default')
  })
})
