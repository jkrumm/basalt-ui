---
name: CommandPalette
use when: 'the app has commands, shortcuts or a destination list worth reaching from the keyboard'
never when: 'the app has a handful of screens and no actions (the rail is the whole navigation)'
subpath: basalt-ui/shell
peers: ['@atlaskit/pragmatic-drag-and-drop', '@base-ui/react', '@tanstack/react-hotkeys', '@tanstack/react-router']
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
CommandPalette({ commands, rank, open: openProp, onOpenChange, placeholder, present, sources, }: CommandPaletteProps): ReactElement
  commands: CommandSet
  rank?: RankFn  // Orders and filters the rows for a query
  open?: boolean  // Controlled state, for `AppShell search={{ onOpen }}`; without it the palette keeps its own
  onOpenChange?: (open: boolean) => void
  placeholder?: string
  present?: OverlayPresent  // How it opens: `auto` is a full-height sheet with the field on top on a phone (compact width, coarse pointer) and the centred dialog elsewhere; `popup` and `sheet` force one
  sources?: readonly PaletteSource[]  // Record search beside the commands: one group per source, after the command and nav groups, in this order and headed by the source's `label`
```

`PaletteSource` import from `basalt-ui/shell`: `import type { PaletteSource } from 'basalt-ui/shell'`.

## Example

```tsx
<AppShell nav={NAV} brand={{ name: 'Argo' }} search={{ onOpen: () => setOpen(true) }}>
  <Outlet />
  <CommandPalette commands={COMMANDS} open={open} onOpenChange={setOpen} sources={[SUPPLIERS]} />
</AppShell>
```

## Example

```tsx
const SUPPLIERS: PaletteSource = {
  id: 'suppliers',
  label: 'Suppliers',
  search: async (query, signal) => {
    const found = await findSuppliers(query, { signal })
    return found.map((s) => ({ id: s.id, title: s.name, kind: 'Supplier', detail: s.city, to: `/suppliers/${s.id}` }))
  },
}
```
