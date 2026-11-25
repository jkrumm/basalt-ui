---
name: PasswordInput
use when: 'a password to sign in with or to set'
never when: 'a secret the user copies rather than types (use Input readOnly with a CopyButton at its end)'
subpath: basalt-ui/ui/password-input
peers: ['@base-ui/react']
slots: [password-input]
---

# PasswordInput

A password field with a reveal button at its end. The button shows the text and flips its own
name ("Show password", "Hide password") and `aria-pressed`; it acts on this field only. Name the
field's `autoComplete`: `current-password` to sign in, `new-password` to set one.

## Props

### `PasswordInput`

```ts
PasswordInput({ size, className, ...props }: PasswordInputProps): ReactElement
  className?: string  // Layout only (`w-full`, `max-w-xs`, `flex-1`)
  size?: "sm" | "md" | null
```

## Slots

- `password-input`
