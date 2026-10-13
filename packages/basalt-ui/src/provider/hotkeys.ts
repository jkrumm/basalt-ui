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

type HotkeyHandle = { unregister: () => void }
type HotkeyManager = {
  register: (
    hotkey: string,
    callback: (event: KeyboardEvent) => void,
    options?: { preventDefault?: boolean },
  ) => HotkeyHandle
}

export function useRegistryHotkeys(): void {
  useEffect(() => {
    const commands = Object.values(getActiveCommands()).filter((c) => c.shortcut !== undefined)
    if (commands.length === 0) return

    let cancelled = false
    const handles: HotkeyHandle[] = []

    void import('@tanstack/react-hotkeys').then((peer) => {
      if (cancelled) return
      const manager = (
        peer as unknown as { getHotkeyManager: () => HotkeyManager }
      ).getHotkeyManager()
      for (const cmd of commands) {
        if (cmd.shortcut === undefined) continue
        handles.push(
          manager.register(
            cmd.shortcut,
            (event) => {
              // The `when` gate is read at press time, not at registration.
              if (cmd.when !== undefined && !cmd.when()) return
              event.preventDefault()
              void cmd.run()
            },
            { preventDefault: false },
          ),
        )
      }
    })

    return () => {
      cancelled = true
      for (const handle of handles) handle.unregister()
    }
  }, [])
}
