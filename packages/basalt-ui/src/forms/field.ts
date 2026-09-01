/**
 * ./forms — inputProps: DX helper for Mantine v9 uncontrolled fields.
 * Mantine-coupled. Optional peer: @mantine/form.
 */
import type { LooseKeys, UseFormReturnType } from '@mantine/form'

// ── inputProps ────────────────────────────────────────────────────────────────

/**
 * Bundles the two props every Mantine v9 uncontrolled field needs — `getInputProps` spread
 * plus the reconciler `key` — into a single object. Eliminates the two-call boilerplate at
 * every field site.
 *
 * @example
 * import { useBasaltForm, inputProps } from 'basalt-ui/forms'
 *
 * function MyForm() {
 *   const form = useBasaltForm({ initialValues: { email: '' } })
 *   return <TextInput {...inputProps(form, 'email')} label="Email" />
 * }
 */
export function inputProps<Values extends Record<string, unknown>, Path extends LooseKeys<Values>>(
  form: UseFormReturnType<Values>,
  path: Path,
): ReturnType<UseFormReturnType<Values>['getInputProps']> & { key: string } {
  return {
    ...form.getInputProps(path),
    key: form.key(path),
  }
}

/**
 * @deprecated Renamed to `inputProps` in 1.x — collides with the `field` store builder in
 * `basalt-ui/state`. Kept as an alias until the forms surface next changes; removal ships as a
 * plain `feat:`, never a major.
 */
export const field = inputProps
