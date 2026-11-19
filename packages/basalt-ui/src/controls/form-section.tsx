/**
 * `FormSection`: a titled group of fields on its own surface. A settings page is a column of them;
 * each holds settings rows (`FormField` takes the section's `layout`, `row` by default) divided by a
 * hairline. It is a fieldset: the title names the group for assistive technology, and `disabled`
 * disables every field inside, whatever the control kind.
 */
import { useId } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import { resolvePhase } from '../core/phase'
import type { Phase, QueryStateLike } from '../core/ports'
import { Skeleton } from '../ui/skeleton'
import { Fieldset, FieldsetLegend } from '../ui/field'
import { FormFieldLayoutContext } from './form-field'
import type { FormFieldLayout } from './form-field'

export type FormSectionProps = {
  /** The section's name: the fieldset's legend, shown at the top of the surface. */
  title: NonNullable<ReactNode>
  /** One line under the title saying what the group controls; wired as the group's description. */
  description?: ReactNode
  /** The layout of every `FormField` inside that names none. Default `row`, the settings row. */
  layout?: FormFieldLayout
  /** Disables every field of the section. */
  disabled?: boolean
  /**
   * The query the section's values wait on. While it loads the title and description stand and the
   * body holds three placeholder rows (no field, no footer); every other phase draws the section.
   * The page's own frame (`QueryState`) owns error and empty.
   */
  phase?: Phase | QueryStateLike | undefined
  /**
   * A band at the bottom of the surface: a `FormFooter` when this section saves on its own (a form
   * of one section), never a second save inside a larger form.
   */
  footer?: ReactNode
  /** Layout only (`w-full`, `max-w-3xl`). */
  className?: string
  /** The section's `FormField`s and `FormRow`s; each becomes one row of the surface. */
  children: ReactNode
}

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const formSectionParts = [
  'form-section',
  'form-section-header',
  'form-section-body',
  'form-section-footer',
  'form-section-loading-row',
] as const

const LOADING_ROWS = ['a', 'b', 'c'] as const

/** One placeholder settings row: a label and its description at the start, the control at the end. */
function LoadingRow(): ReactElement {
  return (
    <div data-slot="form-section-loading-row" className="flex items-center justify-between gap-4">
      <div className="flex w-1/3 flex-col gap-1 text-sm">
        <Skeleton className="w-24" />
        <Skeleton className="w-40" />
      </div>
      <Skeleton className="h-ctl w-1/3 rounded-ctrl" />
    </div>
  )
}

/**
 * A titled group of fields on a surface, one row per field divided by a hairline, with an optional
 * footer band. Its fields default to the settings row: label and description at the start, the
 * control at the end, stacked when the section is narrow.
 *
 * @useWhen a settings or edit page groups more than a few fields under names a reader scans
 * @neverWhen the form is a short dialog (FormFields alone), or the group is a repeated line of an array (FormRow)
 *
 * @example
 * <FormSection title="Deploys" description="How a merge reaches production.">
 *   <FormField label="Deploy main on push" field={autoDeploy}><Switch /></FormField>
 *   <FormField label="Parallel deploys" field={parallel}><NumberField /></FormField>
 * </FormSection>
 */
export function FormSection({
  title,
  description,
  layout = 'row',
  disabled,
  phase,
  footer,
  className,
  children,
}: FormSectionProps): ReactElement {
  const descriptionId = useId()
  const loading = resolvePhase({ phase }).tag === 'loading'
  const hasDescription = description !== undefined && description !== null && description !== ''
  // The surface is a plain box around the fieldset, so the fields' size containers never sit
  // directly in the `<fieldset>` (form-row.tsx names the Chrome bug that avoids).
  return (
    <div
      data-slot="form-section"
      className={cn(
        'min-w-0 overflow-clip rounded-card bg-card text-foreground shadow-card forced-colors:border forced-colors:border-current',
        className,
      )}
    >
      <Fieldset
        {...(disabled === true && { disabled: true })}
        {...(loading && { 'aria-busy': true })}
        {...(hasDescription && { 'aria-describedby': descriptionId })}
        className="min-w-0 gap-0"
      >
        <div
          data-slot="form-section-header"
          className="flex min-w-0 flex-col gap-0.5 px-4 pt-3.5 pb-3"
        >
          <FieldsetLegend className="font-head text-md font-semibold tracking-tight">
            {title}
          </FieldsetLegend>
          {hasDescription && (
            <p id={descriptionId} className="m-0 text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        <div
          data-slot="form-section-body"
          className="flex min-w-0 flex-col border-t border-border *:min-w-0 *:border-b *:border-border *:px-4 *:py-3 *:last:border-b-0"
        >
          {loading ? (
            LOADING_ROWS.map((row) => <LoadingRow key={row} />)
          ) : (
            <FormFieldLayoutContext value={layout}>{children}</FormFieldLayoutContext>
          )}
        </div>
        {footer === undefined || loading ? null : (
          <div data-slot="form-section-footer" className="min-w-0 border-t border-border px-4 py-3">
            {footer}
          </div>
        )}
      </Fieldset>
    </div>
  )
}
