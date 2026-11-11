---
name: windowKey
use when: 'a query is keyed by a sliding time window that would otherwise rotate its key on every tick'
never when: 'the window is fixed (a picked date range) or the data has no step to quantise to'
subpath: basalt-ui/data
peers: []
slots: []
---

# windowKey

Quantises a window onto `stepMs` and returns its query key plus the gated placeholder.

## Signature

```ts
windowKey(window: TimeWindow, options: WindowKeyOptions): WindowKeyResult
  from: number
  to: number
```
