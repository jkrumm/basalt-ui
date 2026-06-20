---
source: basalt-ui
description: Command bus, overlay controller, Spotlight projection, shortcuts display, and composable overlay mount from the shipped ./commands battery. @mantine/modals + @mantine/spotlight are optional peers; @mantine/notifications is already a peer from ./notifications.
paths:
  - 'src/**'
  - 'apps/**/src/**'
---

# Basalt Commands

basalt-ui ships `./commands` — a Mantine-coupled command bus + overlay controller battery providing
`defineCommands`, `runCommand`, `defineOverlays`, `overlays`, `toSpotlightActions`,
`toShortcutList`, `ShortcutsHelp`, and `BasaltOverlays` on top of `@mantine/modals` and
`@mantine/spotlight`. Both are **optional peers** — install them before using this battery:

```bash
bun add @mantine/modals @mantine/spotlight
```

Also import Spotlight styles in `main.tsx`:

```tsx
import '@mantine/spotlight/styles.css'
```

## Mount BasaltOverlays

`BasaltOverlays` is the composable overlay mount — it bundles `ModalsProvider`, `Spotlight`, and
`Notifications` into a single mount point. Put it inside `BasaltProvider`, before the router. It
**replaces** `<BasaltNotifications />` from `basalt-ui/notifications` — do NOT mount both in the
same tree (that would double-mount `<Notifications />`).

```tsx
import { BasaltOverlays } from 'basalt-ui/commands'
import { BasaltProvider } from 'basalt-ui'
import '@mantine/spotlight/styles.css'

createRoot(root).render(
  <BasaltProvider>
    <BasaltOverlays>
      <App />
    </BasaltOverlays>
  </BasaltProvider>,
)
```

Each layer is enabled by default; pass `false` to disable:

```tsx
<BasaltOverlays spotlight={false} notifications={false}>
  <App />
</BasaltOverlays>
```

## defineCommands + runCommand

`defineCommands` is a const-generic factory (mirrors `defineSeries`/`defineNotifications`) for
typed command registries. Augment `BasaltRegister.commands` once, then use `runCommand` — unknown
ids are tsc errors.

```ts
// commands.ts (app-side) — define and augment once:
import { defineCommands } from 'basalt-ui/commands'

export const COMMANDS = defineCommands({
  'file:save': { label: 'Save file', group: 'File', shortcut: 'Mod+S', run: () => save() },
  'file:open': { label: 'Open file', group: 'File', shortcut: 'Mod+O', run: () => open() },
  'data:sync': { label: 'Sync data', group: 'Data', run: async () => sync() },
  'help:docs': { label: 'Open docs', group: 'Help', run: () => window.open('/docs') },
  'edit:focus': {
    label: 'Focus editor',
    group: 'Edit',
    shortcut: 'Mod+E',
    when: () => isEditorPage(), // hides from palette when not on editor page
    run: () => focusEditor(),
  },
})

declare module 'basalt-ui' {
  interface BasaltRegister {
    commands: typeof COMMANDS
  }
}
```

```ts
// usage.ts — typed runCommand; unknown ids are tsc errors:
import { runCommand } from 'basalt-ui/commands'

runCommand('file:save') // ✓ sync
await runCommand('data:sync') // ✓ async
runCommand('nonexistent') // ✗ tsc error
```

### CommandId + CommandRunContext

`CommandId` is `Extract<keyof Slot<'commands', CommandMap>, string>`.
Un-augmented: `never` → `runCommand` is effectively uncallable.
Augmented: the exact registered key literal union.

`CommandRunContext` is minimal (`{ close?: () => void }`) — pass it to close the command palette
before executing:

```ts
runCommand('file:save', { close: () => spotlight.close() })
```

### CRITICAL — runtime stash pattern

The `BasaltRegister` slot augmentation is **type-only and erased at runtime**. `defineCommands`
stashes the spec map in a module-level `activeCommands` variable; `runCommand` reads from THAT
stash — NOT from `{} as Commands`. This is the same pattern as `defineNotifications` / `emit`.
Always call `defineCommands` once before any call to `runCommand` (typically imported at app boot).

## defineOverlays + overlays

`defineOverlays` registers ephemeral modal overlays. `overlays.open` is the imperative controller.

```ts
// overlays.ts (app-side) — define and augment once:
import { defineOverlays } from 'basalt-ui/commands'

export const OVERLAYS = defineOverlays({
  'user:edit': {
    title: 'Edit user',
    render: (p: { id: string; name: string }) => <UserEditForm id={p.id} name={p.name} />,
  },
  'confirm:delete': {
    title: 'Delete item?',
    render: (p: { name: string }) => <ConfirmBody name={p.name} />,
  },
})

declare module 'basalt-ui' {
  interface BasaltRegister { overlays: typeof OVERLAYS }
}
```

```ts
// usage.ts — typed overlays.open; unknown keys are tsc errors:
import { overlays } from 'basalt-ui/commands'

overlays.open('user:edit', { id: '42', name: 'Alice' }) // ✓ typed
overlays.open('confirm:delete', { name: 'photo.jpg' }) // ✓
overlays.open('nonexistent', {}) // ✗ tsc error
overlays.close() // close all open modals
```

`OverlayKey` is `Extract<keyof Slot<'overlays', OverlayMap>, string>`.
The same runtime-stash pattern applies — `defineOverlays` stashes to `activeOverlays`.

### Imperative vs route (when to use each)

| Use `overlays.open`                   | Use route mask (`./router-tanstack`)       |
| ------------------------------------- | ------------------------------------------ |
| Ephemeral confirms, quick-edit panels | Shareable/back-button/refreshable overlays |
| No URL needed                         | URL-addressable dialogs                    |
| Triggered from commands or buttons    | Triggered by navigation                    |

## Spotlight projection (toSpotlightActions)

`toSpotlightActions()` projects the active command registry to `SpotlightActionData[]` for Mantine
Spotlight. Commands where `when()` returns `false` are excluded. `BasaltOverlays` calls it
automatically with `shortcut="mod + K"`.

```ts
import { toSpotlightActions } from 'basalt-ui/commands'
import { Spotlight, spotlight } from '@mantine/spotlight'

// Manual Spotlight mount (if not using BasaltOverlays):
<Spotlight actions={toSpotlightActions()} shortcut="mod + K" />

// Programmatically open the palette:
spotlight.open()
```

## Shortcut display (toShortcutList + ShortcutsHelp)

`toShortcutList()` returns commands with a `shortcut` field as a flat list. `ShortcutsHelp`
renders them in a grouped Mantine layout with platform-aware labels (⌘ on mac, Ctrl elsewhere).

**DISPLAY ONLY in 1.0.** Live key binding is deferred to 1.1 — `@tanstack/react-hotkeys` is
alpha (0.10.0, pre-1.0, "API may change"). Shortcut strings are stored as data; Spotlight
`mod + K` covers the palette trigger for 1.0.

```tsx
import { ShortcutsHelp } from 'basalt-ui/commands'

// In a help modal or settings panel:
;<ShortcutsHelp title="Keyboard shortcuts" maw={480} />
```

```ts
import { toShortcutList } from 'basalt-ui/commands'
const list = toShortcutList()
// [{ id: 'file:save', label: 'Save file', shortcut: 'Mod+S', group: 'File' }, ...]
```

## Deferred (not yet shipped)

- **Live key binding (`toHotkeyBindings` / `useCommandHotkeys`)** — deferred to 1.1. Requires
  `@tanstack/react-hotkeys` to reach 1.0 stable. The `shortcut` field on `Command` is intentionally
  typed now so no breaking changes are needed when the binding lands.
- **`SidebarItem.command?: CommandId`** — cross-ref between the shell sidebar and the command bus
  is a later integration step. Do not add it now.
