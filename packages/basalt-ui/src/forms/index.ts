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

// ── useBasaltForm ─────────────────────────────────────────────────────────────
export { useBasaltForm } from './create-form'
export type { UseBasaltFormOptions } from './create-form'

// ── inputProps ────────────────────────────────────────────────────────────────
// Two calls, never one object: `key` inside a spread is a React 19 warning. See field.ts.
export { inputProps, fieldKey } from './field'

// ── submit lifecycle ──────────────────────────────────────────────────────────
export { useFormSubmit, isFieldErrorEnvelope } from './use-form-submit'
export type { FormFieldErrors, UseFormSubmitOptions, UseFormSubmitReturn } from './use-form-submit'
export { FormStateProvider, useFormState } from './form-state'
export type { FormState, FormStateProviderProps } from './form-state'

// ── array fields ──────────────────────────────────────────────────────────────
export { useFieldArray } from './use-field-array'
export type { UseFieldArrayReturn } from './use-field-array'

// ── FormErrorSummary ──────────────────────────────────────────────────────────
export { FormErrorSummary } from './FormErrorSummary'
export type { FormErrorSummaryProps } from './FormErrorSummary'

// ── useFormDraft ──────────────────────────────────────────────────────────────
export { useFormDraft, DEFAULT_AUTOSAVE_DEBOUNCE_MS } from './use-form-draft'
export type { UseFormDraftOptions, UseFormDraftReturn } from './use-form-draft'
