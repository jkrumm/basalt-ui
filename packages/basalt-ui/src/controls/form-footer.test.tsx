/** `FormFooter`: the primary submits and follows `canSubmit`, `aria-busy` tracks `isSubmitting`. */
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { FormLike } from '../core/ports'
import { FormFooter } from './form-footer'

afterEach(cleanup)

function fakeForm() {
  let state = { values: {}, isSubmitting: false, canSubmit: true, errors: [] as unknown[] }
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

describe('FormFooter', () => {
  test('the primary is the submit button; the others are plain buttons', () => {
    const form = fakeForm()
    let cancelled = 0
    const { getByText } = render(
      <FormFooter
        form={form}
        actions={[
          { label: 'Cancel', onClick: () => void (cancelled += 1) },
          { label: 'Save', primary: true },
        ]}
      />,
    )
    expect(getByText('Save').closest('button')!.getAttribute('type')).toBe('submit')
    fireEvent.click(getByText('Cancel'))
    expect(cancelled).toBe(1)
    expect(getByText('Cancel').closest('button')!.getAttribute('type')).toBe('button')
  })

  test('the primary is disabled on !canSubmit and aria-busy tracks isSubmitting', () => {
    const form = fakeForm()
    const { container, getByText } = render(
      <FormFooter form={form} actions={[{ label: 'Save', primary: true }]} />,
    )
    const footer = container.querySelector('[data-slot="form-footer"]')!
    const save = getByText('Save').closest('button')!
    expect(save.hasAttribute('disabled') || save.hasAttribute('data-disabled')).toBe(false)
    expect(footer.getAttribute('aria-busy')).toBe('false')
    act(() => form.patch({ canSubmit: false }))
    expect(save.hasAttribute('disabled') || save.hasAttribute('data-disabled')).toBe(true)
    act(() => form.patch({ canSubmit: true, isSubmitting: true }))
    expect(footer.getAttribute('aria-busy')).toBe('true')
    act(() => form.patch({ isSubmitting: false }))
    expect(footer.getAttribute('aria-busy')).toBe('false')
  })

  test('a form-level error shows in the live region', () => {
    const form = fakeForm()
    const { container } = render(
      <FormFooter form={form} actions={[{ label: 'Save', primary: true }]} />,
    )
    const region = container.querySelector('[data-slot="form-footer-error"]')!
    expect(region.textContent).toBe('')
    act(() => form.patch({ errors: ['Server down'] }))
    expect(region.textContent).toBe('Server down')
  })
})
