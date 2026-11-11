---
name: unwrap
use when: 'a queryFn or mutationFn calls a transport that returns `{ data, error }` envelopes'
never when: 'the call already throws on failure and never returns an envelope'
subpath: basalt-ui/data
peers: []
slots: []
---

# unwrap

Unwraps a `{ data, error }` envelope (or a promise of one) to its data, throwing the error branch,
and throwing on null data.

## Signature

```ts
unwrap<R extends Envelope | PromiseLike<Envelope>>(response: R): UnwrapResult<R>
```
