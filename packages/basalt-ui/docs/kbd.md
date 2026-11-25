---
name: Kbd
use when: 'a shortcut is named in running text or a menu: one `Kbd` per key'
never when: 'the shortcut is registered for a command (name it in `defineCommands`, which prints it)'
subpath: basalt-ui/ui/kbd
peers: []
slots: [kbd]
---

# Kbd

One key of a shortcut. Put a combination in one `Kbd` per key.

## Props

### `Kbd`

```ts
Kbd({ children, className, ...props }: KbdProps): ReactElement
  className?: string  // Layout only (`ml-auto`)
  children: string  // The key: `K`, `Enter`, `Esc`
```

## `kbdVariants`

Part `kbd`.

No variant axes.

## Slots

- `kbd`
