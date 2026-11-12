/**
 * Stub of `basalt-ui` (`.`): ARCHITECTURE section 3 allots it BasaltProvider, cn, VX, alpha,
 * useFormat, createFormat, setScheme, persisted, externalField, notify, useNow and createChannel.
 * `src/index.ts` is still the 2.x barrel (Mantine provider and dashboard atoms), so a tsconfig path
 * straight at it would pull `@mantine/*` into a v3 route. This file re-exports the v3 pieces that
 * exist under `src/core` and `src/tokens`, and declares the two that do not exist yet.
 */
import { useSyncExternalStore } from 'react'

export { cn } from '../../../../packages/basalt-ui/src/core/cn'
export { createFormat, useFormat } from '../../../../packages/basalt-ui/src/core/format'
export { persisted } from '../../../../packages/basalt-ui/src/core/persisted'
export { externalField } from '../../../../packages/basalt-ui/src/core/external-field'
export { notify } from '../../../../packages/basalt-ui/src/core/notify'
export { setScheme } from '../../../../packages/basalt-ui/src/core/scheme'
export { VX, alpha } from '../../../../packages/basalt-ui/src/tokens'

/**
 * Contract symbol with no implementation under `src` yet (`live` concept, owner `.`): a wall clock
 * that ticks every `everyMs`. The stub is the smallest thing that satisfies a caller.
 */
export function useNow(everyMs = 60_000): number {
  return useSyncExternalStore(
    (cb) => {
      const id = setInterval(cb, everyMs)
      return () => clearInterval(id)
    },
    () => Math.floor(Date.now() / everyMs) * everyMs,
    () => 0,
  )
}
