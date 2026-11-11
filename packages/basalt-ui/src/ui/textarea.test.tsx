import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { Textarea, textareaParts } from './textarea'

afterEach(cleanup)

describe('textarea module', () => {
  test('renders a <textarea> with no provider; the root carries data-slot and textareaParts lists it', () => {
    const { container } = render(<Textarea aria-label="Note" />)
    const slots = [...container.querySelectorAll('[data-slot]')].map((el) =>
      el.getAttribute('data-slot'),
    )
    expect(slots).toEqual([...textareaParts])
    expect(container.querySelector('textarea')?.getAttribute('data-slot')).toBe('textarea')
    expect(container.querySelector('input')).toBeNull()
  })

  test('server render keeps the slot', () => {
    const html = renderToString(<Textarea aria-label="Note" />)
    expect(html).toContain('<textarea')
    expect(html).toContain('data-slot="textarea"')
  })

  test('height is the fixed rows, 3 unless given', () => {
    const { getByLabelText, rerender } = render(<Textarea aria-label="Note" />)
    expect(getByLabelText('Note').getAttribute('rows')).toBe('3')
    rerender(<Textarea aria-label="Note" rows={6} />)
    expect(getByLabelText('Note').getAttribute('rows')).toBe('6')
  })

  test('is controlled through onValueChange', () => {
    let value = ''
    const { getByLabelText } = render(
      <Textarea aria-label="Note" onValueChange={(next) => (value = next)} />,
    )
    fireEvent.change(getByLabelText('Note'), { target: { value: 'a\nb' } })
    expect(value).toBe('a\nb')
  })
})
