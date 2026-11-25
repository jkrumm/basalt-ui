import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox'
import { CheckboxGroup as BaseCheckboxGroup } from '@base-ui/react/checkbox-group'
import { cva } from 'class-variance-authority'
import { useId } from 'react'
import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import { ChoiceCard } from './choice-card'
import type { ChoiceOption, ChoiceVariant } from './radio-group'

/**
 * The `CheckboxGroup` cva table. `list` stacks the options with one gap, wide enough on a coarse
 * pointer that no two 44 px hit areas overlap; `card` stacks choice cards; `tile` lays them in a
 * wrapping grid for options with a preview. Display belongs to the table, so a caller never
 * re-lays the group out.
 *
 * @example
 * checkboxGroupVariants({ variant: 'card' }) // class string for a hand-built wrapper
 */
export const checkboxGroupVariants = cva('', {
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
 * The `Checkbox` cva table: a 16 px box with a check (or a dash when indeterminate). The root is a
 * `<span>`, not a button. It stays 16 px on every pointer and grows only its invisible `::after`
 * hit area, to 24 px for a fine pointer and 44 px for a coarse one. A read-only box keeps its state
 * on the inset surface with a muted check, no border and no hover; it never takes the disabled
 * opacity. No axes.
 *
 * @example
 * checkboxVariants() // class string for a hand-built checkbox
 */
export const checkboxVariants = cva(
  'group relative inline-flex size-4 shrink-0 items-center justify-center rounded-ctrl border border-input bg-background text-on-brand focus-ring transition-colors after:absolute after:top-1/2 after:left-1/2 after:size-6 after:-translate-1/2 pointer-coarse:after:size-11 data-checked:border-brand-fill data-checked:bg-brand-fill data-indeterminate:border-brand-fill data-indeterminate:bg-brand-fill data-invalid:border-bad data-readonly:cursor-default data-readonly:border-transparent data-readonly:bg-inset data-readonly:text-muted-foreground data-readonly:data-checked:border-transparent data-readonly:data-checked:bg-inset data-readonly:data-checked:text-muted-foreground data-readonly:data-indeterminate:border-transparent data-readonly:data-indeterminate:bg-inset data-readonly:data-indeterminate:text-muted-foreground data-disabled:opacity-50',
)

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const checkboxParts = ['checkbox-group', 'checkbox'] as const

type Layout<P> = Omit<P, 'className'> & {
  /** Layout only (`w-full`, `max-w-sm`, `mt-2`). Display belongs to the part. */
  className?: string
}

export type CheckboxGroupProps = Layout<BaseCheckboxGroup.Props> & {
  /** The choices, each a row with its label and description. When given, it replaces `children`. */
  options?: readonly ChoiceOption[]
  /** `list` (default) is plain rows; `card` and `tile` draw each option as a `ChoiceCard`. Needs `options`. */
  variant?: ChoiceVariant
}
export type CheckboxProps = Layout<Omit<BaseCheckbox.Root.Props, 'children'>>

/**
 * A group of checkboxes on Base UI: the value is the list of checked options' `value`s. Works with
 * no provider and joins a Base UI `Field` when wrapped in one. Name each checkbox with a wrapping
 * `<label>`, or give `options` and each row is labelled and described for you. `variant="card"` or
 * `"tile"` draws the options as selectable cards.
 *
 * @example
 * <CheckboxGroup value={tags} onValueChange={setTags} aria-label="Tags"
 *   options={[{ value: 'ops', label: 'Ops', description: 'Pages the on-call' }]} />
 * <CheckboxGroup value={tags} onValueChange={setTags} aria-label="Tags">
 *   <label className="flex items-center gap-2 text-sm"><Checkbox value="ops" />Ops</label>
 *   <label className="flex items-center gap-2 text-sm"><Checkbox value="dev" />Dev</label>
 * </CheckboxGroup>
 */
export function CheckboxGroup({
  className,
  variant = 'list',
  options,
  children,
  ...props
}: CheckboxGroupProps): ReactElement {
  const group = (
    <BaseCheckboxGroup
      {...props}
      data-slot="checkbox-group"
      data-variant={variant}
      className={cn(checkboxGroupVariants({ variant }), className)}
    >
      {options === undefined
        ? children
        : options.map((option) => (
            <CheckboxOption key={String(option.value)} option={option} variant={variant} />
          ))}
    </BaseCheckboxGroup>
  )
  // The tile grid keys its columns on the width its box is given, so it sits in a size container.
  return variant === 'tile' ? <div className="@container min-w-0">{group}</div> : group
}

/**
 * One checkbox, alone or inside a `CheckboxGroup`. Space toggles it; `indeterminate` shows a dash.
 * Its root is a `<span role="checkbox">`, so find it by role `checkbox`, never `button`. The check is
 * drawn by the part; children are not accepted.
 *
 * @useWhen a yes or no the user sets, or several independent choices in a `CheckboxGroup`
 * @neverWhen a setting that applies at once (use Switch), or exactly one of several (use RadioGroup)
 * @example
 * <label className="flex items-center gap-2 text-sm">
 *   <Checkbox checked={agreed} onCheckedChange={setAgreed} />I agree
 * </label>
 */
export function Checkbox({ className, ...props }: CheckboxProps): ReactElement {
  return (
    <BaseCheckbox.Root
      {...props}
      data-slot="checkbox"
      className={cn(checkboxVariants(), className)}
    >
      <BaseCheckbox.Indicator className="flex">
        <svg
          viewBox="0 0 12 12"
          className="size-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M2.5 6.5l2.5 2.5 4.5-5.5" className="group-data-indeterminate:hidden" />
          <path d="M2.5 6h7" className="hidden group-data-indeterminate:block" />
        </svg>
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  )
}

/**
 * One `options` row: the checkbox on the first text line, then the label and the description. The
 * label names the checkbox; the description describes it. The row is a `<label>`.
 */
function CheckboxOption({
  option,
  variant,
}: {
  option: ChoiceOption
  variant: ChoiceVariant
}): ReactElement {
  const labelId = useId()
  const descriptionId = useId()
  const hasDescription = option.description !== undefined
  if (variant !== 'list') {
    return (
      <ChoiceCard
        control={<Checkbox value={option.value} disabled={option.disabled ?? false} />}
        label={option.label}
        {...(option.description !== undefined && { description: option.description })}
        {...(option.trailing !== undefined && { trailing: option.trailing })}
        {...(option.preview !== undefined && { preview: option.preview })}
      />
    )
  }
  return (
    <label className="flex items-start gap-2">
      <Checkbox
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
