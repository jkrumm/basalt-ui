/**
 * `useBasaltForm` — the `mode: 'uncontrolled'` default and the `schemaResolver` wiring, plus
 * `FormErrorSummary` rendering the resulting error list behind `role="alert"`.
 *
 * No schema-validation library is a devDependency of `packages/basalt-ui` itself — Valibot ships
 * only in `apps/playground`'s devDeps for `FormsDemoPage` and is not resolvable from here. A
 * hand-rolled Standard Schema fixture stands in instead, the same shape `use-form-draft.ts`'s own
 * doc builds for its envelope wrapper: any object carrying `'~standard'` satisfies the interface.
 */
import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { inputProps } from './field'
import { FormErrorSummary } from './FormErrorSummary'
import { useBasaltForm } from './create-form'
import type { StandardSchemaV1 } from '../register'

type Values = { name: string }

const REQUIRED = 'Name is required'

function requiredNameSchema(): StandardSchemaV1<unknown, Values> {
  return {
    '~standard': {
      version: 1,
      vendor: 'basalt-test-fixture',
      validate: (raw) => {
        const values = raw as Values
        if (values.name.trim().length === 0) {
          return { issues: [{ message: REQUIRED, path: ['name'] }] }
        }
        return { value: values }
      },
    },
  }
}

describe('useBasaltForm', () => {
  test('defaults to mode: "uncontrolled"', () => {
    const { result } = renderHook(() => useBasaltForm<Values>({ initialValues: { name: '' } }))
    // Mantine's uncontrolled forms still expose the initial snapshot through getValues().
    expect(result.current.getValues()).toEqual({ name: '' })
  })

  test('with a schema, validate() populates errors from an invalid field via schemaResolver', () => {
    const { result } = renderHook(() =>
      useBasaltForm<Values>({ initialValues: { name: '' }, schema: requiredNameSchema() }),
    )
    act(() => {
      result.current.validate()
    })
    expect(result.current.errors['name']).toBe(REQUIRED)
  })

  test('a value passing the schema carries no error', () => {
    const { result } = renderHook(() =>
      useBasaltForm<Values>({ initialValues: { name: 'Ada' }, schema: requiredNameSchema() }),
    )
    act(() => {
      result.current.validate()
    })
    expect(result.current.errors['name']).toBeUndefined()
  })
})

function FormHarness() {
  const form = useBasaltForm<Values>({
    initialValues: { name: '' },
    schema: requiredNameSchema(),
  })
  // `key` must be passed as a real JSX key, not spread — React warns (and a future major errors)
  // on a "key" prop reaching the DOM via spread.
  const { key, ...nameProps } = inputProps(form, 'name')
  return (
    <form data-testid="form" onSubmit={form.onSubmit(() => {})}>
      <FormErrorSummary form={form} />
      <input key={key} {...nameProps} aria-label="Name" />
      <button type="submit">Submit</button>
    </form>
  )
}

describe('FormErrorSummary', () => {
  test('renders nothing while the form is clean', () => {
    render(
      <MantineProvider>
        <FormHarness />
      </MantineProvider>,
    )
    expect(screen.queryByRole('alert')).toBeNull()
  })

  test('a role="alert" summary lists the field error after a failed submit', () => {
    render(
      <MantineProvider>
        <FormHarness />
      </MantineProvider>,
    )
    fireEvent.submit(screen.getByTestId('form'))

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain(REQUIRED)
  })
})
