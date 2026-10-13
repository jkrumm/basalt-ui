/**
 * basalt-ui root barrel — the Mantine-coupled surface: provider, theme, the app shell and the
 * dashboard atoms. The Mantine-free token/chart layer is published under `basalt-ui/tokens` and
 * `basalt-ui/charts`, NOT re-exported here, so a tokens/charts-only consumer never pulls in
 * `@mantine/*`. One import path per symbol: `docs/V2-SPEC.md` § 1; the per-symbol verdicts are
 * `docs/waves/v2-surface.md`.
 */

export { BasaltProvider } from './provider'
export {
  createBasaltRouter,
  type BasaltRouter,
  type BasaltRouterContext,
} from './provider/create-router'
export type { BasaltEvent } from './telemetry'
export {
  defineNav,
  navGroup,
  navTarget,
  flattenNav,
  useBasaltNav,
  // Transitional: `useNav` goes when `BasaltShell` takes a `nav` prop (V2-SPEC § 2); the
  // playground and argo's root route spread it until then.
  useNav,
  type NavItemId,
} from './router-tanstack'
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
