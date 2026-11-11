import { Field as BaseField } from '@base-ui/react/field'
import { Fieldset as BaseFieldset } from '@base-ui/react/fieldset'
import { Form as BaseForm } from '@base-ui/react/form'
import { cva } from 'class-variance-authority'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'

/**
 * The `Field` cva table: a label, a control, a description and an error stacked with one gap. No
 * axes; display belongs to the table, so a caller never re-lays it out.
 *
 * @example
 * fieldVariants() // class string for a hand-built wrapper
 */
export const fieldVariants = cva('flex flex-col gap-1.5')

/**
 * The `Fieldset` cva table: a legend over a group of `Field`s.
 *
 * @example
 * fieldsetVariants()
 */
export const fieldsetVariants = cva('flex flex-col gap-3 border-0 p-0')

/**
 * The `Form` cva table: the vertical rhythm between fields.
 *
 * @example
 * formVariants()
 */
export const formVariants = cva('flex flex-col gap-4')

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const fieldParts = [
  'field',
  'field-label',
  'field-description',
  'field-error',
  'fieldset',
  'fieldset-legend',
  'form',
] as const

type Layout<P> = Omit<P, 'className'> & {
  /** Layout only (`w-full`, `max-w-sm`, `mt-2`). Display belongs to the part. */
  className?: string
}

export type FieldLabelProps = Layout<BaseField.Label.Props>
export type FieldDescriptionProps = Layout<BaseField.Description.Props>
export type FieldErrorProps = Layout<BaseField.Error.Props>
export type FieldsetProps = Layout<BaseFieldset.Root.Props>
export type FieldsetLegendProps = Layout<BaseFieldset.Legend.Props>
export type FormProps<Values extends Record<string, unknown> = Record<string, unknown>> = Layout<
  BaseForm.Props<Values>
>

export type FieldProps = Layout<Omit<BaseField.Root.Props, 'children'>> & {
  /** The visible name of the control. Required: an unlabelled control has no accessible name. */
  label: NonNullable<ReactNode>
  /** Help text under the control, wired to it through `aria-describedby`. */
  description?: ReactNode
  /** An error as text. Shown and announced when set, and marks the control invalid. */
  error?: string
  /** The control: an `Input`, a `Select` trigger or any Base UI control. */
  children?: ReactNode
}

/**
 * A labelled control with an optional description and an error, on Base UI's `Field`. Works with no
 * provider; a Base UI control inside it picks up the label, description and error on its own.
 *
 * @example
 * <Field label="Email" description="We never share it." error={errors.email}>
 *   <Input type="email" value={email} onValueChange={setEmail} />
 * </Field>
 */
export function Field({
  label,
  description,
  error,
  invalid,
  className,
  children,
  ...props
}: FieldProps): ReactElement {
  return (
    <BaseField.Root
      {...props}
      invalid={invalid ?? (error ? true : undefined)}
      data-slot="field"
      className={cn(fieldVariants(), className)}
    >
      <FieldLabel>{label}</FieldLabel>
      {children}
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      {error ? <FieldError match>{error}</FieldError> : null}
    </BaseField.Root>
  )
}

/**
 * The label of a `Field`. Use it directly only when `Field`'s own layout does not fit.
 *
 * @example
 * <FieldLabel>Name</FieldLabel>
 */
export function FieldLabel({ className, ...props }: FieldLabelProps): ReactElement {
  return (
    <BaseField.Label
      {...props}
      data-slot="field-label"
      className={cn('text-sm font-medium text-foreground', className)}
    />
  )
}

/**
 * The help text of a `Field`.
 *
 * @example
 * <FieldDescription>Used on invoices.</FieldDescription>
 */
export function FieldDescription({ className, ...props }: FieldDescriptionProps): ReactElement {
  return (
    <BaseField.Description
      {...props}
      data-slot="field-description"
      className={cn('text-xs text-muted-foreground', className)}
    />
  )
}

/**
 * The error text of a `Field`. Without `match` it shows when the control's validity fails.
 *
 * @example
 * <FieldError match>Required</FieldError>
 */
export function FieldError({ className, ...props }: FieldErrorProps): ReactElement {
  return (
    <BaseField.Error
      {...props}
      data-slot="field-error"
      className={cn('text-xs text-bad', className)}
    />
  )
}

/**
 * A group of related fields under one legend.
 *
 * @example
 * <Fieldset>
 *   <FieldsetLegend>Billing</FieldsetLegend>
 *   <Field label="Name"><Input /></Field>
 * </Fieldset>
 */
export function Fieldset({ className, ...props }: FieldsetProps): ReactElement {
  return (
    <BaseFieldset.Root
      {...props}
      data-slot="fieldset"
      className={cn(fieldsetVariants(), className)}
    />
  )
}

/**
 * The name of a `Fieldset`.
 *
 * @example
 * <FieldsetLegend>Billing</FieldsetLegend>
 */
export function FieldsetLegend({ className, ...props }: FieldsetLegendProps): ReactElement {
  return (
    <BaseFieldset.Legend
      {...props}
      data-slot="fieldset-legend"
      className={cn('text-sm font-medium text-foreground', className)}
    />
  )
}

/**
 * A form on Base UI: native validation wired to every `Field` inside it, `errors` from the server
 * and one `onFormSubmit` with the collected values.
 *
 * @example
 * <Form errors={serverErrors} onFormSubmit={(values) => save(values)}>
 *   <Field label="Name"><Input name="name" required /></Field>
 *   <Button type="submit" variant="primary">Save</Button>
 * </Form>
 */
export function Form<Values extends Record<string, unknown> = Record<string, unknown>>({
  className,
  ...props
}: FormProps<Values>): ReactElement {
  return <BaseForm<Values> {...props} data-slot="form" className={cn(formVariants(), className)} />
}
