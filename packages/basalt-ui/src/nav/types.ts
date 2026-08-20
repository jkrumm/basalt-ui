/**
 * The shared nav vocabulary. TYPE-ONLY BY CONTRACT — never add a value export here.
 * `src/shell/**` (Mantine) and `src/router-tanstack/**` (headless) both `import type` from it,
 * which is erased by tsup, so `dist/router-tanstack/index.js` gains no edge into `shell/` and
 * `scripts/check-dist-layering.mjs` stays green with no config change.
 */
import type { MouseEvent, ReactNode } from 'react'

/** Where a destination appears on the mobile bar. `true` ≡ `'tab'`, `false` ≡ `'hidden'`. */
export type NavMobilePlacement = 'tab' | 'more' | 'hidden'

/**
 * Props basalt hands a nav anchor. Deliberately a PLAIN FUNCTION TYPE, not `ComponentType`
 * or `ElementType`: both are unions, and a union defeats Mantine's polymorphic `component`
 * inference (`<NavLink component={…}>` then rejects `label`). VERIFIED both ways.
 */
export type NavAnchorProps = {
  className?: string
  children?: ReactNode
  onClick?: (e: MouseEvent<HTMLElement>) => void
  'aria-current'?: 'page' | undefined
  'aria-label'?: string
}
export type NavAnchor = (props: NavAnchorProps) => ReactNode

/** A single nav destination. */
export type SidebarItem = {
  key: string
  label: string
  /** Bar/menu label. Falls back to `label`. Keep ≤ 10 chars — a 5-slot bar is ~72px wide. */
  short?: string
  /** Mobile placement. `true` ≡ `'tab'`, `false` ≡ `'hidden'`. @default 'more' */
  mobile?: boolean | NavMobilePlacement
  icon: ReactNode
  /**
   * The router seam. basalt renders every pixel of chrome (desktop row, 56px slot, 44px sheet
   * row) and only hosts this component. When absent the row falls back to `<a href>` + `onClick`.
   */
  Anchor?: NavAnchor
  /** Plain href — the no-router fallback, and the breadcrumb parent target. */
  href?: string
  active?: boolean
  disabled?: boolean
  onClick?: (e: MouseEvent) => void
  /** Rich desktop badge (e.g. `NavCountBadge`). Desktop only. */
  badge?: ReactNode
  /** Unread count. Renders `NavCountBadge` on desktop when `badge` is absent, and an accent
   *  dot on the mobile slot icon. `0` renders nothing. */
  count?: number
  children?: SidebarItem[]
}

/** Per-section mobile configuration. `false` hides the whole section from mobile. */
export type NavSectionMobile = {
  /** Give this SECTION a bar slot; its destinations open per §2.2 cardinality inference. */
  tab?: true
  /** Slot label override; falls back to `SidebarSection.label`. */
  label?: string
  /** Slot icon override; falls back to `SidebarSection.icon`. */
  icon?: ReactNode
}

export type SidebarSection = {
  label: string
  items: SidebarItem[]
  icon?: ReactNode
  collapsible?: boolean
  defaultCollapsed?: boolean
  /** Mobile behaviour for this section. Omit for the default (items place themselves). */
  mobile?: false | NavSectionMobile
}

export type MobileNavSurface = 'link' | 'menu' | 'sheet'

/** One row inside a `menu`/`sheet` slot, grouped under its source section. */
export type MobileNavGroup = { key: string; label?: string; items: SidebarItem[] }

export type MobileNavSlot =
  | {
      kind: 'link'
      key: string
      label: string
      short: string
      icon: ReactNode
      active: boolean
      item: SidebarItem
    }
  | {
      kind: 'menu' | 'sheet'
      key: string
      label: string
      short: string
      icon: ReactNode
      active: boolean
      groups: MobileNavGroup[]
      isMore: boolean
    }

/** Pure projection of `sections` onto the bar. Unit-testable with no DOM. */
export type MobileNavModel = { slots: MobileNavSlot[] }

export type MobileNavConfig = {
  /** Explicit slot order by item/section key. Overrides every `item.mobile` placement. */
  tabs?: readonly string[]
  /** Hard cap on bar slots, INCLUDING More. @default 5 */
  maxTabs?: number
  /** Rows a slot may hold before it becomes a sheet instead of a menu. @default 6 */
  menuMax?: number
  /** @default 'More' */
  moreLabel?: string
  /** Extra content pinned to the bottom of the More surface. */
  moreExtra?: ReactNode
  /** Scroll container for active-slot re-tap. @default document.scrollingElement */
  getScrollElement?: () => HTMLElement | null
}
