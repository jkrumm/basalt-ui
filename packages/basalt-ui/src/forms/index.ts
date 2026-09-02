/**
 * ./forms — the Mantine form layer.
 *
 * Subpath-ONLY, deliberately: the root barrel re-exports nothing from here (`src/index.ts`), so a
 * consumer without `@mantine/form` installed never pulls an unresolvable import in by importing
 * `basalt-ui`. Same reason `./charts` and `./tokens` stay off the root barrel, one optional peer
 * over. Import everything below from `basalt-ui/forms`.
 *
 * Five pieces: the form (`useBasaltForm` + `inputProps`/`fieldKey`), the layout
 * (`FormSection` / `FormRow` / `FormGroup` / `FormActions`), the submit lifecycle
 * (`useFormSubmit` + `FormStateProvider`), the list field (`useFieldArray`) and the draft
 * (`useFormDraft`).
 *
 * Optional peer: @mantine/form ^9.3.0 — install with: bun add @mantine/form
 */

// ── useBasaltForm ─────────────────────────────────────────────────────────────
export { useBasaltForm } from './create-form'
export type { UseBasaltFormOptions } from './create-form'

// ── inputProps ────────────────────────────────────────────────────────────────
// Two calls, never one object: `key` inside a spread is a React 19 warning. See field.ts.
// `field` ships alongside as a @deprecated alias — see field.ts.
export { inputProps, fieldKey, field } from './field'

// ── layout — law C1's third home, the form row ────────────────────────────────
export { FormSection, FormRow, FormGroup, FormActions } from './form-layout'
export type {
  FormSectionProps,
  FormSectionSlot,
  FormRowProps,
  FormRowSlot,
  FormGroupProps,
  FormActionsProps,
} from './form-layout'

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

// ── @mantine/form re-exports (convenience) ────────────────────────────────────
export { useForm, schemaResolver } from '@mantine/form'
export type { UseFormReturnType, UseFormInput } from '@mantine/form'
