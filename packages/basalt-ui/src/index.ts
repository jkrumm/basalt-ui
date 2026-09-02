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
  type BasaltErrorBoundaryProps,
  type BasaltErrorContext,
} from './provider'
// -- Common primitives (src/common) ------------------------------------------------------------
// Not a subpath of its own: `BasaltProps` is the base every component's props extend, so it belongs
// on the entry a consumer already imports. The module is Mantine-free (`common/boundary.test.ts`),
// which is what lets `./charts` reach `cx` without breaching the layer boundary.
// The validate/errors internals (`useValidateProps`/`assertRequiredProps`/`requiredProp`/`oneOf`/
// `deprecatedProp`/`duplicateMount`/`missingLayer`/`BASALT_PREFIX`) and the ref helpers
// (`assignRef`/`mergeRefs`) are basalt's own diagnostic vocabulary, not a consumer's — no consumer
// imports them, so they stay internal (C1 consolidation).
export {
  type BasaltProps,
  type SlotClassNames,
  type SlotStylesProps,
  type Tone,
  type ToneWithNeutral,
  type Tier,
  cx,
  scrollParentOf,
  SCROLLPORT_ATTRIBUTE,
} from './common'

export { createBasaltTheme, baseTheme, cssVariablesResolver } from './theme'
export type { BasaltFontsConfig, CreateBasaltThemeOptions } from './theme'
export { CTL_THEME, CtlSlot } from './theme'
export type { CtlSlotProps } from './theme'
export { ThemeToggle, type ThemeToggleProps } from './theme/theme-toggle'
/**
 * The action vocabulary every home's `actions` slot takes (`docs/CONTROLS-SPEC.md` §2.1). The
 * OTHER components that project it (`OverflowMenu`, `SyncButton`, and the filter family) live on
 * `basalt-ui/controls`; `ActionGroup` is re-exported here alongside its own types so a typed
 * `PageBar`/`BasaltShell` `actions` wrapper needs only this one subpath.
 */
export {
  ActionGroup,
  type BarAction,
  type ActionGroupProps,
  type GlobalAction,
} from './controls/actions'
export { MOTION_DURATION, MOTION_SPRING, MOTION_EASE_STANDARD } from './common/motion'
export {
  BasaltShell,
  NavCountBadge,
  type NavCountBadgeProps,
  AppSidebar,
  SidebarSearch,
  type SidebarSearchProps,
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
  type AppBreadcrumbsProps,
  PageBar,
  type PageBarProps,
  type PageBarSlot,
  PageAside,
  type PageAsideProps,
  type PageAsideSlot,
  useBreakpoint,
  type BreakpointName,
  PageTitle,
  type PageTitleProps,
  type PageTitleSlot,
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
// The `field.*` VALUE is deliberately not re-exported here. `basalt-ui/forms` used to own the
// name `field` too and collide with this one; that forms helper is `inputProps` now (the
// `@deprecated field` alias was removed in 1.29.0, C1 consolidation — see MIGRATING.md). Import
// `field.*` from `basalt-ui/router-tanstack` (beside `createSearchStore`) or from `basalt-ui/state`
// (beside `createLocalStore`).
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
  type ResolveLane,
  type SearchValues,
  type StoredValues,
  type StringField,
} from './state'

// ── Dashboard composites (WidgetHeader/Section heading family + KPI atoms + settings building
// blocks, docs/CONTROLS-SPEC.md §2.2) ──────────────────────────────────────────────────────────────
export {
  WidgetHeader,
  type WidgetHeaderDeltaProps,
  type WidgetHeaderMetricProps,
  type WidgetHeaderProps,
  type WidgetHeaderSlot,
  type WidgetHeaderTier,
  type WidgetHeaderTitleProps,
  DeltaBadge,
  type DeltaBadgeProps,
  type DeltaPolarity,
  Section,
  type SectionProps,
  type SectionSlot,
  StatCard,
  type StatCardBreakdownRow,
  type StatCardProps,
  type StatCardSlot,
  type StatCardTone,
  WidgetGrid,
  type WidgetGridCols,
  type WidgetGridItemProps,
  type WidgetGridProps,
  StatGroup,
  type StatGroupCols,
  type StatGroupProps,
  EmptyState,
  type EmptyStateProps,
  type EmptyStateSlot,
  SettingsSection,
  type SettingsSectionProps,
  type SettingsSectionSlot,
  SettingsRow,
  type SettingsRowProps,
  type SettingsRowSlot,
  DangerZone,
  type DangerZoneProps,
  QueryState,
  type QueryStateProps,
  type QueryStateLike,
  type QueryStateSlot,
  type QueryStateTier,
  type QueryEmptyCopy,
  LoadingState,
  type LoadingStateProps,
  ErrorState,
  type ErrorStateProps,
} from './dashboard'

// ── Connectivity (auto-mounted by BasaltProvider, merged into ./provider — dropped ./connectivity
// subpath) ──────────────────────────────────────────────────────────────────────────────────────
export { ConnectivityProvider } from './provider/connectivity-provider'
export { ConnectivityIndicator } from './provider/connectivity-indicator'
export { useConnectivity } from './provider/use-connectivity'
export type {
  ConnectivityStatus,
  ConnectivitySnapshot,
  ConnectivityProviderProps,
  ConnectivityOverride,
} from './provider/connectivity-types'

// ── Query (createBasaltQueryClient, unwrap, lazy devtools — dropped ./query subpath) ──────────────
export { createBasaltQueryClient, unwrap } from './query-client'
export { BasaltQueryDevtools } from './query-devtools'
export { toErrorMessage, errorStatus } from './common/errors'

// ── BasaltDevDock (C5 consolidation) ────────────────────────────────────────────────────────────
export { BasaltDevDock, type BasaltDevDockProps, type BasaltDevDockTool } from './dev-dock'

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
  RowHeightProps,
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
