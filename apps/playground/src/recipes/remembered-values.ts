// A recipe file the playground typecheck compiles; gen-recipes copies the region into the doc.
// #region recipe:remembered-values
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
// #endregion

export const forgetWindow = (): void => remembered.reset()
