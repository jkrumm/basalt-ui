import type { OneTimeCodeProps } from './one-time-code'

/**
 * Hand-authored guard for `one-time-code` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject. The guard pins the props a caller binds.
 */

// basalt:guard requires
type CalledOneTimeCode = {
  length?: number
  value?: string
  onValueChange?: (value: string) => void
  onComplete?: (value: string) => void
  name?: string
  disabled?: boolean
  onBlur?: () => void
}

export const requiresOneTimeCode = (
  c: CalledOneTimeCode,
): Pick<
  OneTimeCodeProps,
  'length' | 'value' | 'onValueChange' | 'onComplete' | 'name' | 'disabled' | 'onBlur'
> => c

// basalt:guard closed
// @ts-expect-error the code is one string
export const listed: Pick<OneTimeCodeProps, 'value'> = { value: ['1'] }
