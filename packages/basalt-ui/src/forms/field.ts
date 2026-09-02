/**
 * ./forms — inputProps + fieldKey: the two-call idiom every Mantine v9 uncontrolled field needs.
 * Mantine-coupled. Optional peer: @mantine/form.
 *
 * **`key` is NOT in `inputProps`' return, and that is the whole point of this file's shape.**
 * It used to be — one object holding `getInputProps(path)` and `form.key(path)` together, so a
 * single spread covered both. React 19 logs
 * `A props object containing a "key" prop is being spread into JSX` on every such render: a spread
 * `key` is read as the element key but the warning says it is deprecated, and three fields meant
 * three warnings per page. The bundle was basalt's own invention; Mantine's documented idiom is
 * `key={form.key(path)} {...form.getInputProps(path)}`, and this is that idiom with basalt's names.
 *
 * The `@deprecated` `field` alias that used to live here is removed (1.29.0, C1 consolidation) —
 * `basalt-ui/forms`' `field` collided in name with the `field` store builder on `basalt-ui/state`,
 * which was the whole reason for the rename in the first place. Write
 * `key={fieldKey(form, path)} {...inputProps(form, path)}`.
 */
import type { LooseKeys, UseFormReturnType } from '@mantine/form'

// ── inputProps ────────────────────────────────────────────────────────────────

/**
 * The spread half: `form.getInputProps(path)`, and nothing else.
 *
 * Pair it with {@link fieldKey} — an uncontrolled field renders from a `defaultValue`, so without
 * the reconciler key React reuses the DOM node and `form.reset()` / `setValues()` / a removed list
 * row leave the old text on screen.
 *
 * @example
 * import { useBasaltForm, inputProps, fieldKey } from 'basalt-ui/forms'
 *
 * function MyForm() {
 *   const form = useBasaltForm({ initialValues: { email: '' } })
 *   return <TextInput key={fieldKey(form, 'email')} {...inputProps(form, 'email')} label="Email" />
 * }
 */
export function inputProps<Values extends Record<string, unknown>, Path extends LooseKeys<Values>>(
  form: UseFormReturnType<Values>,
  path: Path,
): ReturnType<UseFormReturnType<Values>['getInputProps']> {
  return form.getInputProps(path)
}

/**
 * The key half: `form.key(path)`, as a JSX `key` attribute — never spread.
 *
 * A separate call rather than a second member of {@link inputProps}' object, because an object
 * carrying `key` cannot be spread without React 19 warning about it. Two calls on one line is the
 * cost; a clean console and a reconciler that actually resets its inputs is what it buys.
 *
 * @example
 * <TextInput key={fieldKey(form, 'email')} {...inputProps(form, 'email')} />
 */
export function fieldKey<Values extends Record<string, unknown>, Path extends LooseKeys<Values>>(
  form: UseFormReturnType<Values>,
  path: Path,
): string {
  return form.key(path)
}
