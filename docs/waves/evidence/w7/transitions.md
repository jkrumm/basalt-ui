# W7 evidence — transitions

Lane: `scripts/evidence/transitions.ts` (`make evidence LABEL=<label> LANES=transitions`). Chrome 155.0.8059.79,
playground production build, desktop 1280x800, one collapse and one expand of the `/cbbi` aside per
variant. `document.startViewTransition` is wrapped before load, so "did it animate" is a call count and a
timed-animation count, not an inference.

## Why there is no route transition

A route `<ViewTransition>` keyed by the leaf route id was built first and never fired: 0
`startViewTransition` calls in 12 navigations (Chrome 155), in every variant. V2-SPEC § 5's premise
("every router navigation already runs in `React.startTransition`, so `<ViewTransition>` fires on it") holds
for the call and fails for the commit: `Transitioner.js:20` does call `React.startTransition`, but the
router publishes state through `@tanstack/react-store` 0.11.2 `useSelector`, which is
`useSyncExternalStore`. React commits a `useSyncExternalStore` update synchronously even when the store was
set inside a transition, so the main-slot subtree flips on a sync lane and no `<ViewTransition>` activates.

Control: keying the same `<ViewTransition>` with `useDeferredValue(leafRouteId)` made all 12 navigations
start a transition, but it animates nothing useful: the `Outlet` content has already swapped on the sync
lane when the deferred key changes, so the old snapshot is already the new page. Search-only navigations
also started 0 transitions, as intended. Owner decision (2026-10-14): drop the route transition, revisit if
TanStack Router publishes match state through a transition-capable read. The route code, its CSS and its
tests are deleted.

## Aside fold

| Case                             | `startViewTransition` calls (collapse, then expand) | Timed animations at `ready` | Runtime errors |
| -------------------------------- | --------------------------------------------------- | --------------------------- | -------------- |
| default, light                   | 1, 1                                                | 6                           | 0              |
| default, dark                    | 1, 1                                                | 6                           | 0              |
| `prefers-reduced-motion: reduce` | 1, 1                                                | 0                           | 0              |
| `startViewTransition` deleted    | 0, 0                                                | 0                           | 0              |

One console error (a 404 on a static asset) appears in the default-light run; runtime errors are counted
from inside the page, including a rejected `ready` promise. The lane exits non-zero if any timed
animation survives under `reduce`, or if the default run shows none (the check would be vacuous).

`useDeferredValue(folded)` is what makes it fire: the persisted fold is a `useSyncExternalStore` read
too, so `startTransition` around its setter alone would not activate it (the same defect as the route).
The toggle's `aria-*` and the width reserved for the shell follow the stored fold; only the painted
rail/body follow the deferred one. The fold body stays mounted under `<Activity>`; `page-aside.test.tsx`
asserts an input keeps its value, `useState` survives, and body effects clean up on fold and re-run on
expand. Only the persisted form (`persistKey`) was measured; the unpersisted `useState` form is covered by
unit tests, not by this lane. The `PageAside` complexity split the review raised is deferred.

Screenshots with every view-transition animation paused at 50%:
`transitions/aside-mid--default-light.png`, `transitions/aside-mid--default-dark.png`. Under reduced motion
there is no animation to pause, so the first frame is already the folded rail:
`transitions/aside-mid--reduced-light.png`. Settled: `transitions/aside-folded--default-light.png`.

## Reduced motion

`styles.css` removes every timed view-transition animation (6 → 0). Two zero-duration UA bookkeeping
animations remain on `::view-transition` and `::view-transition-group(root)`; they cannot be seen. Mantine's
transitions follow through `respectReducedMotion: true`; `ThreadFeed` mounts `<MotionConfig
reducedMotion="user">` for `motion`. `ThemeToggle` is a CSS transition with a `reduce` override.

## § 5 Open item: `document.startViewTransition` missing

Observed in Chrome 155 only, with `Document.prototype.startViewTransition` deleted before any page script:
`typeof document.startViewTransition` is `undefined`, the aside collapse commits (the folded rail appears)
and expands again, with 0 page errors and 0 console errors. React falls back to a plain commit. Safari and
Firefox were not available here and are not claimed.
