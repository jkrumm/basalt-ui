/**
 * `inputProps` — the two-call boilerplate (`getInputProps()` + `key()`) collapsed into one object.
 * The deprecated `field` alias (see `field.ts`'s doc) must be the exact same function reference, not
 * just behaviorally equivalent — an identity check is what makes "it can never independently drift"
 * true rather than aspirational.
 */
import { useForm } from '@mantine/form'
import { renderHook } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { field, inputProps } from './field'

describe('field (deprecated alias)', () => {
  test('is the exact same function reference as inputProps', () => {
    expect(field).toBe(inputProps)
  })
})

describe('inputProps', () => {
  test('bundles getInputProps() plus the reconciler key into one object', () => {
    const { result } = renderHook(() => useForm({ initialValues: { email: '' } }))
    const form = result.current

    const props = inputProps(form, 'email')
    const expectedGetInputProps = form.getInputProps('email')

    // `getInputProps()` mints fresh handler closures on every call, so two separate calls never
    // compare equal by reference — the assertion is per-field: the reconciler key, and every
    // NON-function prop `getInputProps` returns, plus the handlers being callable at all.
    expect(props.key).toBe(form.key('email'))
    for (const [prop, value] of Object.entries(expectedGetInputProps)) {
      if (typeof value === 'function') {
        expect(typeof props[prop as keyof typeof props]).toBe('function')
        continue
      }
      expect(props[prop as keyof typeof props]).toEqual(value)
    }
  })
})
