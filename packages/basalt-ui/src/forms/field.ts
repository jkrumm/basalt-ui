/**
 * ./forms — field: DX helper for Mantine v9 uncontrolled fields.
 * Mantine-coupled. Optional peer: @mantine/form.
 */
import type { LooseKeys, UseFormReturnType } from '@mantine/form'

// ── field ─────────────────────────────────────────────────────────────────────

/**
 * Bundles the two props every Mantine v9 uncontrolled field needs — `getInputProps` spread
 * plus the reconciler `key` — into a single object. Eliminates the two-call boilerplate at
 * every field site.
 *
 * @example
 * import { useBasaltForm, field } from 'basalt-ui/forms'
 *
 * function MyForm() {
 *   const form = useBasaltForm({ initialValues: { email: '' } })
 *   return <TextInput {...field(form, 'email')} label="Email" />
 * }
 */
export function field<Values extends Record<string, unknown>, Path extends LooseKeys<Values>>(
  form: UseFormReturnType<Values>,
  path: Path,
): ReturnType<UseFormReturnType<Values>['getInputProps']> & { key: string } {
  return {
    ...form.getInputProps(path),
    key: form.key(path),
  }
}
