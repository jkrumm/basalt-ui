/**
 * Typed navigation definition. Wraps TanStack's own `linkOptions` rather than reimplementing its
 * validator, so `to` / `search` / `params` get the router's full checking, and nav metadata rides
 * OUTSIDE the validated object in a sibling `link:` key.
 *
 * Why not flat (`{ id, label, to, search }`) via a carrier `TComp` over `ValidateLinkOptions`:
 * `Constrain<T, C> = (T extends C ? T : never) | C` is an ASSIGNABILITY check, and assignability
 * does not do excess-property checking — so `{ id, label, to: '/charts', colour: 'red' }` compiles
 * silently. Compile-verified. A config whose selling point is "typos are compile errors" cannot
 * have a hole exactly where metadata typos live.
 *
 * No JSX and no Mantine in this module — `./router-tanstack` is a headless barrel by contract.
 */
import type { ReactNode } from 'react'
import type { NavMobilePlacement, NavSectionMobile } from '../shell/nav-types'

// ── authoring shapes ─────────────────────────────────────────────────────────────────────────────

export type NavItemMeta = {
  id: string
  label: string
  /** Bar/menu label. Falls back to `label`. */
  short?: string
  icon?: ReactNode
  disabled?: boolean
  /** Mobile placement. `true` ≡ `'tab'`, `false` ≡ `'hidden'`. @default 'more' */
  mobile?: boolean | NavMobilePlacement
  /** Active on an exact path match only. Default: prefix (`fuzzy: true`). `'/'` is always exact. */
  exact?: boolean
}

export type NavGroupMeta = {
  id: string
  label: string
  icon?: ReactNode
  collapsible?: boolean
  defaultCollapsed?: boolean
  mobile?: false | NavSectionMobile
}

/** Widened read shapes. The framework reads through these; a consumer never writes them. */
export type AnyNavLink = { to: string; search?: unknown; params?: unknown }
export type AnyNavItem = NavItemMeta & { link: AnyNavLink; children?: ReadonlyArray<AnyNavItem> }
export type AnyNavGroup = NavGroupMeta & { items: ReadonlyArray<AnyNavItem> }

// ── inference machinery ──────────────────────────────────────────────────────────────────────────

/** Exact-object check: any key outside `Shape` is typed `never`, which surfaces as an error. */
export type Exact<T, Shape> = T & { readonly [K in Exclude<keyof T, keyof Shape>]: never }

/**
 * `Exact` for ONE item, recursing into `children`.
 *
 * The recursion is the whole point: `AnyNavItem['children']` is a plain
 * `ReadonlyArray<AnyNavItem>` constraint, and a constraint is an assignability check — so a
 * top-level-only `Exact` leaves the metadata-typo hole wide open exactly one level down
 * (`children: [{ id, label, colour: 'red', link }]` compiled silently). Reapplying `Exact` per
 * child, at every depth, is what makes the nested `link:` design actually deliver "every typo is a
 * compile error" rather than "every typo in the top row is a compile error".
 *
 * The `[K in Extract<keyof T, 'children'>]` form rather than a `children?:` property is what keeps
 * this inference-safe: it evaluates to `{}` for an item that declares no children (so no phantom
 * key is added to the checked shape and nothing becomes required), and the intersection with
 * `Exact<T, AnyNavItem>` keeps `T` in a naked inference position so the caller's literal types
 * still flow out of `navGroup`'s `const T`.
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

type ItemsOf<G> = G extends ReadonlyArray<{ items: ReadonlyArray<infer I> }> ? I : never

/**
 * One item plus every descendant, at arbitrary depth. Recursive so the TYPE side matches what
 * `findById` / `flattenNav` already do at RUNTIME — a one-level walk made `navTarget(nav,
 * 'grandchild')` a compile error against an id the runtime resolves fine.
 */
type WithDescendants<I> =
  | I
  | (I extends { children: ReadonlyArray<infer C> } ? WithDescendants<C> : never)

type AllItemsOf<G> = WithDescendants<ItemsOf<G>>

/**
 * id → link options, as a mapped type with key remapping. Do NOT replace this with
 * `Extract<AllItemsOf<G>, { id: K }>['link']` — that form was compile-tested and returns the
 * WHOLE union, silently losing per-id precision.
 */
export type NavIndex<G> = {
  [I in AllItemsOf<G> as I extends { id: infer K extends string } ? K : never]: I extends {
    link: infer L
  }
    ? L
    : never
}

/**
 * The literal union of every addressable destination id in a definition — parents, children and
 * grandchildren alike, at ARBITRARY depth, matching what `findById` / `flattenNav` resolve at
 * runtime. Verified to seven levels of `children` with no instantiation-depth complaint.
 *
 * If this ever resolves to plain `string`, the entire nav API validates nothing while reporting
 * zero errors — so any change to the generics above must be re-checked against
 * `apps/playground/src/nav.type-guard.tsx`, whose `@ts-expect-error` rows go UNUSED (TS2578) the
 * moment the union widens.
 */
export type NavItemId<G> = Extract<keyof NavIndex<G>, string>
export type NavGroupId<G> = G extends ReadonlyArray<{ id: infer I }> ? I : never
export type NavTabId<G> = NavItemId<G> | NavGroupId<G>

export type NavConfig<
  G extends ReadonlyArray<AnyNavGroup>,
  T extends ReadonlyArray<NavTabId<G>>,
> = {
  groups: G
  mobile?: {
    /** Explicit bar order by item/group id. Omit to let each item's `mobile` field decide. */
    tabs?: T
    /** @default 5 */ maxTabs?: number
    /** @default 6 */ menuMax?: number
    /** @default 'More' */ moreLabel?: string
  }
}

// ── builders (identity at runtime) ───────────────────────────────────────────────────────────────

/**
 * One nav group. `const M` on the meta is load-bearing: without it the group `id` widens to
 * `string` from `NavGroupMeta` and `mobile.tabs` silently stops validating group ids.
 */
export function navGroup<const M extends NavGroupMeta, const T extends ReadonlyArray<AnyNavItem>>(
  meta: Exact<M, NavGroupMeta>,
  items: NavItemsInput<T>,
): M & { items: T } {
  return { ...(meta as M), items: items as unknown as T }
}

/**
 * The whole navigation — desktop and mobile — in one inferred definition.
 *
 * There is deliberately NO compile-time cap on `mobile.tabs.length`. Both a
 * `T extends … & { length: 0|1|2|3|4|5 }` constraint and a `tabs: T & MaxFive` property form were
 * compile-tested: each makes the length check work but silently degrades `NavTabId<G>` to `string`,
 * killing the far more valuable id-union validation. The cap is a runtime concern — the shell's
 * `projectMobileNav` slices to `maxTabs` and DEV-warns about what it dropped.
 */
export function defineNav<
  const G extends ReadonlyArray<AnyNavGroup>,
  const T extends ReadonlyArray<NavTabId<G>>,
>(config: NavConfig<G, T>): NavConfig<G, T> {
  return config
}

// ── readers ──────────────────────────────────────────────────────────────────────────────────────

function findById(items: ReadonlyArray<AnyNavItem>, id: string): AnyNavItem | undefined {
  for (const item of items) {
    if (item.id === id) return item
    const hit = item.children ? findById(item.children, id) : undefined
    if (hit) return hit
  }
  return undefined
}

/**
 * The link options for one destination, by id. Spreadable into `<Link>`, `router.navigate()`
 * and `redirect()`. This is what collapses a consumer's Spotlight commands and index redirect.
 *
 * `id` is the definition's literal id union (`NavItemId`) at any nesting depth, so a nested child
 * or grandchild is addressable exactly like a top-level item — the type side and `findById`'s
 * runtime walk agree.
 */
export function navTarget<
  const C extends { groups: ReadonlyArray<AnyNavGroup> },
  K extends NavItemId<C['groups']>,
>(config: C, id: K): NavIndex<C['groups']>[K] {
  for (const g of config.groups) {
    const hit = findById(g.items, id)
    if (hit) return hit.link as NavIndex<C['groups']>[K]
  }
  throw new Error(`navTarget: no nav item with id "${id}"`)
}

/** A flattened destination, tagged with the group it was declared in. */
export type FlatNavItem = AnyNavItem & { groupId: string; groupLabel: string }

/** Depth-first flatten, parent then children — the leaf every other surface reads. */
export function flattenNav(config: { groups: ReadonlyArray<AnyNavGroup> }): FlatNavItem[] {
  const out: FlatNavItem[] = []
  const walk = (items: ReadonlyArray<AnyNavItem>, groupId: string, groupLabel: string): void => {
    for (const item of items) {
      out.push({ ...item, groupId, groupLabel })
      if (item.children) walk(item.children, groupId, groupLabel)
    }
  }
  for (const g of config.groups) walk(g.items, g.id, g.label)
  return out
}
