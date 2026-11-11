import type { ToastProps } from './toast'

/**
 * Hand-authored guard for `toast` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject. The one axis is `tone`.
 */

// basalt:guard requires
type CalledToast = { tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info' }

export const requiresToast = (c: CalledToast): Pick<ToastProps, 'tone'> => c

// basalt:guard closed
// @ts-expect-error a tone outside the union is a type error
export const closedTone: Pick<ToastProps, 'tone'> = { tone: 'loud' }
