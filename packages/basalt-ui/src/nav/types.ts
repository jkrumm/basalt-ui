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
  /** A parent on the path to the active row. NOT active itself — never carries `aria-current`. */
  ancestor?: boolean
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

/**
 * Status tone on a sidebar-block item — byte-identical to the common `Tone` vocabulary
 * (`common/props.ts`, audit A13) and to `StatCardTone`, whose members are `VX.status` keys by
 * construction. Declared here rather than aliased to `common`'s `Tone`: this module is the one
 * `./router-tanstack` reads, and `common/props.ts` re-exports `Tier` (type-only) from
 * `../widget-header/widget-header`, a Mantine-coupled file — importing anything from `common/props`
 * here would pull that whole module's declaration graph into `nav/types.d.ts`, making it
 * unresolvable without `@mantine/core` installed. Kept in step with `Tone` by convention, not by
 * import.
 */
export type SidebarBlockTone = 'good' | 'warn' | 'bad'

/** One row inside a `kind: 'list'` block. Same router seam as `SidebarItem` — `Anchor`, then href. */
export type SidebarBlockItem = {
  key: string
  label: string
  /** Trailing muted text (a timestamp, a count, an owner). */
  meta?: string
  icon?: ReactNode
  /** Renders a status dot in place of a missing `icon`; reads `--vx-status-*`, never a hex. */
  tone?: SidebarBlockTone
  Anchor?: NavAnchor
  href?: string
  onClick?: () => void
}

/**
 * A list of non-destination rows under a micro-label — "Awaiting action", "Recents", a project
 * list. `count` is the header badge (and what earns a rail dot); `max` shows the first N with a
 * "Show more" toggle past it.
 */
export type SidebarListBlock = {
  kind: 'list'
  key: string
  label: string
  icon?: ReactNode
  count?: number
  /** Rows shown before the "Show more" toggle. Omit to show every row. */
  max?: number
  items: SidebarBlockItem[]
  /** @default 'nav' */
  placement?: 'nav' | 'bottom'
  collapsible?: boolean
  /** Collapsed-rail projection. @default 'dot' when `count` is set, `'hidden'` otherwise */
  rail?: 'dot' | 'hidden'
  /** @default 'more' */
  mobile?: 'more' | 'hidden'
}

/** A "Getting started 1 of 5" progress row. Pinned above the settings footer; never in the nav. */
export type SidebarProgressBlock = {
  kind: 'progress'
  key: string
  label: string
  value: number
  total: number
  onClick?: () => void
  /** @default 'bottom' — the only placement a progress row has. */
  placement?: 'bottom'
  /** Collapsed-rail projection: a ring on the settings row. @default 'ring' */
  rail?: 'ring' | 'hidden'
  /** @default 'hidden' */
  mobile?: 'more' | 'hidden'
}

/**
 * DESKTOP ONLY — arbitrary consumer content (a tree, a filter panel) that no set of rows can
 * express. Replaced `BasaltShellProps.sidebarNavExtra`; hidden on the collapsed rail and absent
 * from mobile for the same reason that prop was.
 */
export type SidebarCustomBlock = {
  kind: 'custom'
  key: string
  node: ReactNode
  /** @default 'nav' */
  placement?: 'nav' | 'bottom'
}

/**
 * A sidebar block — DECLARED DATA, never a `ReactNode` slot (law C13, `docs/CONTROLS-SPEC.md`
 * §2.3), which is what lets basalt own the collapsed-rail badge and the mobile More-sheet
 * projection instead of each consumer hand-rolling both.
 */
export type SidebarBlock = SidebarListBlock | SidebarProgressBlock | SidebarCustomBlock

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
  /**
   * Scroll container for active-slot re-tap. Only needed when the page scrolls somewhere basalt
   * cannot see — inside a shell the default already resolves `AppShell.Main`
   * (`[data-basalt-scrollport]`), and outside one it falls back to the document.
   *
   * @default the `[data-basalt-scrollport]` element, else `document.scrollingElement`
   */
  getScrollElement?: () => HTMLElement | null
}
