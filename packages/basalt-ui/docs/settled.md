---
name: settled
use when: 'a test must read the tree after a popup opened, a navigation ran or a query settled'
never when: 'the test uses fake timers (it polls real ones), or a `findBy*` on the one element is enough'
subpath: basalt-ui/testing
peers: ['@axe-core/playwright']
slots: []
---

# settled

Awaits at least one mount tick, then keeps ticking until the router and query client (when given)
are idle. Always ends on a tick that found nothing pending, so a state change the last request
scheduled has rendered by the time it resolves.

## Signature

```ts
settled(options?: SettledOptions): Promise<void>
  router?: SettledRouter  // Also wait for this router to finish loading and transitioning
  queryClient?: SettledQueryClient  // Also wait for this client to have no fetch or mutation in flight
  timeoutMs?: number  // Give up after this many milliseconds with an error naming what is still pending
```

## Example

```tsx
fireEvent.click(trigger)
await settled({ queryClient })
```
