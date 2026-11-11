/**
 * Authoring and inference types of the nav declaration. TYPE-ONLY: never add a value export here.
 *
 * `link` is plain TanStack `linkOptions` (`to` / `search` / `params`), and nav metadata rides
 * OUTSIDE the validated object in a sibling `link:` key.
 *
 * Why not flat (`{ id, label, to, search }`) via a carrier over `ValidateLinkOptions`:
 * `Constrain<T, C> = (T extends C ? T : never) | C` is an ASSIGNABILITY check, and assignability
 * does not do excess-property checking, so `{ id, label, to: '/charts', colour: 'red' }` compiles
 * silently. Compile-verified. A config whose selling point is "typos are compile errors" cannot
 * have a hole exactly where metadata typos live.
 */
import type { RegisteredRouter } from '@tanstack/react-router'
import type { IconComponent } from '../../core/ports'

// ── authoring shapes ─────────────────────────────────────────────────────────────────────────────

/** Where a destination appears on the mobile bar. `true` ≡ `'tab'`, `false` ≡ `'hidden'`. */
export type NavMobilePlacement = 'tab' | 'more' | 'hidden'

/** Per-section mobile behaviour. `false` hides the whole section from mobile. */
export type NavSectionMobile = {
  /** Give this SECTION a bar slot. */
  tab?: true
  /** Slot label override; falls back to the section `label`. */
  label?: string
  /** Slot icon override; falls back to the section `icon`. */
  icon?: IconComponent
}

export type NavItemMeta = {
  id: string
  label: string
  /** Bar/menu label. Falls back to `label`. */
  short?: string
  icon?: IconComponent
  disabled?: boolean
  /** Mobile placement. `true` ≡ `'tab'`, `false` ≡ `'hidden'`. @default 'more' */
  mobile?: boolean | NavMobilePlacement
  /** Active on an exact path match only. Default: prefix. `'/'` is always exact. */
  exact?: boolean
  /** Replaces path matching for this item. */
  activeWhen?: (ctx: { pathname: string }) => boolean
}

export type NavSectionMeta = {
  id: string
  label: string
  icon?: IconComponent
  collapsible?: boolean
  defaultCollapsed?: boolean
  mobile?: false | NavSectionMobile
}

/** Widened read shapes. The framework reads through these; a consumer never writes them. */
export type AnyNavLink = { to: string; search?: unknown; params?: unknown }
export type AnyNavItem = NavItemMeta & { link: AnyNavLink; children?: ReadonlyArray<AnyNavItem> }
export type AnyNavSection = NavSectionMeta & { items: ReadonlyArray<AnyNavItem> }
export type AnyNavConfig = {
  sections: ReadonlyArray<AnyNavSection>
  pinned?: ReadonlyArray<AnyNavItem>
}

// ── badges ───────────────────────────────────────────────────────────────────────────────────────

/** One badge per row: a count (optionally attention-tinted) or a dot, never both. */
export type NavBadge =
  | { count: number; attention?: boolean; dot?: never }
  | { dot: true; count?: never; attention?: never }

/** Keys are typed from the declared nav; a typo is a compile error. */
export type NavBadges<N> = Partial<Record<NavItemId<N>, NavBadge>>

// ── inference machinery ──────────────────────────────────────────────────────────────────────────

/** Exact-object check: any key outside `Shape` is typed `never`, which surfaces as an error. */
export type Exact<T, Shape> = T & { readonly [K in Exclude<keyof T, keyof Shape>]: never }

/**
 * `Exact` for ONE item, recursing into `children`.
 *
 * The recursion is the whole point: `AnyNavItem['children']` is a plain
 * `ReadonlyArray<AnyNavItem>` constraint, and a constraint is an assignability check, so a
 * top-level-only `Exact` leaves the metadata-typo hole open one level down. Reapplying `Exact` per
 * child, at every depth, makes "every typo is a compile error" hold below the top row too.
 *
 * The `[K in Extract<keyof T, 'children'>]` form rather than a `children?:` property keeps this
 * inference-safe: it evaluates to `{}` for an item without children (no phantom key, nothing
 * becomes required), and the intersection with `Exact<T, AnyNavItem>` keeps `T` in a naked
 * inference position so the caller's literal types still flow out of `defineNav`'s `const` generics.
 */
export type ExactNavItem<T> = Exact<T, AnyNavItem> & {
  readonly [K in Extract<keyof T, 'children'>]: T[K] extends ReadonlyArray<AnyNavItem>
    ? NavItemsInput<T[K]>
    : T[K]
}

/** Per-element `Exact` over a tuple of items, so an unknown key errors at the item that owns it. */
export type NavItemsInput<T extends ReadonlyArray<AnyNavItem>> = {
  readonly [K in keyof T]: ExactNavItem<T[K]>
}

/** `ExactNavItem` one level up: a section is exact, and so is every item inside it. */
export type ExactNavSection<T> = Exact<T, AnyNavSection> & {
  readonly [K in Extract<keyof T, 'items'>]: T[K] extends ReadonlyArray<AnyNavItem>
    ? NavItemsInput<T[K]>
    : T[K]
}

export type NavSectionsInput<T extends ReadonlyArray<AnyNavSection>> = {
  readonly [K in keyof T]: ExactNavSection<T[K]>
}

type SectionItemsOf<N> = N extends { sections: ReadonlyArray<{ items: ReadonlyArray<infer I> }> }
  ? I
  : never
type PinnedItemsOf<N> = N extends { pinned?: ReadonlyArray<infer I> } ? I : never

/** One item plus every descendant, at arbitrary depth. */
type WithDescendants<I> =
  | I
  | (I extends { children: ReadonlyArray<infer C> } ? WithDescendants<C> : never)

type AllItemsOf<N> = WithDescendants<SectionItemsOf<N> | PinnedItemsOf<N>>

/**
 * id → link options, as a mapped type with key remapping. Do NOT replace this with
 * `Extract<AllItemsOf<N>, { id: K }>['link']`: that form was compile-tested and returns the WHOLE
 * union, silently losing per-id precision.
 */
export type NavIndex<N> = {
  [I in AllItemsOf<N> as I extends { id: infer K extends string } ? K : never]: I extends {
    link: infer L
  }
    ? L
    : never
}

/**
 * The literal union of every addressable item id in a definition: sections' items, pinned items,
 * children and grandchildren at ARBITRARY depth. If this ever resolves to plain `string`, the nav
 * API validates nothing while reporting zero errors; `nav.type-guard.test.ts` goes red (TS2578)
 * the moment the union widens.
 */
export type NavItemId<N> = Extract<keyof NavIndex<N>, string>
export type NavSectionId<N> = N extends { sections: ReadonlyArray<{ id: infer I }> } ? I : never
export type NavTabId<N> = NavItemId<N> | NavSectionId<N>

/**
 * The resolved definition `defineNav` returns. Call `defineNav` at module scope: anchor identity
 * keys on the item objects, so a definition built inside a component remounts the links per render.
 */
export type NavConfig<
  S extends ReadonlyArray<AnyNavSection>,
  P extends ReadonlyArray<AnyNavItem>,
  T extends ReadonlyArray<unknown>,
> = {
  sections: S
  mobile?: {
    /** Explicit bar order by item/section id. Omit to let each item's `mobile` field decide. */
    tabs?: T
    /** @default 5 */ maxTabs?: number
    /** @default 6 */ menuMax?: number
    /** @default 'More' */ moreLabel?: string
  }
} & ([P] extends [readonly []] ? unknown : { pinned: P })

/** What `defineNav` accepts: the same shape with `Exact` applied at every section and item. */
export type NavConfigInput<
  S extends ReadonlyArray<AnyNavSection>,
  P extends ReadonlyArray<AnyNavItem>,
  T extends ReadonlyArray<unknown>,
> = {
  sections: NavSectionsInput<S>
  pinned?: NavItemsInput<P>
  mobile?: NavConfig<S, P, T>['mobile']
}

/**
 * Without the `Register` augmentation `RegisteredRouter['routeTree']` is `any`, every `to` widens
 * to `string` and the definition validates nothing, so the parameter becomes an unsatisfiable
 * string literal whose text is the fix. Parametric over the tree so the un-registered state is
 * testable inside a program that registers a router.
 */
export type RegisteredOr<T, Tree = RegisteredRouter['routeTree']> = 0 extends 1 & Tree
  ? 'basalt: declare Register { router }'
  : T
