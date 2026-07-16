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
export { ThemeToggle, type ThemeToggleProps } from './theme-toggle'
export { MOTION_DURATION, MOTION_SPRING, MOTION_EASE_STANDARD } from './motion'
export {
  BasaltShell,
  NavCountBadge,
  AppSidebar,
  SidebarSearch,
  type SidebarSearchConfig,
  SidebarAccount,
  MobileNav,
  AppBreadcrumbs,
  type BreadcrumbLinkRenderer,
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
  type AccountBadgeTone,
  type BasaltIdentity,
  type BasaltRole,
  type BasaltPlan,
  type AccountMenuItem,
  type BasaltAccountState,
  type BasaltAccountActions,
  type BasaltAccountProps,
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

// ── Persisted state + online hook (state.ts) ─────────────────────────────────────────────────────
export {
  createPersistedState,
  type PersistedStateOptions,
  useOnlineStatus,
  readPersistedValue,
} from './state'

// ── Dashboard composites (KPI atoms + settings building blocks) ──────────────────────────────────
export {
  DeltaBadge,
  type DeltaBadgeProps,
  StatCard,
  type StatCardProps,
  EmptyState,
  type EmptyStateProps,
  SettingsSection,
  type SettingsSectionProps,
  SettingsRow,
  type SettingsRowProps,
  DangerZone,
  type DangerZoneProps,
} from './dashboard'

// ── Connectivity (auto-mounted by BasaltProvider) ────────────────────────────────────────────────
export { ConnectivityProvider, ConnectivityIndicator, useConnectivity } from './connectivity'
export type {
  ConnectivityStatus,
  ConnectivitySnapshot,
  ConnectivityProviderProps,
  ConnectivityOverride,
} from './connectivity'

// ── Type-only re-exports for compile fixtures (H.4) ──────────────────────────────────────────────
// SurfaceSpec/RuleName/SkillName: the value SURFACES stays internal; types only for surfaces-broken
// fixture. GuardKind: type-only for fixture completeness. No ./surfaces subpath exposed.
export type { SurfaceSpec, RuleName, SkillName } from './surfaces'
export type { GuardKind } from './guard/types'

// ── Agent chat (thread feed + detail workspace) ──────────────────────────────────────────────────
// Everything from `./agent-chat` (Mantine-styled thread-chat components + the flagship
// ThreadWorkspace) belongs at the root. From the headless `./agent` layer, SELECTIVELY re-export
// only the pieces a ThreadWorkspace consumer needs — NOT an export-star — so the optional-peer
// components (StreamingMarkdown, BasaltStickToBottom) and the rest of `./agent` stay off the root
// entry; `edenTransport` stays out too, sourced from `basalt-ui/agent` instead.
export {
  ThreadWorkspace,
  ThreadFeed,
  ThreadOutcomeCard,
  ThreadDetailPanel,
  Composer,
  threadPartRenderers,
  ThreadTranscript,
} from './agent-chat'
export type {
  ThreadWorkspaceProps,
  ThreadFeedProps,
  ThreadOutcomeCardProps,
  ThreadDetailPanelProps,
  ComposerProps,
  ThreadTranscriptProps,
} from './agent-chat'
export { createThreadsStore, heuristicOutcome, useAgentThreadRuns } from './agent'
export type {
  AgentThread,
  AgentOutcome,
  ThreadStatus,
  ThreadsStore,
  ThreadsStoreOptions,
  OutcomeResolver,
  ChatMessage,
  AgentPart,
  AgentTransport,
} from './agent'
