import { Switch as BaseSwitch } from '@base-ui/react/switch'
import { cva } from 'class-variance-authority'
import type { ReactElement } from 'react'
import { cn } from '../core/cn'

/**
 * The `Switch` cva table: a 36 x 20 px track with a thumb. It keeps that size on every pointer and
 * grows only its invisible `::after` hit area, to 24 px for a fine pointer and 44 px for a coarse
 * one. No axes.
 *
 * @example
 * switchVariants() // class string for a hand-built switch
 */
export const switchVariants = cva(
  'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-input p-0.5 focus-ring transition-colors after:absolute after:top-1/2 after:left-1/2 after:h-6 after:w-full after:min-w-6 after:-translate-1/2 pointer-coarse:after:h-11 pointer-coarse:after:min-w-11 data-checked:bg-brand-fill data-invalid:ring-1 data-invalid:ring-bad data-disabled:cursor-not-allowed data-disabled:opacity-50',
)

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const switchParts = ['switch'] as const

export type SwitchProps = Omit<BaseSwitch.Root.Props, 'className' | 'children'> & {
  /** Layout only (`mt-1`, `shrink-0`). Size belongs to the part. */
  className?: string
}

/**
 * An on/off switch on Base UI; Space toggles it. Works with no provider and joins a Base UI `Field`
 * when wrapped in one. Name it with a wrapping `<label>` or `aria-label`.
 *
 * @example
 * <label className="flex items-center gap-2 text-sm">
 *   <Switch checked={on} onCheckedChange={setOn} />Notifications
 * </label>
 */
export function Switch({ className, ...props }: SwitchProps): ReactElement {
  return (
    <BaseSwitch.Root {...props} data-slot="switch" className={cn(switchVariants(), className)}>
      <BaseSwitch.Thumb className="pointer-events-none block size-4 rounded-full bg-background shadow-raised transition-transform motion-reduce:transition-none data-checked:translate-x-4" />
    </BaseSwitch.Root>
  )
}
