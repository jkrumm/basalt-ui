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
 * (`useFormDraft`). The layout (`FormSection` / `FormRow` / `FormGroup` / `FormActions`) moved to
 * `basalt-ui/controls` in 1.36.0 — it needs no `@mantine/form` — and stays here as deprecated
 * aliases until 1.37.0, as do the `useForm`/`schemaResolver` re-exports (import from
 * `@mantine/form`).
 *
 * Optional peer: @mantine/form ^9.3.0 — install with: bun add @mantine/form
 */

// ── useBasaltForm ─────────────────────────────────────────────────────────────
export { useBasaltForm } from './create-form'
export type { UseBasaltFormOptions } from './create-form'

// ── inputProps ────────────────────────────────────────────────────────────────
// Two calls, never one object: `key` inside a spread is a React 19 warning. See field.ts.
export { inputProps, fieldKey } from './field'

// ── layout — moved to ./controls (1.36.0), deprecated aliases until 1.37.0 ─────
export {
  /** @deprecated Import from 'basalt-ui/controls' — removed in 1.37.0. */
  FormSection,
  /** @deprecated Import from 'basalt-ui/controls' — removed in 1.37.0. */
  FormRow,
  /** @deprecated Import from 'basalt-ui/controls' — removed in 1.37.0. */
  FormGroup,
  /** @deprecated Import from 'basalt-ui/controls' — removed in 1.37.0. */
  FormActions,
} from '../controls/form-layout'
export type {
  /** @deprecated Import from 'basalt-ui/controls' — removed in 1.37.0. */
  FormSectionProps,
  /** @deprecated Import from 'basalt-ui/controls' — removed in 1.37.0. */
  FormSectionSlot,
  /** @deprecated Import from 'basalt-ui/controls' — removed in 1.37.0. */
  FormRowProps,
  /** @deprecated Import from 'basalt-ui/controls' — removed in 1.37.0. */
  FormRowSlot,
  /** @deprecated Import from 'basalt-ui/controls' — removed in 1.37.0. */
  FormGroupProps,
  /** @deprecated Import from 'basalt-ui/controls' — removed in 1.37.0. */
  FormActionsProps,
} from '../controls/form-layout'

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

// ── @mantine/form re-exports — deprecated, zero consumers import them from here ──
export {
  /** @deprecated Import from '@mantine/form' — removed in 1.37.0. */
  useForm,
  /** @deprecated Import from '@mantine/form' — removed in 1.37.0. */
  schemaResolver,
} from '@mantine/form'
export type {
  /** @deprecated Import from '@mantine/form' — removed in 1.37.0. */
  UseFormReturnType,
  /** @deprecated Import from '@mantine/form' — removed in 1.37.0. */
  UseFormInput,
} from '@mantine/form'
