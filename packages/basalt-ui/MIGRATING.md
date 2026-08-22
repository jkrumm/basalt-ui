# Migrating basalt-ui

`CHANGELOG.md` ships in this package and lists every release. It cannot tell you what **broke**:
semantic-release writes one line per commit, and "make the mobile bar navigate, driven by one typed
nav definition" does not say `ChartHoverSync` was deleted. This file is that half — removed and
renamed exports per minor, with the replacement.

Reconstructed from `git diff` over the published export surface across `v1.0.0..v1.19.1`, then
cross-checked against the repo's `scripts/export-surface.json` snapshot. **Every replacement below
was re-audited against the built declaration files at 1.20.0 (2026-08-22)** after round 5 caught one
row that was wrong. That pass corrected 4 table rows and 3 prose claims. The 1.20.1 section was
written against source, not against its commit messages. Check the types, not this table, if the two
disagree.

**No majors, by policy.** A rename or a removal ships as a plain `feat:` on the 1.x line, so a minor
bump can require code changes. Skipping several at once is the expensive case — read every section
between your version and the target.

> Reading the CHANGELOG: minors and majors are `#` (h1), patches are `##` (h2). Grepping for
> `## [1.` finds only the patches.

**Minors with no public API delta:** 1.1.0, 1.3.0, 1.4.0, 1.5.0, 1.6.0, 1.7.0, 1.8.0, 1.9.0,
1.10.0, 1.13.0, 1.14.0, 1.16.0, 1.18.0 — and every patch. Additive-only subpaths: `./tokens.css`
at 1.3.0, `./agent-chat` at 1.10.0.

---

## 1.20.1 — the `theme-allow` grammar

**No export removed or renamed.** One break, and it is in the escape hatch itself: **file scope must
now be spelled `theme-allow-file`.** At 1.20.0 an annotation that named a rule and gave a reason —
the exact shape the rule's own message asks for — was promoted to a whole-file declaration, which is
why per-node scoping never actually shipped. The two forms are now distinct:

```text
theme-allow                                  → this node/line, EVERY rule   (reports theme-allow-unscoped)
theme-allow <id>[, <id>…] [— <why>]          → this node/line, those rules
theme-allow-file <id>[, <id>…] — <why>       → the WHOLE FILE, those rules; a bare one waives NOTHING
"basalt:theme-allow[-file]": "<id>… — <why>" → the same two, for JSON / .webmanifest
```

**The migration is one word per file declaration.** Measured across the consumer sweep: linewatch
0 → 11 findings, argo 0 → 6, rb 0 → 0 — all `warn`, so **no build changes colour**.

```diff
-// theme-allow hand-rolled-plot — two panes over one x scale
+// theme-allow-file hand-rolled-plot — two panes over one x scale
```

**An annotation must now START its comment** — after `//`, `/*`, `<!--`, a block-comment gutter `*`,
or nothing but whitespace. Both parsers used a bare substring search, so a comment that merely
_mentioned_ the token parsed as the legacy blanket form and switched every rule off on the line
below. linewatch documented its own waivers in a docblock and thereby disarmed the file — a false
NEGATIVE, and the reason this ships as a break rather than a grace period. Every annotation anyone
actually writes still qualifies; a sentence about the escape hatch no longer waives anything.

**A comment-only annotation now reaches the first CODE line below it**, walking through the rest of
its own comment block. Before, a reason that wrapped onto a second line, or a docblock's `*/`,
absorbed the waiver and the natural shape silently waived nothing — argo hit that three times in one
upgrade. A blank line still ends the block.

**`.json` / `.webmanifest` finally have a waiver.** They have been scanned since 1.20.0 and cannot
hold a comment, so their findings were unwaivable and the printed remedy prescribed something
impossible; both consumers fell back to a blanket `exemptRules`. Use a member key — but for a
manifest, `basaltAppPlugin` is the first remedy, since a hand-copied hex drifts from the palette:

```json
{ "basalt:theme-allow-file": "raw-hex — a PWA manifest theme_color must be a literal hex" }
```

**Two API-shaped fixes worth acting on:**

| Change                                                                     | What to do                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createSearchParamStore` / `createMultiSearchParamStore` gain `linkSearch` | replace every nav link's `search: { <param>: '<literal>' }` with `search: <store>.linkSearch`, passed BY REFERENCE. A module-scope literal pins the fallback on every click — argo's reader had ZERO call sites, so "remember my window" had never worked |
| `BasaltShell` collapse moves to `createPersistedState`                     | the key is now `basalt:<storageKey>` holding `{ v, value }`; read it with `readPersistedValue(storageKey, 1)`. A one-time migration adopts the raw pre-1.20.1 value, so the sidebar does not re-expand on upgrade                                         |

**New, additive:**

| Surface                                              | Note                                                                                                                                                                                                                                          |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check-theme --audit-allows`                         | every waiver and every `exemptRules` entry with what it still suppresses, proved by re-running the guard with that one occurrence neutralized. Exits 1 on a dead waiver — wire it into CI                                                     |
| `basalt.exemptRules` takes paths, globs and a reason | relative paths and directory prefixes (`public/site.webmanifest`, `src/agent`), globs (`*` stops at `/`, `**` does not, a slash-free glob also matches the basename), and `{ paths, reason }`. Entries that suppress nothing are now reported |
| `doctor` → `lefthook-preset`                         | hard-fails a broken `extends` target. lefthook merges a missing target into ZERO commands and exits 0, so a stale path leaves a repo with no pre-commit gate and a clean `lefthook dump`. `sync` reports the same seam                        |
| `basaltAppPlugin({ colorScheme })`                   | `'dark'` (default) / `'light'` / `'auto'` / `false`. Set it to whatever the app passes as `defaultColorScheme` — before this, a light-scheme consumer got dark native controls permanently                                                    |
| `VX.text.nano` (10px) + `VX.text.display` (30px)     | the two rungs `inline-font-size` could previously only be waived for. A 20px rung was rejected: 21/20 = 1.05 is below the ladder's 1.06×–1.17× band, so `h2` is the remedy                                                                    |
| `sync` backfills `basalt.roots`                      | only `init` wrote it, so every existing consumer sat on the undeclared `src` default while `guard-scan` passed. A declared value is never overwritten                                                                                         |
| `basalt/shadow-basalt-export` reads all nine barrels | the charts layer included. Still exact-name-only — a **tripwire, not coverage**                                                                                                                                                               |

Also: `check-theme`'s `inline-spacing` no longer reads a unitless number in a plain options bag as
CSS (`fitBounds({ padding: 48 })` stops reporting); the shipped `oxfmt` pre-commit job drops back to
`*.{ts,tsx,js,jsx,css}` and gains `--no-error-on-unmatched-pattern`; `tokens:css` emits `0.1` rather
than `0.10`, so a committed sheet stops failing prettier — re-run the command to pick it up.

**The lefthook preset overrides YOU, not the other way round.** An `extends` target wins on a
colliding key: declare `pre-commit.commands.oxfmt.run` (or `glob:`) in your own file and **yours**
is the one silently discarded. Only keys the preset does not define merge in. The guard job runs
`${BASALT_BIN:-bunx --no-install basalt-ui}`; that shell default is the sanctioned seam, set via
`env:`, which does merge.

## 1.20.0 — enforcement

**No export removed or renamed.** The whole delta is that things which used to pass now report. If
your build goes red on this upgrade, that is the release working. Every new **kind** and **rule**
lands `warn` — but two other changes in this release do fail a build: `basalt/raw-size-literal`
promotes to `error`, and the widened markup scan reads `index.html` / `.webmanifest`, where a raw
hex is an `error`-severity colour kind. Two consumers exited 1 on exactly that.

| Change                                                           | What you'll see                                                                                                 | What to do                                                                                |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `basalt/raw-size-literal` `warn` → **`error`**                   | CSS-length strings on `size`/`fz`/`fontSize` now fail lint                                                      | use a token (`size="sm"`); `warn` since 1.7.0, zero violations across all seven consumers |
| Five new guard kinds (`warn`)                                    | `theme-allow-unscoped`, `surface-shadow-override`, `css-raw-surface`, `inline-font-size`, `hidden-inline-style` | see below; promotion is tracked in `GRACE_PERIOD_KINDS`                                   |
| Two new oxlint rules (`warn`)                                    | `basalt/shadow-basalt-export`, `basalt/hand-rolled-shell`                                                       | import the shipped component instead of the fork                                          |
| `basalt/hand-rolled-plot`, `basalt/chart-legend-literal` widened | more sites report; both stay `warn`                                                                             | a widened rule does not promote in the minor that widens it                               |
| `doctor` `SKIPPED` exits non-zero, + 3 new hard checks           | doctor goes red where it was green                                                                              | that is the finding — see below                                                           |

**`theme-allow` has a new contract, and one comment shape stops waiving.** A bare `theme-allow`
still waives every kind, but now reports `theme-allow-unscoped`. Rescope it — and spell the id
right, because a word in the id slot that names no rule now waives NOTHING rather than degrading to
the blanket form:

```diff
-// theme-allow
+// theme-allow raw-surface — third-party widget needs a literal corner
```

**The break: a reason with no separator introducing it.** `// theme-allow legacy vendor asset` used
to waive the line; it now waives nothing and the un-suppressed finding reports at its own severity
(`error` for `raw-hex`). The first word after the token is read as a rule id, and an id that names
no rule fails closed — that is the whole point, since the alternative is one mistyped character
silently widening a scoped waiver into a blanket one. No annotation in any of the seven consumer
repos writes that shape; every one of them introduces its reason with `—`, `–`, `-` or `:`. Add a
separator, or an id:

```diff
-// theme-allow legacy vendor asset
+// theme-allow raw-hex — legacy vendor asset
```

Prose AFTER a resolved id is safe and needs no separator —
`// theme-allow raw-surface sub-scale legend corner` waives `raw-surface` and reports nothing. Only
a comma keeps the id list open past the first id.

Two placements that used to fail now work, both matching what the oxlint plugin always did: a
comment-ONLY line directly above the reported line (the only form JSX can express — the reported
line is usually a multi-line opening tag or a `{expr}` child), and in CSS a trailing annotation
reaching back over the declaration it terminates, which is what survives the shipped `oxfmt`
reflowing a long `background-color` so the hex lands above the comment.

**`basalt/hand-rolled-plot` waivers must now be written deliberately.** Every assembly node is
reported individually, and a waiver is no longer picked up off whatever comment happened to sit on
the file's first assembly node — it needs a written declaration naming the rule and giving a reason,
anywhere in the file: `// theme-allow hand-rolled-plot — two panes over one x scale`.

**But the waiver is still whole-file, and per-node scoping is not expressible at 1.20.0.** Naming
the rule AND giving a reason is what `hasFileDeclaration` matches, at any line — so a comment
intended for one node silences the file. Dropping the reason keeps it node-scoped in the oxlint
plugin, but then `check-theme` reports `theme-allow-unscoped ("no reason")`. The two halves of the
contract intersect at exactly one legal shape and that shape is whole-file. Write the declaration in
the component's docblock, where it reads as the file-level decision it is. **Fixed in 1.20.1** —
see that section; the declaration moves to `theme-allow-file`.

**`doctor` will go red.** `SKIPPED` is a third outcome beside pass/warn/fail and exits non-zero on
its own — "All checks passed" is only printable when every check RAN. Three new hard checks:
`basalt-resolves` (walks cwd → ancestors → workspace packages), `guard-scan` (would `check-theme`
cover more than zero files?), `oxlint-preset` (does `.oxlintrc.json` really extend the shipped
preset? JSONC is parsed, not rejected — `init` keeps an existing config, so one repo ran five minors
with the whole lint half off).

**New, additive:**

| Surface                                                          | Note                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `basalt.profile: 'tokens-only'` / `--tokens-only`                | disables the 17 kinds whose remedy is a Mantine component, prop or the React theme factory. `check-theme` requires it DECLARED; `doctor` infers it, because its profile only changes advice, never enforcement                                                                                                                                                                                                                               |
| `basalt.include: [...]`                                          | scan a named file outside `roots` — and the only route to a `.json`, which is never blanket-scanned                                                                                                                                                                                                                                                                                                                                          |
| `basalt.roots` + a `lint:basalt` script                          | written by `init` from the real layout; `init` on an existing app is a lint-debt event, not a no-op                                                                                                                                                                                                                                                                                                                                          |
| `tokens:css --check`, `--selector-class <c>` (+ `--light-class`) | drift gate; the Tailwind `<html class="dark">` convention. There is no `scheme: { class }` API — the class form is CLI-only                                                                                                                                                                                                                                                                                                                  |
| `fonts:css [--out] [--check]`                                    | the shipped `--basalt-font-*` stacks as plain CSS, read out of `styles.css` — the only route to basalt's typefaces without the Mantine-coupled `styles.css`                                                                                                                                                                                                                                                                                  |
| `__APP_VERSION__` ambient declaration                            | ships via `src/register.ts`, re-exported by the root barrel: delete your hand-written ambient block. A subpath-only consumer does not get it                                                                                                                                                                                                                                                                                                 |
| `BASALT_CWD`                                                     | `check-theme`/`doctor` honour it, and relocate to the single workspace package carrying a basalt config when invoked from a root that has none                                                                                                                                                                                                                                                                                               |
| `@generated basalt-ui` header                                    | `tokens:css`/`fonts:css` output carries it on line 1, the version + invocation line on line 2, and `check-theme`, in a `.css` file with that exact header, skips the LINES that are basalt custom properties, selectors, `}` or self-closing comments — this is what fixed 116 violations reported inside the stylesheet `tokens:css` had just written. Committed output emitted by 1.19.1 has no header: re-run the command to get the skip |

`check-theme` also resolves `.html` / `.webmanifest` / `.json` as markup (colour kinds only), and
each root's PARENT now contributes its `index.html` and `public/` tree.

## 1.19.0 — nav

| Removed / renamed                                                 | Replacement                                                                                                                      | Note                                                                                                                                                        |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NavLinkRenderer` (type)                                          | `defineNav` + `{...useNav(NAV)}` (`basalt-ui/router-tanstack`), or `SidebarItem.Anchor`                                          | basalt now paints every nav pixel                                                                                                                           |
| `BasaltShellProps.renderNavLink`, `AppSidebarProps.renderNavLink` | same                                                                                                                             |                                                                                                                                                             |
| `BreadcrumbLinkRenderer` (type)                                   | `AppBreadcrumbs.parentAnchor`                                                                                                    |                                                                                                                                                             |
| `BasaltShellProps.renderBreadcrumbLink`                           | same                                                                                                                             |                                                                                                                                                             |
| `BasaltShellProps.sidebarFooterExtra`                             | `mobileNav.moreExtra`                                                                                                            | its only host was the mobile drawer; it rendered nowhere on desktop                                                                                         |
| `AppSidebarProps.footerExtra`, `AppSidebarProps.onClose`          | —                                                                                                                                | the full-height mobile sidebar drawer is deleted                                                                                                            |
| `MobileNavItem` (type)                                            | `MobileNavSlot`                                                                                                                  |                                                                                                                                                             |
| `MobileNavSection` (type)                                         | `MobileNavGroup`                                                                                                                 |                                                                                                                                                             |
| `MobileNavLinkRenderer` (type)                                    | `MobileNavModel`                                                                                                                 |                                                                                                                                                             |
| `SidebarSection.mobileTab`                                        | `SidebarSection.mobile?: false \| NavSectionMobile` — an OBJECT (`{ tab: true, label?, icon? }`), or `false` to hide the section | `'tab' \| 'more' \| 'hidden'` is `SidebarItem.mobile` (`NavMobilePlacement`, `true` ≡ `'tab'`, `false` ≡ `'hidden'`) — a different prop on a different type |

A consumer with no router needs no migration — `href` + `onClick` still work.

**Expect new type errors, and read them.** `renderNavLink` took `to` as an opaque value, which is
why consumers reached for `to={target.to as never}`. `defineNav` types it, so a destination missing
a required `search` now fails to compile — in one repo that surfaced two nav links that had been
shipping without required params. Fix with a click-time thunk (`search: () => Schema.parse({})`),
never `search: true`.

## 1.17.0 — behaviour only, no export removed

| Changed                                              | Effect                                                       | Opt out                          |
| ---------------------------------------------------- | ------------------------------------------------------------ | -------------------------------- |
| `resolveAxisDomain` clamps before padding, not after | the axis top moves on any chart with an `autoMaxFloor`       | lower the floor, or pin `domain` |
| `ChartFrame` `role="img"` → `role="group"`           | `role="img"` pruned the keyboard slider out of the a11y tree | —                                |

## 1.15.0 — chart layer rebuilt

The largest delta in the 1.x line. No shims were shipped.

| Removed / renamed                                                                                                                                                    | Replacement                                                                                                                                                | Note                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ChartHoverSync`, `ChartHoverSyncProps`                                                                                                                              | `globalCursorStore` / `createCursorStore` / `useChartCursor` / `useCursorState` — **no provider**                                                          | `ChartCursorScope` now _isolates_ a subtree; it is the inverse of the old provider, not a rename                                                                                                                                             |
| `HoverContext`, `HoverCtx`, `useHoverSync`, `DEFAULT_NO_OP_SET_HOVER`                                                                                                | `useChartCursor`, `useCursorState`, `CursorState`, `CursorStore`                                                                                           | context → `useSyncExternalStore`                                                                                                                                                                                                             |
| `ResponsiveChart`, `ResponsiveChartProps`                                                                                                                            | `CartesianChart` / `CartesianChartProps` (+ `autoMargin`, `PlotContext`, `PlotRect`)                                                                       | now mandatory for every single-plot cartesian chart, enforced by `basalt/hand-rolled-plot`                                                                                                                                                   |
| `ChartTooltip` (tip-based), `useChartTooltip`, `useTooltipStyles`                                                                                                    | `ChartTooltipFloat` + the `tooltip: CartesianTooltipConfig` prop                                                                                           | portal / flip / clamp done once                                                                                                                                                                                                              |
| `BarsAxisConfig`                                                                                                                                                     | `AxisConfig` + `resolveAxisDomain`                                                                                                                         |                                                                                                                                                                                                                                              |
| `ZonedLineTooltipLabel`                                                                                                                                              | `tooltip` config on the kind                                                                                                                               |                                                                                                                                                                                                                                              |
| `ZonedLine`/`MultiLine`: `yDomain`, `yAutoPad`, `yAutoMaxFloor`, `yAutoMinCeil`, `numTicksY`, `formatYTick`                                                          | one `y?: AxisConfig<T>`                                                                                                                                    | `y` is **optional** where `yDomain` was required                                                                                                                                                                                             |
| `ZonedLine`/`MultiLine`: `tooltipLabel`, `renderExtraTooltipRows`                                                                                                    | `tooltip.label`, `tooltip.extraRows` (`CartesianTooltipConfig`)                                                                                            | there is no `appendRows`; the field is `extraRows`                                                                                                                                                                                           |
| `ZonedLine`/`MultiLine`: `formatValue`                                                                                                                               | **`y.format`** — or per-series `ChartSeries.formatValue` for one row                                                                                       | `CartesianTooltipConfig` has no value formatter: the axis format IS the tooltip value format                                                                                                                                                 |
| `ZonedLine`/`MultiLine`: `numTicksX`                                                                                                                                 | `xTicks`                                                                                                                                                   | `xZones` added alongside                                                                                                                                                                                                                     |
| `Bars`: `formatValue`, `hideBarTooltipRows`, `leftAxis`, `rightAxis`, `marginLeft`, `numTicksX`, `tooltipLabel`, `renderExtraTooltipRows`, `renderPrefixTooltipRows` | `y` / `y2` (`AxisConfig`), `xTicks`, `tooltip.{label,extraRows,prependRows}`, per-bar `BarsBar.formatValue` / `.tooltip`, measured `autoMargin` + `margin` | passing `y2` is what makes a chart dual-axis. `chartMargin({ rightAxis })` is **not** removed — it is still exported from `basalt-ui` and `basalt-ui/charts`; it is simply no longer needed, since the right gutter follows from measurement |
| `StackedArea`: `formatValue`, `numTicksX`, `numTicksY`, `yAutoMaxFloor`, `yLabel`                                                                                    | `y` (incl. `y.format`), `xTicks`; per-series `ChartSeries.formatValue`                                                                                     | `StackedAreaProps` has **no** `tooltip` prop — its tooltip is entirely derived from `series`                                                                                                                                                 |
| `Heatmap.width`                                                                                                                                                      | measures itself; takes `height` / `aspectRatio` / `fill`                                                                                                   |                                                                                                                                                                                                                                              |

## 1.12.0 — agent-chat, behaviour only

| Changed                                                                    | Effect                                                                                                                                              |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `streaming` no longer selects the image allowlist                          | **security-relevant.** Model output must now pass `contentTrust="untrusted"`; leaving it unset silently reopens prompt-injection image exfiltration |
| consumer `rehypePlugins` output is now sanitized, `clobberPrefix` is empty | a consumer injecting non-default elements must pass a matching `sanitizeSchema`                                                                     |

## 1.11.0 — agent parts

Semver-breaking in a minor; the commit body says so.

| Removed / renamed                                        | Replacement                                                                                           | Note                                                                                        |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `ToolCallPart` flat `{ type, toolName, input, output? }` | `ToolCallPart` as a 7-arm union discriminated on `state` (`input-streaming` … `output-error`)         | mirrors the AI SDK v7 lifecycle                                                             |
| the error field named `error`                            | `errorText`                                                                                           | the SDK union has no `error`                                                                |
| flattened approval fields                                | nested `approval: ToolApproval`, carried verbatim                                                     | flattening dropped `isAutomatic` / `signature`                                              |
| —                                                        | every `AgentPart` now extends `PartBase` with a **required `id`**; `withPartIds` mints them on drafts | a 1.10-shaped part rehydrated from localStorage no longer throws, but id-less parts collide |
| `ToolChip` threw `assertNever` on an unknown state       | now falls back instead of throwing                                                                    |                                                                                             |

## 1.0.0 — the Mantine pivot

| Removed / renamed                                                                             | Replacement                                                               | Note                                                                             |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `./css` subpath (877 lines: 307 custom props, 19 utilities, a reset, the Tailwind entrypoint) | `basalt-ui tokens:css` / `basalt-ui/tokens.css` — **but only from 1.3.0** | between 1.0.0 and 1.2.x the only CSS door was `styles.css` + `buildPaletteCss()` |
| `./starlight` subpath                                                                         | —                                                                         | no replacement                                                                   |
| the OKLCH foundation palette, ShadCN/Tremor/Starlight doctrine                                | the three-tier `--vx-*` system                                            | see `docs/FRAMEWORK-FREE.md` for the token-only route                            |

Names that have no 1.x equivalent: the `--chart-blue-1..8` sequential ramp (1.x is categorical
`--vx-fill-*` only), the default font stacks as a token (they live in `styles.css`), `purple` as a
text color, `black`, `blue-400`/`green-400`.

**The typefaces changed at 1.0, not just their delivery.** 0.4.2 shipped Instrument Sans; 1.x ships
Nunito Sans (body) + Hubot Sans (condensed headings), mono unchanged at JetBrains Mono. `fonts:css`
emits the 1.x stacks — for a 0.4.2 migrant that is a **rebrand**, not a restoration. It also emits
`--basalt-font-head-stretch: 88%`, tuned for Hubot Sans specifically; pointed at another face it
silently condenses it.

## 1.0.1 — CLI binary renamed

`basalt` → **`basalt-ui`**. Never `bunx basalt`.

---

## Lint and guard rules that tightened

Two independent mechanisms, each with its own ledger — read the ledger, not this table, for what is
in grace TODAY. `GuardKind` severities (`basalt-ui check-theme`) default to `error` and are
downgraded only by `GRACE_PERIOD_KINDS` (`src/guard/index.ts`). `basalt/*` oxlint rule severities
live in `configs/oxlint.json`, and since 1.20.0 their grace is tracked by `PLUGIN_RULE_GRACE`, a
named export beside the plugin — a test asserts it against the shipped preset in both directions, so
deleting an entry forces the level flip in the same commit.

| Rule                               | Landed           | Became `error`                                                           |
| ---------------------------------- | ---------------- | ------------------------------------------------------------------------ |
| `mantine-shade-index` (guard kind) | 1.7.0 as `warn`  | **1.11.0**                                                               |
| `basalt/raw-scroll-container`      | ≤1.2.0 as `off`  | `warn` 1.10.0 → **`error` 1.13.0**                                       |
| `basalt/ai-sdk-major`              | 1.10.0 as `warn` | **1.13.0**                                                               |
| `basalt/agent-no-raw-usechat`      | 1.10.0 as `warn` | **1.13.0**                                                               |
| `basalt/agent-resume-guard`        | 1.10.0 as `warn` | **1.13.0**                                                               |
| `basalt/raw-size-literal`          | 1.7.0 as `warn`  | **1.20.0**                                                               |
| `basalt/hand-rolled-plot`          | 1.15.0 as `warn` | still `warn` — widened again at 1.20.1; grace restarts with the widening |
| `basalt/chart-legend-literal`      | 1.15.0 as `warn` | still `warn` — widened at 1.20.0                                         |
| `basalt/shadow-basalt-export`      | 1.20.0 as `warn` | may stay `warn` permanently — widened at 1.20.1                          |
| `basalt/hand-rolled-shell`         | 1.20.0 as `warn` | —                                                                        |

`card-with-border`, `inline-display`, `raw-html-layout`, `raw-form-control`, `raw-font-family` and
the other original guard kinds have been `error` since before 1.2.0 — they never had a grace minor.
Guard findings only gained a severity field at all in 1.4.0; before that every finding was fatal.

**Rule-id rename at 1.1.0:** `basalt/import-boundary` split into `basalt/visx-boundary`,
`basalt/visx-tooltip` and `basalt/token-layer-boundary` (the last is repo-local and deliberately not
in the shipped preset). A config still naming `import-boundary` after 1.1.0 disables nothing.

## Deprecated, not yet removed

The 32 camelCase `--vx-*` aliases deprecated in 1.5.0 are **still emitted at 1.20.1**.
`buildPaletteCss({ legacyAliases: false })` / `tokens:css --no-legacy-aliases` opts out now; a later
minor flips the default.

## Not verified

- Props declared inline on a component (`function X({ a }: { a: string })`) rather than on an
  exported type are outside the diff method used here. Spot checks on the shell and charts modules
  found none, but the negative is unproven.
- The 0.4.2 `./css` line counts in the 1.0.0 table (877 lines / 307 custom props / 19 utilities) come
  from the removal commit, not from a re-read of the 0.4.2 tarball.

`AppBreadcrumbs.parentAnchor` was listed here through 1.20.0 and is now verified: it is declared on
the shipped `dist/shell/app-breadcrumbs.d.ts` (`parentAnchor?: NavAnchor`, with `parentHref` as the
no-router fallback). The type is inline on the component rather than an exported `AppBreadcrumbsProps`,
which is why the export-surface diff never saw it.
