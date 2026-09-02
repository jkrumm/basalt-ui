/**
 * `useFormSubmit` — the four jobs it exists to stop a consumer re-writing, each asserted against a
 * real async handler rather than a resolved stub: the pending window, the caught-and-decoded
 * throw, the server field-error envelope, and focus landing on the first errored field.
 *
 * The handler is a deferred promise the test resolves by hand — a handler that has already settled
 * makes the pending assertion vacuously true, which is exactly how an `isSubmitting` that never
 * flips ships green.
 *
 * DOM harness (`tests/setup/dom.ts`) rather than SSR markup: focus is the assertion, and focus is
 * live-DOM behaviour.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { useBasaltForm } from './create-form'
import { fieldKey, inputProps } from './field'
import { isFieldErrorEnvelope, useFormSubmit } from './use-form-submit'
import type { FormFieldErrors, UseFormSubmitOptions } from './use-form-submit'
import type { StandardSchemaV1 } from '../register'

type Values = { email: string; name: string }

const INITIAL: Values = { email: '', name: '' }
const EMAIL_REQUIRED = 'Email is required'

/** A hand-rolled Standard Schema, for the reason `create-form.test.tsx` states: no schema lib here. */
function emailRequiredSchema(): StandardSchemaV1<unknown, Values> {
  return {
    '~standard': {
      version: 1,
      vendor: 'basalt-test-fixture',
      validate: (raw) => {
        const values = raw as Values
        if (values.email.trim().length === 0) {
          return { issues: [{ message: EMAIL_REQUIRED, path: ['email'] }] }
        }
        return { value: values }
      },
    },
  }
}

/** A promise the test settles, so the pending window is observable. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (err: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

type HarnessProps = {
  handler: (values: Values) => Promise<void>
  options?: UseFormSubmitOptions<Values>
  withSchema?: boolean
  initialValues?: Values
}

function Harness({ handler, options, withSchema = false, initialValues = INITIAL }: HarnessProps) {
  const form = useBasaltForm<Values>({
    initialValues,
    ...(withSchema && { schema: emailRequiredSchema() }),
  })
  const { submit, isSubmitting, submitError, reset } = useFormSubmit(form, handler, options ?? {})
  return (
    <form data-testid="form" onSubmit={submit}>
      <input key={fieldKey(form, 'email')} {...inputProps(form, 'email')} aria-label="Email" />
      <input key={fieldKey(form, 'name')} {...inputProps(form, 'name')} aria-label="Name" />
      <output data-testid="submitting">{String(isSubmitting)}</output>
      <output data-testid="error">{submitError ?? ''}</output>
      <output data-testid="email-error">{String(form.errors['email'] ?? '')}</output>
      <button type="button" onClick={reset}>
        Dismiss
      </button>
      <button type="submit">Save</button>
    </form>
  )
}

const submitForm = () => fireEvent.submit(screen.getByTestId('form'))
const text = (id: string) => screen.getByTestId(id).textContent

describe('isFieldErrorEnvelope', () => {
  test('accepts a plain object of string messages, wherever it was thrown from', () => {
    expect(isFieldErrorEnvelope({ fieldErrors: { email: 'Taken' } })).toBe(true)
    expect(
      isFieldErrorEnvelope(Object.assign(new Error('422'), { fieldErrors: { email: 'Taken' } })),
    ).toBe(true)
  })

  test('rejects everything that would render a non-message under an input', () => {
    expect(isFieldErrorEnvelope(new Error('boom'))).toBe(false)
    expect(isFieldErrorEnvelope(null)).toBe(false)
    expect(isFieldErrorEnvelope({ fieldErrors: null })).toBe(false)
    expect(isFieldErrorEnvelope({ fieldErrors: ['Taken'] })).toBe(false)
    expect(isFieldErrorEnvelope({ fieldErrors: { email: 422 } })).toBe(false)
  })
})

describe('the pending window', () => {
  test('isSubmitting is true while the handler is in flight and false once it settles', async () => {
    const gate = deferred<void>()
    render(<Harness handler={() => gate.promise} initialValues={{ email: 'a@b.c', name: 'Ada' }} />)
    expect(text('submitting')).toBe('false')

    act(submitForm)
    await waitFor(() => expect(text('submitting')).toBe('true'))

    await act(async () => {
      gate.resolve()
      await gate.promise
    })
    await waitFor(() => expect(text('submitting')).toBe('false'))
  })
})

describe('the success path', () => {
  test('the handler receives the values and onSuccess runs after it', async () => {
    const seen: string[] = []
    render(
      <Harness
        handler={async (values) => {
          seen.push(`handler:${values.email}`)
        }}
        options={{ onSuccess: (values) => seen.push(`success:${values.email}`) }}
        initialValues={{ email: 'a@b.c', name: 'Ada' }}
      />,
    )
    act(submitForm)
    await waitFor(() => expect(seen).toEqual(['handler:a@b.c', 'success:a@b.c']))
    expect(text('error')).toBe('')
  })
})

describe('a thrown Error', () => {
  test('is caught, decoded through toErrorMessage into submitError, and reported to onError', async () => {
    const seen: unknown[] = []
    render(
      <Harness
        handler={() => Promise.reject(new Error('Upstream refused'))}
        options={{ onError: (err) => seen.push(err) }}
        initialValues={{ email: 'a@b.c', name: 'Ada' }}
      />,
    )
    act(submitForm)
    await waitFor(() => expect(text('error')).toBe('Upstream refused'))
    expect(seen).toHaveLength(1)
    // The throw does not leave the form busy — the failure path settles the flag too.
    expect(text('submitting')).toBe('false')
  })

  test('mapError replaces the default decoding', async () => {
    render(
      <Harness
        handler={() => Promise.reject(new Error('ECONNRESET'))}
        options={{ mapError: () => 'Could not save the profile' }}
        initialValues={{ email: 'a@b.c', name: 'Ada' }}
      />,
    )
    act(submitForm)
    await waitFor(() => expect(text('error')).toBe('Could not save the profile'))
  })

  test('reset() clears the banner without re-submitting', async () => {
    render(
      <Harness
        handler={() => Promise.reject(new Error('Upstream refused'))}
        initialValues={{ email: 'a@b.c', name: 'Ada' }}
      />,
    )
    act(submitForm)
    await waitFor(() => expect(text('error')).toBe('Upstream refused'))
    act(() => {
      fireEvent.click(screen.getByText('Dismiss'))
    })
    expect(text('error')).toBe('')
  })
})

describe('the server field-error envelope', () => {
  test('routes onto the fields AND still states a form-level message', async () => {
    render(
      <Harness
        handler={() =>
          Promise.reject(
            Object.assign(new Error('Validation failed'), {
              fieldErrors: { email: 'Already registered' },
            }),
          )
        }
        initialValues={{ email: 'a@b.c', name: 'Ada' }}
      />,
    )
    act(submitForm)
    await waitFor(() => expect(text('email-error')).toBe('Already registered'))
    expect(text('error')).toBe('Validation failed')
  })

  test('the errored field takes focus', async () => {
    render(
      <Harness
        handler={() => Promise.reject({ fieldErrors: { name: 'Reserved' } })}
        initialValues={{ email: 'a@b.c', name: 'root' }}
      />,
    )
    act(submitForm)
    // Two separate waits so a failure names its half: the envelope reaching the field, then the
    // focus that applyFieldErrors places synchronously after it.
    await waitFor(() => expect(text('error')).not.toBe(''))
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Name')))
  })
})

describe('focus-first-error on a failed schema validation', () => {
  test('the first errored field is focused, and the handler never runs', async () => {
    let called = 0
    render(
      <Harness
        withSchema
        handler={async () => {
          called += 1
        }}
      />,
    )
    act(submitForm)
    await waitFor(() => expect(screen.getByLabelText('Email')).toHaveProperty('value', ''))
    expect(document.activeElement).toBe(screen.getByLabelText('Email'))
    expect(called).toBe(0)
  })
})

describe('validateAsync', () => {
  test('runs after the schema and before the handler, and blocks it when it reports', async () => {
    const order: string[] = []
    const validateAsync = async (values: Values): Promise<FormFieldErrors | null> => {
      order.push('async')
      return values.email === 'taken@b.c' ? { email: 'Already registered' } : null
    }
    render(
      <Harness
        withSchema
        handler={async () => {
          order.push('handler')
        }}
        options={{ validateAsync }}
        initialValues={{ email: 'taken@b.c', name: 'Ada' }}
      />,
    )
    act(submitForm)
    await waitFor(() => expect(text('email-error')).toBe('Already registered'))
    expect(order).toEqual(['async'])
    expect(document.activeElement).toBe(screen.getByLabelText('Email'))
    // Blocked, not failed: no form-level banner for a field-level verdict.
    expect(text('error')).toBe('')
  })

  test('a null verdict lets the handler through', async () => {
    const order: string[] = []
    render(
      <Harness
        withSchema
        handler={async () => {
          order.push('handler')
        }}
        options={{ validateAsync: async () => null }}
        initialValues={{ email: 'free@b.c', name: 'Ada' }}
      />,
    )
    act(submitForm)
    await waitFor(() => expect(order).toEqual(['handler']))
  })

  test('the sync schema still runs FIRST — a bad value never reaches the network', async () => {
    let asyncRuns = 0
    render(
      <Harness
        withSchema
        handler={async () => {}}
        options={{
          validateAsync: async () => {
            asyncRuns += 1
            return null
          },
        }}
      />,
    )
    act(submitForm)
    await waitFor(() => expect(text('email-error')).toBe(EMAIL_REQUIRED))
    expect(asyncRuns).toBe(0)
  })
})
