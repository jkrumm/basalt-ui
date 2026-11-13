---
name: useConnection
use when: 'a live surface shows whether its data is streaming, polling or cut off'
never when: 'the app needs to gate a fetch on the network (read the `onlineManager` of Query; this hook never flips it)'
subpath: basalt-ui/data
peers: []
slots: []
---

# useConnection

Whether the app is live, polling or offline, and how old its stream and data are. Feed it to
`<ConnectionIndicator connection={...} />`. `offline` is a classified network failure (three in
a row, held 5 s) or the browser reporting offline, never a 4xx/5xx, a parse error or a failing
third-party (`external`) poll. Needs a client from `makeQueryClient`.

## Signature

```ts
useConnection(): ConnectionView
```
