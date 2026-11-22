/**
 * `FormSection`: a titled group of settings rows. The heading row (title, an optional badge and
 * action, one muted line) stands above one hairline-bordered box; the box holds the rows, divided by
 * hairlines (`FormField` takes the section's `layout`, `row` by default). The box is a fieldset
 * named by the title: `disabled` disables every field inside, whatever the control kind, and
 * `locked` does the same, dims the box and says why in the heading row.
 */
import { useId } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import { resolvePhase } from '../core/phase'
import type { Phase, QueryStateLike } from '../core/ports'
import { Skeleton } from '../ui/skeleton'
import { Fieldset } from '../ui/field'
import { FormFieldLayoutContext } from './form-field'
import type { FormFieldLayout } from './form-field'

export type FormSectionProps = {
  /** The section's name: the heading row's title and the group's accessible name. */
  title: NonNullable<ReactNode>
  /** One line under the title saying what the group controls; wired as the group's description. */
  description?: ReactNode
  /** A chip beside the title (a plan, `Beta`): a `Lozenge`. */
  badge?: ReactNode
  /**
   * A button at the end of the heading row (`New field`). It sits outside the box's fieldset, so a
   * disabled or locked section keeps it reachable: gate it yourself.
   */
  action?: ReactNode
  /** A stable id for the section, a target for a link (`#deploys`). */
  id?: string
  /**
   * Locks the section behind a plan or a permission: the box is dimmed and inert, every field in
   * it is disabled, and this node says why (`Enterprise plan`) beside a padlock. Put the way out
   * (`See plans`) in `action`, which stays enabled.
   */
  locked?: ReactNode
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
   * A band at the bottom of the box: a `FormFooter` when this section saves on its own (a form
   * of one section), never a second save inside a larger form.
   */
  footer?: ReactNode
  /** Layout only (`w-full`, `max-w-3xl`). */
  className?: string
  /** The section's `FormField`s, `FormRow`s and settings rows; each becomes one row of the box. */
  children: ReactNode
}

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const formSectionParts = [
  'form-section',
  'form-section-header',
  'form-section-title',
  'form-section-locked',
  'form-section-action',
  'form-section-box',
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

function Padlock(): ReactElement {
  return (
    <svg viewBox="0 0 16 16" className="size-icon shrink-0" fill="none" aria-hidden="true">
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * A titled group of settings rows: the heading row, then one bordered box of rows divided by
 * hairlines, with an optional footer band. Its fields default to the settings row: label and
 * description at the start, the control at the end, stacked when the section is narrow.
 *
 * @useWhen a settings or edit page groups more than a few fields under names a reader scans
 * @neverWhen the form is a short dialog (FormFields alone), or the group is a repeated line of an array (FormRow)
 *
 * @example
 * <FormSection title="Deploys" description="How a merge reaches production.">
 *   <form.AppField name="autoDeploy">{(f) => <f.FormField label="Deploy main on push"><Switch /></f.FormField>}</form.AppField>
 *   <form.AppField name="parallel">{(f) => <f.FormField label="Parallel deploys"><NumberField /></f.FormField>}</form.AppField>
 * </FormSection>
 *
 * @example
 * <FormSection title="Audit log" badge={<Lozenge tone="accent">Enterprise</Lozenge>} locked="Part of the Enterprise plan." action={<Button>See plans</Button>}>…</FormSection>
 */
export function FormSection({
  title,
  description,
  badge,
  action,
  id,
  locked,
  layout = 'row',
  disabled,
  phase,
  footer,
  className,
  children,
}: FormSectionProps): ReactElement {
  const titleId = useId()
  const descriptionId = useId()
  const loading = resolvePhase({ phase }).tag === 'loading'
  const hasDescription = description !== undefined && description !== null && description !== ''
  const isLocked = locked !== undefined && locked !== null && locked !== false
  // The root is a plain box and the box a plain div around the fieldset's rows, so a field's size
  // container never sits directly in the `<fieldset>` (form-row.tsx names the Chrome bug).
  return (
    <div
      data-slot="form-section"
      {...(id !== undefined && { id })}
      {...(isLocked && { 'data-locked': '' })}
      className={cn('flex min-w-0 flex-col gap-3 scroll-mt-(--page-sticky-top,0px)', className)}
    >
      <div data-slot="form-section-header" className="flex min-w-0 items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span
              id={titleId}
              data-slot="form-section-title"
              className="font-head text-md font-semibold tracking-tight text-foreground"
            >
              {title}
            </span>
            {badge}
          </div>
          {hasDescription && (
            <p id={descriptionId} className="m-0 text-sm text-muted-foreground">
              {description}
            </p>
          )}
          {isLocked && (
            <p
              data-slot="form-section-locked"
              className="m-0 flex items-center gap-1.5 text-sm text-muted-foreground"
            >
              <Padlock />
              <span>{locked}</span>
            </p>
          )}
        </div>
        {action === undefined || action === null ? null : (
          <div data-slot="form-section-action" className="shrink-0">
            {action}
          </div>
        )}
      </div>
      <Fieldset
        {...((disabled === true || isLocked) && { disabled: true })}
        {...(loading && { 'aria-busy': true })}
        aria-labelledby={titleId}
        {...(hasDescription && { 'aria-describedby': descriptionId })}
        className="min-w-0 gap-0"
      >
        <div
          data-slot="form-section-box"
          {...(isLocked && { inert: true })}
          className={cn(
            'min-w-0 overflow-clip rounded-card border border-border bg-card text-foreground forced-colors:border-current',
            isLocked && 'opacity-50',
          )}
        >
          <div
            data-slot="form-section-body"
            className="flex min-w-0 flex-col *:min-w-0 *:border-b *:border-border *:px-5 *:py-3.5 *:last:border-b-0"
          >
            {loading ? (
              LOADING_ROWS.map((row) => <LoadingRow key={row} />)
            ) : (
              <FormFieldLayoutContext value={layout}>{children}</FormFieldLayoutContext>
            )}
          </div>
          {footer === undefined || loading ? null : (
            <div
              data-slot="form-section-footer"
              className="min-w-0 border-t border-border px-5 py-3"
            >
              {footer}
            </div>
          )}
        </div>
      </Fieldset>
    </div>
  )
}
