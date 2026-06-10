/**
 * basalt-ui root barrel — the Mantine-coupled surface.
 *
 * Provider + theme + the app shell. The Mantine-free token/chart layer is published under the
 * `basalt-ui/tokens` and `basalt-ui/charts` subpath exports (see package.json), NOT re-exported
 * here, so a tokens/charts-only consumer never pulls in `@mantine/*`.
 */

export { BasaltProvider, type BasaltProviderProps } from './provider'
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
