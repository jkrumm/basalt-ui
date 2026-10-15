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
 * What `inputProps` returns: Mantine's shape with `error` typed (`any` upstream). `error` is always
 * present — Mantine sets the key on every call, `undefined` on a clean field — so it is `ReactNode`,
 * not optional. It is the one typed way to read a field error: `form.errors` is an index signature
 * (dot access is TS4111), and a raw control inside `FormRow` takes
 * `<FormRow error={inputProps(form, path).error}>`. A Mantine input spread with `inputProps` already
 * renders it; passing it to `FormRow` as well renders it twice.
 */
export type InputProps = Omit<GetInputPropsReturnType, 'error'> & { error: ReactNode }

type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'

type AllDigits<S extends string> = S extends `${Digit}${infer Rest}`
  ? Rest extends ''
    ? true
    : AllDigits<Rest>
  : false

/** A canonical array index: digits only, no sign, no decimal point, no exponent, no leading zero. */
type IsIndex<S extends string> = S extends '0'
  ? true
  : S extends `0${string}`
    ? false
    : AllDigits<S>

/** One path segment applied to a value; `never` when the segment does not exist there. */
type Child<T, K extends string> =
  NonNullable<T> extends infer N
    ? N extends readonly (infer V)[]
      ? IsIndex<K> extends true
        ? V
        : never
      : K extends keyof N
        ? N[K]
        : never
    : never

type ValueAt<T, P extends string> = P extends `${infer Head}.${infer Rest}`
  ? ValueAt<Child<T, Head>, Rest>
  : Child<T, P>

/** `Path` if the value at that dot path is a (possibly optional/nullable) boolean, else `never`. */
type BooleanAt<Values, Path extends string> = [ValueAt<Values, Path>] extends [never]
  ? never
  : [NonNullable<ValueAt<Values, Path>>] extends [boolean]
    ? Path
    : never

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
 * The boolean overload: `{ type: 'checkbox' }` binds a boolean field to Mantine `Checkbox` and
 * `Switch`. It returns `onChange` plus `defaultChecked` in `useBasaltForm`'s default `uncontrolled`
 * mode, or `checked` under `mode: 'controlled'` (Mantine decides; there is no `value`).
 *
 * Only a path whose value is a boolean (optional/nullable included) type-checks; a string path is a
 * type error, not a silently wrong binding. Two limits of that check:
 * - The path must be a literal. A `string`-typed path is rejected here (use a literal, or the
 *   one-argument form), so the path argument does not autocomplete.
 * - On a union parent, a key present on several members is accepted only when every member types it
 *   as boolean; array segments must be canonical indices (`flags.0`, never `flags.1.5` or `flags.01`).
 *
 * @example
 * <Switch key={fieldKey(form, 'active')} {...inputProps(form, 'active', { type: 'checkbox' })} />
 */
export function inputProps<Values extends Record<string, unknown>, Path extends string>(
  form: UseFormReturnType<Values>,
  path: BooleanAt<Values, Path>,
  options: { type: 'checkbox' },
): InputProps
export function inputProps<Values extends Record<string, unknown>>(
  form: UseFormReturnType<Values>,
  path: string,
  options?: { type: 'checkbox' },
): InputProps {
  // Mantine types `error` optional but sets the key on every call (`withError` defaults to true).
  return form.getInputProps(path, options) as InputProps
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
