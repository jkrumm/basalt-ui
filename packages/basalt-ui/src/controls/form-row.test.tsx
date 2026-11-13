/**
 * `FormRow`: a named group of fields that lays itself out by its own container and disables as one.
 * The geometry itself is proven in real Chrome by `tests/layout/form-field.layout.test.ts`.
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { Input } from '../ui/input'
import { Switch } from '../ui/switch'
import { memoryHandle } from './control-view.handles'
import { FormField } from './form-field'
import { FormRow, formRowParts } from './form-row'

afterEach(cleanup)

const text = memoryHandle('fr.t', 'a', { kind: 'string' })
const flag = memoryHandle('fr.f', false, { kind: 'boolean' })

describe('FormRow', () => {
  test('a legend names the group; the fields keep their own names', () => {
    const { getByRole } = render(
      <FormRow legend="Line 2">
        <FormField label="Item" control={text}>
          <Input />
        </FormField>
        <FormField label="Quantity" control={text}>
          <Input />
        </FormField>
      </FormRow>,
    )
    expect(getByRole('group', { name: 'Line 2' })).toBeTruthy()
    expect(getByRole('textbox', { name: 'Item' })).toBeTruthy()
    expect(getByRole('textbox', { name: 'Quantity' })).toBeTruthy()
  })

  test('the layout is the container tier, never the viewport', () => {
    const { container } = render(
      <FormRow>
        <FormField label="A" control={text}>
          <Input />
        </FormField>
      </FormRow>,
    )
    const row = container.querySelector('[data-slot="form-row"]')!
    expect(row.className).toContain('@container')
    const fields = container.querySelector('[data-slot="form-row-fields"]')!.className
    expect(fields).toContain('@regular:')
    expect(fields).not.toMatch(/(^|\s)(sm|md|lg|xl):/)
  })

  test('disabled disables every field of the row', () => {
    const { getAllByRole } = render(
      <FormRow disabled>
        <FormField label="A" control={flag}>
          <Switch />
        </FormField>
        <FormField label="B" control={flag}>
          <Switch />
        </FormField>
      </FormRow>,
    )
    for (const sw of getAllByRole('switch')) expect(sw.hasAttribute('data-disabled')).toBe(true)
  })

  test('repeats for an array: each row keeps its own legend', () => {
    const { getAllByRole } = render(
      <>
        {['a', 'b', 'c'].map((id, i) => (
          <FormRow key={id} legend={`Line ${i + 1}`}>
            <FormField label="Item" control={text}>
              <Input />
            </FormField>
          </FormRow>
        ))}
      </>,
    )
    expect(getAllByRole('group').map((g) => g.getAttribute('aria-labelledby')).length).toBe(3)
  })

  test('server render keeps every slot', () => {
    const html = renderToString(
      <FormRow legend="Line">
        <FormField label="Item" control={text}>
          <Input />
        </FormField>
      </FormRow>,
    )
    for (const part of formRowParts) expect(html).toContain(`data-slot="${part}"`)
  })
})
