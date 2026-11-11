/**
 * The read shapes of the shell core. TYPE-ONLY: never add a value export here.
 *
 * Structural on purpose. The core reads a nav declaration through these shapes and imports nothing
 * from `src/router`: the `defineNav` result (`AnyNavConfig`) and the frozen `NavConfig` of
 * `src/shell/contract.ts` both satisfy them, which `types.type-guard.test.ts` pins. A row the core
 * projects always holds the ORIGINAL item object in `item`, never a copy, because anchor identity
 * keys on that object (concept section 4, invariant 25): a copied item remounts its link.
 */
import type { IconComponent } from '../../core/ports'
import type { NavBadges } from '../contract'

/** A count (optionally attention-tinted) or a dot. `count: 0` is not lit and renders nothing. */
export type NavBadge = NonNullable<NavBadges[string]>

/** The badges an `AppShell` receives, keyed by nav item id. */
export type BadgeMap = Readonly<Partial<Record<string, NavBadge>>>

/** Where a destination appears on the phone bar. `true` is `'tab'`, `false` is `'hidden'`. */
export type CoreMobilePlacement = 'tab' | 'more' | 'hidden'

/** One nav destination as the core reads it. */
export type CoreNavItem = {
  id: string
  label: string
  /** Bar label; falls back to `label`. */
  short?: string
  icon?: IconComponent
  disabled?: boolean
  /** @default 'more' */
  mobile?: boolean | CoreMobilePlacement
  children?: ReadonlyArray<CoreNavItem>
}

/** Per-section phone behaviour: `false` hides the whole subtree, `{ tab: true }` makes one slot. */
export type CoreSectionMobile = false | { tab?: true; label?: string; icon?: IconComponent }

export type CoreNavSection = {
  /** The fold key and the `mobile.tabs` name of the section. */
  id: string
  label: string
  icon?: IconComponent
  collapsible?: boolean
  defaultCollapsed?: boolean
  mobile?: CoreSectionMobile
  items: ReadonlyArray<CoreNavItem>
}

export type CoreMobileConfig = {
  /** Explicit bar order by item id or section id. Replaces every item's own `mobile`. */
  tabs?: ReadonlyArray<unknown>
  /** Slots including More. @default 5 */
  maxTabs?: number
  /** Rows a slot holds before it becomes a sheet. @default 12 */
  menuMax?: number
  /** @default 'More' */
  moreLabel?: string
}

export type CoreNavConfig = {
  sections: ReadonlyArray<CoreNavSection>
  /** Rail bottom. On the phone they project after the sections, under no group heading. */
  pinned?: ReadonlyArray<CoreNavItem>
  mobile?: CoreMobileConfig
}
