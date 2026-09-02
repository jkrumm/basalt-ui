/**
 * `FormStateProvider` / `useFormState` — the context's two laws, both of which are only visible
 * from the HOOK side.
 *
 * `form-layout.test.tsx` proves the rendered consequence (three `<fieldset disabled>`s), which is
 * what the browser acts on. It cannot see the resolution itself: that `disabled` is already true
 * while `submitting` is (so no call site ever writes `disabled || submitting`), and that nesting
 * ORs in BOTH fields rather than replacing them. A regression in either would keep every markup
 * assertion green and hand a custom control — the one kind `<fieldset>` cannot reach — the wrong
 * verdict.
 */
import { renderHook } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { FormStateProvider, useFormState } from './form-state'
import type { ReactNode } from 'react'

function read(wrapper?: (children: ReactNode) => ReactNode) {
  return renderHook(() => useFormState(), {
    ...(wrapper !== undefined && {
      wrapper: ({ children }: { children: ReactNode }) => <>{wrapper(children)}</>,
    }),
  }).result.current
}

describe('outside any provider', () => {
  // A control is never disabled by accident of placement — the default is the enabled form.
  test('reads the enabled default rather than throwing', () => {
    expect(read()).toEqual({ disabled: false, submitting: false })
  })
})

describe('one provider', () => {
  test('`submitting` implies `disabled`, so a call site never ORs the two itself', () => {
    expect(read((c) => <FormStateProvider submitting>{c}</FormStateProvider>)).toEqual({
      disabled: true,
      submitting: true,
    })
  })

  test('`disabled` alone does NOT imply submitting — the reason stays distinguishable', () => {
    expect(read((c) => <FormStateProvider disabled>{c}</FormStateProvider>)).toEqual({
      disabled: true,
      submitting: false,
    })
  })
})

describe('nesting ORs, it never resets', () => {
  test('an inner provider disables a subsection of an enabled form', () => {
    const state = read((c) => (
      <FormStateProvider>
        <FormStateProvider disabled>{c}</FormStateProvider>
      </FormStateProvider>
    ))
    expect(state).toEqual({ disabled: true, submitting: false })
  })

  test('an inner `disabled={false}` cannot re-enable a disabled subsection', () => {
    const state = read((c) => (
      <FormStateProvider disabled>
        <FormStateProvider disabled={false}>{c}</FormStateProvider>
      </FormStateProvider>
    ))
    expect(state).toEqual({ disabled: true, submitting: false })
  })

  // The one that would be a double-submit: a form that is submitting is submitting everywhere.
  test('an inner `submitting={false}` cannot unset a submit in flight', () => {
    const state = read((c) => (
      <FormStateProvider submitting>
        <FormStateProvider submitting={false}>{c}</FormStateProvider>
      </FormStateProvider>
    ))
    expect(state).toEqual({ disabled: true, submitting: true })
  })

  test('an inner `submitting` propagates UP the resolved verdict, three levels deep', () => {
    const state = read((c) => (
      <FormStateProvider>
        <FormStateProvider>
          <FormStateProvider submitting>{c}</FormStateProvider>
        </FormStateProvider>
      </FormStateProvider>
    ))
    expect(state).toEqual({ disabled: true, submitting: true })
  })
})
