// apps/playground/src/nav.type-guard.tsx
//
// The compile-time regression guard for `defineNav` / `navGroup` / `navTarget` — one fixture per
// row of the nav config's type contract, each either a positive assignment that must compile or a
// `@ts-expect-error` that must fire.
//
// WHY IT LIVES IN THE PLAYGROUND AND NOT IN THE PACKAGE. Inside `packages/basalt-ui` there is no
// registered router, so `RegisteredRouter` degrades to `AnyRouter`, every `to` widens to `string`,
// and `defineNav` validates NOTHING while reporting zero errors — the API looks like it works and
// catches nothing. `apps/playground/src/main.tsx` declares the `Register` interface against a real
// `createRouter({ routeTree })`, so this file is the ONLY place in the repo where the route-path
// rows below can fail. Every `@ts-expect-error` here is also a liveness check on that registration:
// if the augment ever breaks, these directives go unused and tsc fails with TS2578 instead of
// silently passing.
//
// Each directive suppresses exactly ONE following line, so every bad literal is on its own line.
import { Link, linkOptions, redirect } from '@tanstack/react-router'
import { defineNav, navGroup, navTarget } from 'basalt-ui/router-tanstack'

// `/dashboard`'s store validates FOUR fields (`demo/dashboard-range-store.ts`), and
// `validateSearch` returns every one of them resolved — so TanStack type-requires all four on any
// link into it. Hoisted `as const` so the literals do not widen (see the row-8 trap below) and the
// four keys are stated once rather than eight times.
const DASH_SEARCH = {
  range: '7d',
  compare: 'none',
  currency: 'USD',
  channels: [],
} as const

// ── the definition under test ────────────────────────────────────────────────────────────────────

export const NAV = defineNav({
  groups: [
    navGroup({ id: 'main', label: 'Main' }, [
      { id: 'home', label: 'Home', mobile: 'tab', link: linkOptions({ to: '/' }) },
      {
        id: 'dash',
        label: 'Dashboard',
        short: 'Dash',
        mobile: 'tab',
        link: linkOptions({ to: '/dashboard', search: DASH_SEARCH }),
        children: [
          {
            id: 'sessions',
            label: 'Sessions',
            link: linkOptions({ to: '/dashboard/sessions', search: DASH_SEARCH }),
            // A GRANDCHILD — two levels below the group. Both halves of the contract are checked
            // against it: it is `Exact`-checked like any other item (row 4b), and it is present in
            // the id union `navTarget` takes (row 11).
            children: [
              { id: 'session-detail', label: 'Detail', link: linkOptions({ to: '/charts' }) },
            ],
          },
        ],
      },
    ]),
    navGroup({ id: 'lab', label: 'Lab', mobile: { tab: true } }, [
      { id: 'charts', label: 'Charts', link: linkOptions({ to: '/charts' }) },
    ]),
  ],
  mobile: { tabs: ['dash', 'lab'], maxTabs: 4 },
})

// ── 1. per-index literal precision, through two nesting levels ───────────────────────────────────
// A widened `string` here would mean the whole contract is inferring through the CONSTRAINT rather
// than the argument, which is the failure mode every row below is downstream of.

export const dashTo: '/dashboard' = NAV.groups[0].items[1].link.to
export const sessionsTo: '/dashboard/sessions' = NAV.groups[0].items[1].children[0].link.to
export const groupId: 'lab' = NAV.groups[1].id

// ── 2. a route path that does not exist ──────────────────────────────────────────────────────────

export const badPath = defineNav({
  groups: [
    navGroup({ id: 'g', label: 'G' }, [
      // @ts-expect-error '/nope' is not a registered route path — errors with the route-path union
      { id: 'x', label: 'X', link: linkOptions({ to: '/nope' }) },
    ]),
  ],
})

// ── 3. a missing required meta field ─────────────────────────────────────────────────────────────

export const missingLabel = defineNav({
  groups: [
    navGroup({ id: 'g', label: 'G' }, [
      // @ts-expect-error `label` is required on every nav item
      { id: 'x', link: linkOptions({ to: '/' }) },
    ]),
  ],
})

// ── 4. an unknown item key (the hole a flat `{ id, label, to }` shape would have) ─────────────────
// This is the row that justifies the whole nested `link:` design: `Constrain<T, C>` is an
// ASSIGNABILITY check and assignability does no excess-property checking, so a flat carrier shape
// would accept `colour` silently. `Exact<T, Shape>` types every foreign key as `never` instead.

export const unknownItemKey = defineNav({
  groups: [
    navGroup({ id: 'g', label: 'G' }, [
      // @ts-expect-error 'colour' is not a NavItemMeta key — Exact<> types it `never`
      { id: 'x', label: 'X', colour: 'red', link: linkOptions({ to: '/' }) },
    ]),
  ],
})

// ── 4b. an unknown key on a CHILD item ───────────────────────────────────────────────────────────
// The row that matters most, because this is where the design's own argument was open: `Exact<>`
// used to be applied per TOP-LEVEL tuple element only, while `AnyNavItem['children']` is a plain
// `ReadonlyArray<AnyNavItem>` constraint — and a constraint is an assignability check, which does
// no excess-property checking. So the exact hole row 4 exists to close was wide open exactly one
// level down, in a shape the playground's own nav model actually uses. `ExactNavItem` recurses
// through `children`, so the check now holds at every depth (verified to seven levels).

export const unknownChildKey = defineNav({
  groups: [
    navGroup({ id: 'g', label: 'G' }, [
      {
        id: 'x',
        label: 'X',
        link: linkOptions({ to: '/dashboard', search: DASH_SEARCH }),
        children: [
          // @ts-expect-error 'colour' is not a NavItemMeta key — the recursion types it `never` too
          { id: 'y', label: 'Y', colour: 'red', link: linkOptions({ to: '/charts' }) },
        ],
      },
    ]),
  ],
})

// ── 4c. a bad route path on a CHILD ──────────────────────────────────────────────────────────────
// Row 2 one level down: recursing `Exact<>` must not cost the child's `link` its own validation.

export const badChildPath = defineNav({
  groups: [
    navGroup({ id: 'g', label: 'G' }, [
      {
        id: 'x',
        label: 'X',
        link: linkOptions({ to: '/dashboard', search: DASH_SEARCH }),
        children: [
          // @ts-expect-error '/nope' is not a registered route path, at any depth
          { id: 'y', label: 'Y', link: linkOptions({ to: '/nope' }) },
        ],
      },
    ]),
  ],
})

// ── 5. the flat-shape migration mistake ──────────────────────────────────────────────────────────

export const topLevelTo = defineNav({
  groups: [
    navGroup({ id: 'g', label: 'G' }, [
      // @ts-expect-error `to` rides inside `link`, never at the top level of an item
      { id: 'x', label: 'X', to: '/' },
    ]),
  ],
})

// ── 6. an unknown group meta key ─────────────────────────────────────────────────────────────────

export const unknownGroupKey = defineNav({
  groups: [
    // @ts-expect-error 'colour' is not a NavGroupMeta key
    navGroup({ id: 'g', label: 'G', colour: 'red' }, [
      { id: 'x', label: 'X', link: linkOptions({ to: '/' }) },
    ]),
  ],
})

// ── 7. a route whose search params are required ──────────────────────────────────────────────────
// `/dashboard` runs `validateSearch`, so TanStack marks `search` required on the link options.
// The limit this row used to carry is GONE, and the change is worth stating: a hand-written
// `validateSearch(search: Record<string, unknown>)` type-required the search OBJECT but none of its
// KEYS, so `search: {}` compiled and a nav target forgetting `range` was a runtime concern only.
// `createSearchStore.validateSearch` returns every field RESOLVED, so each one is now type-required
// too — `search: { range: '7d' }` alone is a compile error naming the three fields it dropped.

export const missingSearch = defineNav({
  groups: [
    navGroup({ id: 'g', label: 'G' }, [
      // @ts-expect-error `/dashboard` requires `search` — MakeRequiredSearchParams
      { id: 'x', label: 'X', link: linkOptions({ to: '/dashboard' }) },
    ]),
  ],
})

// ── 8. the search thunk ──────────────────────────────────────────────────────────────────────────
// A function form is accepted where a search object is (`ParamsReducerFn`), and re-evaluates at
// click time rather than at module scope — which is what a "last 7 days" target needs.

export const searchThunk = defineNav({
  groups: [
    navGroup({ id: 'g', label: 'G' }, [
      {
        id: 'threads',
        label: 'Threads',
        link: linkOptions({ to: '/threads', search: () => ({ thread: 'latest' }) }),
      },
    ]),
  ],
})

// The spec's "compiles WITHOUT `as const`" is the interesting half of this row, and it holds even
// for a LITERAL-UNION search param (`range: '1d' | '7d' | '30d'`): `linkOptions`' `const` type
// parameter keeps `'7d'` literal because the nav item's `link` field types `search` as `unknown`
// and so never forces a widening.
export const searchThunkLiteralUnion = defineNav({
  groups: [
    navGroup({ id: 'g', label: 'G' }, [
      {
        id: 'dash',
        label: 'Dashboard',
        link: linkOptions({
          to: '/dashboard',
          search: () => ({ range: '7d', compare: 'none', currency: 'USD', channels: [] }),
        }),
      },
    ]),
  ],
})

// The trap that survives, and the reason the row above is worth pinning rather than assuming: the
// same thunk hoisted into a STANDALONE `linkOptions` call has no such contextual type, its return
// widens to `{ range: string }`, and it is rejected. Inline it in the nav item, or write `as const`.
const widenedSearch = () => ({ range: '7d', compare: 'none', currency: 'USD', channels: [] })
// @ts-expect-error a standalone thunk's `range` widens to `string` and misses the preset union
export const hoistedThunk = linkOptions({ to: '/dashboard', search: widenedSearch })

// ── 9. a bar tab naming an id that does not exist ────────────────────────────────────────────────
// `tabs` validates against the item-id union UNIONED with the group-id union, which is why
// `navGroup`'s `const M` on its meta is load-bearing: widen the group id to `string` and this row
// silently stops firing.

export const badTabId = defineNav({
  groups: [
    navGroup({ id: 'g', label: 'G' }, [{ id: 'x', label: 'X', link: linkOptions({ to: '/' }) }]),
  ],
  // @ts-expect-error 'zzz' is neither an item id nor a group id
  mobile: { tabs: ['zzz'] },
})

// ── 10. `mobile.tabs` omitted ────────────────────────────────────────────────────────────────────
// `T` falls back to its constraint — omitting the escape hatch must not require naming a type.

export const noTabs = defineNav({
  groups: [
    navGroup({ id: 'g', label: 'G' }, [{ id: 'x', label: 'X', link: linkOptions({ to: '/' }) }]),
  ],
  mobile: { maxTabs: 3 },
})

// ── 11. `navTarget` returns the ONE destination's options, not the union of all of them ───────────
// The annotation is the assertion: it would fail if `NavIndex` collapsed to the whole union, which
// is exactly what the `Extract<…, { id: K }>['link']` form (deliberately not used) does.

export const dashTarget: { readonly to: '/dashboard'; readonly search: typeof DASH_SEARCH } =
  navTarget(NAV, 'dash')

// A nested child is addressable by id too — `AllItemsOf` walks `children` to ARBITRARY depth, so
// the id union matches what `findById` / `flattenNav` already resolve at runtime. A one-level walk
// used to make a grandchild a compile error against an id the runtime finds perfectly well; the row
// below is the grandchild case, and it is the pin on that agreement.
export const sessionsTarget: {
  readonly to: '/dashboard/sessions'
  readonly search: typeof DASH_SEARCH
} = navTarget(NAV, 'sessions')

export const sessionDetailTarget: { readonly to: '/charts' } = navTarget(NAV, 'session-detail')

// ── 12. `navTarget` with an id that is not in the definition ─────────────────────────────────────

// @ts-expect-error 'zzz' is not a nav item id — the parameter is the id union, not `string`
export const missingTarget = navTarget(NAV, 'zzz')

// ── 13. the target spreads into `redirect()` with no cast ────────────────────────────────────────
// This is the row that collapses a consumer's index redirect and its command palette onto the same
// definition the sidebar renders from.

export const dashRedirect = () => redirect(navTarget(NAV, 'dash'))

// ── 14. the target spreads into `<Link>` with no cast ────────────────────────────────────────────
// The file is `.tsx` rather than the `.ts` its siblings use for exactly this row: `createElement(
// Link, { ...link })` is NOT a stand-in — it rejects the VALID spread (TS2769, no overload matches)
// while accepting `{ to: '/nope' }`, i.e. it is precisely backwards. Only JSX instantiates
// `LinkComponent`'s generics the way a consumer's call site does.

export const dashLink = () => <Link {...navTarget(NAV, 'dash')}>Dashboard</Link>
export const itemLink = () => <Link {...NAV.groups[0].items[1].link}>Dashboard</Link>

// PROVES: the nav definition's `to`/`search` ride the router's own validator with per-item literal
// precision AT EVERY DEPTH, and every metadata typo — a bad path, a missing label, a foreign key on
// an item, a CHILD or a group, a flat `to`, a bar tab naming nothing — is a compile error rather
// than a silent pass; and the addressable-id union matches what the runtime readers resolve.
