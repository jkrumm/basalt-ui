import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { useState } from 'react'
import type { ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import { SwatchPicker, swatchPickerParts } from './swatch-picker'
import type { SwatchToken } from './swatch-picker'

afterEach(cleanup)

const options = [
  { value: 'good', label: 'Green' },
  { value: 'warn', label: 'Amber' },
  { value: 'bad', label: 'Red', disabled: true },
] as const

function Picker(props: { display?: 'inline' | 'menu'; onBlur?: () => void }): ReactElement {
  const [value, setValue] = useState<SwatchToken | undefined>('good')
  return (
    <SwatchPicker
      aria-label="Stage colour"
      options={options}
      value={value}
      onValueChange={setValue}
      {...(props.display !== undefined && { display: props.display })}
      {...(props.onBlur !== undefined && { onBlur: props.onBlur })}
    />
  )
}

describe('swatch-picker', () => {
  test('inline: a named radio group, every swatch named by its colour, the picked one checked', () => {
    const { getByRole, getAllByRole } = render(<Picker />)
    expect(getByRole('radiogroup', { name: 'Stage colour' })).toBeDefined()
    expect(getAllByRole('radio').map((r) => r.getAttribute('aria-label'))).toEqual([
      'Green',
      'Amber',
      'Red',
    ])
    expect(getByRole('radio', { name: 'Green' }).hasAttribute('data-checked')).toBe(true)
  })

  test('picking a swatch moves the selection; a disabled one cannot be picked', () => {
    const { getByRole } = render(<Picker />)
    fireEvent.click(getByRole('radio', { name: 'Amber' }))
    expect(getByRole('radio', { name: 'Amber' }).hasAttribute('data-checked')).toBe(true)
    expect(getByRole('radio', { name: 'Red' }).hasAttribute('data-disabled')).toBe(true)
  })

  test('the fill is a token class, never a colour value', () => {
    const { getByRole } = render(<Picker />)
    expect(getByRole('radio', { name: 'Green' }).className).toContain('bg-good')
    expect(getByRole('radio', { name: 'Green' }).getAttribute('style')).toBeNull()
  })

  test('menu: the trigger shows the picked colour and opens the grid', () => {
    const { getByRole, queryByRole } = render(<Picker display="menu" />)
    const trigger = getByRole('button', { name: 'Stage colour: Green' })
    expect(queryByRole('radiogroup')).toBeNull()
    fireEvent.click(trigger)
    expect(getByRole('radiogroup', { name: 'Stage colour' })).toBeDefined()
  })

  test('server render keeps the slots', () => {
    const html = renderToString(<Picker />)
    for (const part of swatchPickerParts) expect(html).toContain(`data-slot="${part}"`)
  })
})
