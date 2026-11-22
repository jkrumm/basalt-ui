import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { useState } from 'react'
import type { ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import { OneTimeCode, oneTimeCodeParts } from './one-time-code'

afterEach(cleanup)

function Code(props: {
  onComplete?: (v: string) => void
  invalid?: boolean
  onBlur?: () => void
  length?: number
}): ReactElement {
  const [value, setValue] = useState('')
  return (
    <>
      <OneTimeCode
        aria-label="Verification code"
        value={value}
        onValueChange={setValue}
        {...(props.onComplete !== undefined && { onComplete: props.onComplete })}
        {...(props.onBlur !== undefined && { onBlur: props.onBlur })}
        {...(props.length !== undefined && { length: props.length })}
        aria-invalid={props.invalid ?? false}
      />
      <output>{value}</output>
    </>
  )
}

const boxes = (root: ParentNode): HTMLInputElement[] => [
  ...root.querySelectorAll<HTMLInputElement>(
    'input:not([type="hidden"]):not([aria-hidden="true"])',
  ),
]

describe('one-time-code', () => {
  test('renders one named box per character in a named group', () => {
    const { container, getByRole } = render(<Code />)
    expect(boxes(container)).toHaveLength(6)
    expect(getByRole('group', { name: 'Verification code' })).toBeDefined()
    // The first box is named by the group's label; the rest by their place.
    expect(boxes(container).map((b) => b.getAttribute('aria-label'))).toEqual([
      null,
      ...[2, 3, 4, 5, 6].map((n) => `Character ${n} of 6`),
    ])
    expect(boxes(container)[0]?.getAttribute('aria-labelledby')).toBeTruthy()
  })

  test('the first box asks the platform for the code and every box opens the digit keypad', () => {
    const { container } = render(<Code />)
    const [first, second] = boxes(container)
    expect(first?.getAttribute('autocomplete')).toBe('one-time-code')
    expect(first?.getAttribute('inputmode')).toBe('numeric')
    expect(second?.getAttribute('inputmode')).toBe('numeric')
  })

  test('a pasted code fills every box and completes once', () => {
    const done: string[] = []
    const { container } = render(<Code onComplete={(v) => done.push(v)} />)
    fireEvent.paste(boxes(container)[0] as HTMLElement, {
      clipboardData: { getData: () => '123456' },
    })
    expect(
      boxes(container)
        .map((b) => b.value)
        .join(''),
    ).toBe('123456')
    expect(done).toEqual(['123456'])
  })

  test('the platform suggestion arrives as one multi-character change on the first box', () => {
    const { container } = render(<Code length={4} />)
    fireEvent.change(boxes(container)[0] as HTMLElement, { target: { value: '9876' } })
    expect(
      boxes(container)
        .map((b) => b.value)
        .join(''),
    ).toBe('9876')
  })

  test('letters are rejected by the numeric default', () => {
    const { container } = render(<Code />)
    fireEvent.paste(boxes(container)[0] as HTMLElement, {
      clipboardData: { getData: () => 'abc123' },
    })
    expect(
      boxes(container)
        .map((b) => b.value)
        .join(''),
    ).not.toContain('a')
  })

  test('aria-invalid marks the whole group', () => {
    const { container } = render(<Code invalid />)
    expect(boxes(container).every((b) => b.getAttribute('aria-invalid') === 'true')).toBe(true)
  })

  test('onBlur fires once when focus leaves the group, not between boxes', () => {
    let blurs = 0
    const { container } = render(<Code onBlur={() => blurs++} />)
    const a = boxes(container)[0] as HTMLElement
    const b = boxes(container)[1] as HTMLElement
    fireEvent.blur(a, { relatedTarget: b })
    expect(blurs).toBe(0)
    fireEvent.blur(b, { relatedTarget: document.body })
    expect(blurs).toBe(1)
  })

  test('server render keeps the slots', () => {
    const html = renderToString(<Code />)
    for (const part of oneTimeCodeParts) expect(html).toContain(`data-slot="${part}"`)
  })
})
