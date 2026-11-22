import { cva } from 'class-variance-authority'
import { cloneElement, useId } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'

/**
 * The `ChoiceCard` cva table: a bordered, clickable frame around one radio or checkbox. The
 * selected card is drawn by its border (ink, one pixel thicker through an inset ring), never by a
 * fill alone; hover tints the surface, focus-visible on the control outlines the whole card, an
 * invalid control turns the border red and a disabled one fades the card. At least 64 px high.
 *
 * @example
 * choiceCardVariants() // class string for a hand-built card
 */
export const choiceCardVariants = cva(
  'relative flex min-h-16 min-w-0 cursor-pointer flex-col gap-3 rounded-card border border-input bg-background p-3 transition-colors has-data-checked:border-foreground has-data-checked:ring-1 has-data-checked:ring-foreground has-data-checked:ring-inset has-data-invalid:border-bad has-data-invalid:has-data-checked:ring-bad has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand has-data-disabled:cursor-not-allowed has-data-disabled:opacity-50 not-has-data-disabled:hover:bg-accent pointer-coarse:min-h-11',
)

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const choiceCardParts = ['choice-card'] as const

export type ChoiceCardProps = {
  /** The `Radio` or `Checkbox` the card selects with. It is named by `label` and described by `description` and `trailing`. */
  control: ReactElement
  /** The card's title: the name of the choice. */
  label: ReactNode
  /** One line under the title. */
  description?: ReactNode
  /** A value at the end of the title row (a price with its unit line); described to assistive tech. */
  trailing?: ReactNode
  /** A picture above the title row: a thumbnail, a swatch strip, a mini layout. Decorative; the label names the choice. */
  preview?: ReactNode
  /** Layout only (`w-full`, `max-w-sm`). */
  className?: string
}

/**
 * A selectable card: a title, a line of text, an optional trailing value and an optional preview
 * slot around one `Radio` or `Checkbox`. The whole card is the `<label>`, so a click anywhere selects.
 * `RadioGroup` and `CheckboxGroup` draw `options` with it when their `variant` is `card` or `tile`;
 * use it directly when a card needs its own children.
 *
 * @useWhen a choice carries a description, a price or a picture and the options sit side by side
 * @neverWhen the options are plain one-line labels (use a RadioGroup or CheckboxGroup list)
 * @example
 * <ChoiceCard control={<Radio value="pro" />} label="Pro" description="Team seats" trailing="€12" />
 */
export function ChoiceCard({
  control,
  label,
  description,
  trailing,
  preview,
  className,
}: ChoiceCardProps): ReactElement {
  const labelId = useId()
  const descriptionId = useId()
  const trailingId = useId()
  const describedBy = [
    description === undefined ? undefined : descriptionId,
    trailing === undefined ? undefined : trailingId,
  ]
    .filter((id) => id !== undefined)
    .join(' ')
  return (
    <label data-slot="choice-card" className={cn(choiceCardVariants(), className)}>
      {preview !== undefined && (
        <span aria-hidden="true" className="block overflow-hidden rounded-ctrl">
          {preview}
        </span>
      )}
      <span className="flex items-start gap-2">
        {cloneElement(control, {
          'aria-labelledby': labelId,
          'aria-describedby': describedBy === '' ? undefined : describedBy,
          className: cn('mt-0.5', (control.props as { className?: string }).className),
        } as Record<string, unknown>)}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span id={labelId} className="text-sm font-medium text-foreground">
            {label}
          </span>
          {description !== undefined && (
            <span id={descriptionId} className="text-xs text-muted-foreground">
              {description}
            </span>
          )}
        </span>
        {trailing !== undefined && (
          <span
            id={trailingId}
            className="shrink-0 text-right text-sm font-medium text-foreground tabular-nums"
          >
            {trailing}
          </span>
        )}
      </span>
    </label>
  )
}
