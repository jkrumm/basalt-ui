/** The settings grammar: a section's heading row, lock, row ids, the action, confirm and group rows, the unsaved bar. */
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { FormLike, IconComponent } from '../core/ports'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Switch } from '../ui/switch'
import { memoryHandle } from './control-view.handles'
import { FormField } from './form-field'
import { FormFooter } from './form-footer'
import { FormSection } from './form-section'
import { FormActionRow, FormConfirmRow, FormGroupRow } from './settings-rows'

afterEach(cleanup)

const text = memoryHandle('sg.t', 'a', { kind: 'string' })
const flag = memoryHandle('sg.f', false, { kind: 'boolean' })

const Glyph: IconComponent = (props) => <svg data-glyph="" {...props} />

describe('FormSection heading row', () => {
  test('title, badge, description and action stand outside the box', () => {
    const { container, getByRole } = render(
      <FormSection
        title="Audit log"
        description="Every change, kept."
        badge={<span>Enterprise</span>}
        action={<Button>See plans</Button>}
      >
        <FormField label="Retention" control={text}>
          <Input />
        </FormField>
      </FormSection>,
    )
    const header = container.querySelector('[data-slot="form-section-header"]')!
    const box = container.querySelector('[data-slot="form-section-box"]')!
    expect(header.contains(box)).toBe(false)
    expect(header.textContent).toContain('Audit log')
    expect(header.textContent).toContain('Enterprise')
    expect(header.contains(getByRole('button', { name: 'See plans' }))).toBe(true)
    expect(getByRole('group', { name: 'Audit log' })).toBeTruthy()
    expect(box.className).toContain('border-border')
  })

  test('locked dims the box, disables its fields, says why and keeps the action enabled', () => {
    const { container, getByRole, getByText } = render(
      <FormSection
        title="Single sign-on"
        locked="Part of the Enterprise plan."
        action={<Button>See plans</Button>}
      >
        <FormField label="Provider" control={text}>
          <Input />
        </FormField>
      </FormSection>,
    )
    const box = container.querySelector('[data-slot="form-section-box"]')!
    expect(box.hasAttribute('inert')).toBe(true)
    expect(box.className).toContain('opacity-50')
    expect(getByText('Part of the Enterprise plan.')).toBeTruthy()
    expect(
      container.querySelector('[data-slot="form-section-locked"]')!.querySelector('svg'),
    ).not.toBeNull()
    expect(getByRole('textbox', { name: 'Provider', hidden: true }).hasAttribute('disabled')).toBe(
      true,
    )
    expect(getByRole('button', { name: 'See plans' }).hasAttribute('disabled')).toBe(false)
  })

  test('an unlocked section is neither inert nor dimmed', () => {
    const { container } = render(
      <FormSection title="Open">
        <FormField label="A" control={text}>
          <Input />
        </FormField>
      </FormSection>,
    )
    const box = container.querySelector('[data-slot="form-section-box"]')!
    expect(box.hasAttribute('inert')).toBe(false)
    expect(box.className).not.toContain('opacity-50')
  })
})

describe('FormField row', () => {
  test('id lands on the row, the control keeps its own', () => {
    const { container, getByRole } = render(
      <FormField label="Digest" id="row-digest" layout="row" control={flag}>
        <Switch />
      </FormField>,
    )
    const row = container.querySelector('#row-digest')!
    expect(row.getAttribute('data-slot')).toBe('form-field-row')
    expect(getByRole('switch', { name: 'Digest' }).id).not.toBe('row-digest')
  })

  test('an icon draws a tile at the start of a row', () => {
    const { container } = render(
      <FormField label="Digest" icon={Glyph} layout="row" control={flag}>
        <Switch />
      </FormField>,
    )
    const row = container.querySelector('[data-slot="form-field-row"]')!
    expect(row.firstElementChild!.getAttribute('data-slot')).toBe('icon-tile')
    expect(row.querySelector('[data-glyph]')!.getAttribute('aria-hidden')).toBe('true')
  })

  test('the control column is fixed and the grid stacks below the regular tier', () => {
    const { container } = render(
      <FormField label="Name" layout="row" control={text}>
        <Input />
      </FormField>,
    )
    const field = container.querySelector('[data-slot="field"]')!
    expect(field.className).toContain('@regular:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]')
    expect(field.className).toContain('[grid-template-areas:"label"_"desc"_"control"_"error"]')
  })

  test('a bare use() handle (a synced field) binds like a control and applies at once', () => {
    let value = 'x'
    const synced = { use: (): [string, (v: string) => void] => [value, (v) => void (value = v)] }
    const { getByRole } = render(
      <FormField label="Language" control={synced}>
        <Input />
      </FormField>,
    )
    fireEvent.change(getByRole('textbox', { name: 'Language' }), { target: { value: 'de' } })
    expect(value).toBe('de')
  })

  test('every control in a row has its label as its accessible name', () => {
    const { getByRole } = render(
      <FormSection title="Prefs">
        <FormField label="Name" control={text}>
          <Input />
        </FormField>
        <FormField label="Weekly digest" description="One email." control={flag}>
          <Switch />
        </FormField>
      </FormSection>,
    )
    expect(getByRole('textbox', { name: 'Name' })).toBeTruthy()
    expect(getByRole('switch', { name: 'Weekly digest' })).toBeTruthy()
  })
})

describe('FormActionRow', () => {
  test('the action is in the row; danger tone reads in the verdict color', () => {
    const { container, getByRole } = render(
      <FormActionRow
        label="Revoke key"
        description="Stops every script using it."
        tone="danger"
        id="row-revoke"
        action={<Button variant="danger">Revoke</Button>}
      />,
    )
    const row = container.querySelector<HTMLElement>('#row-revoke')!
    expect(getByRole('group', { name: 'Revoke key' })).toBe(row)
    expect(row.getAttribute('data-slot')).toBe('form-action-row')
    expect(row.textContent).toContain('Stops every script using it.')
    expect(row.querySelector('.text-bad')!.textContent).toBe('Revoke key')
    expect(row.contains(getByRole('button', { name: 'Revoke' }))).toBe(true)
  })
})

describe('FormConfirmRow', () => {
  test('the button enables only when the typed text matches exactly', async () => {
    let confirmed = 0
    const { getByRole } = render(
      <FormConfirmRow
        label="Delete workspace"
        description="Removes every project."
        confirmText="acme"
        actionLabel="Delete workspace now"
        onConfirm={() => void (confirmed += 1)}
      />,
    )
    const input = getByRole('textbox', { name: 'Type acme to confirm' })
    const button = getByRole('button', { name: 'Delete workspace now' })
    const off = () => button.hasAttribute('disabled') || button.hasAttribute('data-disabled')
    expect(off()).toBe(true)
    fireEvent.change(input, { target: { value: 'Acme' } })
    expect(off()).toBe(true)
    fireEvent.change(input, { target: { value: 'acme' } })
    expect(off()).toBe(false)
    await act(async () => {
      fireEvent.click(button)
    })
    expect(confirmed).toBe(1)
    expect((input as HTMLInputElement).value).toBe('')
    expect(off()).toBe(true)
  })

  test('a rejected onConfirm keeps the typed text and the row declares its slot', async () => {
    const { container, getByRole } = render(
      <FormConfirmRow
        label="Delete"
        confirmText="x"
        actionLabel="Go"
        onConfirm={() => Promise.reject(new Error('nope'))}
      />,
    )
    expect(container.querySelector('[data-slot="form-confirm-row"]')).not.toBeNull()
    const input = getByRole('textbox', { name: 'Type x to confirm' }) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'x' } })
    await act(async () => {
      fireEvent.click(getByRole('button', { name: 'Go' }))
    })
    expect(input.value).toBe('x')
  })

  test('without a description the row names no description', () => {
    const { container } = render(<FormActionRow label="Run" action={<Button>Go</Button>} />)
    expect(container.querySelector('[aria-describedby]')).toBeNull()
  })

  test('the input is a plain field: no autofill, no spellcheck', () => {
    const { getByRole } = render(
      <FormConfirmRow label="Delete" confirmText="x" actionLabel="Go" onConfirm={() => {}} />,
    )
    const input = getByRole('textbox', { name: 'Type x to confirm' })
    expect(input.getAttribute('autocomplete')).toBe('off')
    expect(input.getAttribute('spellcheck')).toBe('false')
  })
})

describe('FormGroupRow', () => {
  test('opens to a list of rows; the rows stay mounted while closed', () => {
    const { getByRole, container } = render(
      <FormGroupRow label="Deploys" summary="1 of 2 on" icon={Glyph} id="row-deploys">
        <FormField label="Succeeded" control={flag}>
          <Switch />
        </FormField>
      </FormGroupRow>,
    )
    const trigger = getByRole('button', { name: /Deploys/ })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelector('#row-deploys')).not.toBeNull()
    expect(
      container.querySelector('[data-slot="form-group-row-panel"] [role="switch"]'),
    ).not.toBeNull()
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(getByRole('switch', { name: 'Succeeded' })).toBeTruthy()
    expect(trigger.className).toContain('group')
  })
})

function fakeForm() {
  let state = {
    values: {},
    isSubmitting: false,
    canSubmit: true,
    errors: [] as unknown[],
    isDirty: false,
  }
  const subs = new Set<() => void>()
  const form: FormLike<unknown> & { patch(p: Partial<typeof state>): void } = {
    get state() {
      return state
    },
    options: {},
    store: {
      subscribe(cb) {
        subs.add(cb)
        return { unsubscribe: () => void subs.delete(cb) }
      },
    },
    reset() {},
    patch(p) {
      state = { ...state, ...p }
      subs.forEach((cb) => cb())
    },
  }
  return form
}

describe('FormFooter floating', () => {
  test('hidden while the form is clean, shown while dirty or saving, with Discard and Save', () => {
    const form = fakeForm()
    const { container, getByText } = render(
      <FormFooter
        floating
        form={form}
        actions={[{ label: 'Discard' }, { label: 'Save', primary: true }]}
      />,
    )
    const bar = container.querySelector<HTMLElement>('[data-slot="form-footer"]')!
    expect(bar.hasAttribute('data-floating')).toBe(true)
    expect(bar.hidden).toBe(true)
    act(() => form.patch({ isDirty: true }))
    expect(bar.hidden).toBe(false)
    expect(getByText('Unsaved changes')).toBeTruthy()
    expect(getByText('Save').closest('button')!.getAttribute('type')).toBe('submit')
    act(() => form.patch({ isDirty: false, isSubmitting: true }))
    expect(bar.hidden).toBe(false)
    act(() => form.patch({ isSubmitting: false }))
    expect(bar.hidden).toBe(true)
  })

  test('a form error keeps the bar open', () => {
    const form = fakeForm()
    const { container } = render(
      <FormFooter floating form={form} actions={[{ label: 'Save', primary: true }]} />,
    )
    act(() => form.patch({ errors: ['Could not save.'] }))
    expect(container.querySelector<HTMLElement>('[data-slot="form-footer"]')!.hidden).toBe(false)
  })
})
