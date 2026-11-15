---
name: CommandPalette
use when: 'the app has commands, shortcuts or a destination list worth reaching from the keyboard'
never when: 'the app has a handful of screens and no actions (the rail is the whole navigation)'
subpath: basalt-ui/shell
peers: ['@base-ui/react']
slots: [command-palette, command-palette-list]
---

# CommandPalette

The command palette and the app's one key listener. It lists every command of the set, every
`defineNav` item and the built-ins, opens on `Mod+K`, and ranks with `rank`. Escape closes only the
top layer: the palette, never the dialog it was opened over. Mount it once, inside `AppShell`,
so `shell.toggle-rail` has a rail to toggle and the nav is registered. It is the app's one
palette: while an `AppShell` is mounted, `BasaltProvider` mounts no Spotlight of its own. Hand
the shell's search row the same open state (`search={{ onOpen }}`, as in the example).

## Signature

```ts
CommandPalette({ commands, rank, open: openProp, onOpenChange, placeholder, }: CommandPaletteProps): ReactElement
  commands: CommandSet
  rank?: RankFn
  open?: boolean
  onOpenChange?: (open: boolean) => void
  placeholder?: string
```
