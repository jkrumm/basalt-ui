/**
 * The dev dock — mounted by `BasaltProvider` behind a literal `NODE_ENV` check and not exported
 * from the barrel (V2-SPEC § 2). A fixed bottom drawer hosting the Router devtools, the Query
 * devtools panel and the theme lab; it renders only the ACTIVE panel, and the provider's three
 * `dev.*` Spotlight commands choose which.
 *
 * Every dependency is an OPTIONAL peer loaded through `import()` when its tool opens, so neither
 * devtools package is required until then. In production this returns `null` before any import.
 */
import { lazy, Suspense, useEffect } from 'react'
import type { ReactNode } from 'react'
import { Box, CloseButton, Flex, Group, Text } from '@mantine/core'
import type { BasaltProps } from './common/props'
import { applyOverrides, loadOverrides } from './theme-lab/boot'
import type { ThemeLabControlsProps } from './theme-lab'

/** Which panel is open. `null` renders nothing (the dock is unmounted, not hidden). */
export type BasaltDevDockTool = 'router' | 'query' | 'theme'

const TOOL_TITLE: Record<BasaltDevDockTool, string> = {
  router: 'Router Devtools',
  query: 'Query Devtools',
  theme: 'Theme Lab',
}

// Any non-null object — avoids a hard, eager type dependency on `@tanstack/react-router` for a
// consumer who never renders the `'router'` tool, while still accepting a REAL `Router` class
// instance with no cast. A narrower structural type (matching a `Router` field, or falling back
// to `Record<string, unknown>`) used to reject that instance under TS weak-type detection: a
// class instance declares no index signature, so it has no excess-property overlap with either
// branch. `TanStackRouterDevtoolsPanel` itself takes the real (much wider) `AnyRouter` type; the
// devtools panel is the only reader of this prop, so `object` is exactly as wide as it needs to be.
type DevDockRouter = object

const LazyRouterDevtoolsPanel = lazy(() =>
  import('@tanstack/react-router-devtools').then((m) => ({
    default: m.TanStackRouterDevtoolsPanel,
  })),
)
Object.assign(LazyRouterDevtoolsPanel, { displayName: 'LazyRouterDevtoolsPanel' })

// The embeddable PANEL, not `ReactQueryDevtools` (`BasaltQueryDevtools`'s own wrapped export) —
// that one renders its own floating trigger button + auto-popup shell, which would duplicate the
// dock's own chrome. `query-devtools.tsx`'s `BasaltQueryDevtools` stays the answer for a consumer
// who wants the traditional floating-button devtools instead of a dock tab.
const LazyQueryDevtoolsPanel = lazy(() =>
  import('@tanstack/react-query-devtools').then((m) => ({ default: m.ReactQueryDevtoolsPanel })),
)
Object.assign(LazyQueryDevtoolsPanel, { displayName: 'LazyQueryDevtoolsPanel' })

const LazyThemeLabControls = lazy(() =>
  import('./theme-lab').then((m) => ({ default: m.ThemeLabControls })),
)
Object.assign(LazyThemeLabControls, { displayName: 'LazyThemeLabControls' })

export type BasaltDevDockProps = BasaltProps & {
  /** Which panel to show. `null` renders nothing. */
  tool: BasaltDevDockTool | null
  /** Called when the dock's own close button fires, or a hosted panel asks to close itself
   * (the router devtools' own `setIsOpen`, the query devtools' own `onClose`). */
  onClose: () => void
  /** The active TanStack `Router` instance — required only to render the `'router'` tool; a
   * consumer that never opens it may omit this entirely. */
  router?: DevDockRouter
  /** Forwarded to the hosted `ThemeLabControls` (icons, the copy callback — see its own props). */
  themeLab?: ThemeLabControlsProps
}

/**
 * Lazy, production-excluded dock. Safe to mount unconditionally with `tool={null}` — the dynamic
 * imports for whichever peer a tool needs only fire once that tool is actually selected, and
 * never at all in production.
 */
export function BasaltDevDock({
  tool,
  onClose,
  router,
  themeLab,
  className,
  style,
}: BasaltDevDockProps): ReactNode {
  // The theme lab owns only the editing UI — re-apply persisted overrides at boot so a tuning
  // session survives a refresh, whether or not the dock is open.
  useEffect(() => applyOverrides(loadOverrides()), [])
  if (process.env['NODE_ENV'] === 'production') return null
  if (tool === null) return null

  return (
    <Flex
      direction="column"
      {...(className !== undefined && { className })}
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        height: '42vh',
        zIndex: 400,
        background: 'var(--mantine-color-body)',
        borderTop: '1px solid var(--mantine-color-default-border)',
        // Floating tier: a fixed dock sits above the page like a menu/drawer, so it takes
        // basalt's overlay depth token rather than Mantine's raw shadow ramp.
        boxShadow: 'var(--vx-shadow-overlay)',
        ...style,
      }}
    >
      <Group
        justify="space-between"
        px="sm"
        py={6}
        style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
      >
        <Text size="xs" fw={600} tt="uppercase" c="dimmed">
          {TOOL_TITLE[tool]}
        </Text>
        <CloseButton size="sm" onClick={onClose} aria-label="Close devtools" />
      </Group>
      {/* theme-allow raw-scroll-container — hosts third-party devtools panels sized to
          height: 100%; they need a real overflow ancestor, not ScrollArea's custom viewport. */}
      <Box style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <Suspense fallback={null}>
          {tool === 'router' && router !== undefined && (
            <LazyRouterDevtoolsPanel
              // The devtools panel's own `router` prop takes the real `AnyRouter` type;
              // `DevDockRouter` is deliberately the widest structural stand-in (`object`) so this
              // module never eagerly imports the router's types.
              // oxlint-disable-next-line typescript/no-explicit-any -- see above
              router={router as any}
              isOpen
              setIsOpen={onClose}
              style={{ height: '100%' }}
            />
          )}
          {tool === 'query' && (
            <LazyQueryDevtoolsPanel onClose={onClose} style={{ height: '100%' }} />
          )}
          {tool === 'theme' && (
            <Box p="md">
              <LazyThemeLabControls {...themeLab} />
            </Box>
          )}
        </Suspense>
      </Box>
    </Flex>
  )
}
