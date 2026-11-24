/**
 * Shell contract: the public types of `AppShell`, the nav declaration and the window chrome.
 * Types only, no value symbols. Pinned by `check-contract-frozen`; a change needs a
 * `chore: contract amendment` commit. Sketched in docs/v3/concepts/shell-nav-router.md sections
 * 3.1, 3.5 and 8.
 */
import type { ReactNode } from 'react'
import type { ControlsSlot, IconComponent, NavTarget } from '../core/ports'
import type { FavouritesStore, NavBadge } from '../page/contract'
import type { SizeClass } from '../page/use-size-class'

// ---- Opaque targets and size ---------------------------------------------------------------

/** The frame axis (never page layout); the rail is hidden compact, collapsed medium, open expanded. */
export type { SizeClass }

/** What a `custom`, `popover` or block slot receives; clipped to the header row. */
export type ShellBox = { height: number; sizeClass: SizeClass }

// ---- Nav (3.1) ----------------------------------------------------------------------------

// minimal; concept elides it (the `linkOptions` result)
export type NavLinkOptions = {
  to: string
  params?: Record<string, string>
  search?: Record<string, unknown> | ((prev: Record<string, unknown>) => Record<string, unknown>)
  hash?: string
}

export type NavChild = { id: string; label: string; link: NavLinkOptions }

export type NavItem = {
  id: string
  label: string
  /** Shorter label for the tab bar. */
  short?: string
  icon?: IconComponent
  link: NavLinkOptions
  /** `'/'` is always exact. */
  exact?: boolean
  activeWhen?: (location: { pathname: string }) => boolean
  mobile?: 'tab' | 'more' | 'hidden'
  children?: readonly NavChild[]
}

export type NavSection = { id: string; label: string; items: readonly NavItem[] }

/** The nav the shell draws; `basalt-ui/router`'s `NavConfig` is what `defineNav` returns. */
export type ShellNav = {
  sections: readonly NavSection[]
  /** Rail bottom. */
  pinned?: readonly NavItem[]
}

/** Keys are typed from the declared nav; a typo is a compile error. */
export type ShellBadges<Id extends string = string> = Partial<Record<Id, NavBadge>>

// ---- Header actions, sidebar blocks, settings, account (3.1) ------------------------------

type GlobalActionBase = {
  id: string
  label: string
  /** Yields first when low; default 1. */
  priority?: number
  mobile?: 'bar' | 'more' | 'hidden'
}

export type GlobalAction =
  | (GlobalActionBase & { kind: 'button'; icon: IconComponent; onClick: () => void })
  | (GlobalActionBase & {
      kind: 'popover'
      icon: IconComponent
      badge?: number
      content: (box: ShellBox) => ReactNode
    })
  /** Counted escape; re-renders alone. */
  | (GlobalActionBase & { kind: 'custom'; render: (box: ShellBox) => ReactNode })

export type SidebarBlock =
  | { kind: 'progress'; id: string; label: string; value: number }
  | {
      kind: 'custom'
      id: string
      mobile?: { label: string; icon: IconComponent }
      render: (box: ShellBox) => ReactNode
    }

export type SettingsItem = { id: string; label: string; icon?: IconComponent; onClick: () => void }

export type SettingsConfig = { mode: 'menu'; items: readonly SettingsItem[] }

// minimal; concept elides it
export type AccountRow = { label: string; onClick: () => void }

export type Account =
  | { status: 'loading' }
  | { status: 'signed-out'; onSignIn: () => void }
  | {
      status: 'signed-in'
      name: string
      /** Email or plan text. */
      detail?: string
      avatar?: string
      /** Manage account and the like. */
      rows?: readonly AccountRow[]
      onSignOut?: () => void
    }

// ---- AppShell (3.1) -----------------------------------------------------------------------

/** `native-overlay`: header 52, lead inset, drag region. */
export type ShellChrome = 'web' | 'native-overlay'

/**
 * How the work surface sits on the frame from `md` up: `panel` is inset, rounded and hairline
 * bordered; `flush` meets the window's edges with one hairline on the rail side. Compact is always flush.
 */
export type ShellFrame = 'panel' | 'flush'

export type ShellBrand = { name: string; logo?: IconComponent }

/** One workspace in the switcher: a face (an image, else a glyph, else its initials) and a name. */
export type Workspace = { id: string; label: string; avatar?: string; icon?: IconComponent }

/**
 * The workspace switcher at the top of the rail. `onSwitch` gets the chosen id; the app decides what
 * switching does (a route, a session, a refetch). `manage` adds a last row that opens the app's own
 * workspace settings.
 */
export type WorkspaceSwitcher = {
  current: Workspace
  options: readonly Workspace[]
  onSwitch: (id: string) => void
  manage?: { label: string; href: string | NavTarget }
}

export type AppShellProps<Id extends string = string> = {
  nav: ShellNav
  brand: ShellBrand
  badges?: ShellBadges<Id>
  blocks?: readonly SidebarBlock[]
  globalControls?: ControlsSlot
  globalActions?: readonly GlobalAction[]
  settings?: SettingsConfig
  account?: Account
  search?: { onOpen: () => void }
  /** A workspace switcher in the brand zone; on a phone its options are rows of the More surface. */
  workspace?: WorkspaceSwitcher
  /**
   * Where the rail's Favourites section keeps its entries. Default: `persisted` under
   * `basalt:<storageKey>-favourites`.
   */
  favourites?: FavouritesStore
  /**
   * The key the rail's collapse is stored under; the width the reader dragged it to lives beside it
   * under `<storageKey>-width`.
   */
  storageKey?: string
  chrome?: ShellChrome
  /** Default `panel`. */
  frame?: ShellFrame
  compactHeader?: 'show' | 'hidden'
  children?: ReactNode
}

/** Return of `useWindowChrome()`. */
export type WindowChrome = { chrome: ShellChrome; leadInset: number }
