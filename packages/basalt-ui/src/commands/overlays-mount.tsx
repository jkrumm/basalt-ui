/**
 * overlays-mount — composable overlay mount for basalt-ui apps.
 *
 * `BasaltOverlays` bundles ModalsProvider, Spotlight, and Notifications into a single mount point.
 * Put it inside BasaltProvider, before the router. It replaces the standalone `<BasaltNotifications />`
 * from `basalt-ui/notifications` — do NOT mount both `<BasaltOverlays notifications />` and
 * `<BasaltNotifications />` in the same tree (double-mount of `<Notifications />`).
 *
 * Each overlay system is opt-in via props (all default to true). Use flags to disable layers the
 * app does not need — e.g. a charts-only app that has no commands can set `spotlight={false}`.
 *
 * Optional peers required:
 *   @mantine/modals ^9.3.0     (for modals)
 *   @mantine/spotlight ^9.3.0  (for spotlight)
 *   @mantine/notifications ^9.3.0 (for notifications)
 *   @tanstack/react-hotkeys ^0.10.0 (optional — keybindings degrade to no-op when absent)
 *
 * Spotlight live store: BasaltOverlays uses a basalt-owned createSpotlight() store so the
 * spotlight instance is separate from Mantine's default global. Import `basaltSpotlight` and call
 * `basaltSpotlight.open()` / `basaltSpotlight.close()` from consumer code. The re-exported
 * `openSpotlight` / `closeSpotlight` helpers from index.ts delegate to this store.
 *
 * @example
 * // main.tsx — replace <BasaltNotifications /> with <BasaltOverlays>:
 * import { BasaltOverlays } from 'basalt-ui/commands'
 * import '@mantine/spotlight/styles.css'
 *
 * createRoot(root).render(
 *   <BasaltProvider>
 *     <BasaltOverlays>
 *       <App />
 *     </BasaltOverlays>
 *   </BasaltProvider>
 * )
 *
 * // Disable spotlight for apps without commands:
 * <BasaltOverlays spotlight={false}>
 *   <App />
 * </BasaltOverlays>
 *
 * // Open/close programmatically:
 * import { openSpotlight, closeSpotlight } from 'basalt-ui/commands'
 * openSpotlight()
 */
import type { ComponentProps, ReactNode } from 'react'
import { ModalsProvider } from '@mantine/modals'
import { Spotlight, createSpotlight } from '@mantine/spotlight'
import { Notifications } from '@mantine/notifications'
import { runCommand } from './define-commands'
import type { CommandId } from './define-commands'
import { toSpotlightActions } from './projectors'
import { useCommandHotkeys } from './useCommandHotkeys'

// ── basaltSpotlight singleton ─────────────────────────────────────────────────

/**
 * Basalt-owned Spotlight store. Use this singleton instead of Mantine's global `spotlight`
 * to avoid collisions when the consumer also uses @mantine/spotlight directly.
 *
 * createSpotlight() returns [store, { open, close, toggle }].
 */
const [basaltSpotlightStore, basaltSpotlightActions] = createSpotlight()

/**
 * Singleton Spotlight store for basalt-ui apps. Pass to `<Spotlight store={...} />` when
 * mounting manually outside BasaltOverlays.
 *
 * @example
 * import { basaltSpotlight } from 'basalt-ui/commands'
 * basaltSpotlight.open()
 */
export const basaltSpotlight = basaltSpotlightActions

// ── openSpotlight / closeSpotlight ────────────────────────────────────────────

/** Open the basalt Spotlight palette programmatically. */
export function openSpotlight(): void {
  basaltSpotlightActions.open()
}

/** Close the basalt Spotlight palette programmatically. */
export function closeSpotlight(): void {
  basaltSpotlightActions.close()
}

// ── BasaltOverlaysProps ───────────────────────────────────────────────────────

export type BasaltOverlaysProps = {
  /** Mount @mantine/modals ModalsProvider. Default: true. */
  modals?: boolean
  /** Mount @mantine/spotlight Spotlight with mod+K shortcut. Default: true. */
  spotlight?: boolean
  /** Mount @mantine/notifications Notifications overlay. Default: true. */
  notifications?: boolean
  /**
   * Activate @tanstack/react-hotkeys keybindings for all registered commands. Default: true.
   * Degrades to no-op when @tanstack/react-hotkeys peer is absent — safe to leave enabled.
   */
  hotkeys?: boolean
  /** Override or extend the Notifications props (position, autoClose, limit, etc.). Defaults: position="bottom-right", autoClose=4000, limit=5. */
  notificationsProps?: Omit<ComponentProps<typeof Notifications>, 'children'>
  /** App content (required). */
  children: ReactNode
}

// ── SpotlightMount (inner component to sync live actions) ─────────────────────

/**
 * Mounts Spotlight with a live-updating actions list synced to the command registry.
 * Separated into its own component so hooks run inside the overlay tree.
 *
 * Actions are a snapshot at render time — sufficient because commands are registered at module
 * load before BasaltOverlays mounts. A future reactive stash can add a version counter here.
 */
function SpotlightMount() {
  const actions = toSpotlightActions((id) => {
    basaltSpotlightActions.close()
    void runCommand(id as CommandId)
  })

  return <Spotlight store={basaltSpotlightStore} actions={actions} shortcut="mod + K" />
}

// ── HotkeysMount (inner component — ensures hook is inside component tree) ────

/** Mounts useCommandHotkeys inside the overlay tree. Graceful no-op when peer is absent. */
function HotkeysMount() {
  useCommandHotkeys()
  return null
}

// ── BasaltOverlays ────────────────────────────────────────────────────────────

/**
 * Composable overlay mount — wraps children in ModalsProvider and renders Spotlight +
 * Notifications siblings. All three layers are enabled by default; pass `false` to disable.
 *
 * Mount exactly ONE BasaltOverlays per app. Do NOT combine with a standalone
 * `<BasaltNotifications />` from `basalt-ui/notifications` — that would double-mount
 * `<Notifications />`.
 *
 * @example
 * <BasaltProvider>
 *   <BasaltOverlays>
 *     <RouterProvider router={router} />
 *   </BasaltOverlays>
 * </BasaltProvider>
 */
export function BasaltOverlays({
  modals: enableModals = true,
  spotlight: enableSpotlight = true,
  notifications: enableNotifications = true,
  hotkeys: enableHotkeys = true,
  notificationsProps,
  children,
}: BasaltOverlaysProps) {
  const content = (
    <>
      {enableSpotlight && <SpotlightMount />}
      {enableNotifications && (
        <Notifications position="bottom-right" autoClose={4000} limit={5} {...notificationsProps} />
      )}
      {enableHotkeys && <HotkeysMount />}
      {children}
    </>
  )

  if (enableModals) {
    return <ModalsProvider>{content}</ModalsProvider>
  }

  return <>{content}</>
}
