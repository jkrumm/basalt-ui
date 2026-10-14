# W10 evidence — route transitions

Lane: `scripts/evidence/transitions.ts` (`make evidence LABEL=w10-transitions LANES=transitions`). Chrome
155.0.8059.79, playground production build, 1280x800, `prefers-reduced-motion: no-preference`.
`document.startViewTransition` is wrapped before load, so "did it start" is a call count and the `types`
it received, not an inference. Chrome only: Safari and Firefox were not run.

## Route navigations

| Case                                                                                                                        | Result                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 12 sidebar-link navigations, `startViewTransition` per click                                                                | 12/12 (W7: 0/12)                                                                                          |
| `types` received                                                                                                            | `basalt-forward` x10, `basalt-back` x1 (`/settings` to `/dashboard`); the twelfth is forward again        |
| 1 search-only navigation (`/cbbi` view tab)                                                                                 | 0 calls                                                                                                   |
| Runtime errors, unhandled rejections, console errors                                                                        | 0, 0, 0                                                                                                   |
| `CSS.supports('selector(:active-view-transition-type(a, b))')` (the comma list the stylesheet uses), and `(a)`              | true, true                                                                                                |
| Timed animations at `ready`, one navigation: `::view-transition-old(basalt-main)` / `-new(basalt-main)` / `old`+`new(root)` | 1 / 1 / 0 (content region animates, root stays static)                                                    |
| 8 clicks 40 ms apart, `ready` watched by the probe                                                                          | 7 transitions started, 1 skipped (`ready` rejected)                                                       |
| Same 8 clicks, `ready` left alone, guard on                                                                                 | 0 unhandled rejections, 0 console errors                                                                  |
| Same 8 clicks, `ready` left alone, **guard removed** (control)                                                              | `unhandledrejection: AbortError: Transition was skipped. New ViewTransition started`, 3 and 1 in two runs |

The control is a one-off with `guardViewTransitionRejections()` disabled in `create-router.tsx`, not committed.
`window` `unhandledrejection` is what `BasaltProvider` forwards to the telemetry sink as `window.error`
(`provider/index.tsx` `useWindowErrors`), so the guard is what keeps a superseded transition out of it.

The playground nav gives forward/back only; `sibling` (same nav item, or a path outside the nav) and the
first-load / search-only `false` are covered by `route-transition.test.ts`, not by this lane.

## Aside fold, unchanged

| Case                             | `startViewTransition` calls (collapse, then expand) | Timed animations at `ready` | Runtime errors |
| -------------------------------- | --------------------------------------------------- | --------------------------- | -------------- |
| default, light                   | 1, 1                                                | 6                           | 0              |
| default, dark                    | 1, 1                                                | 6                           | 0              |
| `prefers-reduced-motion: reduce` | 1, 1                                                | 0                           | 0              |
| `startViewTransition` deleted    | 0, 0                                                | 0                           | 0              |

Identical to W7. The route name `basalt-main` exists only while a `basalt-*` route type is active, so the
fold's transition has no second named group.

## Browser floor

| Feature                                                | Chrome | Safari | Firefox |
| ------------------------------------------------------ | ------ | ------ | ------- |
| Base transition (`document.startViewTransition(fn)`)   | 111    | 18.0   | 144     |
| `types` / `:active-view-transition-type()` (direction) | 125    | 18.2   | 147     |

Route transitions are types-gated. `createBasaltRouter` sets `defaultViewTransition` only where
`CSS.supports('selector(:active-view-transition-type(a))')` holds (the router's own test, router.js:495):
Chrome 125 / Safari 18.2 / Firefox 147. Without that support the router never calls the `types` callback,
so an ungated option would give first load and every search-only change (filters) a full-page UA
crossfade, shell included. Older browsers, and the server, navigate without animation. The base row is
what React's own `<ViewTransition>` (the aside fold) needs.

Not seen: only Chrome 155 was observed. Safari and Firefox rows come from the audit, not from this run.
Not looked at: the animation frames themselves (no route screenshots were taken).
