import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { Textarea, textareaParts, textareaVariants } from './textarea'

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

  test('rows is the floor, 3 unless given, and reaches the stylesheet as --textarea-rows', () => {
    const { getByLabelText, rerender } = render(<Textarea aria-label="Note" />)
    expect(getByLabelText('Note').getAttribute('rows')).toBe('3')
    rerender(<Textarea aria-label="Note" rows={6} />)
    expect(getByLabelText('Note').getAttribute('rows')).toBe('6')
    expect(getByLabelText('Note').style.getPropertyValue('--textarea-rows')).toBe('6')
  })

  test('a caller style is kept beside the floor variable', () => {
    const { getByLabelText } = render(<Textarea aria-label="Note" style={{ color: 'red' }} />)
    const el = getByLabelText('Note')
    expect(el.style.color).toBe('red')
    expect(el.style.getPropertyValue('--textarea-rows')).toBe('3')
  })

  test('the class string grows the box between the rows floor and a 10-line ceiling', () => {
    const classes = textareaVariants()
    expect(classes).toContain('field-sizing-content')
    expect(classes).toContain(
      'min-h-[max(var(--basalt-ctl-h),calc(var(--textarea-rows,3)*1lh+var(--textarea-pad)+2px))]',
    )
    expect(classes).toContain('max-h-[calc(10lh+var(--textarea-pad)+2px)]')
    expect(classes).toContain('[--textarea-pad:1rem]')
    expect(textareaVariants({ size: 'sm' })).toContain('[--textarea-pad:0.5rem]')
    expect(classes).toContain('resize-y')
  })

  test('is controlled through onValueChange', () => {
    let value = ''
    const { getByLabelText } = render(
      <Textarea aria-label="Note" onValueChange={(next) => (value = next)} />,
    )
    fireEvent.change(getByLabelText('Note'), { target: { value: 'a\nb' } })
    expect(value).toBe('a\nb')
  })

  test('a read-only textarea carries the read-only look, not the disabled one', () => {
    const { getByLabelText } = render(<Textarea aria-label="Note" readOnly defaultValue="kept" />)
    const el = getByLabelText('Note')
    expect(el.hasAttribute('readonly')).toBe(true)
    expect(el.className).toContain('[&[readonly]]:bg-inset')
    expect(el.className).toContain('[&[readonly]]:border-transparent')
  })
})

const rectOf = (top: number, bottom: number): DOMRect =>
  ({ top, bottom, left: 0, right: 100 }) as DOMRect

describe('textarea focus reveal', () => {
  test('focus reveals a box that is partly below the viewport', () => {
    const { getByLabelText } = render(<Textarea aria-label="Note" />)
    const el = getByLabelText('Note') as HTMLTextAreaElement
    const scrollIntoView = mock(() => {})
    el.scrollIntoView = scrollIntoView
    el.getBoundingClientRect = () => rectOf(window.innerHeight - 10, window.innerHeight + 50)
    el.focus()
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
  })

  test('focus leaves a fully visible box alone', () => {
    const { getByLabelText } = render(<Textarea aria-label="Note" />)
    const el = getByLabelText('Note') as HTMLTextAreaElement
    const scrollIntoView = mock(() => {})
    el.scrollIntoView = scrollIntoView
    el.getBoundingClientRect = () => rectOf(10, 40)
    el.focus()
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  test('the nearest scrolling ancestor, not the page, is the area the box must fit', () => {
    const { container, getByLabelText } = render(
      <div style={{ overflowY: 'auto' }}>
        <Textarea aria-label="Note" />
      </div>,
    )
    const scroller = container.firstElementChild as HTMLElement
    scroller.getBoundingClientRect = () => rectOf(0, 100)
    const el = getByLabelText('Note') as HTMLTextAreaElement
    const scrollIntoView = mock(() => {})
    el.scrollIntoView = scrollIntoView
    el.getBoundingClientRect = () => rectOf(90, 150)
    el.focus()
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
  })

  test('a box inside its scroller but below the window is revealed', () => {
    const { container, getByLabelText } = render(
      <div style={{ overflowY: 'auto' }}>
        <Textarea aria-label="Note" />
      </div>,
    )
    const scroller = container.firstElementChild as HTMLElement
    scroller.getBoundingClientRect = () => rectOf(window.innerHeight + 20, window.innerHeight + 300)
    const el = getByLabelText('Note') as HTMLTextAreaElement
    const scrollIntoView = mock(() => {})
    el.scrollIntoView = scrollIntoView
    el.getBoundingClientRect = () => rectOf(window.innerHeight + 40, window.innerHeight + 100)
    el.focus()
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
  })

  test('a caller onFocus still runs', () => {
    const onFocus = mock(() => {})
    const { getByLabelText } = render(<Textarea aria-label="Note" onFocus={onFocus} />)
    const el = getByLabelText('Note') as HTMLTextAreaElement
    el.scrollIntoView = mock(() => {})
    el.focus()
    expect(onFocus).toHaveBeenCalledTimes(1)
  })
})
