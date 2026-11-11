---
name: useFormat
use when: 'a component prints a number, date, money amount, relative time or duration for a reader'
never when: 'the code runs outside React (a model module, a server function): use `createFormat`'
subpath: basalt-ui
peers: ['@tanstack/react-router-devtools', beautiful-mermaid, rehype-sanitize, remark-gfm, remend, shiki]
slots: []
---

# useFormat

The formatter for the current locale and time zone: the provider's `locale` and `timeZone` props,
else English and UTC. Built on first use, not when the provider mounts.

## Signature

```ts
useFormat(): Format
```
