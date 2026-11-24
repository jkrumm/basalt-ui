/**
 * `basalt-ui/static` — parts for content pages that render to static HTML with no client JavaScript:
 * no provider, no context, no hook, no router. Every visible string and accessible name is a prop.
 * The interactive ones (the menus, the theme switch, the copy button) are platform markup;
 * one inline script, placed by the `basalt-ui/astro` integration, serves them all. Peers: react only.
 */
export { Prose } from '../page/prose'
export type { ProseProps } from '../page/prose'
export { SiteHeader } from './site-header'
export type { SiteHeaderProps } from './site-header'
export { SiteFooter } from './site-footer'
export type { SiteFooterProps } from './site-footer'
export { ThemeSwitch } from './theme-switch'
export type { ThemeSwitchProps } from './theme-switch'
export { SiteCallout } from './callout'
export type { SiteCalloutProps } from './callout'
export { SiteCodeBlock } from './code-block'
export type { SiteCodeBlockProps } from './code-block'
export { SiteArticle, SitePager } from './article-layout'
export type { SiteArticleProps, SitePagerProps } from './article-layout'
export { SiteTabs, SiteTab } from './tabs'
export type { SiteTabsProps, SiteTabProps } from './tabs'
export { SiteForm, SiteField, SiteSubmit } from './form'
export type { SiteFormProps, SiteFieldProps } from './form'
export { SiteDataTable } from './data-table'
export type { SiteDataTableProps } from './data-table'
export { siteMdxComponents } from './mdx'
export type { SiteMdxLabels } from './mdx'
// The landing blocks export the data shapes a page writes; their props read off `ComponentProps`.
export { SiteHero } from './hero'
export { SiteBento, SiteFeature } from './bento'
export { SiteComparison } from './comparison'
export type { SiteComparisonColumn, SiteComparisonRow } from './comparison'
export { SiteQuestionList } from './question-list'
export type { SiteQuestion } from './question-list'
export { SiteCallToAction } from './call-to-action'
export type {
  SiteAction,
  SiteLink,
  SiteLinkGroup,
  SiteMenuEntry,
  SiteNavItem,
  SiteNavMenu,
  TocEntry,
} from './types'
