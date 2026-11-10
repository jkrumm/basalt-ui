/**
 * `isPristine` — structural compare of a form's values against its default values. Internal.
 *
 * Fields that were never mounted still count: a key present in both sides with the same value is
 * pristine, which a per-field dirty flag cannot say.
 */

type FormLike = {
  state: { values: unknown }
  options: { defaultValues?: unknown }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (typeof v !== 'object' || v === null) return false
  const proto = Object.getPrototypeOf(v) as unknown
  return proto === Object.prototype || proto === null
}

function equal(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && Object.is(a.getTime(), b.getTime())
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((item, i) => equal(item, b[i]))
  }
  if (!isPlainObject(a) || !isPlainObject(b)) return false
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) {
    if (!equal(a[key], b[key])) return false
  }
  return true
}

export function isPristine(form: FormLike): boolean {
  return equal(form.state.values, form.options.defaultValues ?? {})
}
