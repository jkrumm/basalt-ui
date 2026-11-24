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
      aria-label="Stage color"
      options={options}
      value={value}
      onValueChange={setValue}
      {...(props.display !== undefined && { display: props.display })}
      {...(props.onBlur !== undefined && { onBlur: props.onBlur })}
    />
  )
}

describe('swatch-picker', () => {
  test('inline: a named radio group, every swatch named by its color, the picked one checked', () => {
    const { getByRole, getAllByRole } = render(<Picker />)
    expect(getByRole('radiogroup', { name: 'Stage color' })).toBeDefined()
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

  test('the fill is a token class, never a color value', () => {
    const { getByRole } = render(<Picker />)
    expect(getByRole('radio', { name: 'Green' }).className).toContain('bg-good')
    expect(getByRole('radio', { name: 'Green' }).getAttribute('style')).toBeNull()
  })

  test('menu: the trigger shows the picked color and opens the grid', () => {
    const { getByRole, queryByRole } = render(<Picker display="menu" />)
    const trigger = getByRole('button', { name: 'Stage color: Green' })
    expect(queryByRole('radiogroup')).toBeNull()
    fireEvent.click(trigger)
    expect(getByRole('radiogroup', { name: 'Stage color' })).toBeDefined()
  })

  test('menu: the panel is named by aria-labelledby, else by aria-label, else by the catalog', () => {
    const { getByRole, unmount } = render(
      <>
        <span id="who">Pipeline color</span>
        <SwatchPicker aria-labelledby="who" display="menu" options={options} value="good" />
      </>,
    )
    fireEvent.click(getByRole('button'))
    expect(getByRole('radiogroup', { name: 'Pipeline color' })).toBeDefined()
    unmount()
    const bare = render(<SwatchPicker display="menu" options={options} value="good" />)
    fireEvent.click(bare.getByRole('button'))
    expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Color')
  })

  test('menu: picking a color closes the menu and fires onBlur once', () => {
    let blurs = 0
    const { getByRole } = render(
      <SwatchPicker
        aria-label="Stage color"
        display="menu"
        options={options}
        value="good"
        onBlur={() => (blurs += 1)}
      />,
    )
    fireEvent.click(getByRole('button'))
    // Arrow keys select with a click that has no pointer behind it: the menu stays open to browse.
    fireEvent.click(getByRole('radio', { name: options[2]!.label }))
    expect(blurs).toBe(0)
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    fireEvent.click(getByRole('radio', { name: options[1]!.label }), { detail: 1 })
    expect(blurs).toBe(1)
  })

  test('menu: Space on a swatch picks it and closes the menu through its click', () => {
    let blurs = 0
    const { getByRole } = render(
      <SwatchPicker
        aria-label="Stage color"
        display="menu"
        options={options}
        onBlur={() => (blurs += 1)}
      />,
    )
    fireEvent.click(getByRole('button'))
    fireEvent.keyDown(getByRole('radiogroup'), { key: ' ' })
    fireEvent.click(getByRole('radio', { name: options[1]!.label }))
    expect(blurs).toBe(1)
  })

  test('menu: Enter on a swatch closes the menu', () => {
    let blurs = 0
    const { getByRole } = render(
      <SwatchPicker
        aria-label="Stage color"
        display="menu"
        options={options}
        value="good"
        onBlur={() => (blurs += 1)}
      />,
    )
    fireEvent.click(getByRole('button'))
    fireEvent.keyDown(getByRole('radiogroup'), { key: 'Enter' })
    expect(blurs).toBe(1)
  })

  test('server render keeps the slots', () => {
    const html = renderToString(<Picker />)
    for (const part of swatchPickerParts) expect(html).toContain(`data-slot="${part}"`)
  })
})
