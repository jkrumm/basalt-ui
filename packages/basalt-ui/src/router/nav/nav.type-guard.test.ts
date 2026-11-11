// The compile-time regression guard for `defineNav`, one fixture per row of the nav type contract:
// each is a positive assignment that must compile or a `@ts-expect-error` that must fire.
//
// STRATEGY. Without a registered router `RegisteredRouter` degrades to `AnyRouter`, every `to`
// widens to `string` and `defineNav` validates nothing while reporting zero errors. The package
// program has no `Register`, and a `Register` augmentation is program-global, so this file (and its
// `.tsx` companion) is EXCLUDED from `tsconfig.json` and checked by `tsconfig.nav-guard.json`
// (`bun run typecheck` runs both). Every `@ts-expect-error` is also a liveness check on that
// registration: if it breaks, the directives go unused and tsc fails with TS2578.
//
// Each directive suppresses exactly ONE following line, so every bad literal is on its own line.
//
// Counterparts of apps/playground/src/nav.type-guard.tsx (2.x row -> here):
//   1 literal precision -> 1      2/4c bad path (item, child) -> 2, 4c   3 missing label -> 3
//   4/4b/6 foreign key (item, child, group) -> 4, 4b, 6 (+ grandchild 4d, pinned 4e, section 6)
//   5 flat `to` -> 5              8 search thunk -> 8     9/10 tabs -> 9, 10
//   11 navTarget index -> 11 (NavIndex/NavItemId precision, grandchild + pinned addressable)
//   12/13 navTarget unknown id / redirect, 14 Link spread -> navTarget lands with the nav-target
//   Issue; the `<Link {...link}>` spread is covered in nav.type-guard-link.test.tsx.
// New rows: 15 unsatisfiable Register, 16 unknown badge key, 17 two badges on a row.
//
// src/register.type-guard.test.ts rows concern AsyncState/Slot, not nav: nothing to mirror.
import { describe, expect, test } from 'bun:test'
import {
  createRootRoute,
  createRoute,
  createRouter,
  linkOptions,
  redirect,
} from '@tanstack/react-router'
import { defineNav } from './define-nav'
import type {
  NavBadge,
  NavBadges,
  NavIndex,
  NavItemId,
  NavSectionId,
  NavTabId,
  RegisteredOr,
} from './types'

const rootRoute = createRootRoute()
const route = <const P extends string>(path: P) =>
  createRoute({ getParentRoute: () => rootRoute, path })
const gallery = createRoute({
  getParentRoute: () => rootRoute,
  path: '/gallery',
  validateSearch: (s: Record<string, unknown>): { 'shot-state'?: 'empty' | 'full' } =>
    s['shot-state'] === 'empty' || s['shot-state'] === 'full'
      ? { 'shot-state': s['shot-state'] }
      : {},
})
const routeTree = rootRoute.addChildren([
  route('/'),
  gallery,
  route('/cards'),
  route('/table'),
  route('/shell'),
  route('/finance/$month'),
])
export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// ── the definition under test ────────────────────────────────────────────────────────────────────

export const NAV = defineNav({
  sections: [
    {
      id: 'main',
      label: 'Main',
      items: [
        { id: 'home', label: 'Home', mobile: 'tab', link: linkOptions({ to: '/' }) },
        {
          id: 'gal',
          label: 'Gallery',
          short: 'Gal',
          mobile: 'tab',
          link: linkOptions({ to: '/gallery' }),
          children: [
            {
              id: 'cards',
              label: 'Cards',
              link: linkOptions({ to: '/cards' }),
              // A GRANDCHILD: Exact-checked like any item (4d) and present in the id union (11).
              children: [
                { id: 'table-detail', label: 'Detail', link: linkOptions({ to: '/table' }) },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'lab',
      label: 'Lab',
      collapsible: true,
      mobile: { tab: true },
      items: [{ id: 'shell', label: 'Shell', link: linkOptions({ to: '/shell' }) }],
    },
  ],
  pinned: [
    { id: 'settings', label: 'Settings', mobile: 'more', link: linkOptions({ to: '/shell' }) },
  ],
  mobile: { tabs: ['gal', 'lab', 'settings'], maxTabs: 4 },
})

// ── 1. per-index literal precision, through two nesting levels and pinned ────────────────────────
// A widened `string` would mean the contract infers through the CONSTRAINT rather than the argument,
// which is the failure mode every row below is downstream of.

export const galTo: '/gallery' = NAV.sections[0].items[1].link.to
export const cardsTo: '/cards' = NAV.sections[0].items[1].children[0].link.to
export const detailTo: '/table' = NAV.sections[0].items[1].children[0].children[0].link.to
export const sectionId: 'lab' = NAV.sections[1].id
export const pinnedTo: '/shell' = NAV.pinned[0].link.to

// ── 2. a route path that does not exist ──────────────────────────────────────────────────────────

export const badPath = defineNav({
  sections: [
    {
      id: 'g',
      label: 'G',
      items: [
        // @ts-expect-error '/nope' is not a registered route path
        { id: 'x', label: 'X', link: linkOptions({ to: '/nope' }) },
      ],
    },
  ],
})

// ── 3. a missing required meta field ─────────────────────────────────────────────────────────────

export const missingLabel = defineNav({
  sections: [
    {
      id: 'g',
      label: 'G',
      items: [
        // @ts-expect-error `label` is required on every nav item
        { id: 'x', link: linkOptions({ to: '/' }) },
      ],
    },
  ],
})

// ── 4. an unknown item key (the hole a flat `{ id, label, to }` shape would have) ─────────────────
// `Constrain<T, C>` is an ASSIGNABILITY check and assignability does no excess-property checking, so
// a flat carrier shape would accept `colour` silently. `Exact<T, Shape>` types foreign keys `never`.

export const unknownItemKey = defineNav({
  sections: [
    {
      id: 'g',
      label: 'G',
      items: [
        // @ts-expect-error 'colour' is not a nav item key
        { id: 'x', label: 'X', colour: 'red', link: linkOptions({ to: '/' }) },
      ],
    },
  ],
})

// ── 4b. an unknown key on a CHILD item ───────────────────────────────────────────────────────────
// `ExactNavItem` recurses through `children`, so the check holds at every depth.

export const unknownChildKey = defineNav({
  sections: [
    {
      id: 'g',
      label: 'G',
      items: [
        {
          id: 'x',
          label: 'X',
          link: linkOptions({ to: '/gallery' }),
          children: [
            {
              id: 'y',
              label: 'Y',
              // @ts-expect-error 'colour' is not a nav item key, one level down
              colour: 'red',
              link: linkOptions({ to: '/cards' }),
            },
          ],
        },
      ],
    },
  ],
})

// ── 4c. a bad route path on a CHILD ──────────────────────────────────────────────────────────────
// Recursing `Exact<>` must not cost the child's `link` its own validation.

export const badChildPath = defineNav({
  sections: [
    {
      id: 'g',
      label: 'G',
      items: [
        {
          id: 'x',
          label: 'X',
          link: linkOptions({ to: '/gallery' }),
          children: [
            // @ts-expect-error '/nope' is not a registered route path, at any depth
            { id: 'y', label: 'Y', link: linkOptions({ to: '/nope' }) },
          ],
        },
      ],
    },
  ],
})

// ── 4d. an unknown key on a GRANDCHILD ───────────────────────────────────────────────────────────

export const unknownGrandchildKey = defineNav({
  sections: [
    {
      id: 'g',
      label: 'G',
      items: [
        {
          id: 'x',
          label: 'X',
          link: linkOptions({ to: '/gallery' }),
          children: [
            {
              id: 'y',
              label: 'Y',
              link: linkOptions({ to: '/cards' }),
              children: [
                {
                  id: 'z',
                  label: 'Z',
                  // @ts-expect-error 'colour' is not a nav item key, two levels down
                  colour: 'red',
                  link: linkOptions({ to: '/table' }),
                },
              ],
            },
          ],
        },
      ],
    },
  ],
})

// ── 4e. an unknown key on a PINNED item ──────────────────────────────────────────────────────────

export const unknownPinnedKey = defineNav({
  sections: [
    { id: 'g', label: 'G', items: [{ id: 'x', label: 'X', link: linkOptions({ to: '/' }) }] },
  ],
  pinned: [
    {
      id: 'p',
      label: 'P',
      // @ts-expect-error 'colour' is not a nav item key on a pinned item
      colour: 'red',
      link: linkOptions({ to: '/' }),
    },
  ],
})

// ── 5. the flat-shape migration mistake ──────────────────────────────────────────────────────────

export const topLevelTo = defineNav({
  sections: [
    {
      id: 'g',
      label: 'G',
      items: [
        // @ts-expect-error `to` rides inside `link`, never at the top level of an item
        { id: 'x', label: 'X', to: '/' },
      ],
    },
  ],
})

// ── 6. an unknown SECTION key ────────────────────────────────────────────────────────────────────

export const unknownSectionKey = defineNav({
  sections: [
    {
      id: 'g',
      label: 'G',
      // @ts-expect-error 'colour' is not a section key
      colour: 'red',
      items: [{ id: 'x', label: 'X', link: linkOptions({ to: '/' }) }],
    },
  ],
})

// ── 8. the search thunk ──────────────────────────────────────────────────────────────────────────
// A function form is accepted where a search object is, and re-evaluates at click time.

export const searchThunk = defineNav({
  sections: [
    {
      id: 'g',
      label: 'G',
      items: [
        {
          id: 'gallery',
          label: 'Gallery',
          link: linkOptions({ to: '/gallery', search: () => ({ 'shot-state': 'empty' }) }),
        },
      ],
    },
  ],
})

// The trap that survives: a standalone thunk has no contextual type, its return widens to
// `{ 'shot-state': string }`, and it is rejected. Inline it in the item, or write `as const`.
const widenedSearch = () => ({ 'shot-state': 'empty' })
// @ts-expect-error a standalone thunk's `shot-state` widens to `string` and misses the union
export const hoistedThunk = linkOptions({ to: '/gallery', search: widenedSearch })

// ── 8b. params ride in `link` and are checked by the router ──────────────────────────────────────

export const withParams = defineNav({
  sections: [
    {
      id: 'g',
      label: 'G',
      items: [
        {
          id: 'month',
          label: 'Month',
          link: linkOptions({ to: '/finance/$month', params: { month: 'latest' } }),
        },
      ],
    },
  ],
})

// ── 9. a bar tab naming an id that does not exist ────────────────────────────────────────────────
// `tabs` validates against the item-id union UNIONED with the section-id union.

export const badTabId = defineNav({
  sections: [
    { id: 'g', label: 'G', items: [{ id: 'x', label: 'X', link: linkOptions({ to: '/' }) }] },
  ],
  // @ts-expect-error 'zzz' is neither an item id nor a section id
  mobile: { tabs: ['zzz'] },
})

// ── 10. `mobile.tabs` omitted ────────────────────────────────────────────────────────────────────

export const noTabs = defineNav({
  sections: [
    { id: 'g', label: 'G', items: [{ id: 'x', label: 'X', link: linkOptions({ to: '/' }) }] },
  ],
  mobile: { maxTabs: 3 },
})

// ── 11. the id unions and the index keep per-id precision ────────────────────────────────────────
// `NavItemId` covers every item at ANY depth plus pinned; a widened `string` here would make the
// annotations below fail. `NavIndex` must return ONE destination's link, not the union of all.

export const allIds: NavItemId<typeof NAV> extends infer U
  ? [U] extends [string]
    ? string extends U
      ? never
      : 'ok'
    : never
  : never = 'ok'
export const grandchildId: NavItemId<typeof NAV> = 'table-detail'
export const pinnedId: NavItemId<typeof NAV> = 'settings'
export const sectionIdOf: NavSectionId<typeof NAV> = 'lab'
export const tabId: NavTabId<typeof NAV> = 'lab'
export const galIndex: { readonly to: '/gallery' } = null as unknown as NavIndex<typeof NAV>['gal']
export const detailIndex: { readonly to: '/table' } = null as unknown as NavIndex<
  typeof NAV
>['table-detail']
// @ts-expect-error 'zzz' is not a nav item id
export type MissingIndex = NavIndex<typeof NAV>['zzz']
// @ts-expect-error 'zzz' is not a nav item id
export const missingId: NavItemId<typeof NAV> = 'zzz'

// ── 12. the link spreads into `redirect()` with no cast ──────────────────────────────────────────

export const galRedirect = () => redirect(NAV.sections[0].items[1].link)

// ── 15. the Register guard: an un-registered router makes the parameter unsatisfiable ────────────
// `RegisteredOr<T, Tree>` is parametric over the route tree so the un-registered state (an `any`
// tree) is testable inside a program that DOES register a router.

export const registeredPasses: RegisteredOr<{ ok: true }> = { ok: true }
// oxlint-disable-next-line typescript/no-explicit-any
export const unregisteredIsALiteral: RegisteredOr<{ ok: true }, any> =
  'basalt: declare Register { router }'
// @ts-expect-error un-registered: the only accepted value is the fix-it string
// oxlint-disable-next-line typescript/no-explicit-any
export const unregisteredRejectsConfig: RegisteredOr<{ ok: true }, any> = { ok: true }

// ── 16. a badge key must be an item id ───────────────────────────────────────────────────────────

export const goodBadges: NavBadges<typeof NAV> = {
  gal: { count: 3, attention: true },
  settings: { dot: true },
  'table-detail': { count: 1 },
}
export const unknownBadgeKey: NavBadges<typeof NAV> = {
  // @ts-expect-error 'zzz' is not a nav item id
  zzz: { count: 1 },
}

// ── 17. two badges on a row ──────────────────────────────────────────────────────────────────────

export const countBadge: NavBadge = { count: 2, attention: true }
export const dotBadge: NavBadge = { dot: true }
// @ts-expect-error a row carries ONE badge: a count or a dot, never both
export const twoBadges: NavBadge = { count: 2, dot: true }
// @ts-expect-error `attention` belongs to the count badge only
export const dotWithAttention: NavBadge = { dot: true, attention: true }

describe('nav type guard (runtime half)', () => {
  test('the guarded definition is a plain, pure object', () => {
    expect(NAV.sections.map((s) => s.id)).toEqual(['main', 'lab'])
    expect(NAV.pinned[0].id).toBe('settings')
    expect(Object.keys(NAV).toSorted()).toEqual(['mobile', 'pinned', 'sections'])
  })
})
