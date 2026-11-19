import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { useState } from 'react'
import type { ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import { Radio, RadioGroup, radioGroupParts } from './radio-group'

const describedBy = (el: HTMLElement): string | null => {
  const id = el.getAttribute('aria-describedby')
  return id === null ? null : (document.getElementById(id)?.textContent ?? null)
}

afterEach(cleanup)

const slots = (root: ParentNode): string[] =>
  [...root.querySelectorAll('[data-slot]')].map((el) => el.getAttribute('data-slot') ?? '')

function Plans(props: { onChange?: (v: string) => void }): ReactElement {
  const [value, setValue] = useState('a')
  return (
    <RadioGroup
      aria-label="Plan"
      value={value}
      onValueChange={(next) => {
        setValue(next)
        props.onChange?.(next)
      }}
    >
      {['a', 'b', 'c'].map((v) => (
        <label key={v}>
          <Radio value={v} />
          {`Plan ${v}`}
        </label>
      ))}
    </RadioGroup>
  )
}

describe('radio-group module', () => {
  test('renders with no provider; every part carries data-slot and radioGroupParts lists them', () => {
    const { container } = render(<Plans />)
    expect([...new Set(slots(container))].toSorted()).toEqual([...radioGroupParts].toSorted())
    expect(container.querySelector('[role="radiogroup"]')?.getAttribute('data-slot')).toBe(
      'radio-group',
    )
  })

  test('server render keeps the slots', () => {
    const html = renderToString(<Plans />)
    for (const part of radioGroupParts) expect(html).toContain(`data-slot="${part}"`)
  })

  test('the selected radio is the one tab stop (arrow keys are covered in the browser layout test)', () => {
    const { getAllByRole } = render(<Plans />)
    expect(getAllByRole('radio').map((r) => r.getAttribute('tabindex'))).toEqual(['0', '-1', '-1'])
  })

  test('only the selected radio is checked and the label names it', () => {
    const { getAllByRole, getByRole } = render(<Plans />)
    expect(getAllByRole('radio').map((r) => r.getAttribute('aria-checked'))).toEqual([
      'true',
      'false',
      'false',
    ])
    expect(getByRole('radio', { name: 'Plan b' })).toBeDefined()
  })
})

describe('radio-group options', () => {
  test('each radio is named by its label and described by its description', () => {
    const { getByRole } = render(
      <RadioGroup
        aria-label="Plan"
        defaultValue="free"
        options={[
          { value: 'free', label: 'Free', description: 'Up to three users' },
          { value: 'pro', label: 'Pro' },
        ]}
      />,
    )
    expect(describedBy(getByRole('radio', { name: 'Free' }))).toBe('Up to three users')
    expect(getByRole('radio', { name: 'Pro' }).getAttribute('aria-describedby')).toBeNull()
  })

  test('a click on the label text selects the option', () => {
    const seen: string[] = []
    const { getByRole, getByText } = render(
      <RadioGroup
        aria-label="Plan"
        defaultValue="free"
        onValueChange={(next) => seen.push(next)}
        options={[
          { value: 'free', label: 'Free', description: 'Up to three users' },
          { value: 'pro', label: 'Pro', description: 'Team seats' },
        ]}
      />,
    )
    fireEvent.click(getByText('Pro'))
    expect(getByRole('radio', { name: 'Pro' }).getAttribute('aria-checked')).toBe('true')
    expect(seen).toEqual(['pro'])
  })

  test('a disabled option is disabled', () => {
    const { getByRole } = render(
      <RadioGroup
        aria-label="Plan"
        options={[
          { value: 'free', label: 'Free' },
          { value: 'pro', label: 'Pro', disabled: true },
        ]}
      />,
    )
    expect(getByRole('radio', { name: 'Pro' }).getAttribute('aria-disabled')).toBe('true')
  })
})
