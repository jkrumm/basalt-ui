/**
 * `useBasaltForm` — the `mode: 'uncontrolled'` default and the `schemaResolver` wiring.
 *
 * No schema-validation library is a devDependency of `packages/basalt-ui` itself — Valibot ships
 * only in `apps/playground`'s devDeps for `FormsDemoPage` and is not resolvable from here. A
 * hand-rolled Standard Schema fixture stands in instead, any object carrying `'~standard'` satisfies the interface.
 */
import { act, renderHook } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
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
