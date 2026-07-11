# Argo migration — consumer learnings (2026-07-11 overnight run)

Argo (`~/SourceRoot/argo`) was migrated end-to-end onto basalt-ui 1.0 (file:-linked, unpublished):
provider/theme/series foundation, all chart features (~60 files), the app shell, and the
query/forms/notifications/commands batteries, plus `basalt init` + `basalt check-theme` replacing
argo's local guard. This is the distilled feedback from that run — the first real external
consumer exercise. Items are ordered by how much they'd help the next consumer, not severity.

## Packaging / CLI

1. **`bunx basalt` resolves from the npm registry, not the workspace.** With basalt-ui only a
   leaf-workspace `file:` dep, `bunx basalt` either fails or silently fetches the stale published
   `basalt-ui@0.4.2` (Tailwind era, different/no bin). Workaround found: add `basalt-ui` as a root
   devDependency so the bin hoists into root `node_modules/.bin`. Docs should state this; better,
   `basalt doctor` could detect a version mismatch between the running CLI and the installed
   package.
2. **CLI hard-requires `dist/`** (`bin/basalt.mjs` → `../dist/cli/index.js`) while the runtime can
   ride `BASALT_LOCAL` source aliasing. For sibling-checkout consumers, document "build first"
   next to the BASALT_LOCAL instructions.
3. **`init` writes `oxfmt.json`, but oxfmt auto-discovers `.oxfmtrc.json`.** A consumer with an
   existing `.oxfmtrc.json` gets an inert duplicate. Align the scaffold filename with discovery.
4. **`check-theme`'s built-in defaults still point at argo's pre-migration layout**
   (`apps/dashboard/src` + `packages/charts/src`). Any other repo silently scans 0 files
   (warn-only). Require `basalt.roots` or fail loudly when the default roots match nothing.
5. **Strictness jump is unannounced.** The 1.0 guard adds six rule kinds beyond the legacy local
   guard; on a previously guard-clean repo it fired 162 findings day one (28 raw-html-layout,
   52 inline-spacing, 26 chart-missing-aria-label, 23 raw-surface, 20 inline-display,
   13 unframed-chart). All real, but `init` should print a "first-run report + per-rule opt-down"
   hint so consumers tune config instead of mass-`theme-allow`ing.

## Tokens / charts API

6. **`p()` and `ACCENT`/`INK`/`FILL`/`SHADOW` aren't re-exported from `basalt-ui/charts`** while
   `BP`/`STATUS`/`defineSeries` are — series authoring flips between two subpaths. Re-export or
   document the split.
7. **`groupTokens` double bookkeeping**: `groupTokens('activity', MAP)` must stay in lockstep with
   the `paletteOptions.groups` key `'activity-'` (trailing dash, easy to mismatch). A
   `defineSeriesGroups({ activity: MAP })` that returns both the tokens and the groups object
   would remove the failure mode. Also: README, `DESIGN.md.tpl`, and the playground disagree on
   `seriesTokens` vs `groupTokens` conventions.
8. **`DonutDatum.key: SeriesKey` couples to THE single registered series slot.** Multi-domain
   consumers (argo: metrics + activity + usage + billing + outcome maps) need `as DonutDatum[]`
   casts for every non-primary donut. Loosen to `string` (keep `SeriesKey` as an overload) or
   document the cast as the blessed pattern.
9. **No `VX.tooltipMuted` JS token** (CSS var is internal). Two argo features had used it via the
   old `useVxTheme()`; both substituted `VX.muted`. Either export it or note the substitution.
10. **`Bars` derived legend can't express `refLines` landmarks** (MEV/MAV/MRV case) → consumers
    hand-roll a supplemental `ChartLegend`. Consider an opt-in `refLinesInLegend`.
11. **`DualPanel.fillBetween` takes one fill** — can't express diverging above/below fills
    (argo's acute-vs-chronic divergence chart stayed bespoke). Consider `{ fillAbove, fillBelow }`.
12. **No scatter/dots-only `SeriesMark`** — a dots-only series (VO2max) can't ride `MultiLine`;
    stays bespoke.
13. **Silent renames need a migration note**: `HoverCtx.date` → `.key`, `useHoverSync({ getX })` →
    `{ getKey }`. Both typecheck-visible only in strict setups.
14. **`legend.maxRows` renders a `+N more` chip** where consumers previously `.slice(0, N)`d —
    better behavior, but a visible diff worth one docs line.
15. **`MultiLine` auto-domain lower bound is wrong for non-zero baselines**:
    `lower = Math.min(safeMin, yAutoMinCeil) * yAutoPad` multiplies the floor UP by 1.1 — with
    `yAutoMinCeil={Infinity}` ("don't force zero") the floor lands 10% ABOVE the data minimum and
    clips the series (hit on argo's body-weight chart; caught in review, worked around with a
    fixed computed domain). The lower bound should divide by the pad (or subtract), and the
    `yAutoMinCeil=Infinity` idiom deserves an explicit "no zero baseline" flag instead.
16. Positive: the kinds' self-measuring (`ChartFrame`/`useChartSize`) deleted every
    `useElementSize` + `width > 0` guard in the app, and derived legends deleted four hand-rolled
    legend blocks with identical output. The series-descriptor model held up across ~35 charts;
    only 6 stayed bespoke, each for a real capability gap (items 10–12) — and bespoke composition
    via `ChartFrame` + re-exported visx felt sanctioned, not hacky.

## Shell

17. **Fixed dimensions, no knobs**: header 96/48, navbar 216/48, footer 52, padding `sm` are
    hardcoded; argo came from 108/56, 240/72, 56, `md`. Fine for adopting the doctrine, but a
    density/size prop tier would ease visual review of big migrations.
18. **`renderNavLink` bypasses the internal `.link` CSS-module styling** — router-integrated nav
    rows lose the inactive/hover treatment that fallback rows get. Expose the class or move the
    treatment to theme level.
19. **No external collapse control** — consumer hotkeys (argo had `Cmd+B`) can't drive collapse;
    `storageKey` is the only seam.
20. **Mobile "More" full-drawer doesn't close on navigation** — `mobileOpened`/`closeMobile` are
    internal with no callback surface for `renderNavLink` clicks. Narrow but real regression vs
    argo's shell.
21. **`settingsMenuItems` is flat** — no submenu support; argo's Theme + DevTools submenus became
    six flat rows.

## Batteries

22. **`emit()` can't override a kind's `intent`** and `NotifyOptions` has no raw-color escape —
    argo's achievement toasts (6 colors keyed by achievement type) could not ride the typed
    registry and stayed on raw `notifications.show` (thus invisible to the bell/history). Either
    an `intent` override or a documented "outside the registry" stance.
23. **`NotificationSpec` carries no `title`/`icon`** — titles repeat at every call site via opts.
    Intentional? Document it as such.
24. **Commands registry TS circular-inference footgun**: `overlays.open(...)` inside a `run` in
    the module that also augments `BasaltRegister.commands` → "COMMANDS implicitly has type
    'any'". Fix: explicit `: void` return annotation on that `run`. Belongs in
    `basalt-commands.md`.
25. **`useBasaltForm` omits `validate`** — schema-only validation; cross-field/async rules force a
    raw `useForm` fallback. One docs line.
26. Positive: `createBasaltQueryClient` passed argo's bespoke QueryCache/MutationCache
    (401-eviction) straight through — zero gap. `useBasaltForm` + zod v4 was a drop-in for the one
    real `useForm` consumer.
27. **Two `unwrap`s**: basalt `./query`'s `unwrap(promise)` vs argo's Eden `unwrap(resolved)` —
    same intent, incompatible shapes. Pick a story (accept both? document the difference?) before
    another Eden consumer trips on it.

## Docs / templates

28. **The managed CLAUDE.md block contradicts DESIGN-SPEC**: it still says "system-sans by
    size+weight" and "hairline elevation (no drop shadows)" — both inverted by the 2026-07 design
    overhaul (three-font system, shadow-card). The init template lagged the overhaul; sync it and
    cut a `basalt sync` release so consumers pick it up.
29. **README "wire the runtime" is simplified vs reality** (playground uses 3 layer.css imports,
    BasaltOverlays, palette groups, theme-lab boot re-apply). Promote the playground wiring into
    the README.
30. **DESIGN-SPEC on-accent table lists `#162456` for dark** while `palette.ts` ships white both
    schemes (documented rationale in code). Spec table is stale.

## Argo-side follow-ups (recorded here so they're not lost)

- Re-enable the six disabled guard rules one at a time and burn down the 162 findings —
  `chartMissingAriaLabel` (26) first.
- Hermes-chat → `./agent` battery is the deliberate cut: needs the ai v5→v7 transport migration,
  voice layer stays consumer-side regardless.
- Consider `ResponsiveChart`/`useChartSize` for the remaining `useElementSize` imports in bespoke
  charts.
- Data battery (`BasaltDataTable`) not adopted — hand-rolled tables still fine; revisit if sorting
  needs grow.
