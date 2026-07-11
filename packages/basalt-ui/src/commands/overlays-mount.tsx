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
 * A disabled layer's optional peer is NEVER imported — each layer is lazy-loaded (React.lazy +
 * dynamic import()) only when its flag is true, and degrades to a no-op fallback instead of
 * crashing when the peer is absent.
 *
 * Optional peers required (only when the corresponding layer is enabled):
 *   @mantine/modals ^9.3.0     (for modals)
 *   @mantine/spotlight ^9.3.0  (for spotlight)
 *   @mantine/notifications ^9.3.0 (for notifications)
 *   @tanstack/react-hotkeys ^0.10.0 (optional — keybindings degrade to no-op when absent)
 *
 * Spotlight live store: BasaltOverlays uses a basalt-owned createSpotlight() store so the
 * spotlight instance is separate from Mantine's default global. The store is created lazily (on
 * first use, whether from mounting the spotlight layer or from calling openSpotlight()/
 * closeSpotlight()) so @mantine/spotlight is never imported until actually needed. Import
 * `basaltSpotlight` and call `basaltSpotlight.open()` / `basaltSpotlight.close()` from consumer
 * code. The re-exported `openSpotlight` / `closeSpotlight` helpers delegate to this store.
 *
 * @example
 * // main.tsx — replace <BasaltNotifications /> with <BasaltOverlays>. Use the layered bundle —
 * // the unlayered one outranks basalt's `@layer basalt` styles regardless of specificity:
 * import { BasaltOverlays } from 'basalt-ui/commands'
 * import '@mantine/spotlight/styles.layer.css'
 *
 * createRoot(root).render(
 *   <BasaltProvider>
 *     <BasaltOverlays>
 *       <App />
 *     </BasaltOverlays>
 *   </BasaltProvider>
 * )
 *
 * // Disable spotlight for apps without commands — @mantine/spotlight is then never imported:
 * <BasaltOverlays spotlight={false}>
 *   <App />
 * </BasaltOverlays>
 *
 * // Open/close programmatically:
 * import { openSpotlight, closeSpotlight } from 'basalt-ui/commands'
 * openSpotlight()
 */
import type { ComponentType, ReactNode } from 'react'
import { lazy, Suspense } from 'react'
import type { ModalsProviderProps } from '@mantine/modals'
import type { NotificationsProps } from '@mantine/notifications'
import { runCommand } from './define-commands'
import type { CommandId } from './define-commands'
import { toSpotlightActions } from './projectors'
import { useCommandHotkeys } from './useCommandHotkeys'

// ── Lazy @mantine/spotlight resolution (module-wide singleton) ────────────────

type SpotlightModule = typeof import('@mantine/spotlight')
type SpotlightStore = ReturnType<SpotlightModule['createSpotlight']>[0]
type SpotlightActions = ReturnType<SpotlightModule['createSpotlight']>[1]
type SpotlightHandle = { store: SpotlightStore; actions: SpotlightActions }

let spotlightHandlePromise: Promise<SpotlightHandle | undefined> | undefined

/**
 * Lazily resolves @mantine/spotlight and creates the basalt-owned createSpotlight() store.
 * Memoized module-wide so the spotlight layer's SpotlightMount and the openSpotlight/
 * closeSpotlight helpers share one store instance. Resolves to undefined when the peer is
 * absent — callers degrade to a no-op instead of crashing.
 */
function loadSpotlightHandle(): Promise<SpotlightHandle | undefined> {
  spotlightHandlePromise ??= import('@mantine/spotlight')
    .then(({ createSpotlight }) => {
      const [store, actions] = createSpotlight()
      return { store, actions }
    })
    .catch(() => undefined)
  return spotlightHandlePromise
}

// ── basaltSpotlight singleton ─────────────────────────────────────────────────

/**
 * Basalt-owned Spotlight actions (open/close/toggle), backed by a lazily-created
 * createSpotlight() store so @mantine/spotlight is only imported on first use.
 *
 * @example
 * import { basaltSpotlight } from 'basalt-ui/commands'
 * basaltSpotlight.open()
 */
export const basaltSpotlight = {
  open: (): void => {
    void loadSpotlightHandle().then((handle) => handle?.actions.open())
  },
  close: (): void => {
    void loadSpotlightHandle().then((handle) => handle?.actions.close())
  },
  toggle: (): void => {
    void loadSpotlightHandle().then((handle) => handle?.actions.toggle())
  },
}

// ── openSpotlight / closeSpotlight ────────────────────────────────────────────

/** Open the basalt Spotlight palette programmatically. */
export function openSpotlight(): void {
  basaltSpotlight.open()
}

/** Close the basalt Spotlight palette programmatically. */
export function closeSpotlight(): void {
  basaltSpotlight.close()
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
  notificationsProps?: Omit<NotificationsProps, 'children'>
  /** App content (required). */
  children: ReactNode
}

// ── Lazy ModalsProvider (falls back to a passthrough fragment) ────────────────

function PassthroughFragment({ children }: ModalsProviderProps) {
  return <>{children}</>
}

const LazyModalsProvider = lazy(() =>
  import('@mantine/modals')
    .then((m) => ({ default: m.ModalsProvider }))
    .catch(() => ({ default: PassthroughFragment })),
)

// ── Lazy SpotlightMount (falls back to rendering nothing) ─────────────────────

function NullFallback(): ReactNode {
  return null
}

/**
 * Lazily resolves @mantine/spotlight and mounts Spotlight with a live-updating actions list
 * synced to the command registry, sharing the store created by loadSpotlightHandle().
 *
 * Actions are a snapshot at render time — sufficient because commands are registered at module
 * load before BasaltOverlays mounts. A future reactive stash can add a version counter here.
 */
const LazySpotlightMount = lazy(() =>
  Promise.all([import('@mantine/spotlight'), loadSpotlightHandle()])
    .then(([{ Spotlight }, handle]) => {
      if (handle === undefined) return { default: NullFallback }
      // Re-bind as a fresh const so the non-undefined narrowing above survives into the
      // nested closure below (TS does not carry a parameter narrowing into nested functions).
      const spotlightHandle: SpotlightHandle = handle

      function SpotlightMountInner(): ReactNode {
        const actions = toSpotlightActions((id) => {
          spotlightHandle.actions.close()
          void runCommand(id as CommandId)
        })

        return <Spotlight store={spotlightHandle.store} actions={actions} shortcut="mod + K" />
      }

      return { default: SpotlightMountInner }
    })
    .catch(() => ({ default: NullFallback })),
)

// ── Lazy Notifications (falls back to rendering nothing) ──────────────────────

function NotificationsFallback(_props: NotificationsProps): ReactNode {
  return null
}

const LazyNotifications = lazy<ComponentType<NotificationsProps>>(() =>
  import('@mantine/notifications')
    .then((m) => ({ default: m.Notifications as ComponentType<NotificationsProps> }))
    .catch(() => ({ default: NotificationsFallback })),
)

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
 * A disabled layer's optional peer is never imported.
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
      {enableSpotlight && (
        <Suspense fallback={null}>
          <LazySpotlightMount />
        </Suspense>
      )}
      {enableNotifications && (
        <Suspense fallback={null}>
          <LazyNotifications
            position="bottom-right"
            autoClose={4000}
            limit={5}
            {...notificationsProps}
          />
        </Suspense>
      )}
      {enableHotkeys && <HotkeysMount />}
      {children}
    </>
  )

  if (enableModals) {
    return (
      <Suspense fallback={<>{content}</>}>
        <LazyModalsProvider>{content}</LazyModalsProvider>
      </Suspense>
    )
  }

  return <>{content}</>
}
