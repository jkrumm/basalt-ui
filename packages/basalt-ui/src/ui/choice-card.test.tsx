import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { useState } from 'react'
import type { ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import { Checkbox, CheckboxGroup } from './checkbox'
import { ChoiceCard, choiceCardParts } from './choice-card'
import { Radio, RadioGroup } from './radio-group'

afterEach(cleanup)

const describedBy = (el: HTMLElement): string =>
  (el.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join('|')

const plans = [
  { value: 'free', label: 'Free', description: 'Up to three users', trailing: '€0' },
  { value: 'pro', label: 'Pro', description: 'Team seats', trailing: '€12', preview: <i>thumb</i> },
]

function Plans(): ReactElement {
  const [plan, setPlan] = useState('free')
  return (
    <RadioGroup
      variant="card"
      aria-label="Plan"
      value={plan}
      onValueChange={setPlan}
      options={plans}
    />
  )
}

describe('choice-card', () => {
  test('a card is one label: the title names the radio, the text and the trailing value describe it', () => {
    const { getByRole } = render(<Plans />)
    const pro = getByRole('radio', { name: 'Pro' })
    expect(describedBy(pro)).toBe('Team seats|€12')
    expect(pro.closest('[data-slot="choice-card"]')?.tagName).toBe('LABEL')
  })

  test('a click anywhere on the card selects it and the selected card carries data-checked', () => {
    const { getByText, getByRole } = render(<Plans />)
    fireEvent.click(getByText('Team seats'))
    expect(getByRole('radio', { name: 'Pro' }).hasAttribute('data-checked')).toBe(true)
    expect(getByRole('radio', { name: 'Free' }).hasAttribute('data-checked')).toBe(false)
  })

  test('the preview is hidden from assistive tech and the tile variant draws a grid', () => {
    const { container } = render(
      <RadioGroup variant="tile" aria-label="Look" defaultValue="free" options={plans} />,
    )
    expect(container.querySelector('i')?.parentElement?.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('[data-slot="radio-group"]')?.className).toContain('grid')
  })

  test('a disabled option stays disabled in the card', () => {
    const { getByRole } = render(
      <RadioGroup
        variant="card"
        aria-label="Plan"
        options={[{ value: 'a', label: 'A', disabled: true }]}
      />,
    )
    expect(getByRole('radio', { name: 'A' }).hasAttribute('data-disabled')).toBe(true)
  })

  test('the checkbox group draws cards and toggles several', () => {
    const seen: string[][] = []
    const { getByText } = render(
      <CheckboxGroup
        variant="card"
        aria-label="Channels"
        defaultValue={[]}
        onValueChange={(next) => seen.push(next)}
        options={[
          { value: 'mail', label: 'Mail', description: 'Daily digest' },
          { value: 'push', label: 'Push' },
        ]}
      />,
    )
    fireEvent.click(getByText('Mail'))
    fireEvent.click(getByText('Push'))
    expect(seen.at(-1)).toEqual(['mail', 'push'])
  })

  test('a hand-built card names its own control', () => {
    const { getByRole } = render(
      <RadioGroup aria-label="Plan">
        <ChoiceCard control={<Radio value="a" />} label="Alpha" />
        <ChoiceCard control={<Checkbox />} label="Beta" />
      </RadioGroup>,
    )
    expect(getByRole('radio', { name: 'Alpha' })).toBeDefined()
    expect(getByRole('checkbox', { name: 'Beta' })).toBeDefined()
  })

  test('server render keeps the slot', () => {
    const html = renderToString(<Plans />)
    for (const part of choiceCardParts) expect(html).toContain(`data-slot="${part}"`)
  })
})
