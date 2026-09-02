/**
 * `setColorScheme`/`toggleSidebar` — imperative shell handles, wired automatically.
 *
 * Command bodies run OUTSIDE the React tree (a Spotlight action, a hotkey), so a `run: () =>
 * ...`  has no hook access to `useMantineColorScheme()` or `BasaltShell`'s collapse state. Every
 * consumer of `defineCommands` therefore hand-rolled the SAME "register a live setter ref, read
 * it later" bridge per action — argo's own `lib/color-scheme-bridge.ts` / `lib/sidebar-bridge.ts`
 * are the seed for this file, right down to the reason each is its OWN leaf module: `commands.tsx`
 * imports the router, which imports the generated route tree, which imports every route file
 * including the one that owns the shell — so a command file importing anything back out of the
 * shell closes a real circular module dependency (surfaces as TS's "implicitly has type any…
 * referenced in its own initializer"). A leaf with ZERO local imports is what both sides can
 * depend on without re-closing that cycle (`register.ts`'s `Slot` doc has the type-level half of
 * the same story for `commands`↔`overlays`).
 *
 * basalt registers BOTH setters itself — `BasaltProvider` calls {@link registerColorSchemeSetter}
 * from inside `MantineProvider` (`provider/index.tsx`'s `BasaltBridge`), `BasaltShell` calls
 * {@link registerSidebarToggle} (`shell/index.tsx`'s `ShellFrame`) — so a consumer's own
 * `commands.tsx` needs no `__root.tsx` wiring at all, unlike argo's hand-rolled version: mount
 * `BasaltProvider`/`BasaltShell` once, and `setColorScheme`/`toggleSidebar` just work.
 *
 * Last-registered wins, same "last call wins" rule `defineCommands`/`defineOverlays`'s own runtime
 * stash documents — two overlapping mounts (a route swap) are normal, not a race to guard against.
 *
 * @example
 * // commands.ts
 * import { defineCommands, setColorScheme, toggleSidebar } from 'basalt-ui/commands'
 * export const COMMANDS = defineCommands({
 *   'theme:dark': { label: 'Dark theme', run: () => setColorScheme('dark') },
 *   'ui:toggle-sidebar': { label: 'Toggle sidebar', shortcut: 'Mod+B', run: () => toggleSidebar() },
 * })
 */

export type ColorScheme = 'light' | 'dark' | 'auto'
export type ColorSchemeSetter = (scheme: ColorScheme) => void
export type SidebarToggle = () => void

let colorSchemeSetterRef: ColorSchemeSetter | null = null
let sidebarToggleRef: SidebarToggle | null = null

/** @internal called by `BasaltProvider`. Not part of the public API surface. */
export function registerColorSchemeSetter(setter: ColorSchemeSetter | null): void {
  colorSchemeSetterRef = setter
}

/** @internal called by `BasaltShell`. Not part of the public API surface. */
export function registerSidebarToggle(toggle: SidebarToggle | null): void {
  sidebarToggleRef = toggle
}

/**
 * Set the color scheme from outside the React tree. A no-op (with a dev-only console warning)
 * when no `BasaltProvider` is mounted yet — the same "not wired" shape `runCommand`/
 * `overlays.open` already use for an unregistered id.
 *
 * @example
 * setColorScheme('dark')
 */
export function setColorScheme(scheme: ColorScheme): void {
  if (colorSchemeSetterRef === null) {
    if (process.env['NODE_ENV'] !== 'production') {
      // eslint-disable-next-line no-console -- dev-only diagnostic, mirrors runCommand's own
      console.warn('[basalt] setColorScheme: no BasaltProvider is mounted yet')
    }
    return
  }
  colorSchemeSetterRef(scheme)
}

/**
 * Toggle `BasaltShell`'s desktop sidebar collapse from outside the React tree. A no-op (with a
 * dev-only console warning) when no `BasaltShell` is mounted yet.
 *
 * @example
 * toggleSidebar()
 */
export function toggleSidebar(): void {
  if (sidebarToggleRef === null) {
    if (process.env['NODE_ENV'] !== 'production') {
      // eslint-disable-next-line no-console -- dev-only diagnostic, mirrors runCommand's own
      console.warn('[basalt] toggleSidebar: no BasaltShell is mounted yet')
    }
    return
  }
  sidebarToggleRef()
}
