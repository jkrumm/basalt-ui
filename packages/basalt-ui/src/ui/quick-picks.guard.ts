import type { QuickPicksProps } from './quick-picks'

/**
 * Hand-authored guard for `quick-picks` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject. The guard pins the props a caller binds.
 */

// basalt:guard requires
type CalledQuickPicks = {
  options: readonly { value: string; label: string }[]
  value?: string | undefined
  onValueChange?: (value: string) => void
  disabled?: boolean
}

export const requiresQuickPicks = (
  c: CalledQuickPicks,
): Pick<QuickPicksProps, 'options' | 'value' | 'onValueChange' | 'disabled'> => c

// basalt:guard closed
// @ts-expect-error the picks are the component's options
export const optionless: Pick<QuickPicksProps, 'options'> = {}
