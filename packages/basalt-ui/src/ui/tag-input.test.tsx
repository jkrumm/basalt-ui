import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { useState } from 'react'
import type { ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import { TagInput, tagInputParts } from './tag-input'

afterEach(cleanup)

function Tags(props: {
  initial?: string[]
  validate?: (tag: string) => string | undefined
  max?: number
  onBlur?: () => void
  name?: string
}): ReactElement {
  const [tags, setTags] = useState<string[]>(props.initial ?? [])
  return (
    <TagInput
      aria-label="Invitees"
      value={tags}
      onValueChange={setTags}
      {...(props.validate !== undefined && { validate: props.validate })}
      {...(props.max !== undefined && { max: props.max })}
      {...(props.onBlur !== undefined && { onBlur: props.onBlur })}
      {...(props.name !== undefined && { name: props.name })}
    />
  )
}

const chips = (root: ParentNode): string[] =>
  [...root.querySelectorAll('[data-chip]')].map((c) => c.firstElementChild?.textContent ?? '')

const paste = (el: HTMLElement, text: string): void => {
  fireEvent.paste(el, { clipboardData: { getData: () => text } })
}

describe('tag-input', () => {
  test('Enter and a typed separator make a chip; duplicates and blanks are ignored', () => {
    const { container, getByRole } = render(<Tags />)
    const entry = getByRole('textbox', { name: 'Invitees' })
    fireEvent.change(entry, { target: { value: 'a@x.io' } })
    fireEvent.keyDown(entry, { key: 'Enter' })
    fireEvent.change(entry, { target: { value: 'b@x.io,' } })
    fireEvent.change(entry, { target: { value: 'a@x.io;' } })
    fireEvent.change(entry, { target: { value: ' ,' } })
    expect(chips(container)).toEqual(['a@x.io', 'b@x.io'])
    expect((entry as HTMLInputElement).value).toBe('')
  })

  test('a pasted list splits on separators and line breaks', () => {
    const { container, getByRole } = render(<Tags />)
    paste(getByRole('textbox'), 'a@x.io, b@x.io;c@x.io\nd@x.io')
    expect(chips(container)).toEqual(['a@x.io', 'b@x.io', 'c@x.io', 'd@x.io'])
  })

  test('a plain paste without a separator stays in the entry', () => {
    const { container, getByRole } = render(<Tags />)
    paste(getByRole('textbox'), 'single')
    expect(chips(container)).toEqual([])
  })

  test('max drops the tags past it', () => {
    const { container, getByRole } = render(<Tags max={2} />)
    paste(getByRole('textbox'), 'a,b,c')
    expect(chips(container)).toEqual(['a', 'b'])
  })

  test('Backspace on an empty entry removes the last tag and a remove button removes its own', () => {
    const { container, getByRole } = render(<Tags initial={['a', 'b', 'c']} />)
    fireEvent.keyDown(getByRole('textbox'), { key: 'Backspace' })
    expect(chips(container)).toEqual(['a', 'b'])
    fireEvent.click(getByRole('button', { name: 'Remove a' }))
    expect(chips(container)).toEqual(['b'])
  })

  test('validate marks a failing tag as an invalid chip and the entry aria-invalid', () => {
    const { container, getByRole, getByText } = render(
      <Tags
        initial={['a@x.io', 'nope']}
        validate={(tag) => (tag.includes('@') ? undefined : 'Not an email')}
      />,
    )
    const invalid = container.querySelectorAll('[data-chip][data-invalid]')
    expect(invalid).toHaveLength(1)
    expect(getByText('Not an email')).toBeDefined()
    expect(getByRole('textbox').getAttribute('aria-invalid')).toBe('true')
  })

  test('leaving the field commits the typed text, then fires onBlur once', () => {
    let blurs = 0
    const { container, getByRole } = render(<Tags onBlur={() => blurs++} />)
    const entry = getByRole('textbox')
    fireEvent.change(entry, { target: { value: 'late' } })
    fireEvent.blur(entry, { relatedTarget: document.body })
    expect(chips(container)).toEqual(['late'])
    expect(blurs).toBe(1)
  })

  test('name submits one hidden value per tag', () => {
    const { container } = render(<Tags initial={['a', 'b']} name="invitees" />)
    const values = [...container.querySelectorAll('input[type="hidden"][name="invitees"]')].map(
      (i) => (i as HTMLInputElement).value,
    )
    expect(values).toEqual(['a', 'b'])
  })

  test('server render keeps the slots', () => {
    const html = renderToString(<Tags initial={['a']} />)
    for (const part of tagInputParts) expect(html).toContain(`data-slot="${part}"`)
  })
})
