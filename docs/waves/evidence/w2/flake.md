# W2 — merge-train layout flake

Test: `shell chrome … with the inset unset the zone is exactly as it was`
(`packages/basalt-ui/tests/layout/shell-chrome.layout.test.ts`).

## Root cause

`collapseSidebar` waited only for the **navbar** to reach the 48px rail width. The header zone
(`app-brand.module.css`: `transition-property: flex-basis, width`) eases on its own transition, and
`reducedMotion: 'reduce'` in the harness does not stop it. When the host is slow to produce frames the
navbar's width check can pass while the zone is still mid-ease, so the test measured the zone at
171.09px (toggle centre == zone centre, so the zone itself was the moving box). Padding was already 0.

It reproduced here without `rd`: 1 failure in 10 runs under 4 `yes >/dev/null` load processes. The
merge train failed 5/5 because it runs the suite on a loaded host; whether anything specific to
`host_run` (stdin/TTY, cwd) contributes was not isolated — the fix removes the race either way.

## Fix

`collapseSidebar` now also waits until `document.getAnimations()` has no running animation. The zone's
own width is deliberately not pinned to 48px: the lead-inset tests legitimately widen the rail zone
(a first attempt that pinned it timed out those tests).

## Result

`bun run test:layout` × 10, 4 background `yes >/dev/null` processes, Chrome via the harness defaults
(1440px desktop, DPR 2):

|        | passes                                          |
| ------ | ----------------------------------------------- |
| before | 9/10 (failure: `rail zone is 171.09375px wide`) |
| after  | 10/10                                           |

N = 10 per row; the before-failure is intermittent, so a single clean run proves nothing.
