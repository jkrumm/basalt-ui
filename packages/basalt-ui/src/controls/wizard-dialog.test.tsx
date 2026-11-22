/** `WizardDialog`: live preview, a gated primary, the review jump and a restored draft. */
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { z } from 'zod'
import type { FormLike } from '../core/ports'
import { Dialog, DialogContent } from '../ui/dialog'
import { WizardDialog, wizardDialogParts } from './wizard-dialog'

type Values = { name: string; plan: string; seats: number }
const EMPTY: Values = { name: '', plan: 'team', seats: 1 }

type Fake = FormLike<Values> & {
  handleSubmit(): void
  set(patch: Partial<Values>): void
  submitted: Values[]
}

/** A TanStack-shaped form: every edit notifies once, `defaultValues` stay put. */
function fakeForm(): Fake {
  let state = { values: EMPTY, isSubmitting: false, canSubmit: true, errors: [] as unknown[] }
  const options: FormLike<Values>['options'] = { defaultValues: EMPTY }
  const subs = new Set<() => void>()
  const emit = (): void => subs.forEach((cb) => cb())
  const submitted: Values[] = []
  return {
    get state() {
      return state
    },
    options,
    submitted,
    store: {
      subscribe(cb) {
        subs.add(cb)
        return { unsubscribe: () => void subs.delete(cb) }
      },
    },
    reset(values) {
      state = { ...state, values }
      emit()
    },
    set(patch) {
      state = { ...state, values: { ...state.values, ...patch } }
      emit()
    },
    handleSubmit() {
      submitted.push(state.values)
    },
  }
}

const STEPS = (form: Fake) =>
  [
    {
      label: 'Customer',
      title: 'Who is it for?',
      help: 'Name the customer.',
      render: () => (
        <input
          aria-label="Name"
          value={form.state.values.name}
          onChange={(e) => form.set({ name: e.target.value })}
        />
      ),
      valid: (v: Values) => v.name.trim().length > 1,
      summary: (v: Values) => [{ label: 'Name', value: v.name }],
    },
    {
      label: 'Plan',
      title: 'Pick a plan',
      render: () => <p>plan fields</p>,
      valid: (v: Values) => v.seats > 0,
      summary: (v: Values) => [
        { label: 'Plan', value: v.plan },
        { label: 'Seats', value: String(v.seats) },
      ],
    },
  ] as const

function mount(form: Fake, draft = false) {
  const steps = STEPS(form)
  return render(
    <Dialog defaultOpen>
      <DialogContent title="New contract" size="split">
        <WizardDialog
          form={form}
          steps={steps}
          preview={(v: Values) => <p data-testid="card">{v.name === '' ? 'Untitled' : v.name}</p>}
          submitLabel="Create contract"
          {...(draft && {
            draft: {
              key: 'contract',
              version: 1,
              owner: null,
              schema: z.object({ name: z.string(), plan: z.string(), seats: z.number() }),
            },
          })}
        />
      </DialogContent>
    </Dialog>,
  )
}

const primary = (): HTMLButtonElement =>
  document.querySelector<HTMLButtonElement>('[data-slot="wizard-footer"] button')!
const heading = (): string =>
  document.querySelector('[data-slot="wizard-heading"]')?.textContent ?? ''

beforeEach(() => {
  localStorage.clear()
})
afterEach(cleanup)

describe('WizardDialog', () => {
  test('every slot it renders is declared', () => {
    mount(fakeForm())
    for (const el of document.querySelectorAll('[data-slot^="wizard-"]'))
      expect(wizardDialogParts as readonly string[]).toContain(el.getAttribute('data-slot') ?? '')
  })

  test('the preview mirrors the form as it is edited', () => {
    const form = fakeForm()
    mount(form)
    expect(document.querySelector('[data-testid="card"]')?.textContent).toBe('Untitled')
    act(() => form.set({ name: 'Acme' }))
    expect(document.querySelector('[data-testid="card"]')?.textContent).toBe('Acme')
  })

  test('the primary is disabled until the step is valid, then continues', () => {
    const form = fakeForm()
    mount(form)
    expect(heading()).toBe('Who is it for?')
    expect(primary().hasAttribute('data-disabled')).toBe(true)
    act(() => form.set({ name: 'Acme' }))
    expect(primary().hasAttribute('data-disabled')).toBe(false)
    fireEvent.click(primary())
    expect(heading()).toBe('Pick a plan')
    expect(document.querySelector('[data-slot="wizard-counter"]')?.textContent).toBe('2/3')
  })

  test('Back returns to the previous step', () => {
    const form = fakeForm()
    form.set({ name: 'Acme' })
    mount(form)
    fireEvent.click(primary())
    fireEvent.click(document.querySelector('[aria-label="Back"]')!)
    expect(heading()).toBe('Who is it for?')
  })

  test('the review lists every answer, jumps back to a step and submits once', () => {
    const form = fakeForm()
    form.set({ name: 'Acme' })
    mount(form)
    fireEvent.click(primary())
    fireEvent.click(primary())
    expect(heading()).toBe('Review')
    const rows = [...document.querySelectorAll('[data-slot="wizard-review-row"]')]
    expect(rows.map((r) => r.querySelector('dt')?.textContent)).toEqual(['Name', 'Plan', 'Seats'])
    fireEvent.click(document.querySelector('[aria-label="Edit Plan"]')!)
    expect(heading()).toBe('Pick a plan')
    fireEvent.click(primary())
    expect(primary().textContent).toBe('Create contract')
    fireEvent.click(primary())
    expect(form.submitted).toEqual([{ name: 'Acme', plan: 'team', seats: 1 }])
  })

  test('a draft restored after a reload opens on the first step that is not valid', async () => {
    const first = fakeForm()
    const view = mount(first, true)
    act(() => first.set({ name: 'Acme', seats: 0 }))
    view.unmount()
    cleanup()

    const second = fakeForm()
    await act(async () => {
      mount(second, true)
    })
    expect(second.state.values.name).toBe('Acme')
    expect(heading()).toBe('Pick a plan')
  })
})
