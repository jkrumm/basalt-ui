/** `FormFooter`: the primary submits and stays enabled while invalid, `aria-busy` tracks `isSubmitting`. */
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { FormLike } from '../core/ports'
import { FormFooter } from './form-footer'

afterEach(cleanup)

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

  test('the primary stays enabled on !canSubmit, so a click shows the errors; aria-busy tracks isSubmitting', () => {
    const form = fakeForm()
    const { container, getByText } = render(
      <FormFooter form={form} actions={[{ label: 'Save', primary: true }]} />,
    )
    const footer = container.querySelector('[data-slot="form-footer"]')!
    const save = getByText('Save').closest('button')!
    expect(save.hasAttribute('disabled') || save.hasAttribute('data-disabled')).toBe(false)
    expect(footer.getAttribute('aria-busy')).toBe('false')
    act(() => form.patch({ canSubmit: false }))
    expect(save.hasAttribute('disabled') || save.hasAttribute('data-disabled')).toBe(false)
    act(() => form.patch({ canSubmit: true, isSubmitting: true }))
    expect(footer.getAttribute('aria-busy')).toBe('true')
    act(() => form.patch({ isSubmitting: false }))
    expect(footer.getAttribute('aria-busy')).toBe('false')
  })

  test('sticky: the row is a sticky band and says when the form is dirty', () => {
    const form = fakeForm()
    const { container } = render(
      <FormFooter sticky form={form} actions={[{ label: 'Save', primary: true }]} />,
    )
    const footer = container.querySelector('[data-slot="form-footer"]')!
    expect(footer.hasAttribute('data-sticky')).toBe(true)
    expect(footer.className).toContain('sticky')
    const status = container.querySelector('[data-slot="form-footer-status"]')!
    expect(status.textContent).toBe('')
    act(() => form.patch({ isDirty: true }))
    expect(status.textContent).toBe('Unsaved changes')
    expect(footer.hasAttribute('data-dirty')).toBe(true)
  })

  test('not sticky: no status line and no band', () => {
    const form = fakeForm()
    const { container } = render(
      <FormFooter form={form} actions={[{ label: 'Save', primary: true }]} />,
    )
    expect(container.querySelector('[data-slot="form-footer-status"]')).toBeNull()
    expect(container.querySelector('[data-slot="form-footer"]')!.className).not.toContain('sticky')
  })

  test('a rejected submit moves focus to the first invalid control of the form', async () => {
    const form = fakeForm()
    const { getByText, getByLabelText } = render(
      <form
        onSubmit={(event) => {
          event.preventDefault()
        }}
      >
        <input aria-label="Name" />
        <input aria-label="Email" aria-invalid="true" />
        <FormFooter form={form} actions={[{ label: 'Save', primary: true }]} />
      </form>,
    )
    fireEvent.click(getByText('Save'))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(document.activeElement).toBe(getByLabelText('Email'))
  })

  test("an invalid control that is not rendered hands focus to its field's visible control", async () => {
    const form = fakeForm()
    const { getByText, getByRole } = render(
      <form
        onSubmit={(event) => {
          event.preventDefault()
        }}
      >
        <div data-slot="field">
          <input aria-label="File" aria-invalid="true" hidden />
          <button type="button">Choose a file</button>
        </div>
        <input aria-label="Email" aria-invalid="true" />
        <FormFooter form={form} actions={[{ label: 'Save', primary: true }]} />
      </form>,
    )
    // happy-dom lays nothing out, so say which elements have boxes.
    const proto = HTMLElement.prototype as unknown as { getClientRects: () => unknown[] }
    const original = proto.getClientRects
    proto.getClientRects = function (this: HTMLElement) {
      return this.hidden ? [] : [{}]
    }
    fireEvent.click(getByText('Save'))
    await new Promise((resolve) => setTimeout(resolve, 50))
    proto.getClientRects = original
    expect(document.activeElement).toBe(getByRole('button', { name: 'Choose a file' }))
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

  test('a toSubmitErrors form-level error (`{ form }`) shows in the live region', () => {
    const form = fakeForm()
    const { container } = render(
      <FormFooter form={form} actions={[{ label: 'Save', primary: true }]} />,
    )
    const region = container.querySelector('[data-slot="form-footer-error"]')!
    act(() => form.patch({ errors: [{ form: 'Boom' }] }))
    expect(region.textContent).toBe('Boom')
  })
})
