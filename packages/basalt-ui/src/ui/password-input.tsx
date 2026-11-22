import { Button as BaseButton } from '@base-ui/react/button'
import { Input as BaseInput } from '@base-ui/react/input'
import { useState } from 'react'
import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import { scopeClass, useControlScope } from '../core/control-scope'
import { base as baseMessages } from '../core/messages/base'
import { useMessages } from '../core/messages/use-messages'
import { buttonVariants } from './button'
import { inputVariants } from './input'
import type { InputProps } from './input'

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const passwordInputParts = ['password-input'] as const

export type PasswordInputProps = Omit<InputProps, 'type' | 'start' | 'end'>

function EyeGlyph({ open }: { open: boolean }): ReactElement {
  return (
    <svg viewBox="0 0 16 16" className="size-icon" fill="none" aria-hidden="true">
      <path
        d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8z"
        stroke="currentColor"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="2" stroke="currentColor" />
      {!open && <path d="M2.5 13.5l11-11" stroke="currentColor" strokeLinecap="round" />}
    </svg>
  )
}

/**
 * A password field with a reveal button at its end. The button shows the text and flips its own
 * name ("Show password", "Hide password") and `aria-pressed`; it acts on this field only. Name the
 * field's `autoComplete`: `current-password` to sign in, `new-password` to set one.
 *
 * @useWhen a password to sign in with or to set
 * @neverWhen a secret the user copies rather than types (use Input readOnly with a CopyButton at its end)
 * @example
 * <PasswordInput autoComplete="current-password" aria-label="Password" />
 */
export function PasswordInput({ size, className, ...props }: PasswordInputProps): ReactElement {
  const t = useMessages(baseMessages)
  const scope = useControlScope()
  const [shown, setShown] = useState(false)
  return (
    <div
      data-input-group=""
      className={cn('relative w-full min-w-0', scopeClass(scope), className)}
    >
      <BaseInput
        {...props}
        type={shown ? 'text' : 'password'}
        data-slot="password-input"
        className={cn(inputVariants({ size: size ?? scope?.size }), 'pe-8')}
      />
      <span className="absolute inset-y-0 end-0 flex items-center pe-2.5 text-muted-foreground">
        <BaseButton
          aria-label={shown ? t('base.password.hide') : t('base.password.show')}
          aria-pressed={shown}
          disabled={props.disabled}
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm', shape: 'icon' }),
            '-me-1.5 text-muted-foreground',
          )}
          onClick={() => setShown((was) => !was)}
        >
          <EyeGlyph open={shown} />
        </BaseButton>
      </span>
    </div>
  )
}
