---
name: CopyButton
use when: 'a value the user copies elsewhere: an API key, an id, a URL, a command'
never when: 'the action does more than copy (use Button), or the text is long prose (let the user select it)'
subpath: basalt-ui/ui/copy-button
peers: ['@base-ui/react']
slots: [copy-button]
---

# CopyButton

A button that copies `value` to the clipboard and says so: the glyph turns to a check and the
name (the word too, with `showLabel`) to "Copied" until the pointer or focus leaves. Ghost and
icon-only by default, so it fits an `Input` `end` slot or a code line; `showLabel` adds the
word. Works on plain http too.

## Props

### `CopyButton`

```ts
CopyButton({ value, label, showLabel, onCopied, variant, size, className, onPointerLeave, onBlur, ...props }: CopyButtonProps): ReactElement
  size?: "sm" | "md" | null
  variant?: "primary" | "secondary" | "ghost" | "danger" | null
  value: string  // The text written to the clipboard
  label?: string  // What is copied, for the accessible name: "Copy API key"
  showLabel?: boolean  // Draws the word beside the glyph; without it the button is icon-only
  onCopied?: (value: string) => void  // Fires after the clipboard took the value
  className?: string  // Layout only (`ml-auto`)
```

## Slots

- `copy-button`
