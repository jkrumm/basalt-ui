---
name: OneTimeCode
use when: 'a short code the user receives and types: a sign-in or verification code, a PIN'
never when: 'the secret is long or free-form (use PasswordInput) or the digits are a quantity (use NumberField)'
subpath: basalt-ui/ui/one-time-code
peers: ['@base-ui/react']
slots: [one-time-code]
---

# OneTimeCode

A verification code in one box per character, on Base UI's OTP field. The first box carries
`autocomplete="one-time-code"`, so the platform suggestion (an SMS code, a password manager)
fills every box at once; a pasted code does the same; the digit keypad opens on touch. Typing
moves on, Backspace moves back, the arrows move between boxes. `aria-invalid` is the error state
of the whole code. Works with no provider and joins a Base UI `Field` when wrapped in one.

## Props

### `OneTimeCode`

```ts
OneTimeCode({ length, onValueChange, onComplete, "aria-invalid": invalid, "aria-label": ariaLabel, "aria-labelledby": ariaLabelledBy, "aria-describedby": ariaDescribedBy, onBlur, className, ...props }: OneTimeCodeProps): ReactElement
  length?: number  // The number of boxes
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  onComplete?: (value: string) => void  // Fires once the last box is filled, also when a complete code is pasted
  validationType?: "none" | "numeric" | "alpha" | "alphanumeric"  // `numeric` (default, opens the digit keypad), `alpha`, `alphanumeric` or `none`
  mask?: boolean  // Hides the characters like a password
  name?: string
  required?: boolean
  disabled?: boolean
  readOnly?: boolean
  aria-invalid?: boolean
  aria-label?: string
  aria-labelledby?: string
  aria-describedby?: string
  onBlur?: () => void  // Fires once when focus leaves the whole code: the validate-on-blur hook
  className?: string  // Layout only (`justify-center`)
```

## `oneTimeCodeVariants`

Part `one-time-code`.

No variant axes.

## Slots

- `one-time-code`
