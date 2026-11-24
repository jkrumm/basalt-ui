---
name: useFormat
use when: 'a component prints a number, date, money amount, relative time or duration for a reader'
never when: 'the code runs outside React (a model module, a server function): use `createFormat`'
subpath: basalt-ui
peers: []
slots: []
---

# useFormat

The formatter for the current locale and time zone: the provider's `locale` and `timeZone` props,
else English and UTC. Built on first use, not when the provider mounts.

## Signature

```ts
useFormat(): Format
```

`Format` import from `basalt-ui`: `import type { Format } from 'basalt-ui'`.

## Example

```tsx
const f = useFormat()
f.duration(45_000_000, 'words') // '12 hr 30 min', not the clock's '12:30:00'
f.date(day, 'day') // 'Nov 12': a day and month, no year
f.date(day) // 'Nov 12, 2026'
```
