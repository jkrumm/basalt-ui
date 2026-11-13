---
name: RefreshButton
use when: 'a page or the shell header offers a refresh of live data, with how old it is'
never when: 'the action is not a refresh (use `Button`) or the data never changes (omit it)'
subpath: basalt-ui/page
peers: ['@base-ui/react']
slots: [refresh-button, refresh-button-age, refresh-button-print]
---

# RefreshButton

The one shape refresh takes: spread `useFreshness().button` for the app's queries, or pass a
server job's own `syncing`, `lastCompletedAt`, `onSync` and `error`. The age (`2 min. ago`) is
absent on the server and on the first client paint, so it cannot mismatch on hydration. While
`syncing` the glyph spins and a second press is refused without losing focus; an `error` is part
of the accessible name and the tooltip, never colour alone. On paper the button is hidden and a
line "Updated <date and time>" states when the data was taken.

## Signature

```ts
RefreshButton({ syncing, lastCompletedAt, onSync, scope, label, error, className, }: RefreshButtonProps): ReactElement
  syncing: boolean
  lastCompletedAt?: number | Date | null
  onSync: () => void
  scope: "page" | "global"
  label?: string
  error?: string
  className?: string
```
