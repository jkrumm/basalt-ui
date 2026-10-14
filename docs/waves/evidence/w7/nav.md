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
