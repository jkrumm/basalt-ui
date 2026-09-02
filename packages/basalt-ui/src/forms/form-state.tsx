/**
 * ./forms — FormStateProvider / useFormState: the one place a form says "busy", read by every
 * layout primitive in this module.
 *
 * The gap this closes (audit B §4): `@mantine/form` has no disabled/readonly propagation, so
 * "disable everything while the submit is in flight" had to be threaded to every single input by
 * hand — and the one field that got forgotten is the one a user double-submits through.
 *
 * **The propagation mechanism is native `<fieldset disabled>`, not `cloneElement`.** `FormRow`,
 * `FormGroup` and `FormActions` each render their control region as a `fieldset`, so the browser
 * disables every descendant control — a Mantine `TextInput`, a raw `<button>`, a third-party
 * date picker — with real `:disabled` styling and real assistive-tech semantics, and basalt never
 * has to know what its children are. A custom control that is NOT a native form element reads
 * `useFormState()` itself.
 *
 * Mantine-coupled only by neighbourhood: this file imports nothing but React.
 *
 * @example
 * const { submit, isSubmitting } = useFormSubmit(form, save)
 * <form onSubmit={submit}>
 *   <FormStateProvider submitting={isSubmitting}>
 *     <FormRow label="Name">
 *       <TextInput key={fieldKey(form, 'name')} {...inputProps(form, 'name')} />
 *     </FormRow>
 *     <FormActions actions={[{ key: 'save', label: 'Save', onClick: submit }]} />
 *   </FormStateProvider>
 * </form>
 */
import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'

/**
 * What a control in this subtree needs to know. Two fields on purpose:
 *
 * - `disabled` is the RESOLVED verdict — bind a control's `disabled` to it and nothing else. It is
 *   already true while `submitting` is, so a call site never writes `disabled || submitting` and
 *   never gets that `||` backwards.
 * - `submitting` is the REASON, for a control that renders differently for it (a button showing a
 *   loader) rather than merely inertly.
 */
export type FormState = {
  readonly disabled: boolean
  readonly submitting: boolean
}

const DEFAULT_FORM_STATE: FormState = { disabled: false, submitting: false }

const FormStateContext = createContext<FormState>(DEFAULT_FORM_STATE)

export type FormStateProviderProps = {
  /** Disable every control below, for a reason of the caller's own (no permission, read-only view). */
  disabled?: boolean
  /** A submit is in flight — pair with `useFormSubmit`'s `isSubmitting`. Implies `disabled`. */
  submitting?: boolean
  children: ReactNode
}

/**
 * Publishes the form's busy/disabled state to every layout primitive below it.
 *
 * **Nesting ORs, it never resets**: an inner `<FormStateProvider>` can disable a subsection of an
 * enabled form, but cannot re-enable a subsection of a disabled one. A form that is submitting is
 * submitting everywhere, and a provider that could unset that is a double-submit waiting for the
 * one call site that used it.
 */
export function FormStateProvider({
  disabled = false,
  submitting = false,
  children,
}: FormStateProviderProps) {
  const parent = useContext(FormStateContext)
  const value = useMemo<FormState>(
    () => ({
      disabled: parent.disabled || disabled || submitting,
      submitting: parent.submitting || submitting,
    }),
    [parent.disabled, parent.submitting, disabled, submitting],
  )
  return <FormStateContext.Provider value={value}>{children}</FormStateContext.Provider>
}

/**
 * The form state a custom (non-native) control has to honour itself. Outside any provider it reads
 * `{ disabled: false, submitting: false }` — a control is never disabled by accident of placement.
 *
 * @example
 * function ColorSwatches() {
 *   const { disabled } = useFormState()
 *   return <div aria-disabled={disabled}>…</div>
 * }
 */
export function useFormState(): FormState {
  return useContext(FormStateContext)
}
