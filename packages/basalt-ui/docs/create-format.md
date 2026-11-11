---
name: createFormat
use when: 'code outside React needs formatted text (a model module, a server function, a chart label builder)'
never when: 'a component can call `useFormat`, which reads the provider''s locale and time zone'
subpath: basalt-ui
peers: ['@tanstack/react-router-devtools', beautiful-mermaid, rehype-sanitize, remark-gfm, remend, shiki]
slots: []
---

# createFormat

A pure formatter for one locale and time zone. Default `en` and `UTC`, never the host's; `timeZone: 'host'` opts in to the runtime zone.
Its `Intl` instances live in the returned object, so nothing is shared between requests.

## Signature

```ts
createFormat(o?: FormatOptions): Format
  locale?: string
  timeZone?: string
```
