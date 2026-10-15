/**
 * `inputProps` + `fieldKey` — the split that keeps the spread warning-free.
 *
 * The load-bearing assertion is the console one: React 19 logs
 * `A props object containing a "key" prop is being spread into JSX` for every render of the old
 * one-object form, and a console warning is exactly the class of defect that survives a green
 * suite. It is asserted the way `tests/isomorphic/harness.ts` does — spy, render, read — rather
 * than by inspecting the returned object, because the object shape is the mechanism and the silent
 * console is the contract.
 */
import { Checkbox, MantineProvider, Switch, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { fireEvent, render, renderHook } from '@testing-library/react'
import { describe, expect, spyOn, test } from 'bun:test'
import { fieldKey, inputProps } from './field'
import { useBasaltForm } from './create-form'

describe('inputProps', () => {
  test('returns getInputProps() — and NOT `key`, which is what React 19 warns about', () => {
    const { result } = renderHook(() => useForm({ initialValues: { email: '' } }))
    const form = result.current

    const props = inputProps(form, 'email')
    expect(props).not.toHaveProperty('key')

    const expectedGetInputProps = form.getInputProps('email')
    // `getInputProps()` mints fresh handler closures on every call, so two separate calls never
    // compare equal by reference — the assertion is per-field: every NON-function prop it returns,
    // plus the handlers being callable at all.
    for (const [prop, value] of Object.entries(expectedGetInputProps)) {
      if (typeof value === 'function') {
        expect(typeof props[prop as keyof typeof props]).toBe('function')
        continue
      }
      expect(props[prop as keyof typeof props]).toEqual(value)
    }
  })
})

describe('fieldKey', () => {
  test('is the form reconciler key for that path', () => {
    const { result } = renderHook(() => useForm({ initialValues: { email: '' } }))
    expect(fieldKey(result.current, 'email')).toBe(result.current.key('email'))
  })

  test('two paths never share a key', () => {
    const { result } = renderHook(() => useForm({ initialValues: { a: '', b: '' } }))
    expect(fieldKey(result.current, 'a')).not.toBe(fieldKey(result.current, 'b'))
  })
})

function Fields() {
  const form = useBasaltForm<{ name: string; email: string; budget: string }>({
    initialValues: { name: '', email: '', budget: '' },
  })
  return (
    <form>
      <TextInput key={fieldKey(form, 'name')} {...inputProps(form, 'name')} label="Name" />
      <TextInput key={fieldKey(form, 'email')} {...inputProps(form, 'email')} label="Email" />
      <TextInput key={fieldKey(form, 'budget')} {...inputProps(form, 'budget')} label="Budget" />
    </form>
  )
}

describe('the documented idiom renders silently', () => {
  test('three fields log no React key-spread warning', () => {
    const error = spyOn(console, 'error').mockImplementation(() => {})
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      render(
        <MantineProvider>
          <Fields />
        </MantineProvider>,
      )
      const logged = [...error.mock.calls, ...warn.mock.calls].map((args) => String(args[0]))
      expect(logged.filter((message) => message.includes('"key" prop'))).toEqual([])
      // Nothing else either — a new warning here is a finding, not noise.
      expect(logged).toEqual([])
    } finally {
      error.mockRestore()
      warn.mockRestore()
    }
  })
})

describe('inputProps checkbox binding', () => {
  type V = {
    name: string
    active: boolean
    nested: { on: boolean; label: string }
    flags: boolean[]
  }

  test('a boolean path accepts { type: "checkbox" }, a string path does not (type-level)', () => {
    const { result } = renderHook(() =>
      useBasaltForm<V>({
        initialValues: { name: '', active: true, nested: { on: false, label: '' }, flags: [false] },
      }),
    )
    const form = result.current
    expect(inputProps(form, 'active', { type: 'checkbox' }).defaultChecked).toBe(true)
    expect(inputProps(form, 'nested.on', { type: 'checkbox' }).defaultChecked).toBe(false)
    expect(inputProps(form, 'flags.0', { type: 'checkbox' }).defaultChecked).toBe(false)
    // @ts-expect-error — `name` is a string path
    inputProps(form, 'name', { type: 'checkbox' })
    // @ts-expect-error — `nested.label` is a string path
    inputProps(form, 'nested.label', { type: 'checkbox' })
    // @ts-expect-error — only the checkbox option exists
    inputProps(form, 'active', { type: 'input' })
    expect(inputProps(form, 'active')).not.toHaveProperty('key')
  })

  function Booleans() {
    const form = useBasaltForm<{ agree: boolean; notify: boolean }>({
      initialValues: { agree: false, notify: true },
    })
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          form.setFieldError('agree', 'Must agree')
        }}
      >
        <Checkbox
          key={fieldKey(form, 'agree')}
          {...inputProps(form, 'agree', { type: 'checkbox' })}
          label="Agree"
        />
        <Switch
          key={fieldKey(form, 'notify')}
          {...inputProps(form, 'notify', { type: 'checkbox' })}
          label="Notify"
        />
        <button type="submit">go</button>
        <output data-testid="err">{String(inputProps(form, 'agree').error ?? '')}</output>
      </form>
    )
  }

  test('binds a Mantine Checkbox and Switch, and surfaces the typed error', () => {
    const { getByLabelText, getByText, getByTestId } = render(
      <MantineProvider>
        <Booleans />
      </MantineProvider>,
    )
    const agree = getByLabelText('Agree') as HTMLInputElement
    const notify = getByLabelText('Notify') as HTMLInputElement
    expect(agree.checked).toBe(false)
    expect(notify.checked).toBe(true)

    fireEvent.click(notify)
    expect(notify.checked).toBe(false)

    fireEvent.submit(getByText('go').closest('form') as HTMLFormElement)
    expect(getByTestId('err').textContent).toBe('Must agree')

    fireEvent.click(agree)
    expect(agree.checked).toBe(true)
  })
})
