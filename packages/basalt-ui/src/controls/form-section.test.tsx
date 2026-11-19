/** `FormSection`: a named fieldset on a surface whose fields default to the settings row. */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { Input } from '../ui/input'
import { Switch } from '../ui/switch'
import { memoryHandle } from './control-view.handles'
import { FormField } from './form-field'
import { FormRow } from './form-row'
import { FormSection, formSectionParts } from './form-section'

afterEach(cleanup)

const text = memoryHandle('fs.t', 'a', { kind: 'string' })
const flag = memoryHandle('fs.f', false, { kind: 'boolean' })

describe('FormSection', () => {
  test('the title names the group and the description describes it', () => {
    const { getByRole } = render(
      <FormSection title="Deploys" description="How a merge reaches production.">
        <FormField label="Branch" control={text}>
          <Input />
        </FormField>
      </FormSection>,
    )
    const group = getByRole('group', { name: 'Deploys' })
    const describedBy = group.getAttribute('aria-describedby')!
    expect(document.getElementById(describedBy)!.textContent).toBe(
      'How a merge reaches production.',
    )
    expect(getByRole('textbox', { name: 'Branch' })).toBeTruthy()
  })

  test('its fields take the row layout unless they name one', () => {
    const { container } = render(
      <FormSection title="General">
        <FormField label="Name" control={text}>
          <Input />
        </FormField>
        <FormField label="Stacked" layout="stack" control={text}>
          <Input />
        </FormField>
      </FormSection>,
    )
    expect(container.querySelectorAll('[data-slot="form-field-row"]').length).toBe(1)
  })

  test('layout="stack" stacks every field; a FormRow inside a row section stacks its fields', () => {
    const stacked = render(
      <FormSection title="A" layout="stack">
        <FormField label="Name" control={text}>
          <Input />
        </FormField>
      </FormSection>,
    )
    expect(stacked.container.querySelector('[data-slot="form-field-row"]')).toBeNull()
    cleanup()
    const row = render(
      <FormSection title="B">
        <FormRow>
          <FormField label="From" control={text}>
            <Input />
          </FormField>
          <FormField label="To" control={text}>
            <Input />
          </FormField>
        </FormRow>
      </FormSection>,
    )
    expect(row.container.querySelector('[data-slot="form-field-row"]')).toBeNull()
  })

  test('disabled disables every field inside', () => {
    const { getByRole } = render(
      <FormSection title="Locked" disabled>
        <FormField label="Name" control={text}>
          <Input />
        </FormField>
        <FormField label="On" control={flag}>
          <Switch />
        </FormField>
      </FormSection>,
    )
    expect(getByRole('textbox', { name: 'Name' }).hasAttribute('disabled')).toBe(true)
    const toggle = getByRole('switch', { name: 'On' })
    expect(
      toggle.hasAttribute('data-disabled') || toggle.getAttribute('aria-disabled') === 'true',
    ).toBe(true)
  })

  test('the footer band renders only when given', () => {
    const without = render(
      <FormSection title="A">
        <FormField label="Name" control={text}>
          <Input />
        </FormField>
      </FormSection>,
    )
    expect(without.container.querySelector('[data-slot="form-section-footer"]')).toBeNull()
    cleanup()
    const withFooter = render(
      <FormSection title="A" footer={<span>Saved</span>}>
        <FormField label="Name" control={text}>
          <Input />
        </FormField>
      </FormSection>,
    )
    expect(
      withFooter.container.querySelector('[data-slot="form-section-footer"]')!.textContent,
    ).toBe('Saved')
  })

  test('server render keeps the legend and every slot it declares but the footer', () => {
    const html = renderToString(
      <FormSection title="General" description="About">
        <FormField label="Name" control={text}>
          <Input />
        </FormField>
      </FormSection>,
    )
    for (const slot of formSectionParts.filter((s) => s !== 'form-section-footer')) {
      expect(html).toContain(`data-slot="${slot}"`)
    }
    expect(html).toContain('General')
  })
})

describe('FormField layout="row"', () => {
  test('the row wraps the field in a size container keyed on its own width', () => {
    const { container } = render(
      <FormField label="Name" layout="row" control={text}>
        <Input />
      </FormField>,
    )
    const row = container.querySelector('[data-slot="form-field-row"]')!
    expect(row.className).not.toContain('@container')
    expect(row.querySelector(':scope > div')!.className).toContain('@container')
    const field = container.querySelector('[data-slot="field"]')!
    expect(field.className).toContain('@regular:')
  })

  test('a toggle keeps its end column at every width', () => {
    const { container } = render(
      <FormField label="On" layout="row" control={flag}>
        <Switch />
      </FormField>,
    )
    const field = container.querySelector('[data-slot="field"]')!
    expect(field.className).toContain('grid-cols-[minmax(0,1fr)_auto]')
    expect(field.className).not.toContain('@regular:grid-cols')
  })

  test('the label still names the control and the description describes it', () => {
    const { getByRole } = render(
      <FormField label="Name" description="Shown in the header." layout="row" control={text}>
        <Input />
      </FormField>,
    )
    const box = getByRole('textbox', { name: 'Name' })
    const ids = (box.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean)
    expect(ids.map((id) => document.getElementById(id)?.textContent)).toContain(
      'Shown in the header.',
    )
  })
})
