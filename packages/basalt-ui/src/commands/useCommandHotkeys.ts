/**
 * useCommandHotkeys — binds the active command registry to keyboard shortcuts via
 * @tanstack/react-hotkeys.
 *
 * OPTIONAL PEER: @tanstack/react-hotkeys is an optional peer dependency. This hook degrades
 * gracefully to a no-op when the peer is absent — core imports cleanly with the peer missing.
 *
 * Implementation: uses dynamic import() inside useEffect to lazily resolve the optional peer.
 * Registration is imperative via the `getHotkeyManager()` singleton (re-exported from
 * @tanstack/react-hotkeys → @tanstack/hotkeys). Each effect run registers all shortcut commands
 * and returns a cleanup that unregisters them. This is fully rules-of-hooks compliant and works
 * in strict ESM environments (no require()).
 *
 * No HotkeysProvider is required — @tanstack/react-hotkeys uses a singleton HotkeyManager.
 *
 * @example
 * // Typical placement — inside BasaltOverlays so keybindings are active whenever overlays mount:
 * useCommandHotkeys()
 *
 * // Standalone consumer:
 * import { useCommandHotkeys } from 'basalt-ui/commands'
 * function App() {
 *   useCommandHotkeys()
 *   return <RouterProvider router={router} />
 * }
 */
import { useEffect } from 'react'
import { getActiveCommands } from './define-commands'

// ── HotkeyManager peer types (erased at runtime) ──────────────────────────────

// We only import types here — the actual module is loaded dynamically inside useEffect.
// This keeps the module resolvable even when the peer is absent (no static import).

type HotkeyHandle = {
  unregister: () => void
  callback: (event: KeyboardEvent) => void
}

type HotkeyManagerType = {
  register: (
    hotkey: string,
    callback: (event: KeyboardEvent) => void,
    options?: { preventDefault?: boolean },
  ) => HotkeyHandle
}

type PeerModule = {
  getHotkeyManager: () => HotkeyManagerType
}

// ── useCommandHotkeys ─────────────────────────────────────────────────────────

/**
 * Reads the active command registry and binds each command's `shortcut` to its `run()` via
 * the @tanstack/react-hotkeys HotkeyManager singleton. Degrades to a no-op when the optional
 * peer is absent.
 *
 * Registers on mount, unregisters on unmount. Re-runs whenever the effect deps change.
 * Commands without a shortcut are skipped. Commands where `when()` returns false at press time
 * are silently skipped (the binding stays registered; the when-gate fires in the callback).
 *
 * @example
 * useCommandHotkeys()
 */
export function useCommandHotkeys(): void {
  useEffect(() => {
    let handles: HotkeyHandle[] = []
    let cancelled = false

    const bind = async (): Promise<void> => {
      let peer: PeerModule
      try {
        peer = (await import('@tanstack/react-hotkeys')) as unknown as PeerModule
      } catch {
        // Peer absent — stay no-op.
        return
      }
      if (cancelled) return
      if (typeof peer.getHotkeyManager !== 'function') return

      const manager = peer.getHotkeyManager()
      const cmds = getActiveCommands()

      for (const [, cmd] of Object.entries(cmds)) {
        if (cmd.shortcut === undefined) continue

        const handle = manager.register(
          cmd.shortcut,
          (event: KeyboardEvent) => {
            // Respect the when() gate at execution time (not registration time)
            if (cmd.when !== undefined && !cmd.when()) return
            // Only prevent default when the command will actually run
            event.preventDefault()
            void cmd.run()
          },
          // preventDefault: false — we handle it manually above, gated on when()
          { preventDefault: false },
        )
        handles.push(handle)
      }
    }

    void bind()

    return () => {
      cancelled = true
      for (const handle of handles) {
        handle.unregister()
      }
      handles = []
    }
  }, [])
}
