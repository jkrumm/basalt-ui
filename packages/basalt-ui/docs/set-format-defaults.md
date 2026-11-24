---
name: setFormatDefaults
use when: 'the app has one page locale or time zone and charts must print dates in it before any component mounts (call it once at startup, beside `routerDefaults`).'
never when: 'only text in components needs the locale (use `useFormat` or `createFormat`, which take it per call), or a server renders many locales.'
subpath: basalt-ui
peers: []
slots: []
---

# setFormatDefaults

Sets the locale / time zone every formatter, and the chart layer's date labels, fall back to when a call
passes none. Merges: only DEFINED fields are applied, `undefined` leaves the earlier value.

## Signature

```ts
setFormatDefaults(next?: FormatDefaults): void
  locale?: string  // BCP-47 tag every formatter uses when a call passes none
  timeZone?: string  // IANA time zone every date formatter uses when a call passes none
```

`FormatDefaults` import from `basalt-ui`: `import type { FormatDefaults } from 'basalt-ui'`.
