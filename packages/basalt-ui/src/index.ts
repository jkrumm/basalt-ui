/**
 * basalt-ui root barrel — the Mantine-coupled surface.
 *
 * Provider + theme + the app shell. The Mantine-free token/chart layer is published under the
 * `basalt-ui/tokens` and `basalt-ui/charts` subpath exports (see package.json), NOT re-exported
 * here, so a tokens/charts-only consumer never pulls in `@mantine/*`.
 */

export {
  BasaltProvider,
  type BasaltProviderProps,
  BasaltErrorBoundary,
  type BasaltErrorContext,
} from './provider'
export { createBasaltTheme, baseTheme, cssVariablesResolver } from './theme'
export {
  BasaltShell,
  NavCountBadge,
  AppSidebar,
  MobileNav,
  AppBreadcrumbs,
  PageHeaderProvider,
  PageActions,
  PageActionsOutlet,
  type SidebarSection,
  type SidebarItem,
  type BasaltShellProps,
  type BrandConfig,
  type SettingsMenuItem,
  type AppSidebarProps,
  type MobileNavItem,
  type MobileNavSection,
  type NavLinkRenderer,
  type MobileNavLinkRenderer,
} from './shell'

// ── Design seam (register.ts) ─────────────────────────────────────────────────────────────────────
// BasaltRegister MUST be exported from the package main entry so `declare module 'basalt-ui'`
// augmentation works — a consumer cannot augment 'basalt-ui/charts'.
export {
  type BasaltRegister,
  type Slot,
  type Series,
  type SeriesKey,
  type AsyncState,
  assertNever,
  type StandardSchemaV1,
} from './register'

// ── Persisted state (state.ts) ────────────────────────────────────────────────────────────────────
export { createPersistedState, type PersistedStateOptions } from './state'

// ── Type-only re-exports for compile fixtures (H.4) ──────────────────────────────────────────────
// SurfaceSpec/RuleName/SkillName: the value SURFACES stays internal; types only for surfaces-broken
// fixture. GuardKind: type-only for fixture completeness. No ./surfaces subpath exposed.
export type { SurfaceSpec, RuleName, SkillName } from './surfaces'
export type { GuardKind } from './guard/types'
