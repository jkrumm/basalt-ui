/**
 * ./forms — the Mantine form layer.
 *
 * Subpath-ONLY, deliberately: the root barrel re-exports nothing from here (`src/index.ts`), so a
 * consumer without `@mantine/form` installed never pulls an unresolvable import in by importing
 * `basalt-ui`. Same reason `./charts` and `./tokens` stay off the root barrel, one optional peer
 * over. Import everything below from `basalt-ui/forms`.
 *
 * Four pieces: the form (`useBasaltForm` + `inputProps`/`fieldKey`), the submit lifecycle
 * (`useFormSubmit` + `FormStateProvider`), the list field (`useFieldArray`) and the draft
 * (`useFormDraft`). The layout (`FormSection` / `FormRow` / `FormGroup` / `FormActions`) lives in
 * `basalt-ui/controls` (it needs no `@mantine/form`); `useForm`/`schemaResolver` come from
 * `@mantine/form` directly. Both stopped being re-exported here in 1.39.0.
 *
 * Optional peer: @mantine/form ^9.3.0 — install with: bun add @mantine/form
 */

export { useBasaltForm } from './create-form'
export { inputProps, fieldKey } from './field'
