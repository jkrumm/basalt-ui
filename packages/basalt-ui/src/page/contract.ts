/**
 * Page contract: the public types of `Page`, `PageBar`, `PageAside`, `Section`, `SplitPage` and
 * `InnerNav`. Types only, no value symbols. Pinned by `check-contract-frozen`; a change needs a
 * `chore: contract amendment` commit. Sketched in docs/v3/concepts/shell-nav-router.md sections
 * 3.2, 3.3 and 3.6, and docs/v3/concepts/ai-mdx.md section 4 (`MDXComponents`).
 */
import type { ComponentType, ReactNode } from 'react'
import type { ControlHandle, ControlsSlot, FreshnessView, IconComponent } from '../core/ports'

// ---- Targets and badges shared with the shell (`shell -> page` is the declared edge) -------

/** Opaque product of `navTarget(linkOptions)`; only the `link` adapter opens it. */
export type NavTarget = { readonly __brand: 'NavTarget' }

/** One field per row: a count, or a dot. */
export type NavBadge = { count: number; attention?: boolean } | { dot: true; attention?: boolean }

// ---- Page and PageBar (3.2) ---------------------------------------------------------------

export type PageProps = {
  /** Scopes commands. */
  area?: string
  /** Definite height; `{ min }` keeps a floor in px. */
  fill?: boolean | { min: number }
  /** Renders `<main>` with no `PageHost`. */
  landmark?: boolean
  children?: ReactNode
}

// minimal; concept elides it
export type PageActionMobile = 'bar' | 'more' | 'hidden'

/** Items sharing a `group` render joined and fold together. */
export type PageButtonAction = {
  id: string
  label: string
  icon?: IconComponent
  primary?: boolean
  group?: string
  onClick: () => void
  mobile?: PageActionMobile
}

export type PageTextAction = {
  kind: 'text'
  id: string
  text: string
  mobile?: PageActionMobile
}

export type PageAction = PageButtonAction | PageTextAction

export type PageBarProps = {
  /** Breadcrumb leaf and `h1` in a shell; the visible `h1` without one. */
  title?: string
  parent?: { label: string; href: string | NavTarget }
  controls?: ControlsSlot
  tabs?: ControlsSlot
  refresh?: { scope: 'page' | 'global' } & FreshnessView['button']
  /** At most 5, at most one `primary`, none required. */
  actions?: readonly [PageAction?, PageAction?, PageAction?, PageAction?, PageAction?]
}

// ---- PageAside (3.2) ----------------------------------------------------------------------

export type PageAsideProps = {
  /** Header and `aria-label`; required. */
  title: string
  width?: number
  /** Open state, device or URL lane. */
  state?: ControlHandle<boolean>
  dock?: 'always' | 'auto'
  mobile?: 'sheet'
  children?: ReactNode
}

// ---- Section (3.2, 8) ---------------------------------------------------------------------

export type SectionProps = {
  title: string
  controls?: ControlsSlot
  children?: ReactNode
}

// ---- InnerNav and SplitPage (3.3) ---------------------------------------------------------

// minimal; concept elides it (a `replace` field is a compile error)
export type PushField<K extends string> = ControlHandle<K> & { readonly history: 'push' }

// minimal; concept elides it
export type InnerNavMenuItem = { id: string; label: string; onSelect: () => void }

export type InnerNavItem = {
  id: string
  label: string
  icon?: IconComponent
  badge?: NavBadge
  /** Min 2 entries; one action is a plain button. */
  menu?: readonly [InnerNavMenuItem, InnerNavMenuItem, ...InnerNavMenuItem[]]
}

export type InnerNavGroup = { id: string; label: string; items: readonly InnerNavItem[] }

export type InnerNavProps<K extends string = string> = {
  label: string
  state: PushField<K>
  filter?: ControlsSlot
  groups: readonly InnerNavGroup[]
}

export type SplitPageProps = {
  /** Narrow: the list while unset, the pane when set. CSS only. */
  selected: boolean
  list: () => ReactNode
  detail: () => ReactNode
}

// ---- MDX (ai-mdx 4) -----------------------------------------------------------------------

// minimal; concept elides it
/** Type of `mdxComponents`: h2-h4 with anchors, a, table, blockquote, Callout, Steps, Step, Tabs, Tab, Figure, Kbd. */
export type MDXComponents = Readonly<Record<string, ComponentType<never>>>
