/**
 * basalt-ui root barrel — the Mantine-coupled surface: provider, theme, the app shell and the
 * dashboard atoms. The Mantine-free token/chart layer is published under `basalt-ui/tokens` and
 * `basalt-ui/charts`, NOT re-exported here, so a tokens/charts-only consumer never pulls in
 * `@mantine/*`. One import path per symbol: `docs/V2-SPEC.md` § 1; the per-symbol verdicts are
 * `docs/waves/v2-surface.md`.
 */

export { BasaltProvider, type BasaltProviderProps } from './provider'
export {
  basaltRouterOptions,
  createBasaltRouter,
  type BasaltRouter,
  type BasaltRouterOptions,
  type BasaltRouterContext,
} from './provider/create-router'
export type { BasaltEvent, ChatTurnEnd, ChatTurnTrace, Telemetry, TraceHeaders } from './telemetry'
export {
  defineNav,
  navGroup,
  navTarget,
  flattenNav,
  useBasaltNav,
  type NavItemId,
} from './router-tanstack'
export { scrollParentOf, useCoarsePointer, type Tone } from './common'
export { createBasaltTheme } from './theme'
export { ThemeToggle } from './theme/theme-toggle'
export { StatusDot, type StatusDotProps } from './theme/status-dot'
export { StatusVerdict, type StatusVerdictProps } from './theme/status-verdict'
export {
  BasaltShell,
  PageBar,
  PageAside,
  useSizeClass,
  PageTitle,
  type ShellBaseProps,
  type SidebarBlock,
  type SettingsMenuItem,
} from './shell'
export {
  WidgetHeader,
  DeltaBadge,
  Section,
  StatCard,
  type StatCardBreakdownRow,
  type StatCardSparklineSize,
  StatGroup,
  type StatStripCell,
  type StatStripRow,
  EmptyState,
  SettingsSection,
  SettingsRow,
  DangerZone,
  Meter,
  type MeterProps,
  type MeterSegment,
  type MeterTick,
  type MeterZone,
  BarList,
  type BarListProps,
  PageSummary,
  type PageSummaryProps,
} from './dashboard'
export { unwrap } from './unwrap'

// The one augmentable seam: `declare module 'basalt-ui' { interface BasaltRegister { … } }` only
// merges when the entry exports the interface. `v2-surface.md` marks it `delete` (no consumer
// *names* it), but every typed registry (commands, overlays, notifications, series) resolves
// through it — augmentation is not an import, so the consumer count missed it.
export type { BasaltRegister, SeriesKey } from './register'
