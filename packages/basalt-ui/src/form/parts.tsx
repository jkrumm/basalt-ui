/**
 * The parts `useAppForm` binds: `f.FormField` (the `./controls` `FormField` reading its field from
 * the context), `form.Form` (the plain `<form noValidate>` a TanStack form needs, its fields
 * disabled while it submits) and `form.Footer` (the `./controls` `FormFooter` reading its form from
 * the context). Each is the structural part with the wiring an app wrote by hand done once.
 */
import { useStore } from '@tanstack/react-form'
import type { ReactElement, ReactNode } from 'react'
import type { FormAction } from '../controls/contract'
import { FormField } from '../controls/form-field'
import type { FormFieldProps } from '../controls/form-field'
import { FormFooter } from '../controls/form-footer'
import type { ValidActions } from '../controls/form-footer'
import { Fieldset } from '../ui/field'
import { useFieldContext, useFormContext } from './contexts'

/** `FormField` without its source: the field comes from the enclosing `form.AppField`. */
export type BoundFormFieldProps = Omit<FormFieldProps<unknown>, 'field' | 'control'>

/**
 * The label, the description and the first error of the enclosing `form.AppField`'s field.
 *
 * @example
 * <form.AppField name="name">{(f) => <f.FormField label="Name" required><Input /></f.FormField>}</form.AppField>
 */
export function BoundFormField(props: BoundFormFieldProps): ReactElement {
  const field = useFieldContext<unknown>()
  return <FormField {...props} field={field} />
}

export type FormProps = {
  /** Layout only (`max-w-xl`, `w-full`). */
  className?: string
  /** The submit meta `onSubmit` reads (`onSubmitMeta` types it): the mounted step of a `Stepper` form. */
  meta?: unknown
  /** The fields, rows, sections and the `form.Footer`. */
  children: ReactNode
}

/**
 * The `<form noValidate>` around a TanStack form: Enter and the primary submit through
 * `form.handleSubmit()`, never the browser's own validation, and every control is disabled while
 * the form submits.
 *
 * @example
 * <form.AppForm><form.Form>…<form.Footer actions={actions} /></form.Form></form.AppForm>
 */
export function Form({ className, meta, children }: FormProps): ReactElement {
  const form = useFormContext()
  const busy = useStore(form.store, (state) => state.isSubmitting)
  return (
    <form
      noValidate
      className={className}
      onSubmit={(event) => {
        event.preventDefault()
        event.stopPropagation()
        void (meta === undefined ? form.handleSubmit() : form.handleSubmit(meta))
      }}
    >
      <Fieldset disabled={busy}>{children}</Fieldset>
    </form>
  )
}

export type FooterProps<A extends readonly FormAction[]> = {
  /** At most five actions and one primary; the primary submits the form. */
  actions: A & ValidActions<A>
  /** Keeps the row in view at the bottom of the scrollport and reads `Unsaved changes` while dirty. */
  sticky?: boolean
  /** Layout only (`mt-4`, `w-full`). */
  className?: string
}

/**
 * The enclosing form's action row: `FormFooter` with its form read from `form.AppForm`.
 *
 * @example
 * <form.Footer actions={[{ label: 'Cancel', onClick: close }, { label: 'Save', primary: true }]} />
 */
export function Footer<const A extends readonly FormAction[]>({
  actions,
  sticky = false,
  className,
}: FooterProps<A>): ReactElement {
  const form = useFormContext()
  return (
    <FormFooter<A>
      form={form}
      actions={actions}
      sticky={sticky}
      {...(className !== undefined && { className })}
    />
  )
}
