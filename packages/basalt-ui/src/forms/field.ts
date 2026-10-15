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
import type { GetInputPropsReturnType, LooseKeys, UseFormReturnType } from '@mantine/form'
import type { ReactNode } from 'react'

/**
 * What `inputProps` returns: Mantine's shape with `error` typed. `.error` is the one typed way to
 * read a field's error — Mantine's `form.errors` is an index signature (dot access is TS4111), and
 * a raw control inside `FormRow` takes it as `<FormRow error={inputProps(form, path).error}>`.
 * A Mantine input spread with `inputProps` already renders it; passing it to `FormRow` as well
 * renders it twice.
 */
export type InputProps = Omit<GetInputPropsReturnType, 'error'> & { error?: ReactNode }

type Depth = [unknown, unknown, unknown, unknown, unknown]

/** Dot paths of `T` whose value is a boolean (objects and arrays, five levels deep). */
type BooleanPath<T, D extends unknown[] = []> = D['length'] extends Depth['length']
  ? never
  : T extends readonly (infer V)[]
    ? (NonNullable<V> extends boolean ? `${number}` : never) | Nested<`${number}`, V, D>
    : T extends object
      ? {
          [K in keyof T & string]-?:
            | (NonNullable<T[K]> extends boolean ? K : never)
            | Nested<K, T[K], D>
        }[keyof T & string]
      : never

type Nested<K extends string, V, D extends unknown[]> =
  NonNullable<V> extends object ? `${K}.${BooleanPath<NonNullable<V>, [...D, unknown]>}` : never

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
): InputProps
/**
 * The boolean overload: `{ type: 'checkbox' }` returns `checked` / `onChange` for Mantine
 * `Checkbox` and `Switch`, and is only accepted on a path whose value is a boolean — a string
 * path is a type error, not a silently wrong binding.
 *
 * @example
 * <Switch key={fieldKey(form, 'active')} {...inputProps(form, 'active', { type: 'checkbox' })} />
 */
export function inputProps<
  Values extends Record<string, unknown>,
  Path extends BooleanPath<Values>,
>(form: UseFormReturnType<Values>, path: Path, options: { type: 'checkbox' }): InputProps
export function inputProps<Values extends Record<string, unknown>>(
  form: UseFormReturnType<Values>,
  path: string,
  options?: { type: 'checkbox' },
): InputProps {
  return options ? form.getInputProps(path, options) : form.getInputProps(path)
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
