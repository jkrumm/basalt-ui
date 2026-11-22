import type { ReactElement } from 'react'
import type { ChoiceCardProps } from './choice-card'

/**
 * Hand-authored guard for `choice-card` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject. The guard pins the props a caller binds.
 */

// basalt:guard requires
type CalledChoiceCard = {
  control: ReactElement
  label: string
  description?: string
  trailing?: string
  className?: string
}

export const requiresChoiceCard = (
  c: CalledChoiceCard,
): Pick<ChoiceCardProps, 'control' | 'label' | 'description' | 'trailing' | 'className'> => c

// basalt:guard closed
// @ts-expect-error a card is named by its label
export const unlabelled: Pick<ChoiceCardProps, 'label'> = {}
