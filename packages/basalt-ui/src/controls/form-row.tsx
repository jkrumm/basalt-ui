/**
 * `FormRow`: fields side by side when their own container is wide enough, stacked when it is not.
 * The tier is the container's (`@regular:`), never the viewport's. It is a Base UI `Fieldset`, so a
 * `disabled` row disables every `FormField` inside by context, whatever the control kind. Repeat it
 * per element of an array, with a `legend` that names the element.
 */
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import { Fieldset, FieldsetLegend } from '../ui/field'

export type FormRowProps = {
  /** Names the row for assistive technology and shows above it: `Line 2` for a repeated row. */
  legend?: ReactNode
  /** Disables every field of the row. */
  disabled?: boolean
  /** Layout only (`w-full`, `max-w-2xl`). */
  className?: string
  /** The row's `FormField`s. */
  children: ReactNode
}

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const formRowParts = ['form-row', 'form-row-fields'] as const

/**
 * A row of `FormField`s that lays itself out by its container: one column narrow, one equal column
 * per field from `@regular`. Repeat it for an array, keyed by a stable id in the value.
 *
 * @useWhen two or three related fields share a line, or a field array repeats a row
 * @neverWhen a single field stands alone: `FormField` already stacks its parts
 *
 * @example
 * <FormRow legend="Line 1">
 *   <FormField label="Item" field={item}><Input /></FormField>
 *   <FormField label="Quantity" field={qty}><NumberField /></FormField>
 * </FormRow>
 */
export function FormRow({ legend, disabled, className, children }: FormRowProps): ReactElement {
  // The container is the row's own fieldset, never the root: Chrome drops the layout of a size
  // container's subtree when the container is a direct child of a `<fieldset>` (a form's
  // `<Fieldset disabled>`) and one commit both changes a sibling before it and an input inside it
  // after a forced layout, which is a restored draft. The root is a plain box, so the row's
  // container always sits in it, whatever encloses the row.
  return (
    <div data-slot="form-row" className={cn('min-w-0', className)}>
      <Fieldset {...(disabled === true && { disabled: true })} className="@container min-w-0 gap-2">
        {legend ? <FieldsetLegend>{legend}</FieldsetLegend> : null}
        <div
          data-slot="form-row-fields"
          className="grid min-w-0 grid-cols-1 gap-3 @regular:auto-cols-fr @regular:grid-flow-col *:min-w-0"
        >
          {children}
        </div>
      </Fieldset>
    </div>
  )
}
