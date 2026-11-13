/**
 * `FormField`: the label, the description and the error of one control, by construction. The error
 * region is always mounted and announces a changed message; the required mark is a glyph and the
 * control's own `aria-required`; the dirty dot follows a `control`'s `isDefault` and never shows for
 * a `field`; a disabled fieldset, native or Base UI, disables every control kind inside.
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import type { FieldLike } from '../core/ports'
import { Checkbox } from '../ui/checkbox'
import { Combobox, ComboboxInput } from '../ui/combobox'
import { Fieldset } from '../ui/field'
import { Input } from '../ui/input'
import { NumberField } from '../ui/number-field'
import { Select } from '../ui/select'
import { Slider } from '../ui/slider'
import { Switch } from '../ui/switch'
import { memoryHandle } from './control-view.handles'
import { FormField, firstError } from './form-field'

afterEach(cleanup)

type Field<T> = FieldLike<T> & { set(next: T, errors?: unknown[]): void; blurs: number }

/** A `FieldLike` the way TanStack Form's field api hands it to a render prop. */
function fieldLike<T>(initial: T, errors: unknown[] = []): Field<T> {
  const field: Field<T> = {
    state: { value: initial, meta: { errors } },
    blurs: 0,
    handleChange(next: T) {
      field.state = { ...field.state, value: next }
    },
    handleBlur() {
      field.blurs += 1
    },
    set(next: T, nextErrors: unknown[] = field.state.meta.errors) {
      field.state = { value: next, meta: { errors: nextErrors } }
    },
  }
  return field
}

const region = (root: ParentNode): HTMLElement =>
  root.querySelector<HTMLElement>('[data-slot="field-error-region"]')!

describe('label, description, accessible name', () => {
  test('the label names the control and the description describes it', () => {
    const f = fieldLike('a@b.c')
    const { getByLabelText, getByText } = render(
      <FormField label="Email" description="We never share it." field={f}>
        <Input />
      </FormField>,
    )
    const input = getByLabelText('Email')
    expect(input.getAttribute('aria-describedby')).toContain(
      getByText('We never share it.').getAttribute('id'),
    )
  })

  test('a `field` wires value, change and blur into the child', () => {
    const f = fieldLike('x')
    const { getByLabelText } = render(
      <FormField label="Name" field={f}>
        <Input />
      </FormField>,
    )
    const input = getByLabelText('Name') as HTMLInputElement
    expect(input.value).toBe('x')
    fireEvent.change(input, { target: { value: 'xy' } })
    expect(f.state.value).toBe('xy')
    fireEvent.blur(input)
    expect(f.blurs).toBe(1)
  })

  test('a `control` reads and writes the handle', () => {
    const handle = memoryHandle('ff.q', 'a', { kind: 'string' })
    const { getByLabelText } = render(
      <FormField label="Search" control={handle}>
        <Input />
      </FormField>,
    )
    const input = getByLabelText('Search') as HTMLInputElement
    expect(input.value).toBe('a')
    fireEvent.change(input, { target: { value: 'ab' } })
    expect(handle.writes).toEqual(['ab'])
  })

  test('a child that sets its own value keeps it', () => {
    const f = fieldLike('x')
    const { getByLabelText } = render(
      <FormField label="Name" field={f}>
        <Input value="mine" onValueChange={() => {}} />
      </FormField>,
    )
    expect((getByLabelText('Name') as HTMLInputElement).value).toBe('mine')
  })

  test('a select child is named by a string label', () => {
    const f = fieldLike('a')
    const { getByRole } = render(
      <FormField label="Kind" field={f}>
        <Select
          aria-label="x"
          options={[
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
          ]}
        />
      </FormField>,
    )
    expect(getByRole('combobox').getAttribute('aria-label')).toBe('x')
  })

  test('server render keeps the label and the empty error region', () => {
    const html = renderToString(
      <FormField label="Email" field={fieldLike('')}>
        <Input />
      </FormField>,
    )
    expect(html).toContain('Email')
    expect(html).toContain('data-slot="field-error-region"')
  })
})

describe('the error', () => {
  test('the live region exists before any error', () => {
    const { container } = render(
      <FormField label="Email" field={fieldLike('')}>
        <Input />
      </FormField>,
    )
    const live = region(container)
    expect(live).not.toBeNull()
    expect(live.getAttribute('aria-live')).toBe('polite')
    expect(live.textContent).toBe('')
  })

  test('the same node gains the text, so a changed message is announced', () => {
    const f = fieldLike('')
    const view = () => (
      <FormField label="Email" field={f}>
        <Input />
      </FormField>
    )
    const { container, rerender, getByLabelText } = render(view())
    const live = region(container)
    f.set('x', ['Not an address'])
    rerender(view())
    expect(region(container)).toBe(live)
    expect(live.textContent).toBe('Not an address')
    expect(getByLabelText('Email').getAttribute('aria-invalid')).toBe('true')
    f.set('x', ['Too short'])
    rerender(view())
    expect(live.textContent).toBe('Too short')
    f.set('xyz', [])
    rerender(view())
    expect(live.textContent).toBe('')
    expect(getByLabelText('Email').getAttribute('aria-invalid')).not.toBe('true')
  })

  test('the error is text, one per field', () => {
    const { container } = render(
      <FormField label="Email" field={fieldLike('', ['one', 'two'])}>
        <Input />
      </FormField>,
    )
    expect(region(container).textContent).toBe('one')
  })
})

describe('firstError', () => {
  test('falsy entries are skipped, strings and {message} objects read', () => {
    expect(firstError([])).toBeUndefined()
    expect(firstError([undefined, null, false, '', 0])).toBeUndefined()
    expect(firstError([undefined, 'Required'])).toBe('Required')
    expect(firstError([{ message: 'Too short' }, 'later'])).toBe('Too short')
    expect(firstError([{ message: '' }, { message: 'second' }])).toBe('second')
  })

  test('a `fieldErrors` envelope is read structurally, by record order', () => {
    expect(firstError([{ fieldErrors: { b: ['second key'], a: ['first key'] } }])).toBe(
      'second key',
    )
    expect(firstError([{ fieldErrors: { a: [], b: 'later' } }])).toBe('later')
    expect(firstError([{ fieldErrors: {} }, 'next'])).toBe('next')
    expect(firstError([{ fieldErrors: { a: [{ message: 'nested' }] } }])).toBe('nested')
  })

  test('an unreadable object is not an error message', () => {
    expect(firstError([{ code: 4 }, 12, true])).toBeUndefined()
  })
})

describe('required', () => {
  test('a visible * glyph, aria-hidden, and the control is aria-required', () => {
    const { container, getByRole } = render(
      <FormField label="Email" required field={fieldLike('')}>
        <Input />
      </FormField>,
    )
    const mark = container.querySelector<HTMLElement>('[data-slot="field-required"]')!
    expect(mark.textContent).toBe('*')
    expect(mark.getAttribute('aria-hidden')).toBe('true')
    expect(getByRole('textbox', { name: 'Email' }).hasAttribute('required')).toBe(true)
  })

  test('the mark is not part of the accessible name', () => {
    const { getByRole } = render(
      <FormField label="Email" required field={fieldLike('')}>
        <Input />
      </FormField>,
    )
    expect(getByRole('textbox', { name: 'Email' })).toBeTruthy()
  })

  test('a switch carries aria-required', () => {
    const handle = memoryHandle('ff.on', false, { kind: 'boolean' })
    const { getByRole } = render(
      <FormField label="Alerts" required control={handle}>
        <Switch />
      </FormField>,
    )
    expect(getByRole('switch').getAttribute('aria-required')).toBe('true')
  })

  test('not required: no mark', () => {
    const { container } = render(
      <FormField label="Email" field={fieldLike('')}>
        <Input />
      </FormField>,
    )
    expect(container.querySelector('[data-slot="field-required"]')).toBeNull()
  })
})

const dot = (root: ParentNode) => root.querySelector('[data-slot="field-dirty"]')

describe('the dirty dot', () => {
  test('shows for a non-default `control` and goes when it is default again', () => {
    const handle = memoryHandle('ff.d', 'a', { kind: 'string' })
    const { container, getByLabelText } = render(
      <FormField label="Name" control={handle}>
        <Input />
      </FormField>,
    )
    expect(dot(container)).toBeNull()
    fireEvent.change(getByLabelText('Name'), { target: { value: 'b' } })
    expect(dot(container)).not.toBeNull()
    act(() => {
      handle.clear()
    })
    expect(dot(container)).toBeNull()
  })

  test('never shows for a `field`, even when its value changed', () => {
    const f = fieldLike('a')
    const { container, getByLabelText } = render(
      <FormField label="Name" field={f}>
        <Input />
      </FormField>,
    )
    fireEvent.change(getByLabelText('Name'), { target: { value: 'b' } })
    expect(dot(container)).toBeNull()
  })
})

const disabledOf = (el: Element): boolean =>
  el.hasAttribute('disabled') ||
  el.getAttribute('aria-disabled') === 'true' ||
  el.hasAttribute('data-disabled')

describe('disabled', () => {
  const select = (
    <Select
      aria-label="Kind"
      options={[
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ]}
    />
  )

  type Case = { name: string; role: string; control: React.ReactElement; value: unknown }
  const CASES: Case[] = [
    { name: 'select', role: 'combobox', control: select, value: 'a' },
    {
      name: 'combobox',
      role: 'combobox',
      control: (
        <Combobox items={['a', 'b']}>
          <ComboboxInput aria-label="Pick" />
        </Combobox>
      ),
      value: 'a',
    },
    { name: 'switch', role: 'switch', control: <Switch />, value: false },
    { name: 'checkbox', role: 'checkbox', control: <Checkbox />, value: false },
    { name: 'number-field', role: 'textbox', control: <NumberField />, value: 1 },
    { name: 'slider', role: 'slider', control: <Slider min={0} max={10} />, value: 3 },
  ]

  for (const c of CASES) {
    test(`${c.name}: a ui Fieldset disabled disables it`, () => {
      const f = fieldLike<unknown>(c.value)
      const { getAllByRole } = render(
        <Fieldset disabled>
          <FormField label="Row" field={f}>
            {c.control}
          </FormField>
        </Fieldset>,
      )
      expect(getAllByRole(c.role).some(disabledOf)).toBe(true)
    })

    test(`${c.name}: a native <fieldset disabled> disables it`, () => {
      const f = fieldLike<unknown>(c.value)
      const { getAllByRole } = render(
        <fieldset disabled>
          <FormField label="Row" field={f}>
            {c.control}
          </FormField>
        </fieldset>,
      )
      expect(getAllByRole(c.role).some(disabledOf)).toBe(true)
    })
  }

  test('enabled stays enabled', () => {
    const { getByRole } = render(
      <FormField label="Row" field={fieldLike(false)}>
        <Switch />
      </FormField>,
    )
    expect(disabledOf(getByRole('switch'))).toBe(false)
  })

  test('`disabled` on the field disables its control', () => {
    const { getByRole } = render(
      <FormField label="Row" disabled field={fieldLike(false)}>
        <Switch />
      </FormField>,
    )
    expect(disabledOf(getByRole('switch'))).toBe(true)
  })
})
