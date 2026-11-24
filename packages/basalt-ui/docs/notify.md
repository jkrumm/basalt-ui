---
name: notify
use when: 'a result needs a short, passing note the user can ignore'
never when: 'the message must be read to continue, or belongs next to a field'
subpath: basalt-ui
peers: []
slots: []
---

# notify

Show a toast. Returns its id. Errors stay until dismissed; every other kind closes after 5 s; an
explicit `autoClose` under 5000 is raised to 5000. An identical payload within 1,500 ms returns
the first toast's id and shows nothing new. A `key` makes a re-emit replace the earlier toast of
that key instead of stacking beside it.

## Signature

```ts
notify(kind: NotifyKind, payload: NotificationPayload): string
```

`NotificationPayload` import from `basalt-ui`: `import type { NotificationPayload } from 'basalt-ui'`.

## Example

```tsx
notify('success', { message: 'Saved' })
notify('error', { message: 'Upload failed', title: 'photo.jpg' })
notify('error', { message: 'Sync failed', key: 'sync' })
```
