import { OTPField as BaseOTPField } from '@base-ui/react/otp-field'
import { cva } from 'class-variance-authority'
import { useId } from 'react'
import type { FocusEvent, ReactElement } from 'react'
import { cn } from '../core/cn'
import { base as baseMessages } from '../core/messages/base'
import { useMessages } from '../core/messages/use-messages'

/**
 * The `OneTimeCode` cva table: the row of boxes, one gap apart. No axes; display belongs to the
 * table, so a caller never re-lays the row out.
 *
 * @example
 * oneTimeCodeVariants() // class string for a hand-built row
 */
export const oneTimeCodeVariants = cva('flex items-center gap-2')

/**
 * The box table: 40 by 44 px, one character centred at 16 px (below that iOS Safari zooms the page
 * on focus). Focus outlines the box; an invalid code turns every box red; a disabled one fades.
 */
const oneTimeCodeInputVariants = cva(
  'h-11 w-10 min-w-0 pointer-coarse:w-11 rounded-ctrl border border-input bg-field p-0 text-center text-base text-foreground tabular-nums focus-ring transition-colors aria-invalid:border-bad data-invalid:border-bad data-disabled:cursor-not-allowed data-disabled:opacity-50 read-only:border-transparent read-only:bg-inset',
)

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const oneTimeCodeParts = ['one-time-code'] as const

export type OneTimeCodeProps = {
  /** The number of boxes. Default 6. */
  length?: number
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  /** Fires once the last box is filled, also when a complete code is pasted. */
  onComplete?: (value: string) => void
  /** `numeric` (default, opens the digit keypad), `alpha`, `alphanumeric` or `none`. */
  validationType?: 'numeric' | 'alpha' | 'alphanumeric' | 'none'
  /** Hides the characters like a password. */
  mask?: boolean
  name?: string
  required?: boolean
  disabled?: boolean
  readOnly?: boolean
  /** The error state of the whole code: every box turns red and `aria-invalid`. */
  'aria-invalid'?: boolean
  /** Names the group and the first box; every later box is named "Character n of N". */
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
  /** Fires once when focus leaves the whole code: the validate-on-blur hook. */
  onBlur?: () => void
  /** Layout only (`justify-center`). */
  className?: string
}

/**
 * A verification code in one box per character, on Base UI's OTP field. The first box carries
 * `autocomplete="one-time-code"`, so the platform suggestion (an SMS code, a password manager)
 * fills every box at once; a pasted code does the same; the digit keypad opens on touch. Typing
 * moves on, Backspace moves back, the arrows move between boxes. `aria-invalid` is the error state
 * of the whole code. Works with no provider and joins a Base UI `Field` when wrapped in one.
 *
 * @useWhen a short code the user receives and types: a sign-in or verification code, a PIN
 * @neverWhen the secret is long or free-form (use PasswordInput) or the digits are a quantity (use NumberField)
 * @example
 * <OneTimeCode aria-label="Verification code" value={code} onValueChange={setCode}
 *   onComplete={verify} aria-invalid={wrong} />
 */
export function OneTimeCode({
  length = 6,
  onValueChange,
  onComplete,
  'aria-invalid': invalid = false,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  onBlur,
  className,
  ...props
}: OneTimeCodeProps): ReactElement {
  const t = useMessages(baseMessages)
  const id = useId()
  const onFocusOut = (event: FocusEvent<HTMLDivElement>): void => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))
      return
    onBlur?.()
  }
  return (
    <BaseOTPField.Root
      {...props}
      length={length}
      id={id}
      {...(ariaLabelledBy !== undefined && { 'aria-labelledby': ariaLabelledBy })}
      aria-describedby={ariaDescribedBy}
      data-slot="one-time-code"
      className={cn(oneTimeCodeVariants(), className)}
      onValueChange={(next) => onValueChange?.(next)}
      onValueComplete={(next) => onComplete?.(next)}
      onBlur={onFocusOut}
    >
      {/* Base UI names the group and the first box from a label for the first box, so a bare `aria-label` becomes one. */}
      {ariaLabelledBy === undefined && ariaLabel !== undefined && (
        <label htmlFor={id} className="sr-only">
          {ariaLabel}
        </label>
      )}
      {Array.from({ length }, (_, index) => (
        <BaseOTPField.Input
          key={index}
          {...(index > 0 && { 'aria-label': t('base.otp.character', index + 1, length) })}
          {...(index === 0 &&
            ariaLabelledBy !== undefined && { 'aria-labelledby': ariaLabelledBy })}
          aria-invalid={invalid || undefined}
          className={oneTimeCodeInputVariants()}
        />
      ))}
    </BaseOTPField.Root>
  )
}
