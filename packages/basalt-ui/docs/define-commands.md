---
name: defineCommands
use when: 'an app has shortcuts, a palette or a native menu: declare them once, here'
never when: 'the action is a destination (a `defineNav` item lists itself) or belongs to one control (use its own onClick)'
subpath: basalt-ui/shell
peers: ['@atlaskit/pragmatic-drag-and-drop', '@base-ui/react', '@tanstack/react-hotkeys', '@tanstack/react-router']
slots: []
---

# defineCommands

Declares the commands of an app and checks them: two commands that share a chord (in the same
area, or both global) or a command that takes a chord the shell reserves throws here, at define
time, naming both. The returned set goes to `CommandPalette` and `toMenuTemplate`.

## Signature

```ts
defineCommands<const T extends CommandMap>(spec: T): CommandSet<T>
```

## Example

```tsx
export const COMMANDS = defineCommands({
  'run.start': { label: 'Start run', chord: 'Mod+Enter', area: 'runs', run: start },
  'jobs.cancel': { label: 'Cancel job', chord: 'Mod+.', enabled: () => hasJob(), run: cancel },
  'help.docs': { label: 'Open docs', group: 'Help', run: () => window.open('/docs') },
})
// __root.tsx, inside <AppShell>:  <CommandPalette commands={COMMANDS} />
```
