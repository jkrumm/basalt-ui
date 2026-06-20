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
 */
import type { ReactNode } from 'react'
import { ModalsProvider } from '@mantine/modals'
import { Spotlight } from '@mantine/spotlight'
import { Notifications } from '@mantine/notifications'
import { toSpotlightActions } from './projectors'

export type BasaltOverlaysProps = {
  /** Mount @mantine/modals ModalsProvider. Default: true. */
  modals?: boolean
  /** Mount @mantine/spotlight Spotlight with mod+K shortcut. Default: true. */
  spotlight?: boolean
  /** Mount @mantine/notifications Notifications overlay. Default: true. */
  notifications?: boolean
  /** App content (required). */
  children: ReactNode
}

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
  children,
}: BasaltOverlaysProps) {
  const content = (
    <>
      {enableSpotlight && <Spotlight actions={toSpotlightActions()} shortcut="mod + K" />}
      {enableNotifications && <Notifications position="bottom-right" autoClose={4000} limit={5} />}
      {children}
    </>
  )

  if (enableModals) {
    return <ModalsProvider>{content}</ModalsProvider>
  }

  return <>{content}</>
}
