/**
 * Page contract: the public types of `Page`, `PageBar`, `PageAside`, `Section`, `SplitPage` and
 * `InnerNav`. Types only, no value symbols. Pinned by `check-contract-frozen`; a change needs a
 * `chore: contract amendment` commit. Sketched in docs/v3/concepts/shell-nav-router.md sections
 * 3.2, 3.3 and 3.6, and docs/v3/concepts/ai-mdx.md section 4 (`MDXComponents`).
 */
import type { ComponentType, ReactNode } from 'react'
import type { CardMenu } from '../core/phase'
import type {
  ConnectionView,
  ControlHandle,
  ControlsSlot,
  FreshnessView,
  IconComponent,
  NavTarget,
} from '../core/ports'

// ---- Targets and badges shared with the shell (`shell -> page` is the declared edge) -------

export type { NavTarget }

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

/**
 * A page's or section's view switch: a tab strip drawn from an enum field (`label` is its
 * accessible name), or a `ControlsSlot` for custom content (a `ViewTabs`, for its phone forms).
 */
export type PageTabs<K extends string = string> =
  | ControlsSlot
  | { handle: ControlHandle<K>; label: string }

export type PageBarProps<K extends string = string> = {
  /** Breadcrumb leaf and `h1` in a shell; the visible `h1` without one. */
  title?: string
  parent?: { label: string; href: string | NavTarget }
  controls?: ControlsSlot
  tabs?: PageTabs<K>
  /** `useConnection()`: draws `ConnectionIndicator` in the end slot, before `refresh`. */
  connection?: ConnectionView
  refresh?: { scope: 'page' | 'global' } & FreshnessView['button']
  /** At most 5, at most one `primary`, none required. */
  actions?: readonly [PageAction?, PageAction?, PageAction?, PageAction?, PageAction?]
}

// ---- PageAside (3.2) ----------------------------------------------------------------------

export type PageAsideProps = {
  /** Header and `aria-label`; required. */
  title: string
  width?: number
  /**
   * Open state, device or URL lane. A boolean field is open while it is `true`; a string field
   * holds the open record's id: open while it holds a value, and a close clears it.
   */
  state?: ControlHandle<boolean> | ControlHandle<string>
  dock?: 'always' | 'auto'
  mobile?: 'sheet'
  children?: ReactNode
}

// ---- Section (3.2, 8) ---------------------------------------------------------------------

export type SectionProps<K extends string = string> = {
  title: string
  /** One line beside the title, shown while collapsed too. */
  summary?: string
  controls?: ControlsSlot
  /** The section's view switch, beside the title. */
  tabs?: PageTabs<K>
  /** The heading is the trigger; open state is uncontrolled or a handle (F2 amendment n5). */
  collapsible?: { defaultOpen?: boolean; state?: ControlHandle<boolean> }
  children?: ReactNode
}

// ---- InnerNav and SplitPage (3.3) ---------------------------------------------------------

// minimal; concept elides it (a `replace` field is a compile error)
export type PushField<K extends string> = ControlHandle<K> & { readonly history: 'push' }

export type InnerNavItem = {
  id: string
  label: string
  icon?: IconComponent
  /** Leaves the field: a route or URL the item opens instead of writing the field. A `navTarget` is a typed route. */
  href?: string | NavTarget
  badge?: NavBadge
  menu?: CardMenu
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
