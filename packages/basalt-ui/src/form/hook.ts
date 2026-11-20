/**
 * basalt's form hook: TanStack Form's `createFormHook` with basalt's parts bound, the pattern its
 * composition guide gives a design system. An app's own control needs no part of its own: it renders
 * as the child of `f.FormField`, which hands it the value and the change handler. `useAppForm` adds one default, the revalidation the forms
 * skill teaches: a field checks when it is left, every field on submit, and every change after a
 * submit, so a fix clears its error at once. An option the app passes wins.
 */
import { createFormHook, revalidateLogic } from '@tanstack/react-form'
import { fieldContext, formContext } from './contexts'
import { BoundFormField, Footer, Form } from './parts'

const bound = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { FormField: BoundFormField },
  formComponents: { Form, Footer },
})

/** Blur before the first submit, every change after it. */
const BLUR_THEN_CHANGE = revalidateLogic({ mode: 'blur', modeAfterSubmission: 'change' })

/**
 * Wraps a bound `useAppForm` so it defaults `validationLogic` to blur-then-change. `H` is
 * TanStack's hook with its dozen generics; the wrapper adds one option in front of the app's and
 * returns what the hook returns, so its signature is the hook's and the casts restate it.
 */
function withRevalidation<H extends (options: never) => unknown>(hook: H): H {
  const call = hook as unknown as (options: object) => unknown
  const wrapped = (options: object): unknown =>
    call({ validationLogic: BLUR_THEN_CHANGE, ...options })
  return wrapped as unknown as H
}

/**
 * A TanStack form with basalt's parts: `f.FormField` on every `form.AppField`, `form.Form` and
 * `form.Footer` inside `form.AppForm`. Takes `useForm`'s options; `validationLogic` defaults to
 * blur, then change after the first submit, so a schema goes on `onDynamic`.
 *
 * @useWhen a submit form: a create or edit dialog, a settings page with a Save
 * @neverWhen the control applies at once (a `FormField control={handle}` on a store), or it filters a view (a `FilterSet`)
 *
 * @example
 * const form = useAppForm({ defaultValues, validators: { onSubmitAsync: toSubmitErrors(save) }, onSubmit })
 * <form.AppForm><form.Form>
 *   <form.AppField name="name" validators={{ onDynamic: NAME }}>
 *     {(f) => <f.FormField label="Name" required><Input /></f.FormField>}
 *   </form.AppField>
 *   <form.Footer actions={[{ label: 'Save', primary: true }]} />
 * </form.Form></form.AppForm>
 */
export const useAppForm = withRevalidation(bound.useAppForm)

/**
 * A component that renders part of a form passed to it: a section of a long form, one step of a
 * `Stepper` form. `defaultValues` only types the form.
 *
 * @useWhen a long form splits into components that each render some of its fields
 * @neverWhen the fields fit the one component that calls `useAppForm`; the same fields recur across forms (`withFieldGroup`)
 *
 * @example
 * const Contact = withForm({ defaultValues, render: function Render({ form }) { return <form.AppField name="email">…</form.AppField> } })
 */
export const withForm = bound.withForm

/**
 * A group of fields reused by more than one form (an address, a time window); mounted with
 * `fields="address"` or a key map.
 *
 * @useWhen the same set of fields appears in two or more forms
 * @neverWhen the fields belong to one form only (`withForm`), or the group needs a validator of its own
 *
 * @example
 * const Address = withFieldGroup({ defaultValues: { street: '', city: '' }, render: function Render({ group }) { return <group.AppField name="city">…</group.AppField> } })
 */
export const withFieldGroup = bound.withFieldGroup
