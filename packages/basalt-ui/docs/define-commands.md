---
name: defineCommands
use when: 'an app has shortcuts, a palette or a native menu: declare them once, here'
never when: 'the action is a destination (a `defineNav` item lists itself) or belongs to one control (use its own onClick)'
subpath: basalt-ui/shell
peers: ['@base-ui/react']
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
