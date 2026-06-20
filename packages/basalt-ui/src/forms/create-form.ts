/**
 * ./forms — createForm: typed useForm wrapper applying basalt defaults.
 * Mantine-coupled. Optional peer: @mantine/form.
 */
import { schemaResolver, useForm, type UseFormInput, type UseFormReturnType } from '@mantine/form'
import type { StandardSchemaV1 } from '../register'

// ── createForm ────────────────────────────────────────────────────────────────

/** Options for createForm — a typed useForm wrapper that applies basalt defaults. */
export type CreateFormOptions<Values extends Record<string, unknown>> = Omit<
  UseFormInput<Values>,
  'validate'
> & {
  /** Standard Schema (Valibot, Zod 4, ArkType) for field-level validation. */
  schema?: StandardSchemaV1<unknown, Values>
  /** @default 'uncontrolled' */
  mode?: 'controlled' | 'uncontrolled'
}

/**
 * Custom hook implementing basalt form defaults.
 * Named `useBasaltForm` so React's rules-of-hooks lint can validate the hook call chain.
 * Exported as `createForm` for the public API (see below).
 *
 * @example
 * import * as v from 'valibot'
 * import { createForm, field } from 'basalt-ui/forms'
 *
 * const Schema = v.object({ name: v.pipe(v.string(), v.minLength(2)), email: v.string() })
 * type Values = v.InferOutput<typeof Schema>
 *
 * function MyForm() {
 *   const form = createForm({ initialValues: { name: '', email: '' }, schema: Schema })
 *   return <TextInput {...field(form, 'name')} label="Name" />
 * }
 */
function useBasaltForm<Values extends Record<string, unknown>>(
  opts: CreateFormOptions<Values>,
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

/**
 * Typed useForm wrapper that applies basalt defaults:
 * - `mode: 'uncontrolled'` by default (avoids per-keystroke re-renders)
 * - `validate: schemaResolver(schema, { sync: true })` when `schema` is provided
 *
 * Call this inside a React component or custom hook — it is a hook wrapper.
 * All useForm options are forwarded unchanged.
 */
export const createForm: <Values extends Record<string, unknown>>(
  opts: CreateFormOptions<Values>,
) => UseFormReturnType<Values> = useBasaltForm
