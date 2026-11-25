import { Radio as BaseRadio } from '@base-ui/react/radio'
import { RadioGroup as BaseRadioGroup } from '@base-ui/react/radio-group'
import { cva } from 'class-variance-authority'
import { useId } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import { ChoiceCard } from './choice-card'

/**
 * The `RadioGroup` cva table. `list` stacks the options with one gap, wide enough on a coarse pointer
 * that no two 44 px hit areas overlap; `card` stacks choice cards; `tile` lays them in a wrapping
 * grid for options with a preview. Display belongs to the table, so a caller never re-lays the
 * group out.
 *
 * @example
 * radioGroupVariants({ variant: 'card' }) // class string for a hand-built wrapper
 */
export const radioGroupVariants = cva('', {
  variants: {
    variant: {
      list: 'flex flex-col gap-2 pointer-coarse:gap-7',
      card: 'flex flex-col gap-2',
      tile: 'grid grid-cols-1 gap-2 @narrow:grid-cols-2 @regular:grid-cols-3 @wide:grid-cols-4',
    },
  },
  defaultVariants: { variant: 'list' },
})

/**
 * The `Radio` cva table: a 16 px ring with a dot when selected. It stays 16 px on every pointer and
 * grows only its invisible `::after` hit area, to 24 px for a fine pointer and 44 px for a coarse
 * one. No axes.
 *
 * @example
 * radioVariants() // class string for a hand-built radio
 */
export const radioVariants = cva(
  'relative inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-input bg-background focus-ring transition-colors after:absolute after:top-1/2 after:left-1/2 after:size-6 after:-translate-1/2 pointer-coarse:after:size-11 data-checked:border-brand-fill data-checked:bg-brand-fill data-invalid:border-bad data-disabled:opacity-50',
)

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const radioGroupParts = ['radio-group', 'radio'] as const

type Layout<P> = Omit<P, 'className'> & {
  /** Layout only (`w-full`, `max-w-sm`, `mt-2`). Display belongs to the part. */
  className?: string
}

/** One choice of a `RadioGroup` or `CheckboxGroup` given as `options`: a label and an optional description. */
export type ChoiceOption<Value = string> = {
  value: Value
  label: ReactNode
  description?: ReactNode
  disabled?: boolean
  /** A value at the end of the title row (a price). Drawn by the `card` and `tile` variants only. */
  trailing?: ReactNode
  /** A picture above the title row. Drawn by the `card` and `tile` variants only. */
  preview?: ReactNode
}

/** How a group draws its `options`: plain rows, stacked cards, or cards in a wrapping grid. */
export type ChoiceVariant = 'list' | 'card' | 'tile'

export type RadioGroupProps<Value = string> = Layout<BaseRadioGroup.Props<Value>> & {
  /** The choices, each a row with its label and description. When given, it replaces `children`. */
  options?: readonly ChoiceOption<Value>[]
  /** `list` (default) is plain rows; `card` and `tile` draw each option as a `ChoiceCard`. Needs `options`. */
  variant?: ChoiceVariant
}
export type RadioProps<Value = string> = Layout<Omit<BaseRadio.Root.Props<Value>, 'children'>>

/**
 * A group of radios on Base UI: one selected value, arrow keys move it in DOM order. Works with no
 * provider and joins a Base UI `Field` when wrapped in one. Name each radio with a wrapping
 * `<label>`, or give `options` and each row is labelled and described for you. `variant="card"` or
 * `"tile"` draws the options as selectable cards with a trailing value and a preview.
 *
 * @useWhen one value of a few (up to about five) that the user should see all at once
 * @neverWhen more than about five options (use Select), several values at once (use Checkbox), or a view switch (use Segmented)
 * @example
 * <RadioGroup value={plan} onValueChange={setPlan} aria-label="Plan"
 *   options={[{ value: 'pro', label: 'Pro', description: 'Team seats and audit log' }]} />
 * <RadioGroup variant="card" value={plan} onValueChange={setPlan} aria-label="Plan"
 *   options={[{ value: 'pro', label: 'Pro', description: 'Team seats', trailing: '€12 / seat' }]} />
 * <RadioGroup value={plan} onValueChange={setPlan} aria-label="Plan">
 *   <label className="flex items-center gap-2 text-sm"><Radio value="free" />Free</label>
 *   <label className="flex items-center gap-2 text-sm"><Radio value="pro" />Pro</label>
 * </RadioGroup>
 */
export function RadioGroup<Value = string>({
  className,
  variant = 'list',
  options,
  children,
  ...props
}: RadioGroupProps<Value>): ReactElement {
  const group = (
    <BaseRadioGroup
      {...props}
      data-slot="radio-group"
      data-variant={variant}
      className={cn(radioGroupVariants({ variant }), className)}
    >
      {options === undefined
        ? children
        : options.map((option) => (
            <RadioOption key={String(option.value)} option={option} variant={variant} />
          ))}
    </BaseRadioGroup>
  )
  // The tile grid keys its columns on the width its box is given, so it sits in a size container.
  return variant === 'tile' ? <div className="@container min-w-0">{group}</div> : group
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

/**
 * One `options` row: the control on the first text line, then the label and the description. The
 * label names the control; the description describes it. The row is a `<label>`, so a click on
 * either text selects the option.
 */
function RadioOption<Value>({
  option,
  variant,
}: {
  option: ChoiceOption<Value>
  variant: ChoiceVariant
}): ReactElement {
  const labelId = useId()
  const descriptionId = useId()
  const hasDescription = option.description !== undefined
  if (variant !== 'list') {
    return (
      <ChoiceCard
        control={<Radio value={option.value} disabled={option.disabled ?? false} />}
        label={option.label}
        {...(option.description !== undefined && { description: option.description })}
        {...(option.trailing !== undefined && { trailing: option.trailing })}
        {...(option.preview !== undefined && { preview: option.preview })}
      />
    )
  }
  return (
    <label className="flex items-start gap-2">
      <Radio
        value={option.value}
        disabled={option.disabled ?? false}
        className="mt-0.5"
        aria-labelledby={labelId}
        aria-describedby={hasDescription ? descriptionId : undefined}
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span id={labelId} className="text-sm text-foreground">
          {option.label}
        </span>
        {hasDescription && (
          <span id={descriptionId} className="text-xs text-muted-foreground">
            {option.description}
          </span>
        )}
      </span>
    </label>
  )
}
