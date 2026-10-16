/**
 * Command shortcuts from the `defineCommands` registry, bound only when the registry has a
 * `shortcut`. `@tanstack/react-hotkeys` is subpath-required for `./commands`, so it is reached
 * through `import()` only and its runtime stays off first paint (V2-SPEC § 2).
 *
 * `defineCommands` registers `HotkeyBinder` as the provider's `hotkeys` slot when a command has a
 * shortcut, so this module (and the peer behind its `import()`) is reachable only from there.
 */
import type { HotkeyRegistrationHandle } from '@tanstack/react-hotkeys'
import { useEffect, useSyncExternalStore } from 'react'
import { getActiveCommands, runCommandSafely, subscribeCommands } from '../commands/command-stash'

export function useRegistryHotkeys(): void {
  // A late `defineCommands` (a lazily loaded route) replaces the map; re-bind against the new one.
  const registry = useSyncExternalStore(subscribeCommands, getActiveCommands, getActiveCommands)
  useEffect(() => {
    const commands = Object.values(registry).filter((c) => c.shortcut !== undefined)
    if (commands.length === 0) return

    let cancelled = false
    const handles: HotkeyRegistrationHandle[] = []

    // An absent peer is a silent no-op: shortcuts simply do not bind.
    void import('@tanstack/react-hotkeys')
      .catch(() => undefined)
      .then((peer) => {
        if (cancelled || peer === undefined) return
        const manager = peer.getHotkeyManager()
        for (const cmd of commands) {
          if (cmd.shortcut === undefined) continue
          handles.push(
            manager.register(
              cmd.shortcut,
              (event) => {
                // The `when` gate is read at press time, not at registration.
                if (cmd.when !== undefined && !cmd.when()) return
                event.preventDefault()
                runCommandSafely(cmd)
              },
              { preventDefault: false },
            ),
          )
        }
      })
      .catch((error: unknown) => {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[basalt] command hotkeys failed to bind', error)
        }
      })

    return () => {
      cancelled = true
      for (const handle of handles) handle.unregister()
    }
  }, [registry])
}

/** The `hotkeys` slot mount: renders nothing, binds the registry's shortcuts. */
export function HotkeyBinder(): null {
  useRegistryHotkeys()
  return null
}
