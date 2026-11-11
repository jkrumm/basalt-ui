import type { AlertProps } from './alert'

/**
 * Hand-authored guard for `alert` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject. The `role` is the tone's: it is not a prop.
 */

// basalt:guard requires
type Called = {
  tone?: 'neutral' | 'accent' | 'good' | 'warn' | 'bad' | 'info'
  title?: string
}

export const requires = (c: Called): Pick<AlertProps, 'tone' | 'title'> => c

// basalt:guard closed
// @ts-expect-error tone is a closed union, not a free string
export const closedTone: Pick<AlertProps, 'tone'> = { tone: 'purple' }

// @ts-expect-error the role follows the tone and cannot be passed
export const noRole: Pick<AlertProps, 'role'> = { role: 'alert' }
