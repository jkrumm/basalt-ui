/**
 * `toSubmitErrors`: a form's `onSubmitAsync` validator over a save function. A save that resolves
 * returns no error; a save that throws (an `unwrap`ped `{ data, error }` envelope, a `fetch` failure)
 * becomes the form's error shape: field messages by field name and one form-level message. TanStack
 * Form clears them on the next change.
 */

import type { SubmitErrors, ToSubmitErrors } from './contract'

const FALLBACK = 'The request failed. Try again.'

function text(value: unknown): string | undefined {
  if (typeof value === 'string') return value === '' ? undefined : value
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = text(entry)
      if (found !== undefined) return found
    }
    return undefined
  }
  if (typeof value === 'object' && value !== null) {
    const message = (value as { message?: unknown }).message
    return typeof message === 'string' && message !== '' ? message : undefined
  }
  return undefined
}

function fieldsOf(value: unknown): Record<string, string> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const fields: Record<string, string> = {}
  for (const [name, entry] of Object.entries(value)) {
    const message = text(entry)
    if (message !== undefined) fields[name] = message
  }
  return Object.keys(fields).length === 0 ? undefined : fields
}

/** Reads a thrown value: `{ fieldErrors, message }`, an Eden `{ status, value }` wrapper, an `Error`, a string. */
function read(thrown: unknown, depth = 0): SubmitErrors {
  if (typeof thrown === 'string') return { form: text(thrown) ?? FALLBACK }
  if (typeof thrown !== 'object' || thrown === null) return { form: FALLBACK }
  const record = thrown as { fieldErrors?: unknown; message?: unknown; value?: unknown }
  const fields = fieldsOf(record.fieldErrors)
  const form = text(record.message)
  if (fields !== undefined || form !== undefined) {
    return { ...(form !== undefined && { form }), ...(fields !== undefined && { fields }) }
  }
  if (depth < 2 && record.value !== undefined) return read(record.value, depth + 1)
  return { form: FALLBACK }
}

/**
 * Wraps a save as `validators.onSubmitAsync`. Pass a save that throws on failure: `(v) =>
 * api.runs.put(v).then(unwrap)`.
 *
 * @useWhen a submit saves to a server whose errors must land on the fields and the form
 * @neverWhen the schema alone validates the form
 *
 * @example
 * const form = useForm({ defaultValues, validators: { onSubmitAsync: toSubmitErrors(save) } })
 */
export function toSubmitErrors<V>(save: (value: V) => Promise<unknown>): ToSubmitErrors<V> {
  return async ({ value }) => {
    try {
      await save(value)
      return undefined
    } catch (thrown) {
      return read(thrown)
    }
  }
}
