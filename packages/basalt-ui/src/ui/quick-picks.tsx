import { Radio as BaseRadio } from '@base-ui/react/radio'
import { RadioGroup as BaseRadioGroup } from '@base-ui/react/radio-group'
import { cva } from 'class-variance-authority'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'

/**
 * The `QuickPicks` cva table: the pills in a wrapping row. A coarse pointer opens the rows up so the
 * 44 px hit areas of two pills never overlap. No axes.
 *
 * @example
 * quickPicksVariants() // class string for a hand-built row
 */
export const quickPicksVariants = cva('flex flex-wrap items-center gap-2 pointer-coarse:gap-y-5')

/**
 * The pill table: a 24 px pill that stays 24 px on every pointer and grows only its invisible
 * `::after` hit area to 44 px for a coarse one. The picked pill is filled with ink, so the state
 * never rides on color alone.
 */
const quickPickVariants = cva(
  'relative inline-flex h-6 cursor-pointer items-center rounded-full border border-input bg-background px-3 text-xs text-foreground transition-colors select-none focus-ring after:absolute after:inset-x-0 after:top-1/2 after:h-6 after:-translate-y-1/2 pointer-coarse:after:h-11 hover:bg-accent data-checked:border-transparent data-checked:bg-primary data-checked:text-primary-foreground data-disabled:cursor-not-allowed data-disabled:opacity-50',
)

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const quickPicksParts = ['quick-picks'] as const

export type QuickPick = {
  /** What the pick writes into the field it feeds. */
  value: string
  label: ReactNode
  disabled?: boolean
}

export type QuickPicksProps = {
  options: readonly QuickPick[]
  /** The field's current value: the pill whose `value` equals it is picked, none when it matches no pill. */
  value?: string | undefined
  /** Fires with the picked pill's `value`: write it into the field. */
  onValueChange?: (value: string) => void
  disabled?: boolean
  /** Names the row: "Due date shortcuts". */
  'aria-label'?: string
  'aria-labelledby'?: string
  /** Layout only (`mb-1`). */
  className?: string
}

/**
 * A row of shortcut pills that write one value into the field they sit with (Today, Tomorrow, In 3
 * days into a date input). It holds no value of its own: it shows a pill picked while the field
 * equals that pill's `value`, so typing a different value clears the pick. One tab stop, arrow keys
 * move through the pills. Compose it above or beside the field it feeds, in one `Field`.
 *
 * @useWhen a field has a few common values worth one click: dates, durations, amounts
 * @neverWhen the pills are the field's only values (use Segmented or RadioGroup) or there are more than about six
 * @example
 * <QuickPicks aria-label="Due date shortcuts" value={due} onValueChange={setDue}
 *   options={[{ value: today, label: 'Today' }, { value: tomorrow, label: 'Tomorrow' }]} />
 * <Input type="date" value={due} onValueChange={setDue} />
 */
export function QuickPicks({
  options,
  value,
  onValueChange,
  disabled,
  className,
  ...names
}: QuickPicksProps): ReactElement {
  return (
    <BaseRadioGroup
      {...names}
      value={value === undefined || !options.some((o) => o.value === value) ? null : value}
      disabled={disabled ?? false}
      onValueChange={(next) => onValueChange?.(String(next))}
      data-slot="quick-picks"
      className={cn(quickPicksVariants(), className)}
    >
      {options.map((option) => (
        <BaseRadio.Root
          key={option.value}
          value={option.value}
          disabled={option.disabled ?? false}
          className={quickPickVariants()}
        >
          {option.label}
        </BaseRadio.Root>
      ))}
    </BaseRadioGroup>
  )
}
