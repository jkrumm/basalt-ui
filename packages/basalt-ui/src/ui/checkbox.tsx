import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox'
import { CheckboxGroup as BaseCheckboxGroup } from '@base-ui/react/checkbox-group'
import { cva } from 'class-variance-authority'
import type { ReactElement } from 'react'
import { cn } from '../core/cn'

/**
 * The `CheckboxGroup` cva table: the options stacked with one gap, wide enough on a coarse pointer
 * that no two 44 px hit areas overlap. No axes; display belongs to the table, so a caller never
 * re-lays the group out.
 *
 * @example
 * checkboxGroupVariants() // class string for a hand-built wrapper
 */
export const checkboxGroupVariants = cva('flex flex-col gap-2 pointer-coarse:gap-7')

/**
 * The `Checkbox` cva table: a 16 px box with a check (or a dash when indeterminate). The root is a
 * `<span>`, not a button. It stays 16 px on every pointer and grows only its invisible `::after`
 * hit area, to 24 px for a fine pointer and 44 px for a coarse one. No axes.
 *
 * @example
 * checkboxVariants() // class string for a hand-built checkbox
 */
export const checkboxVariants = cva(
  'group relative inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-ctrl border border-input bg-background text-on-brand focus-ring transition-colors after:absolute after:top-1/2 after:left-1/2 after:size-6 after:-translate-1/2 pointer-coarse:after:size-11 data-checked:border-brand-fill data-checked:bg-brand-fill data-indeterminate:border-brand-fill data-indeterminate:bg-brand-fill data-invalid:border-bad data-disabled:cursor-not-allowed data-disabled:opacity-50',
)

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const checkboxParts = ['checkbox-group', 'checkbox'] as const

type Layout<P> = Omit<P, 'className'> & {
  /** Layout only (`w-full`, `max-w-sm`, `mt-2`). Display belongs to the part. */
  className?: string
}

export type CheckboxGroupProps = Layout<BaseCheckboxGroup.Props>
export type CheckboxProps = Layout<Omit<BaseCheckbox.Root.Props, 'children'>>

/**
 * A group of checkboxes on Base UI: the value is the list of checked options' `value`s. Works with
 * no provider and joins a Base UI `Field` when wrapped in one. Name each checkbox with a wrapping
 * `<label>`.
 *
 * @example
 * <CheckboxGroup value={tags} onValueChange={setTags} aria-label="Tags">
 *   <label className="flex items-center gap-2 text-sm"><Checkbox value="ops" />Ops</label>
 *   <label className="flex items-center gap-2 text-sm"><Checkbox value="dev" />Dev</label>
 * </CheckboxGroup>
 */
export function CheckboxGroup({ className, ...props }: CheckboxGroupProps): ReactElement {
  return (
    <BaseCheckboxGroup
      {...props}
      data-slot="checkbox-group"
      className={cn(checkboxGroupVariants(), className)}
    />
  )
}

/**
 * One checkbox, alone or inside a `CheckboxGroup`. Space toggles it; `indeterminate` shows a dash.
 * Its root is a `<span role="checkbox">`, so find it by role `checkbox`, never `button`. The check is
 * drawn by the part; children are not accepted.
 *
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
