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
import { FormRow } from '../controls/form-layout'
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

describe('inputProps checkbox binding (types)', () => {
  type V = {
    name: string
    active: boolean
    maybe?: boolean
    nullable: boolean | null
    nested: { on: boolean; label: string }
    items: { done: boolean; title: string }[]
    flags: boolean[]
    grid: boolean[][]
    byId: Record<string, boolean>
    deep: { a: { b: { c: { d: { e: { f: boolean } } } } } }
  }
  const initialValues: V = {
    name: '',
    active: true,
    nullable: null,
    nested: { on: false, label: '' },
    items: [{ done: true, title: '' }],
    flags: [false],
    grid: [[true]],
    byId: { x: true },
    deep: { a: { b: { c: { d: { e: { f: true } } } } } },
  }

  test('boolean paths accept { type: "checkbox" }; string paths do not', () => {
    const { result } = renderHook(() => useBasaltForm<V>({ initialValues }))
    const form = result.current
    const on = { type: 'checkbox' } as const
    expect(inputProps(form, 'active', on).defaultChecked).toBe(true)
    expect(inputProps(form, 'maybe', on).defaultChecked).toBeUndefined()
    expect(inputProps(form, 'nullable', on).defaultChecked).toBeNull()
    expect(inputProps(form, 'nested.on', on).defaultChecked).toBe(false)
    expect(inputProps(form, 'items.0.done', on).defaultChecked).toBe(true)
    expect(inputProps(form, 'flags.0', on).defaultChecked).toBe(false)
    expect(inputProps(form, 'grid.0.0', on).defaultChecked).toBe(true)
    expect(inputProps(form, 'byId.x', on).defaultChecked).toBe(true)
    expect(inputProps(form, 'deep.a.b.c.d.e.f', on).defaultChecked).toBe(true)
    // @ts-expect-error — `name` is a string path
    inputProps(form, 'name', on)
    // @ts-expect-error — `nested.label` is a string path
    inputProps(form, 'nested.label', on)
    // @ts-expect-error — `items.0.title` is a string path
    inputProps(form, 'items.0.title', on)
    // @ts-expect-error — `nested` is an object, not a boolean
    inputProps(form, 'nested', on)
    // @ts-expect-error — a decimal is not an array index
    inputProps(form, 'flags.1.5', on)
    // @ts-expect-error — a leading zero is not canonical
    inputProps(form, 'flags.01', on)
    // @ts-expect-error — a negative index is not canonical
    inputProps(form, 'flags.-1', on)
    // @ts-expect-error — an exponent is not canonical
    inputProps(form, 'flags.1e0', on)
    // @ts-expect-error — a path that does not exist
    inputProps(form, 'nope', on)
    // @ts-expect-error — a non-literal path cannot be proven boolean
    inputProps(form, 'active' as string, on)
    // @ts-expect-error — only the checkbox option exists
    inputProps(form, 'active', { type: 'input' })
  })
})

describe('inputProps bindings', () => {
  test('a no-options call on a boolean path still returns `value`, not `checked`', () => {
    const { result } = renderHook(() =>
      useBasaltForm<{ on: boolean }>({ initialValues: { on: true }, mode: 'controlled' }),
    )
    const props = inputProps(result.current, 'on')
    expect(props.value).toBe(true)
    expect(props).not.toHaveProperty('checked')
  })

  test('the checkbox binding returns `checked` under mode: controlled', () => {
    const { result } = renderHook(() =>
      useBasaltForm<{ on: boolean }>({ initialValues: { on: true }, mode: 'controlled' }),
    )
    const props = inputProps(result.current, 'on', { type: 'checkbox' })
    expect(props.checked).toBe(true)
    expect(props).not.toHaveProperty('defaultChecked')
    expect(props).not.toHaveProperty('value')
  })

  test('does not return `key` (the spread-warning contract)', () => {
    const { result } = renderHook(() =>
      useBasaltForm<{ on: boolean }>({ initialValues: { on: true } }),
    )
    expect(inputProps(result.current, 'on')).not.toHaveProperty('key')
    expect(inputProps(result.current, 'on', { type: 'checkbox' })).not.toHaveProperty('key')
  })
})

type Booleans = {
  agree: boolean
  notify: boolean
  prefs: { weekly: boolean }
  tasks: { done: boolean }[]
}

function BooleanForm() {
  const form = useBasaltForm<Booleans>({
    initialValues: {
      agree: false,
      notify: true,
      prefs: { weekly: false },
      tasks: [{ done: false }],
    },
  })
  const on = { type: 'checkbox' } as const
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        form.setFieldError('agree', 'Must agree')
      }}
    >
      <Checkbox key={fieldKey(form, 'agree')} {...inputProps(form, 'agree', on)} label="Agree" />
      <Switch key={fieldKey(form, 'notify')} {...inputProps(form, 'notify', on)} label="Notify" />
      <Checkbox
        key={fieldKey(form, 'prefs.weekly')}
        {...inputProps(form, 'prefs.weekly', on)}
        label="Weekly"
      />
      <Checkbox
        key={fieldKey(form, 'tasks.0.done')}
        {...inputProps(form, 'tasks.0.done', on)}
        label="Task done"
      />
      <output data-testid="err">{String(inputProps(form, 'agree', on).error)}</output>
      <output data-testid="values">{JSON.stringify(form.getValues())}</output>
      <button type="submit">go</button>
    </form>
  )
}

describe('inputProps checkbox binding (runtime)', () => {
  test('binds Checkbox, Switch, a dot path and an array index; clicks toggle the form value', () => {
    const { getByLabelText, getByTestId } = render(
      <MantineProvider>
        <BooleanForm />
      </MantineProvider>,
    )
    const box = (label: string) => getByLabelText(label) as HTMLInputElement
    expect(box('Agree').checked).toBe(false)
    expect(box('Notify').checked).toBe(true)

    fireEvent.click(box('Notify'))
    fireEvent.click(box('Weekly'))
    fireEvent.click(box('Task done'))
    expect(box('Notify').checked).toBe(false)
    expect(JSON.parse(getByTestId('values').textContent ?? '')).toEqual({
      agree: false,
      notify: false,
      prefs: { weekly: true },
      tasks: [{ done: true }],
    })
  })

  test('error is exactly undefined before submit, and the message after; FormRow renders it once', () => {
    const { getByTestId, getByText } = render(
      <MantineProvider>
        <BooleanForm />
      </MantineProvider>,
    )
    expect(getByTestId('err').textContent).toBe('undefined')
    fireEvent.submit(getByText('go').closest('form') as HTMLFormElement)
    expect(getByTestId('err').textContent).toBe('Must agree')
  })

  test('FormRow with error={inputProps(form, path).error} renders the message exactly once', () => {
    function RawRow() {
      const form = useBasaltForm<{ email: string }>({ initialValues: { email: '' } })
      return (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.setFieldError('email', 'Bad email')
          }}
        >
          <FormRow label="Email" error={inputProps(form, 'email').error}>
            <input aria-label="raw" />
          </FormRow>
          <button type="submit">go</button>
        </form>
      )
    }
    const { getByText, getAllByText, queryByText } = render(
      <MantineProvider>
        <RawRow />
      </MantineProvider>,
    )
    expect(queryByText('Bad email')).toBeNull()
    fireEvent.submit(getByText('go').closest('form') as HTMLFormElement)
    expect(getAllByText('Bad email')).toHaveLength(1)
  })
})
