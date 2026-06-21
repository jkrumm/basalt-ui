/**
 * ./forms — Mantine form adapter battery.
 * Provides useBasaltForm, field, FormErrorSummary, and useFormDraft on top of @mantine/form.
 * Optional peer: @mantine/form ^9.3.0.
 *
 * Install with: bun add @mantine/form
 */

// ── useBasaltForm ─────────────────────────────────────────────────────────────
export { useBasaltForm } from './create-form'
export type { UseBasaltFormOptions } from './create-form'

// ── field ─────────────────────────────────────────────────────────────────────
export { field } from './field'

// ── FormErrorSummary ──────────────────────────────────────────────────────────
export { FormErrorSummary } from './FormErrorSummary'
export type { FormErrorSummaryProps } from './FormErrorSummary'

// ── useFormDraft ──────────────────────────────────────────────────────────────
export { useFormDraft } from './use-form-draft'
export type { UseFormDraftOptions, UseFormDraftReturn } from './use-form-draft'

// ── @mantine/form re-exports (convenience) ────────────────────────────────────
export { useForm, schemaResolver } from '@mantine/form'
export type { UseFormReturnType, UseFormInput } from '@mantine/form'
