---
name: Alert
use when: 'the page must say something about its own state next to the content it concerns: a failed sync, a warning'
never when: 'the message is transient feedback after an action (use `notify`) or a card-level state (use `Callout` or a part''s own phase)'
subpath: basalt-ui/ui/alert
peers: []
slots: [alert]
---

# Alert

An inline message about the page's state. `bad` and `warn` carry `role="alert"` and are announced
at once; `good`, `info`, `accent` and `neutral` carry `role="status"` and are announced politely.
The role follows the tone and cannot be passed.

## Props

### `Alert`

An inline message about the page's state. `bad` and `warn` carry `role="alert"` and are announced
at once; `good`, `info`, `accent` and `neutral` carry `role="status"` and are announced politely.
The role follows the tone and cannot be passed.

```ts
Alert({ tone, title, className, children, ...props }: AlertProps): ReactElement
  tone?: "neutral" | "accent" | "good" | "warn" | "bad" | "info" | null
  className?: string  // Layout only (`max-w-prose`, `mt-4`)
  title?: string  // The short headline
  children: ReactNode  // The body
```

## `alertVariants`

Part `alert`.

- `tone`: `neutral`, `accent`, `good`, `warn`, `bad`, `info` (default `neutral`)

## Slots

- `alert`
