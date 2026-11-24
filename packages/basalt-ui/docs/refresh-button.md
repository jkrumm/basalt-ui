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
of the accessible name and the tooltip, never color alone. On paper the button is hidden and a
line "Updated <date and time>" states when the data was taken.

## Signature

```ts
RefreshButton({ syncing, lastCompletedAt, onSync, scope, label, error, className, }: RefreshButtonProps): ReactElement
  syncing: boolean  // True while a refresh runs: the button is busy and refuses a second press
  lastCompletedAt?: number | Date | null  // Last successful completion
  onSync: () => void
  scope: "global" | "page"  // The home, and with it the shape: `'global'` is icon-only at every width (the shell header), `'page'` is labelled with the age beside it from 840 px up, glyph and short age below
  label?: string  // The visible label of the `'page'` form and the accessible name of every form
  error?: string  // The last failure: names the button (`Refresh — <error>`) and shows in its tooltip
  className?: string  // Layout only (`ml-auto`, `shrink-0`)
```

`RefreshButtonProps` import from `basalt-ui/page`: `import type { RefreshButtonProps } from 'basalt-ui/page'`.

## Example

```tsx
<RefreshButton scope="global" {...useFreshness().button} />
```

## Example

```tsx
<RefreshButton scope="page" syncing={job.running} lastCompletedAt={job.lastCompletedAt} onSync={job.start} />
```
