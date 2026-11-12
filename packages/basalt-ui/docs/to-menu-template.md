---
name: toMenuTemplate
use when: 'the app runs in a native shell (Tauri) whose menu bar should list the commands of the app'
never when: 'the app is web only (the palette is the menu) or the menu needs submenus (the host groups the items)'
subpath: basalt-ui/shell
peers: ['@base-ui/react']
slots: []
---

# toMenuTemplate

Turns a command set into a native-menu template: plain, JSON-safe data with no function in it.
Only a command with a chord can be in a menu, because the chord is what the host dispatches; an
`order` that names an unknown id or one without a chord throws.

## Signature

```ts
toMenuTemplate<T extends CommandMap>(commands: CommandSet<T>, options?: MenuTemplateOptions<T>): MenuTemplate
  commands: Readonly<T>
  entries: readonly CommandEntry[]
  bind: (actions: ShellActions) => () => void
```
