/**
 * basalt-ui root barrel — the Mantine-coupled surface: provider, theme, the app shell and the
 * dashboard atoms. The Mantine-free token/chart layer is published under `basalt-ui/tokens` and
 * `basalt-ui/charts`, NOT re-exported here, so a tokens/charts-only consumer never pulls in
 * `@mantine/*`. One import path per symbol: `docs/V2-SPEC.md` § 1; the per-symbol verdicts are
 * `docs/waves/v2-surface.md`.
 */

// Provider-owned lines (wiring, error boundary, connectivity, query client, dev dock): the
// `delete` verdicts for these ride with the provider/query lanes that replace them (§ 2, § 7), so
// they stay exported here until that lane lands.
export {
  BasaltProvider,
  type BasaltProviderProps,
  BasaltErrorBoundary,
  type BasaltErrorBoundaryProps,
  type BasaltErrorContext,
} from './provider'
export { ConnectivityProvider } from './provider/connectivity-provider'
export { ConnectivityIndicator } from './provider/connectivity-indicator'
export { useConnectivity } from './provider/use-connectivity'
export type {
  ConnectivityStatus,
  ConnectivitySnapshot,
  ConnectivityProviderProps,
  ConnectivityOverride,
} from './provider/connectivity-types'
export type { ConnectivityIndicatorProps } from './provider/connectivity-indicator'
export { createBasaltQueryClient } from './query-client'
export { BasaltQueryDevtools } from './query-devtools'
export { toErrorMessage, errorStatus } from './common/errors'
export { BasaltDevDock, type BasaltDevDockProps, type BasaltDevDockTool } from './dev-dock'
export { scrollParentOf, useCoarsePointer } from './common'
export { createBasaltTheme } from './theme'
export { ThemeToggle } from './theme/theme-toggle'
export {
  BasaltShell,
  PageBar,
  PageAside,
  useSizeClass,
  PageTitle,
  type SidebarBlock,
  type SettingsMenuItem,
} from './shell'
export {
  WidgetHeader,
  DeltaBadge,
  Section,
  StatCard,
  type StatCardBreakdownRow,
  type StatCardTone,
  StatGroup,
  EmptyState,
  SettingsSection,
  SettingsRow,
  DangerZone,
} from './dashboard'
export { unwrap } from './query-client'

// The one augmentable seam: `declare module 'basalt-ui' { interface BasaltRegister { … } }` only
// merges when the entry exports the interface. `v2-surface.md` marks it `delete` (no consumer
// *names* it), but every typed registry (commands, overlays, notifications, series) resolves
// through it — augmentation is not an import, so the consumer count missed it.
export type { BasaltRegister } from './register'
