/**
 * `basalt-ui/page` — the v3 page composites and the long-form content parts (`Prose`, `Callout`,
 * `Toc`, `ArticleLayout`). The content parts import nothing from `basalt-ui/content` and no
 * markdown peer. Peers: react, `@base-ui/react` (via `ui/dialog`, `ui/sheet`, `ui/alert`,
 * `ui/popover` and `ui/toast`).
 */

export { PageSummary } from './page-summary'
export { CardGrid } from './card-grid'
export { QueryState } from './query-state'
export { EmptyState } from './empty-state'
export { OverlayHost } from './overlay-host'
export { defineOverlays } from './define-overlays'
export { useSizeClass } from './use-size-class'
export type { SizeClass } from './use-size-class'
export { Prose } from './prose'
export { Callout } from './callout'
export { Toc } from './toc'
export { ArticleLayout } from './article-layout'
export { ToastHost } from './toast-host'
export { Page } from './page'
export { PageBar } from './page-bar'
export { PageAside } from './page-aside'
export { Facts } from './facts'
export { PropertyList } from './property-list'
export { Section } from './section'
export { SettingsLayout } from './settings-layout'
export type { SettingsLayoutProps } from './settings-layout'
export { SplitPage } from './parts/split-page'
export { InnerNav } from './parts/inner-nav'
export { mdxComponents } from './mdx'
export { ConnectionIndicator } from './connection-indicator'
export type { ConnectionIndicatorProps } from './connection-indicator'
export { RefreshButton } from './refresh-button'
export type { RefreshButtonProps } from './refresh-button'
export { Dock } from './dock'
export type { DockProps } from './dock'
export { FavoriteToggle, useFavorite } from './favorites'
export type { FavoriteToggleProps } from './favorites'
export type { FavoriteEntry, FavoriteInput, FavoritesStore } from './contract'
export { Peek } from './peek'
export type { PeekProps } from './peek'
export type {
  InnerNavGroup,
  InnerNavItem,
  InnerNavProps,
  MDXComponents,
  PageAction,
  PageActionMobile,
  PageAsideProps,
  PageBarProps,
  PageButtonAction,
  PageIdentity,
  PageLayout,
  PageLayoutOption,
  PageProps,
  PageSearch,
  PageSettings,
  PageTabBadge,
  PageTabs,
  PageTextAction,
  SectionProps,
  SplitPageProps,
} from './contract'
