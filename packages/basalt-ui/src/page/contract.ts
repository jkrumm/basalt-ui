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
  Phase,
  QueryStateLike,
  Tone,
} from '../core/ports'

// ---- Targets and badges shared with the shell (`shell -> page` is the declared edge) -------

export type { NavTarget }

/** One field per row: a count, or a dot. */
export type NavBadge = { count: number; attention?: boolean } | { dot: true; attention?: boolean }

// ---- Page and PageBar (3.2) ---------------------------------------------------------------

export type PageProps = {
  /** Scopes commands. */
  area?: string
  /**
   * Fills the work surface: a definite height, no gutter and no gap, so the one main part (a table,
   * a split page, a canvas) meets the surface's edges; `{ min }` keeps a floor in px.
   */
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
 * What a tab carries beside its label: a count in muted tabular figures (`attention` draws it in
 * the bad tone, for the tab that needs the reader) and a dot in a tone before the label.
 */
export type PageTabBadge = { count?: number; attention?: boolean; tone?: Tone }

/**
 * A page's or section's view switch: a tab strip drawn from an enum field (`label` is its
 * accessible name), or a `ControlsSlot` for custom content (a `ViewTabs`, for its phone forms).
 * `badges` gives a tab of the strip its count and tone, keyed by the field's value.
 */
export type PageTabs<K extends string = string> =
  | ControlsSlot
  | {
      state: ControlHandle<K>
      label: string
      badges?: Partial<Record<K, PageTabBadge>>
      handle?: undefined
    }
  | {
      /** @deprecated Use `state`; removed in the next minor. */
      handle: ControlHandle<K>
      label: string
      badges?: Partial<Record<K, PageTabBadge>>
      state?: undefined
    }

/** The view row's search: a string field, written as the reader types. `label` names the box. */
export type PageSearch = { state: ControlHandle<string>; label: string; placeholder?: string }

/** One layout of the view row's toggle: drawn as its icon, named by `label`. */
export type PageLayoutOption<L extends string = string> = {
  value: L
  label: string
  icon: IconComponent
}

/** The view row's layout toggle (table, cards): an enum field and an icon per value. */
export type PageLayout<L extends string = string> = {
  state: ControlHandle<L>
  label: string
  options: readonly PageLayoutOption<L>[]
}

/** The view row's view-settings button, drawn as an icon before the actions. */
export type PageSettings = { label: string; icon?: IconComponent; onClick: () => void }

/**
 * What a record page's band says about the record beside its title: a face, a type line and tags.
 * Draws only with a `title`, which it then names visibly, so the page is named once.
 */
export type PageIdentity = {
  /** A face before the title. `{}` draws the title's initials. */
  avatar?: { src?: string; icon?: IconComponent; shape?: 'person' | 'object' }
  /** One muted line under the title: a city, a domain, a type. */
  subtitle?: string
  /** Trailing tags (Lozenges, a Status); they never shrink below their content. */
  tags?: ReactNode
}

export type PageBarProps<K extends string = string, L extends string = string> = {
  /** Breadcrumb leaf and `h1` in a shell; the visible `h1` without one. */
  title?: string
  /**
   * A record page's identity: the band draws the title as a heading with its face, subtitle and
   * tags (the title is then the visible `h1` in a shell too, and the breadcrumb leaf is kept).
   * Needs `title`; the page's own body then never repeats the record's name.
   */
  identity?: PageIdentity
  parent?: { label: string; href: string | NavTarget }
  controls?: ControlsSlot
  tabs?: PageTabs<K>
  /** Before `controls`; below `@wide` it takes a line of its own. */
  search?: PageSearch
  /** After `refresh`, before `settings`; `undefined` draws none (`useTableViews().layout` with one layout). */
  layout?: PageLayout<L> | undefined
  /** After `layout`, before `actions`. */
  settings?: PageSettings
  /** `useConnection()`: draws `ConnectionIndicator` in the end slot, before `refresh`. */
  connection?: ConnectionView
  refresh?: { scope: 'page' | 'global' } & FreshnessView['button']
  /**
   * The record this page is: a star that adds it to the shell rail's Favourites. In the view row it
   * sits before `settings`; without a row it leads the header's actions. Nothing outside an `AppShell`.
   */
  favourite?: FavouriteInput
  /**
   * At most 5, at most one `primary`, none required. In a shell they claim the header's end unless
   * the band holds a control; then they end the band, the primary last.
   */
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
  /** The query the nav's items wait on: while it loads, every item draws a placeholder row with no link. */
  phase?: Phase | QueryStateLike | undefined
}

export type SplitPageProps = {
  /** Narrow: the list while unset, the pane when set. CSS only. */
  selected: boolean
  /**
   * The way back below the `wide` tier, written from the same field that `selected` reads: the
   * pane field's `clear`. Without it a phone's pane has only the browser's back. Absent from the
   * pane at `wide` and up, where the list sits beside it.
   */
  onBack?: () => void
  /** The back link's text; names the list (`Settings`). Defaults to the catalogue's `page.backToList`. */
  backLabel?: string
  list: () => ReactNode
  detail: () => ReactNode
  /** The list column's width becomes the reader's: a separator on its end edge (pointer, arrows, Home and End, Enter or a double click to reset), remembered on the device per id. Only at the wide tier; below it one pane shows. `initial`, `min` and `max` default to 320, 240 and 640 px. */
  resize?: { id: string; initial?: number; min?: number; max?: number }
  /** Who scrolls: 'page' (default) the list in its own ScrollArea and the detail with the page; 'panes' both panes are bounded to the page's height and each brings its own scroller (a virtual list, a ScrollArea), for a fill page such as a mailbox. */
  scroll?: 'page' | 'panes'
}

// ---- MDX (ai-mdx 4) -----------------------------------------------------------------------

// minimal; concept elides it
/** Type of `mdxComponents`: h2-h4 with anchors, a, table, blockquote, Callout, Steps, Step, Tabs, Tab, Figure, Kbd. */
export type MDXComponents = Readonly<Record<string, ComponentType<never>>>

// ---- Favourites (shell nav) ----------------------------------------------------------------

/** One favourite as stored: serialisable, so a store can keep it anywhere. */
export type FavouriteEntry = { id: string; label: string; href: string }

/**
 * Where an app's favourites live. The default is `persisted` under `<storageKey>-favourites`; an
 * app that keeps them on a server passes its own. `get` returns the same array until `set` or an
 * outside change replaces it.
 */
export type FavouritesStore = {
  get(): readonly FavouriteEntry[]
  set(next: readonly FavouriteEntry[]): void
  subscribe(listener: () => void): () => void
}

/** What a record offers to be favourited: a stable id, a label, where it opens and its glyph. */
export type FavouriteInput = {
  id: string
  label: string
  target: string | NavTarget
  /** Drawn on the rail row for this session; a stored favourite keeps no glyph. */
  icon?: IconComponent
}
