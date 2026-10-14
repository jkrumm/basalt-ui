# W7 — `BasaltShell nav`

`BasaltShell` takes `nav={NAV}` (V2-SPEC § 2, row "nav → sidebar + mobile bar + breadcrumbs"):
active state resolves through the router inside the shell by `useNav`, which is now shell-internal,
and the breadcrumb derives from the resolved sections via `findActiveCrumb`.

## Verdict: `sections` / `mobileNav` leave the public surface

One way to declare a nav (§ 1). `nav` replaces both: `mobileNav`'s tuning already rides
`defineNav({ mobile })`, and the one extra option (`getScrollElement`) is a shell prop. No consumer
outside the playground needs the raw props (consumers.json named only the playground and argo's root
route, both on `nav`). `ShellFrame` keeps them as an internal seam, exported from `shell/` but not the
root barrel, so unit and layout suites can drive the shell without a router.

## Evidence

- `src/shell/nav-prop.router.test.tsx` (real memory router): one `aria-current` winner at a child
  route, breadcrumb `Main / Dashboard / Sessions`, badge count reaches the row, and a
  `@ts-expect-error` on a mistyped badge id.
- Playground `__root.tsx` has no `useNav` call and no spread.
- Budgets: non-chart value symbols 93 → 92 (`useNav` leaves the barrel); ceiling override removed.

## Deferred

`ShellBody` (the former `ShellFrame` body) is a long component; splitting it is pre-existing size,
not this change, and stays out of this PR.

`init` now seeds a leaf `src/lib/nav.tsx` next to `__root.tsx` (`agent/templates/nav.tpl`) so the
scaffold respects the no-cycle rule (`NAV` never imports `__root.tsx`).

Also deferred: splitting `useNav` (one long resolver, unchanged by this PR) and a test of the `init`
`src/lib/nav.tsx` seed.

## `isActive` and the router's own `aria-current`

A TanStack `Link` spreads `aria-current`/`data-status` from its own match as its last props, so under
an `isActive` override a router-matched loser still claimed the page. With an override supplied the
anchor renders through `_asChild` (`OverriddenAnchor` in `use-nav.ts`), which drops the router's two
attributes and re-applies only basalt's verdict.

`data-status`: the default path gets it from `Link`'s own match, the override path from
`OverriddenAnchor`, which re-stamps `data-status="active"` on the basalt winner only — pinned in
`nav-prop.router.test.tsx`. The `init` seed is now tested (`init-sync.test.ts`), so the earlier
"deferred" note for it no longer applies; the `useNav` split stays deferred.
`ShellBaseProps` is exported (type) for consumers that need `brand`/`account` shapes without the
nav generics; the playground is its named consumer.
