import { Radio as BaseRadio } from '@base-ui/react/radio'
import { RadioGroup as BaseRadioGroup } from '@base-ui/react/radio-group'
import { cva } from 'class-variance-authority'
import type { ReactElement } from 'react'
import { cn } from '../core/cn'

/**
 * The `RadioGroup` cva table: the options stacked with one gap, wide enough on a coarse pointer that no two 44 px hit areas overlap. No axes; display belongs to the
 * table, so a caller never re-lays the group out.
 *
 * @example
 * radioGroupVariants() // class string for a hand-built wrapper
 */
export const radioGroupVariants = cva('flex flex-col gap-2 pointer-coarse:gap-7')

/**
 * The `Radio` cva table: a 16 px ring with a dot when selected. It stays 16 px on every pointer and
 * grows only its invisible `::after` hit area, to 24 px for a fine pointer and 44 px for a coarse
 * one. No axes.
 *
 * @example
 * radioVariants() // class string for a hand-built radio
 */
export const radioVariants = cva(
  'relative inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-full border border-input bg-background focus-ring transition-colors after:absolute after:top-1/2 after:left-1/2 after:size-6 after:-translate-1/2 pointer-coarse:after:size-11 data-checked:border-brand-fill data-checked:bg-brand-fill data-invalid:border-bad data-disabled:cursor-not-allowed data-disabled:opacity-50',
)

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const radioGroupParts = ['radio-group', 'radio'] as const

type Layout<P> = Omit<P, 'className'> & {
  /** Layout only (`w-full`, `max-w-sm`, `mt-2`). Display belongs to the part. */
  className?: string
}

export type RadioGroupProps<Value = string> = Layout<BaseRadioGroup.Props<Value>>
export type RadioProps<Value = string> = Layout<Omit<BaseRadio.Root.Props<Value>, 'children'>>

/**
 * A group of radios on Base UI: one selected value, arrow keys move it in DOM order. Works with no
 * provider and joins a Base UI `Field` when wrapped in one. Name each radio with a wrapping
 * `<label>`.
 *
 * @example
 * <RadioGroup value={plan} onValueChange={setPlan} aria-label="Plan">
 *   <label className="flex items-center gap-2 text-sm"><Radio value="free" />Free</label>
 *   <label className="flex items-center gap-2 text-sm"><Radio value="pro" />Pro</label>
 * </RadioGroup>
 */
export function RadioGroup<Value = string>({
  className,
  ...props
}: RadioGroupProps<Value>): ReactElement {
  return (
    <BaseRadioGroup
      {...props}
      data-slot="radio-group"
      className={cn(radioGroupVariants(), className)}
    />
  )
}

/**
 * One option of a `RadioGroup`. Its selected dot is drawn by the part; children are not accepted.
 *
 * @example
 * <Radio value="pro" />
 */
export function Radio<Value = string>({ className, ...props }: RadioProps<Value>): ReactElement {
  return (
    <BaseRadio.Root {...props} data-slot="radio" className={cn(radioVariants(), className)}>
      <BaseRadio.Indicator className="size-1.5 rounded-full bg-on-brand" />
    </BaseRadio.Root>
  )
}
