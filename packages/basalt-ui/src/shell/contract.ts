/**
 * Shell contract: the public types of `AppShell`, the nav declaration and the window chrome.
 * Types only, no value symbols. Pinned by `check-contract-frozen`; a change needs a
 * `chore: contract amendment` commit. Sketched in docs/v3/concepts/shell-nav-router.md sections
 * 3.1, 3.5 and 8.
 */
import type { ReactNode } from 'react'
import type { ControlsSlot, IconComponent } from '../core/ports'
import type { NavBadge } from '../page/contract'

// ---- Opaque targets and size ---------------------------------------------------------------

/** The frame axis (never page layout); the rail is hidden compact, collapsed medium, open expanded. */
export type SizeClass = 'compact' | 'medium' | 'expanded'

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

export type NavConfig = {
  sections: readonly NavSection[]
  /** Rail bottom. */
  pinned?: readonly NavItem[]
}

/** Keys are typed from the declared nav; a typo is a compile error. */
export type NavBadges<Id extends string = string> = Partial<Record<Id, NavBadge>>

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

export type ShellBrand = { name: string; logo?: IconComponent }

export type AppShellProps<Id extends string = string> = {
  nav: NavConfig
  brand: ShellBrand
  badges?: NavBadges<Id>
  blocks?: readonly SidebarBlock[]
  globalControls?: ControlsSlot
  globalActions?: readonly GlobalAction[]
  settings?: SettingsConfig
  account?: Account
  search?: { onOpen: () => void }
  storageKey?: string
  chrome?: ShellChrome
  compactHeader?: 'show' | 'hidden'
  children?: ReactNode
}

/** Return of `useWindowChrome()`. */
export type WindowChrome = { chrome: ShellChrome; leadInset: number }
