/**
 * `basalt-ui/static` — parts for content pages that render to static HTML with no client JavaScript:
 * no provider, no context, no hook, no router. Every visible string and accessible name is a prop.
 * The interactive ones (the menu, the theme switch, the copy button) are platform markup;
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
export { siteMdxComponents } from './mdx'
export type { SiteMdxLabels } from './mdx'
export type { SiteLink, SiteLinkGroup, TocEntry } from './types'
