/**
 * ./forms — useFormSubmit: the submit lifecycle Mantine leaves to every call site.
 * Mantine-coupled. Optional peer: @mantine/form.
 *
 * The gap (audit B §4): `form.onSubmit` gives you validation and a `submitting` flag and nothing
 * else. A real submit also has to catch the handler's throw, turn it into a message a human can
 * read, route a server's per-FIELD errors back onto the fields, and put the caret on the first
 * thing that is wrong. Four jobs, re-written per form, and the last one is the one everybody skips.
 */
import { useCallback, useRef, useState } from 'react'
import type { SyntheticEvent } from 'react'
import type { UseFormReturnType } from '@mantine/form'
import { toErrorMessage } from '../common/errors'

// ── The server field-error envelope ───────────────────────────────────────────

/**
 * Per-field messages keyed by the same dotted paths `inputProps(form, path)` uses
 * (`'email'`, `'addresses.0.city'`). The shape a server returns for a 422, and the shape
 * `validateAsync` returns for a uniqueness check.
 */
export type FormFieldErrors = Record<string, string>

/**
 * Whether a thrown value carries `{ fieldErrors }` — the envelope `useFormSubmit` routes back onto
 * the fields instead of into one form-level message.
 *
 * Structural, not `instanceof`: the throw crosses a transport (Eden, `fetch`, a mutation wrapper)
 * and arrives as a plain object, so an `Error` subclass would only match the one shape basalt
 * itself constructed. The keys are checked to be STRINGS — a `{ fieldErrors: { email: 422 } }`
 * would otherwise reach `form.setErrors` and render a number under an input.
 *
 * @example
 * throw Object.assign(new Error('Validation failed'), { fieldErrors: { email: 'Already taken' } })
 */
export function isFieldErrorEnvelope(err: unknown): err is { fieldErrors: FormFieldErrors } {
  if (err === null || typeof err !== 'object') return false
  const fieldErrors = (err as { fieldErrors?: unknown }).fieldErrors
  if (fieldErrors === null || typeof fieldErrors !== 'object' || Array.isArray(fieldErrors)) {
    return false
  }
  return Object.values(fieldErrors).every((message) => typeof message === 'string')
}

// ── Focus-first-error ─────────────────────────────────────────────────────────

/**
 * Puts the caret on the first errored field. `form.getInputNode(path)` is Mantine v9's own lookup
 * (a `[data-path]` query over the attribute `getInputProps` writes, verified in the installed
 * 9.3.2 source); the `[name]` query is the fallback for a control that spreads its own props and
 * never got the attribute.
 *
 * Order is the ERROR RECORD's key order, not the DOM's: Mantine builds it from the schema, so it is
 * the order the fields were declared in — which for a form written top-to-bottom is the visual
 * order, and unlike a DOM sweep it costs no traversal.
 *
 * A no-op without a document (SSR), because `getInputNode` reaches straight for `document`.
 */
function focusFirstError<Values extends Record<string, unknown>>(
  form: UseFormReturnType<Values>,
  errors: Record<string, unknown>,
): void {
  if (typeof document === 'undefined') return
  for (const [path, message] of Object.entries(errors)) {
    if (message === null || message === undefined || message === false) continue
    const node =
      form.getInputNode<HTMLElement, string>(path) ??
      document.querySelector<HTMLElement>(`[name="${path}"]`)
    if (node !== null) {
      node.focus()
      return
    }
  }
}

// ── useFormSubmit ─────────────────────────────────────────────────────────────

export type UseFormSubmitOptions<Values extends Record<string, unknown>> = {
  /** Ran after the handler resolves. The success path — close the modal, clear the draft, navigate. */
  onSuccess?: (values: Values) => void
  /** Ran on any throw, after `submitError` is set. For telemetry or a toast; not required for either. */
  onError?: (err: unknown) => void
  /**
   * Turns a thrown value into the message `submitError` carries. Defaults to `toErrorMessage`
   * (`basalt-ui/query`), which already unwraps `Error`, `{ message }` and Eden's `{ status, value }`.
   * Override it to brand the copy or to branch on `errorStatus(err)`.
   */
  mapError?: (err: unknown) => string
  /**
   * The async half of validation, run AFTER the schema passes and BEFORE the handler — a uniqueness
   * check, a server-side cross-field rule, anything that needs the network.
   *
   * It lives here rather than on `useBasaltForm` because that hook hard-codes
   * `schemaResolver(schema, { sync: true })` so `validate()`/`isValid()` stay synchronous for every
   * field-level read. Moving the async rule to submit time keeps that property AND gives the rule a
   * home; the cost, stated plainly, is that it does not run on blur.
   *
   * Return `null` (or an empty record) for "valid". Anything else is set on the fields, the first
   * one is focused, and the handler never runs.
   */
  validateAsync?: (values: Values) => Promise<FormFieldErrors | null>
}

export type UseFormSubmitReturn = {
  /** Hand straight to `<form onSubmit={submit}>`, or call it from a button's `onClick`. */
  submit: (event?: SyntheticEvent<HTMLFormElement>) => void
  /** True from the moment a submit starts until the handler settles. Mantine's own `form.submitting`. */
  isSubmitting: boolean
  /** The form-level failure message, or `null`. Cleared at the start of every submit. */
  submitError: string | null
  /** Clears `submitError` without submitting — for a "dismiss" on the error banner. */
  reset: () => void
}

/**
 * Wraps `form.onSubmit` with the four things a real submit needs: a busy flag, a caught and decoded
 * error, a server field-error envelope routed back onto the fields, and focus on the first thing
 * that is wrong.
 *
 * **`isSubmitting` IS `form.submitting`**, not a second piece of state beside it. Mantine already
 * flips that flag around a handler returning a promise, and this handler always does; duplicating it
 * would give a form two busy flags that can disagree, which is the failure a `FormStateProvider`
 * reading the wrong one produces.
 *
 * **Focus moves on BOTH failure paths** — a schema failure (through `onSubmit`'s own
 * `handleValidationFailure`) and a thrown `{ fieldErrors }` envelope. A server's 422 lands exactly
 * where a client-side error does.
 *
 * @example
 * const { submit, isSubmitting, submitError } = useFormSubmit(
 *   form,
 *   async (values) => { await unwrap(api.users.post({ body: values })) },
 *   { onSuccess: () => { clearDraft(); close() }, validateAsync: checkHandleFree },
 * )
 *
 * <form onSubmit={submit}>
 *   <FormStateProvider submitting={isSubmitting}>
 *     {submitError !== null && <Alert color="red">{submitError}</Alert>}
 *     …
 *   </FormStateProvider>
 * </form>
 */
export function useFormSubmit<Values extends Record<string, unknown>>(
  form: UseFormReturnType<Values>,
  handler: (values: Values) => void | Promise<void>,
  options: UseFormSubmitOptions<Values> = {},
): UseFormSubmitReturn {
  const [submitError, setSubmitError] = useState<string | null>(null)

  // The handler and the callbacks are read at FIRE time, never captured into a memo: a submit
  // handler closes over the freshest props by definition, and a stale one here would post the
  // previous render's values.
  const handlerRef = useRef(handler)
  handlerRef.current = handler
  const optionsRef = useRef(options)
  optionsRef.current = options
  const formRef = useRef(form)
  formRef.current = form

  const submit = form.onSubmit(
    async (values) => {
      const { onSuccess, onError, mapError, validateAsync } = optionsRef.current
      setSubmitError(null)
      try {
        const fieldErrors = await validateAsync?.(values)
        if (fieldErrors !== undefined && fieldErrors !== null && hasEntries(fieldErrors)) {
          applyFieldErrors(formRef.current, fieldErrors)
          return
        }
        await handlerRef.current(values)
        onSuccess?.(values)
      } catch (err) {
        // Both, not either: the envelope's per-field messages go on the fields AND its decoded
        // message goes in the banner. A 422 whose fields are all off-screen would otherwise report
        // nothing at all where the user is looking.
        if (isFieldErrorEnvelope(err)) applyFieldErrors(formRef.current, err.fieldErrors)
        setSubmitError(mapError === undefined ? toErrorMessage(err) : mapError(err))
        onError?.(err)
      }
    },
    (errors) => focusFirstError(formRef.current, errors),
  )

  const reset = useCallback(() => setSubmitError(null), [])

  return { submit, isSubmitting: form.submitting, submitError, reset }
}

function hasEntries(errors: FormFieldErrors): boolean {
  return Object.keys(errors).length > 0
}

function applyFieldErrors<Values extends Record<string, unknown>>(
  form: UseFormReturnType<Values>,
  fieldErrors: FormFieldErrors,
): void {
  form.setErrors(fieldErrors)
  focusFirstError(form, fieldErrors)
}
