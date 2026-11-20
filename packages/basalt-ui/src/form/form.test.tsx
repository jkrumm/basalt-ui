/**
 * `basalt-ui/form`: `useAppForm` binds `FormField`, `Form` and `Footer` to one TanStack form, submits
 * through `handleSubmit` with native validation off, disables the fields while it submits, and
 * validates `onDynamic` on blur before the first submit.
 */
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import { Input } from '../ui/input'
import { useAppForm } from './index'

afterEach(cleanup)

const required = ({ value }: { value: string }) => (value === '' ? 'Enter a name.' : undefined)

function NameForm({
  onSubmit,
  hold,
}: {
  onSubmit: (value: { name: string }) => void
  hold?: Promise<void>
}): ReactElement {
  const form = useAppForm({
    defaultValues: { name: '' },
    onSubmit: async ({ value }) => {
      onSubmit(value)
      await hold
    },
  })
  return (
    <form.AppForm>
      <form.Form>
        <form.AppField name="name" validators={{ onDynamic: required }}>
          {(f) => (
            <f.FormField label="Name" required>
              <Input />
            </f.FormField>
          )}
        </form.AppField>
        <form.Footer actions={[{ label: 'Save', primary: true }]} />
      </form.Form>
    </form.AppForm>
  )
}

describe('useAppForm', () => {
  test('the form skips native validation and submits through handleSubmit', async () => {
    const seen: { name: string }[] = []
    const { container, getByRole } = render(<NameForm onSubmit={(v) => seen.push(v)} />)
    expect(container.querySelector('form')!.hasAttribute('novalidate')).toBe(true)
    fireEvent.change(getByRole('textbox'), { target: { value: 'checkout' } })
    fireEvent.click(getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(seen).toEqual([{ name: 'checkout' }]))
  })

  test('onDynamic runs on blur before the first submit, not on change', async () => {
    const { getByRole, getByText, queryByText } = render(<NameForm onSubmit={() => {}} />)
    const input = getByRole('textbox')
    fireEvent.change(input, { target: { value: 'a' } })
    fireEvent.change(input, { target: { value: '' } })
    expect(queryByText('Enter a name.')).toBeNull()
    fireEvent.blur(input)
    await waitFor(() => expect(getByText('Enter a name.')).toBeTruthy())
  })

  test('a submit with an error shows it and does not reach onSubmit', async () => {
    const seen: unknown[] = []
    const { getByRole, getByText } = render(<NameForm onSubmit={(v) => seen.push(v)} />)
    fireEvent.click(getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(getByText('Enter a name.')).toBeTruthy())
    expect(seen).toEqual([])
  })

  test('the fields are disabled and the footer busy while the form submits', async () => {
    const { promise: hold, resolve: release } = Promise.withResolvers<void>()
    const { container, getByRole } = render(<NameForm onSubmit={() => {}} hold={hold} />)
    fireEvent.change(getByRole('textbox'), { target: { value: 'checkout' } })
    fireEvent.click(getByRole('button', { name: 'Save' }))
    const fieldset = container.querySelector('fieldset')!
    const footer = container.querySelector('[data-slot="form-footer"]')!
    await waitFor(() => expect(fieldset.disabled).toBe(true))
    expect(footer.getAttribute('aria-busy')).toBe('true')
    await act(async () => {
      release()
      await hold
    })
    await waitFor(() => expect(fieldset.disabled).toBe(false))
  })

  test('form.Form passes its meta to onSubmit', async () => {
    const steps: number[] = []
    function Stepped(): ReactElement {
      const form = useAppForm({
        defaultValues: { name: 'x' },
        onSubmitMeta: { step: 0 },
        onSubmit: ({ meta }) => {
          steps.push(meta.step)
        },
      })
      return (
        <form.AppForm>
          <form.Form meta={{ step: 2 }}>
            <form.Footer actions={[{ label: 'Continue', primary: true }]} />
          </form.Form>
        </form.AppForm>
      )
    }
    const { getByRole } = render(<Stepped />)
    fireEvent.click(getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(steps).toEqual([2]))
  })
})
