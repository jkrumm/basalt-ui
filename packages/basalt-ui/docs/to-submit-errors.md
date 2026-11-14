---
name: toSubmitErrors
use when: 'a submit saves to a server whose errors must land on the fields and the form'
never when: 'the schema alone validates the form'
subpath: basalt-ui/controls
peers: ['@base-ui/react']
slots: []
---

# toSubmitErrors

Wraps a save as `validators.onSubmitAsync`. Pass a save that throws on failure: `(v) =>
api.runs.put(v).then(unwrap)`.

## Signature

```ts
toSubmitErrors<V>(save: (value: V) => Promise<unknown>): ToSubmitErrors<V>
```
