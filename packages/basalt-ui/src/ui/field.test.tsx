import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Fieldset,
  FieldsetLegend,
  Form,
  fieldParts,
} from './field'
import { Input } from './input'

afterEach(cleanup)

const slots = (root: ParentNode): string[] =>
  [...root.querySelectorAll('[data-slot]')].map((el) => el.getAttribute('data-slot') ?? '')

describe('field module', () => {
  test('renders with no provider; every part carries data-slot and fieldParts lists them', () => {
    const { container } = render(
      <Form>
        <Fieldset>
          <FieldsetLegend>Billing</FieldsetLegend>
          <Field label="Name" description="Shown on invoices" error="Required">
            <Input />
          </Field>
          <Field label="Standalone">
            <FieldLabel>Own label</FieldLabel>
            <FieldDescription>Own description</FieldDescription>
            <FieldError match>Own error</FieldError>
          </Field>
        </Fieldset>
      </Form>,
    )
    expect([...new Set(slots(container))].toSorted()).toEqual([...fieldParts, 'input'].toSorted())
    expect(container.querySelector('form')?.getAttribute('data-slot')).toBe('form')
    expect(container.querySelector('fieldset')?.getAttribute('data-slot')).toBe('fieldset')
    expect(container.querySelector('[data-slot="fieldset-legend"]')).not.toBeNull()
  })

  test('server render keeps every slot', () => {
    const html = renderToString(
      <Form>
        <Fieldset>
          <FieldsetLegend>Billing</FieldsetLegend>
          <Field label="Name" description="d" error="e">
            <Input />
          </Field>
        </Fieldset>
      </Form>,
    )
    for (const part of fieldParts) expect(html).toContain(`data-slot="${part}"`)
  })

  test('the label names the control and the description and error describe it', () => {
    const { getByLabelText, getByText } = render(
      <Field label="Email" description="We never share it." error="Not an address">
        <Input />
      </Field>,
    )
    const input = getByLabelText('Email')
    expect(input.getAttribute('data-slot')).toBe('input')
    const described = (input.getAttribute('aria-describedby') ?? '').split(' ')
    expect(described).toContain(getByText('We never share it.').id)
    expect(described).toContain(getByText('Not an address').id)
    expect(input.getAttribute('aria-invalid')).toBe('true')
  })

  test('without an error nothing is invalid and no error part renders', () => {
    const { getByLabelText, container } = render(
      <Field label="Email">
        <Input />
      </Field>,
    )
    expect(getByLabelText('Email').getAttribute('aria-invalid')).toBeNull()
    expect(container.querySelector('[data-slot="field-error"]')).toBeNull()
    expect(container.querySelector('[data-slot="field-description"]')).toBeNull()
  })

  test('className merges onto the part', () => {
    const { container } = render(
      <Field label="Name" className="max-w-sm">
        <Input />
      </Field>,
    )
    const root = container.querySelector('[data-slot="field"]')
    expect(root?.className).toContain('max-w-sm')
    expect(root?.className).toContain('flex-col')
  })

  test('a Form submits the collected values', () => {
    let values: unknown
    const { container } = render(
      <Form onFormSubmit={(next) => (values = next)}>
        <Field label="Name">
          <Input name="name" defaultValue="Ada" />
        </Field>
      </Form>,
    )
    fireEvent.submit(container.querySelector('form')!)
    expect(values).toEqual({ name: 'Ada' })
  })
})
