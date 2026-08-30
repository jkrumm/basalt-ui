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
export type { BasaltFontsConfig, CreateBasaltThemeOptions } from './theme'
export { CTL_THEME, CtlSlot } from './theme'
export type { CtlSlotProps } from './theme'
/**
 * The action vocabulary every home's `actions` slot takes (`docs/CONTROLS-SPEC.md` §2.1). The
 * COMPONENTS that project it (`ActionGroup`, `OverflowMenu`, `SyncButton`, and the filter family)
 * live on `basalt-ui/controls` — only the types a `PageBar`/`BasaltShell` prop mentions are here.
 */
export type { BarAction, ActionGroupProps, GlobalAction } from './controls/actions'
export { ThemeToggle, type ThemeToggleProps } from './theme-toggle'
export { MOTION_DURATION, MOTION_SPRING, MOTION_EASE_STANDARD } from './motion'
export {
  BasaltShell,
  NavCountBadge,
  AppSidebar,
  SidebarSearch,
  type SidebarSearchConfig,
  type SidebarSearchActions,
  SidebarAccount,
  MobileNav,
  type MobileNavProps,
  projectMobileNav,
  type ProjectMobileNavOptions,
  MOBILE_MAX_TABS_DEFAULT,
  MOBILE_MENU_MAX_DEFAULT,
  MOBILE_MORE_KEY,
  AppBreadcrumbs,
  PageBar,
  type PageBarProps,
  PageAside,
  type PageAsideProps,
  type SidebarSection,
  type SidebarItem,
  type SidebarBlock,
  type SidebarBlockItem,
  type SidebarBlockTone,
  type SidebarListBlock,
  type SidebarProgressBlock,
  type SidebarCustomBlock,
  type NavAnchor,
  type NavAnchorProps,
  type NavMobilePlacement,
  type NavSectionMobile,
  type MobileNavConfig,
  type MobileNavGroup,
  type MobileNavModel,
  type MobileNavSlot,
  type MobileNavSurface,
  type BasaltShellProps,
  type BrandConfig,
  type SettingsMenuItem,
  type AppSidebarProps,
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

// ── Persisted state + the headless store kernel (state.ts) ───────────────────────────────────────
// The `field.*` VALUE is deliberately not re-exported here — `basalt-ui/forms` already owns the
// name `field` on its own barrel. Import it from `basalt-ui/router-tanstack` (beside
// `createSearchStore`) or from `basalt-ui/state` (beside `createLocalStore`).
export {
  createPersistedState,
  type PersistedStateOptions,
  readPersistedValue,
  createLocalStore,
  type LocalStore,
  type AnyField,
  type BooleanField,
  type EnumField,
  type FieldFallback,
  type FieldHandle,
  type FieldLane,
  type FieldOption,
  type FieldSetOptions,
  type FieldValue,
  type MultiField,
  type NumberField,
  type RangeField,
  type RangeParams,
  type RangePresets,
  type RangeValue,
  type RangeWindow,
  type RangeWindows,
  type ResolvedLane,
  type SearchValues,
  type StoredValues,
  type StringField,
} from './state'

// ── WidgetHeader (unified section/widget/card heading primitive, docs/CONTROLS-SPEC.md §2.2) ─────
export {
  WidgetHeader,
  type WidgetHeaderProps,
  type WidgetHeaderTier,
  type DeltaPolarity,
} from './widget-header'

// ── Section (tier-2 heading composer over WidgetHeader, docs/CONTROLS-SPEC.md §2.2) ───────────────
export { Section, type SectionProps } from './section'

// ── Dashboard composites (KPI atoms + settings building blocks) ──────────────────────────────────
export {
  DeltaBadge,
  type DeltaBadgeProps,
  StatCard,
  type StatCardBreakdownRow,
  type StatCardProps,
  type StatCardTone,
  EmptyState,
  type EmptyStateProps,
  SettingsSection,
  type SettingsSectionProps,
  SettingsRow,
  type SettingsRowProps,
  DangerZone,
  type DangerZoneProps,
  QueryState,
  type QueryStateProps,
  type QueryStateLike,
  type QueryStateVariant,
  type QueryEmptyCopy,
  LoadingState,
  type LoadingStateProps,
  ErrorState,
  type ErrorStateProps,
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
// BasaltStickToBottom and the rest of `./agent` stay off the root entry; `edenTransport` stays out
// too, sourced from `basalt-ui/agent` instead. `agent-chat/thread-message.tsx` DOES reach
// `./content`'s `Markdown` for its text renderer — root's markdown/shiki/mermaid optional peers
// come from that path, not from `./agent`.
export {
  ThreadWorkspace,
  ThreadFeed,
  ThreadFeedRow,
  ThreadOutcomeCard,
  ThreadDetailPanel,
  Composer,
  threadPartRenderers,
  ThreadTranscript,
  ToolChip,
} from './agent-chat'
export type {
  ThreadWorkspaceProps,
  ThreadFeedProps,
  ThreadFeedRowProps,
  ThreadOutcomeCardProps,
  ThreadDetailPanelProps,
  ComposerProps,
  ComposerSubmit,
  ComposerAttachment,
  ComposerHandle,
  ThreadTranscriptProps,
  MessageAffordances,
  VirtualizeOptions,
  VirtualizeProps,
  ToolChipProps,
} from './agent-chat'
export {
  createAdapterThreadsStore,
  createThreadsStore,
  heuristicOutcome,
  threadsStoreAdapterContract,
  useAgentThreadRuns,
} from './agent'
export type {
  AdapterThreadsStoreOptions,
  AgentThread,
  AgentOutcome,
  ThreadStatus,
  ThreadsStore,
  ThreadsStoreAdapter,
  ThreadsStoreAdapterContractCase,
  ThreadsStoreOptions,
  OutcomeResolver,
  ChatMessage,
  AgentPart,
  AgentTransport,
} from './agent'
