/**
 * BasaltNotifications — thin wrapper around Mantine `<Notifications />` with basalt defaults.
 *
 * Mount this inside BasaltProvider (typically in main.tsx, after BasaltProvider):
 *
 * ```tsx
 * <BasaltProvider ...>
 *   <BasaltNotifications />
 *   <App />
 * </BasaltProvider>
 * ```
 *
 * It is NOT auto-mounted from BasaltProvider to keep @mantine/notifications out of the root barrel.
 * This is an opt-in component — only add it when the app uses the notifications battery.
 *
 * NOTE: The composable `<BasaltOverlays>` (which will bundle notifications + modals + commands
 * into a single mount point) arrives with the ./commands battery. For now, mount
 * `<BasaltNotifications />` directly.
 *
 * @example
 * import { BasaltNotifications } from 'basalt-ui/notifications'
 * import { BasaltProvider } from 'basalt-ui'
 *
 * createRoot(root).render(
 *   <BasaltProvider>
 *     <BasaltNotifications />
 *     <App />
 *   </BasaltProvider>
 * )
 */
import { Notifications } from '@mantine/notifications'

export type BasaltNotificationsProps = {
  /** Toast position. Default: 'bottom-right'. */
  position?:
    | 'top-left'
    | 'top-right'
    | 'top-center'
    | 'bottom-left'
    | 'bottom-right'
    | 'bottom-center'
  /** Auto-close delay (ms). Default: 4000. */
  autoClose?: number | false
  /** Max visible toasts. Default: 5. */
  limit?: number
}

/**
 * Mounts the Mantine Notifications overlay with basalt defaults.
 * Render ONE instance per app — typically inside BasaltProvider, before the router.
 *
 * @example
 * <BasaltProvider>
 *   <BasaltNotifications position="bottom-right" limit={5} />
 *   <RouterProvider router={router} />
 * </BasaltProvider>
 */
export function BasaltNotifications({
  position = 'bottom-right',
  autoClose = 4000,
  limit = 5,
}: BasaltNotificationsProps) {
  return <Notifications position={position} autoClose={autoClose} limit={limit} />
}
