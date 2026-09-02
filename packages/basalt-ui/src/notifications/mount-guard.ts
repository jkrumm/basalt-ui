/**
 * Duplicate-Notifications-mount guard (F15) — a shared module-level counter, not a per-caller ref,
 * because the whole point is detecting a SECOND, unrelated caller mounting `<BasaltOverlays
 * notifications />` (`commands/overlays-mount.tsx`) at once — nested/duplicate mounts double-render
 * Mantine's `<Notifications />` and neither instance can see the other.
 *
 * Lives here (`./notifications`), not `./commands`, so `commands` is the one importing a shared util
 * rather than the reverse — `./notifications` never depends on `./commands`. Zero `@mantine/*`
 * import, so pulling it into `commands` does not eagerly load `@mantine/notifications`.
 *
 * Not exported from the `./notifications` public barrel (`index.ts`) — internal wiring only, same
 * as `provider/lab-theme.ts`.
 */
import { useEffect } from 'react'
import { isDev } from '../common/is-dev'

let mountedNotificationsCount = 0

/**
 * Call from any component that renders a `<Notifications />` overlay. Warns in dev when a second
 * caller is mounted at the same time. Not a false positive under React 18 StrictMode's double-invoke
 * (that mounts/unmounts the SAME instance in sequence, so the count returns to 0 before a genuine
 * second instance could exist).
 */
export function useNotificationsMountGuard(): void {
  useEffect(() => {
    mountedNotificationsCount++
    if (mountedNotificationsCount > 1 && isDev()) {
      console.warn(
        '[basalt] more than one Notifications overlay is mounted at once — mount exactly ONE ' +
          "<BasaltOverlays notifications /> (they all render Mantine's <Notifications />, so " +
          'toasts would double-fire).',
      )
    }
    return () => {
      mountedNotificationsCount--
    }
  }, [])
}
