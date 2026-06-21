/**
 * ./forms — useBasaltForm: typed useForm wrapper applying basalt defaults.
 * Mantine-coupled. Optional peer: @mantine/form.
 */
import { schemaResolver, useForm, type UseFormInput, type UseFormReturnType } from '@mantine/form'
import type { StandardSchemaV1 } from '../register'

// ── useBasaltForm ─────────────────────────────────────────────────────────────

/** Options for useBasaltForm — a typed useForm wrapper that applies basalt defaults. */
export type UseBasaltFormOptions<Values extends Record<string, unknown>> = Omit<
  UseFormInput<Values>,
  'validate'
> & {
  /** Standard Schema (Valibot, Zod 4, ArkType) for field-level validation. */
  schema?: StandardSchemaV1<unknown, Values>
  /** @default 'uncontrolled' */
  mode?: 'controlled' | 'uncontrolled'
}

/**
 * Typed useForm wrapper that applies basalt defaults:
 * - `mode: 'uncontrolled'` by default (avoids per-keystroke re-renders)
 * - `validate: schemaResolver(schema, { sync: true })` when `schema` is provided
 *
 * Call this inside a React component or custom hook — it is a hook wrapper.
 * All useForm options are forwarded unchanged.
 *
 * @example
 * import * as v from 'valibot'
 * import { useBasaltForm, field } from 'basalt-ui/forms'
 *
 * const Schema = v.object({ name: v.pipe(v.string(), v.minLength(2)), email: v.string() })
 * type Values = v.InferOutput<typeof Schema>
 *
 * function MyForm() {
 *   const form = useBasaltForm({ initialValues: { name: '', email: '' }, schema: Schema })
 *   return <TextInput {...field(form, 'name')} label="Name" />
 * }
 */
export function useBasaltForm<Values extends Record<string, unknown>>(
  opts: UseBasaltFormOptions<Values>,
): UseFormReturnType<Values> {
  const { schema, mode = 'uncontrolled', ...rest } = opts
  return useForm<Values>({
    mode,
    ...rest,
    // schemaResolver is provided by @mantine/form and implements the Standard Schema spec.
    // { sync: true } keeps validate/isValid synchronous for sync schemas (Valibot, Zod 4, ArkType).
    ...(schema !== undefined && {
      // A real Valibot/Zod schema is structurally assignable to StandardSchemaV1, which is
      // assignable to the resolver's expectation. One narrow cast here, nowhere else.
      validate: schemaResolver(schema as Parameters<typeof schemaResolver>[0], { sync: true }),
    }),
  })
}
