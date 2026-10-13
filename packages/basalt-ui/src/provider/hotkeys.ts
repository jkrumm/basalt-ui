/**
 * Command shortcuts from the `defineCommands` registry, bound only when the registry has a
 * `shortcut`. `@tanstack/react-hotkeys` is subpath-required for `./commands`, so it is reached
 * through `import()` only and its runtime stays off first paint (V2-SPEC § 2).
 *
 * `defineCommands` has no loader-registration seam yet; when `./commands` grows one (it calls this
 * module's loader instead), this registry check is what goes away.
 */
import { useEffect } from 'react'
import { getActiveCommands } from '../commands/define-commands'
import type { Command } from '../commands/define-commands'

type HotkeyHandle = { unregister: () => void }
type HotkeyManager = {
  register: (
    hotkey: string,
    callback: (event: KeyboardEvent) => void,
    options?: { preventDefault?: boolean },
  ) => HotkeyHandle
}

/**
 * Runs a command, swallowing a sync throw or async rejection so a failing command never becomes an
 * unhandled rejection (which the provider would report as a `window.error`). Dev logs it.
 */
export function runCommandSafely(cmd: Command): void {
  const report = (error: unknown): void => {
    if (process.env.NODE_ENV !== 'production') console.error('[basalt] command failed', error)
  }
  try {
    Promise.resolve(cmd.run()).catch(report)
  } catch (error) {
    report(error)
  }
}

export function useRegistryHotkeys(): void {
  useEffect(() => {
    const commands = Object.values(getActiveCommands()).filter((c) => c.shortcut !== undefined)
    if (commands.length === 0) return

    let cancelled = false
    const handles: HotkeyHandle[] = []

    // An absent peer is a silent no-op: shortcuts simply do not bind.
    void import('@tanstack/react-hotkeys')
      .catch(() => undefined)
      .then((peer) => {
        if (cancelled || peer === undefined) return
        const getManager = (peer as { getHotkeyManager?: unknown }).getHotkeyManager
        if (typeof getManager !== 'function') return
        const manager = (getManager as () => HotkeyManager)()
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
  }, [])
}
