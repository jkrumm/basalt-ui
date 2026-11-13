---
name: remembered-values
use-when: a page's filter (a time window) should reopen at the value the user last chose, which 2.x did with a `persist` mirror on a `createSearchStore` field
file: apps/playground/src/recipes/remembered-values.ts
---

A remembered value is a preference, and a link is not a preference: v3 has no URL-field `persist` and no redirect on entry.
Keep a `persisted` mirror of the resolved value and hand it to the nav link as `search`, so it resolves at click time, the moment `linkSearch` resolved it in 2.x.
The 2.x store kept one record per store, `{ fieldName: value }`, under `basalt:<key>`. `persisted(key)` with the same key and version reads that record as it stands, and a write keeps the sibling fields.
The recipe holds four cases:

1. Adopt: a sidebar click after leaving the page opens the remembered window.
2. A deep link wins: the page resolves the URL alone, and `validateSearch` never reads storage.
3. Write-through: every change writes the resolved window.
4. An explicit default beats the remembered value: choosing the default writes it, so the next click carries nothing.

An in-app Back never re-applies today's preference, because the value rides on the link and not on a redirect.

```ts
import { persisted } from 'basalt-ui'
import { useEffect } from 'react'

const WINDOWS = ['7d', '30d', '3m', '1y', 'all'] as const
export type Win = (typeof WINDOWS)[number]
export const DEFAULT_WINDOW: Win = '30d'
const isWin = (v: unknown): v is Win => WINDOWS.includes(v as Win)

// The 2.x store kept one record per store, `{ fieldName: value }`, under `basalt:<key>`: read as it stands.
const remembered = persisted<{ window?: unknown }>('garmin-health:window', {
  version: 1,
  initial: {},
})

// The page reads the URL alone: a deep link wins and `validateSearch` never touches storage.
export const resolveWindow = (search: { window?: unknown }): Win =>
  isWin(search.window) ? search.window : DEFAULT_WINDOW

// The nav link's `search`, called at click time. The default stays out of the URL.
export const rememberedSearch = (): { window?: Win } => {
  const win = remembered.get().window
  return isWin(win) && win !== DEFAULT_WINDOW ? { window: win } : {}
}

// Write the resolved value on every change, so choosing the default overrides what was remembered.
export function useRememberWindow(win: Win): void {
  useEffect(() => remembered.set((record) => ({ ...record, window: win })), [win])
}
```
