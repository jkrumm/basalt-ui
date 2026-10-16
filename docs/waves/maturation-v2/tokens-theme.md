# v2 audit: tokens-theme

Scope: `packages/basalt-ui/src/{tokens,theme}/**`, `styles.css`, `vite-color-mix.ts`, the fonts/radius/density/derive knobs, and how the five consumers (+ weatherorb) use them. Paths below are relative to `packages/basalt-ui/` unless absolute. Not repeated: #285, #286.

Headline: the token layer is functionally sound and heavily tested, but it carries three structural debts from the 1.x to 2.0 migration: (1) the theme knobs travel through a runtime `<style>` + `theme.other.basalt*` stash + a second, static resolver, which makes `injectPalette={false}` and non-default `derive` representable-but-wrong; (2) the "generated palette" doctrine has a hand-authored zinc tail that ignores `neutral`/`darkLevel`; (3) ~125 component-named spacing one-offs are published as public `--vx-space-*` custom properties, hand-enumerated three times. Zero consumers use any of derive/fonts/radius/density, so the whole knob machinery is currently adopt-or-delete.

---

## Findings

### tokens-theme-01 (major, wiring/api) The four knobs have no consumer and cost four stash keys, four CSS builders, an order hazard and two theme builders

Evidence: `src/theme/index.ts:1645-1681` (`createBasaltTheme` fork: static `baseTheme` vs `buildTheme` + `mergeThemeOverrides` + `other.basalt*`), `src/theme/index.ts:116-123` (module augmentation of `MantineThemeOther`), `src/provider/index.tsx:272-296` (`BasaltBridge` reads the four stash keys), `src/provider/index.tsx:187-198` (`composeInjectedCss`: "reorder this array and the knobs silently stop working"), `src/tokens/core.ts:1051-1125` (`buildFontsCss/buildRadiusCss/buildDensityCss`). Consumers: argo `main.tsx:30` and weatherorb `providers.tsx:35` call `createBasaltTheme()` with NO args (identical to the default `BasaltProvider theme`); rb/linewatch/obsidian/rollhook pass nothing. A grep for `derive:|density:|radius:|fonts:` in all consumers finds no use.
Proposal: apply the consolidation doctrine. Either (a) keep the knobs but replace the four-builder pipeline with ONE `buildThemeCss({derive, fonts, radius, density})` that owns ordering and is emitted from the cssVariablesResolver (see 02), or (b) drop `fonts`/`radius`/`density` until a named consumer exists (they are CSS-var overrides a consumer can write in 3 lines of CSS today) and keep only `derive`. Also delete the no-op `theme={createBasaltTheme()}` from argo/weatherorb (`theme` already defaults to it).
Breaking: yes (option b). Consumers: none use the knobs; argo, weatherorb carry the redundant call.

### tokens-theme-02 (major, wiring/bug) The palette `<style>` is a second injection channel next to the resolver; `injectPalette={false}` + custom derive silently mismatches

Evidence: `src/theme/index.ts:1445-1457` (doc admits "`injectPalette={false}` combined with a custom `derive` leaves the resolver's fallback hexes at the shipped defaults, silently mismatching"), `src/theme/index.ts:1530` (`cssVariablesResolver` is a module-level static built from `DEFAULT_PALETTE_DATA`), `src/provider/index.tsx:514` (resolver wired unconditionally), `src/provider/index.tsx:65-69` (`injectPalette`, rides fonts/radius/density too). No consumer sets `injectPalette` or calls `buildPaletteCss` in code.
Proposal: Mantine's resolver already receives `theme` and can return `{variables, light, dark}`; build `--vx-*` from `theme.other.basaltDerive` there (via the memoized `buildPaletteData`), so there is one channel, one source of fallback hexes, no `BasaltBridge` style tag, no `injectPalette`, no mismatch state. `paletteOptions` shrinks to `Pick<BuildPaletteOpts,'groups'|'derived'>`; `scheme/defaultScheme/mediaFallback/only` stay CLI-only (`tokens:css`, used by rollhook). Risk to verify: selector specificity against Mantine's `[data-mantine-color-scheme]` blocks (the existing `html[data-mantine-color-scheme=...]` shape already matches), SSR nonce handled by Mantine's own `getStyleNonce`.
Breaking: yes (`injectPalette`, `paletteOptions.scheme|defaultScheme|mediaFallback|only` removed from the provider). Consumers: argo/rb pass only `groups`/`derived`.

### tokens-theme-03 (major, bug) "Generated palette" doctrine has a hand-authored zinc tail that ignores `neutral`, `lightLevel`, `darkLevel`

Evidence: `src/tokens/palette.ts:1336-1339` (`SURFACE.overlay` = `#ffffff` / `color-mix(in srgb, #3f3f46 50%, #27272a)`), `:1215` (`tooltipBg.dark` = `rgba(39, 39, 42, 0.96)`), `:1208-1214` (`NEUTRAL.line/line2/dotStroke/tooltipBorder` from hand ramps `BP.gray/lightGray/darkGray`), `:1210-1225` (dark axis/grid/crosshair/legend are flat `rgba(255,255,255,..)`, light ones derive from `inkLight`: dark/light parity gap), `:100-144` (`SHADOW.*` use stone-tint `rgba(28,25,23,..)` on a zinc identity), `src/theme/index.ts:225` (`'#09090b'` dark tuple index 9), `:455` (`black: '#18181b'`), `:219-224`/`BP.darkGray[0]`. `MAINTAINING.md:179-180` documents "overlay surface ... stay hand-authored", but no test pins that a non-default neutral moves them: grep for `slate|stone|overlay` in `theme/derive-theme.test.ts`, `tokens/palette.test.ts`, `tokens/derive.test.ts` is empty.
Failure: `derive: {neutral: 'slate'}` or `darkLevel: 3` gives slate panels with a zinc popover/menu/tooltip, and an overlay that can be darker than the panel under it.
Proposal: derive overlay/tooltipBg/dotStroke/line* from `DERIVED.surface.*`/`ink.*` (add `overlay` to `SURFACE_TONE` as panelHover+1 step), derive the dark chart chrome from the dark ink exactly like light, build shadow tints from ink, and add a table test `for neutral of [zinc, neutral, stone, slate]` asserting no hex outside the derive output reaches `buildPaletteCss()` (extend `raw-hex` exemption audit to `palette.ts` instead of whole-file exempt).
Breaking: no for default (level-0 byte-identity must be re-pinned where a hand hex becomes derived; ship as a visible `feat:` with a MIGRATING note). Consumers: all (default palette changes by 1-2 LSB).

### tokens-theme-04 (major, layering/dead-code) ~125 component-named spacing one-offs are public `--vx-*` tokens, hand-enumerated three times

Evidence: `src/tokens/palette.ts:372-830` (`SPACE_STEP_BASE`, 125 keys: `agentRailInsetX`, `proseArticleH2RuleGap`, `mobileNavMenuWidth`, `mermaidContainerInset`...), `src/tokens/core.ts:463-620` (`spaceDecls`: 120 hand-written `decl('space-...', `${space.step.x}px`)` lines mirroring the keys), `src/guard/vx-names.ts` (generated name list, so each is also guard surface), `src/tokens/core.ts:826-842` (`only: 'core'` exists solely to strip 99 of them for framework-free consumers; rollhook ships `--only core`). All 120 emitted vars have an in-package reader (verified by grep), so they are not dead, but they are private component geometry published as the token API into every consumer's `:root` (204 variables).
Proposal: (1) generate `spaceDecls` from the object keys with a kebab-case mapper (the same trick `CORE_SPACE_VARS` already uses at `core.ts:633`), deleting ~120 lines; (2) move component-private one-offs out of `tokens/` into the owning component's CSS module as a local custom property (`--_inset`) driven by the three density multipliers, keeping only the generic ladder (`stack*`, `row*`, control heights, card/section insets) in the token layer; (3) then `only: 'core'` disappears because there is nothing to filter. The `unknown-vx-token` family `space` stays small enough to review.
Breaking: yes (removes `--vx-space-<component>-*` names; none used by consumers: grep of five repos finds only `--vx-ink/neutral/accent/divider/...` refs). Consumers: none directly.

### tokens-theme-05 (major, dx) A stringly `derived: string[]` escape hatch plus a three-place series wiring

Evidence: argo `apps/dashboard/src/lib/series.ts:169-215` (`groupTokens` x6, hand-listed `argoPaletteGroups`, `ARGO_DERIVED` raw CSS strings incl. camelCase `--vx-optimalZone`, `--vx-hillshadeShadow: rgb(0 0 0);`, and `declare module 'basalt-ui' { BasaltRegister { series: typeof SERIES_MAP } }`), `apps/dashboard/src/main.tsx:33` (`paletteOptions={{ groups, derived }}`), rb `apps/web/src/main.tsx:15-20` (comment: "Without it those refs resolve to nothing and swatches render transparent"), `src/tokens/core.ts:754-815` (`seriesTokens`, `defineSeries` identity, `groupTokens`, `SERIES_GROUP` symbol brand), `scripts/export-surface.json` (`seriesTokens` published; zero consumers).
Failure: define a group, forget to list it in `paletteOptions.groups` -> `var(--vx-x-y)` resolves to nothing, no error. `derived` strings bypass both the kebab-case convention and the `raw-color-fn` guard (a `.ts` string).
Proposal: make `groupTokens(name, map)` self-registering (module registry like `defineNav`/`defineCommands`) so the provider emits every defined group with no `paletteOptions.groups`; delete `seriesTokens` (adopt-or-delete), fold `defineSeries` into `groupTokens` (it is an identity function); replace `derived: string[]` with `defineTokens({ 'optimal-zone': 'color-mix(...)' })` that validates the name and routes values through the same guard. A dev-only check in `BasaltProvider` should warn when a ref is read but never registered.
Breaking: yes. Consumers: argo, rb (small edits), obsidian/linewatch unaffected.

### tokens-theme-06 (major, api) Dead 1.x chart constants and a density knob that does not reach charts

Evidence: `src/tokens/core.ts:294-305` (`VX.minPxPerTick`, `VX.minPlotHeight`, `VX.zIndexFloating`: zero readers in `src/` or any consumer; the doc says "the 1.x chart frame ... legend's `All N` disclosure" which no longer exists), `:148` (`VX.axisFont` zero readers), `:257` (`VX.shadowCtrl` JS ref zero readers; the CSS var is used), `VX.margin.*` (readers: none outside tokens; `SPACE_STEP.chartMarginTop|Right|Bottom|Left` feed only it), `VX.accentHover/accentFillHover` (JS zero readers). Meanwhile `VX.dotR` (`charts/marks.ts:93,131,176`) and `VX.legendGap` (`charts/legend.tsx:58,67`) are static level-0 numbers; `src/tokens/core.ts:153-158` admits `createBasaltTheme({density})` "has no wiring into chart render props", so `density` silently does not touch chart dots/legend.
Proposal: delete the zero-reader `VX` members and `SPACE_STEP.chartMargin*`; make `dotR`/`legendGap` read a CSS var (`legend` already goes through `--bc-legend-gap`) or `useBasaltSpacing()` so the knob is honest; add a `VX`-member reader test (every `VX` leaf must have a reader or be marked public in `export-surface`).
Breaking: yes (removes `VX` members; no consumer reads them). Consumers: none.

### tokens-theme-07 (major, guard) The inline-style guard disagrees with the CSS guard on circles; three consumers carry the waiver

Evidence: `src/guard/index.ts:84` (`SURFACE_RADIUS` flags any `borderRadius` literal containing a digit, so `'50%'` is flagged in TSX) vs `src/guard/index.ts:242-253` (`SHAPE_RADIUS_VALUES` allows `50%/9999px/999px/100%` in CSS). Waivers: rb `features/course/page.tsx:82`, `features/library/page.tsx:150`, linewatch `components/live-chip.tsx:99` all `theme-allow raw-surface` for `borderRadius: '50%'`; linewatch's comment says "no radius token is 50%" while `VX.radiusPill` exists (`core.ts:174`) and `RADIUS_STEP.pill: 9999` is in `SHAPE_RADIUS_VALUES`.
Proposal: route the TSX path through `isAllowedCssRadius` (one predicate, both dialects), and ship `VX.radiusCircle: '50%'` (or point docs at `radiusPill` for dots) so the guard message has a destination. Then the three waivers go away.
Breaking: no. Consumers: rb (2), linewatch (1).

### tokens-theme-08 (major, dx/api) Hand-rolled ink/neutral alpha ladder: 88 `color-mix` in src, 13 distinct ink percentages, consumers copy it

Evidence: grep in `src/`: 88 `color-mix(` occurrences; `var(--vx-ink) N%` with N in {5,6,7,8,9,10,12,13,14,20,25,40,70}; e.g. `src/theme/index.ts` (nav 9%/13%, SegmentedControl 8%/14%, Progress 8%, subtle hover 6%). Consumers: argo has 33 (`strength-tracker/**/*.module.css`: `var(--vx-neutral)` at 6,10,12,14,16,22,30,45,46,50,52,55,75,85%), obsidian 8, rollhook 46. The `alpha()` helper (`core.ts:80`) is JS-only; CSS modules cannot call it, and `Math.round(a*100)` plus no range check means `alpha(x, 1.5)` emits invalid CSS silently.
Proposal: define a small named tint ladder as tokens (`--vx-tint-1..5` over ink, per scheme, in `buildPaletteCss`) and have the guard offer them in a new `off-ladder-tint` kind (warn for one minor). Make `alpha` take a literal union of the ladder or validate `0..1` in dev. Collapse the 5/6/7 and 12/13/14 near-duplicates in src first.
Breaking: no (additive + warn). Consumers: argo, rollhook, obsidian.

### tokens-theme-09 (major, layering) Two CSS layering regimes; "consumers win or lose deterministically" is not true

Evidence: `src/styles.css:1-16` declares `@layer mantine, basalt;` and claims deterministic order; only 5 of 40 `*.module.css` mention `@layer` (and only in comments, `grep @layer` finds the declarations in `styles.css` alone), so 40 module sheets are UNLAYERED and outrank every layered rule, including a consumer's own `@layer app`. `styles.css:35` puts the font stack in `@layer base`, a third, undeclared layer that, by first-appearance order, sorts ABOVE `basalt`. Consumer `@layer` placement is documented nowhere in the shipped rules (grep `layer` in `MAINTAINING.md` only hits `src/` boundary prose).
Proposal: pick one regime and state it once: (a) wrap every shipped module in `@layer basalt` (a postcss step in tsup or a lint rule `css-module-layer`) and declare `@layer mantine, basalt, app;` so consumers have a named top layer; or (b) document "unlayered by design" and drop the layer claim. Move `--basalt-font-*` out of `@layer base` into `basalt`.
Breaking: no for (b); behavior-affecting for (a). Consumers: any with layered CSS (none found).

### tokens-theme-10 (minor, dead-code/docs) `vite-color-mix.ts` solves a case that no longer exists

Evidence: `src/vite-color-mix.ts:1-14` (premise: "`SURFACE.bg` holds `color-mix()` expressions"), but `bun -e` on `SURFACE.bg` prints plain hex (`#f2f2f5` / `#27272a`); `src/vite.ts:870-873` already admits "currently resolves to plain hex"; `src/vite.ts:235-237` JSDoc still says "a `color-mix()` expression". It is also a THIRD `hexToRgb` (see 11) and carries a `theme-allow raw-hex` pair.
Proposal: delete `vite-color-mix.ts` (+ test), have `resolveThemeColors` read `SURFACE.bg` directly with a dev assert `/^#/`, fix the JSDoc. 137 lines + a test go.
Breaking: no. Consumers: none.

### tokens-theme-11 (minor, dead-code) Duplicated color math: `hexToRgb`, `relativeLuminance`, `contrastRatio` x2-3

Evidence: `src/theme/index.ts:142-150,284-298` (private copies) vs `src/tokens/hct.ts:95,208,214` (exported) vs `src/vite-color-mix.ts` (own `hexToRgb`). `theme` may import from the Mantine-free `tokens/hct`.
Proposal: import from `tokens/hct`; one `hexToRgb`.
Breaking: no. Consumers: none.

### tokens-theme-12 (major, invalid-states) `DeriveConfig` knobs are `number`/`string`; radius and density are literal unions

Evidence: `src/tokens/derive.ts:15-50` (`lightLevel|darkLevel|vibrancy|accentBrightness: number` documented as -5..5; `neutral` union with no runtime check), vs `src/theme/index.ts:1438-1441` (`BasaltRadiusLevel`, `BasaltDensityLevel` unions) and `palette.ts:187-196,1050-1058` (runtime range + `Number.isInteger` throws). `grep isInteger` in `derive.ts` is empty; `vibrancy: 99` yields chroma `0.72*1.2^99` and relies on gamut mapping. JS callers with `neutral: 'foo'` hit a bare `undefined.hue` TypeError (`derive.ts:372`).
Also `resolveDeriveConfig` (`derive.ts:69`) does not normalize `accent`, so `#0077BD` or `#07b` is "non-default" (`isDefaultDeriveConfig` compares strings) and takes the full derive path and `basaltDerive` stash for an identical palette.
Proposal: `type BasaltLevel = -5|-4|...|5`, one shared `assertLevel(name, v, range)` used by all four dimensions, a `neutral` runtime check with an enumerated message, and lowercase/6-digit accent normalization in `resolveDeriveConfig`.
Breaking: no for TS callers who stay in range. Consumers: none.

### tokens-theme-13 (major, naming) Overlapping token names for the same value

Evidence: `src/tokens/palette.ts:1219-1223` (`NEUTRAL.neutral` and `INK.muted` are the same value "kept for the pre-existing `--vx-neutral` name (never renamed)"), `src/tokens/core.ts:376-378,375` (`--vx-good-solid` and `--vx-status-good` are the same pair; `STATUS.good = SUCCESS`), `VX.good` is an 18% tint (`core.ts:~690`), `VX.warn` an 8% tint (asymmetric with `good/bad` at 18%; `goodSoft` exists but no `badSoft/warnSoft`), `--vx-line` vs `--vx-neutral` vs `--vx-axis-stroke`. `NEUTRAL` is also the chart-chrome group, the `neutral` derive seed family and the `status-neutral` pair. Consumers use `--vx-neutral` 25x and `--vx-muted` less, so the alias won in practice.
Proposal: pick one name per value and delete the other (greenfield): drop `--vx-muted`/`INK.muted` or `--vx-neutral`; rename tints `goodTint|badTint|warnTint` with a symmetric `soft` step or drop `goodSoft`; fold `status-good` into `good-solid` (or the reverse). Rename the chart-chrome group `CHROME`.
Breaking: yes (token names). Consumers: argo (`--vx-neutral` x25, `VX.goodSoft` x4, `VX.line2` x10).

### tokens-theme-14 (minor, naming) `BP`, `p`, `BREAKPOINTS`, `SIZE_CLASSES` are confusing public names

Evidence: `src/tokens/index.ts:6` exports `BP` (a hue-family table; "Blueprint palette" legacy), single-letter `p`; `src/tokens/core.ts:322` `BREAKPOINTS` has exactly one member (`article: 1200`) readable only by a comment and a test; `size-classes.ts:10` `SIZE_CLASSES`. A reader sees `BP` and `BREAKPOINTS` and cannot tell which is the viewport.
Proposal: `BP` -> `HUES`, `p` -> `huePair` (or `hue(HUES.blue, 3)`), inline `BREAKPOINTS.article` into `SIZE_CLASSES.expanded` (same 1200 per `content/article-layout.tsx:122`) and delete the table.
Breaking: yes (rename). Consumers: argo `lib/series.ts` (75 `BP.` reads), rb `lib/series.ts` (6).

### tokens-theme-15 (minor, api) Two color vocabularies: derived fills for chrome, hand-ramped `BP` for consumer series

Evidence: `src/tokens/palette.ts:56-79` (hand ramps), consumers build every series with `p(BP.x)` (argo `series.ts:28-168`), while `--vx-fill-*` and `--vx-accent` are derived under the contrast law (`palette.ts:1290-1310`). A consumer series therefore ignores `derive` knobs (a retuned `vibrancy` moves the chrome and not the charts) and has no contrast guarantee.
Proposal: let `defineSeries` accept `{ fill: 'cyan' }`/`{ accent }` references to derived families (with shade-pair via the same `vibrancy`), keeping `BP` only as an explicit, labelled escape hatch; add a guard-free test that every shipped example series clears the chart-on-surface contrast floor.
Breaking: no (additive). Consumers: argo, rb.

### tokens-theme-16 (minor, perf/dx) Theme file carries 14+ copies of the `calc(<rem> * var(--mantine-scale))` idiom and ~20 `CTL_*` magic constants outside the token layer

Evidence: `src/theme/index.ts:1317-1425` (`ctlSizeVars` repeats the wrapper per line, e.g. 14x), `:1286-1311` (`CTL_PADDING_X=10`, `CTL_INPUT_PADDING_Y=4`, `CTL_SWITCH_*`, `CTL_SLIDER_TRACK_SIZE`...), `:663-700` (`Input/Button/ActionIcon` `vars` repeat `calc(var(--vx-space-control-height) * var(--mantine-scale))`). The code says these paddings "have no density-tracking token" (`:1380`), so the ctl tier is half density-tracked (heights) and half not (paddings, chevrons, switch).
Proposal: one `scaled(rem)` helper; move the CTL constants into `SPACE_STEP` so density reaches them (or state in the density doc that ctl insets are fixed).
Breaking: no. Consumers: none.

### tokens-theme-17 (minor, docs) 22 stale references to `tokens/index.ts` for code that lives in `core.ts`

Evidence: `src/tokens/index.ts` is an 18-line barrel; `grep "tokens/index.ts"` hits 22 comments, e.g. `src/agent/foreign.ts:103` ("`defineSeries` (`tokens/index.ts:648-650`)"), `src/theme/index.ts:135,475,667`, `src/dashboard/stat-card.tsx:407`, `src/tokens/core.ts:50-60`. The JSDoc block "VX tokens ..." (`core.ts:96-103`) sits directly above the unrelated `TEXT` doc, orphaned from `VX` at `:142`; two stacked JSDoc blocks precede `accentBridge` (`theme/index.ts:1203-1236`) so the first (about `cssVariablesResolver`) attaches to nothing.
Proposal: sweep to `tokens/core.ts`; reattach/move the two orphan doc blocks; add `check-agent-doc-drift` rule for `file:line` cites (line-number cites rot by construction).
Breaking: no. Consumers: none.

### tokens-theme-18 (minor, docs) Comments narrate history instead of stating the contract

Evidence: `src/theme/index.ts:244-280` (`onColor` JSDoc has two "Fix:" passages and a story about Composer), `:1380-1425` (`ctlSizeVars`: "that mistake shipped"), `src/tokens/core.ts:433-436,626-640` ("landing next", "this commit", "wave 3/4" for work that has landed), `src/theme/spacing.test.ts:1-60` (60-line change log in a test header). These rot and cost review time; doctrine "one doctrine one home" says history belongs in MIGRATING/CHANGELOG.
Proposal: cut each to the invariant (what, why, how it is locked); move incidents to `docs/waves/argo-friction.md`.
Breaking: no. Consumers: none.

### tokens-theme-19 (minor, test) Snapshot-style tests pin numbers, not behavior

Evidence: `src/theme/spacing.test.ts` (540 lines, 36 `toBe/toEqual` against the base tables; its own header warns "updating this file is exactly how a regression would hide"), `src/theme/density-relations.test.ts` (506), `src/tokens/density.test.ts` (261), `tokens/build-radius-css.test.ts`. A retune requires editing the test in the same commit as the table.
Proposal: keep ONE level-0 golden (a generated snapshot of `buildPaletteCss()` checked by `--update`), express the rest as properties (monotonic in level, floors, relation between anchors). Delete the per-number assertions.
Breaking: no. Consumers: none.

### tokens-theme-20 (minor, wiring) `basaltAppPlugin` has no view of the derive config; scheme default is mirrored by hand

Evidence: `src/vite.ts:371` resolves `themeColor: 'auto'` from the static default `SURFACE.bg`, so `createBasaltTheme({derive})` in app code and the manifest/meta `theme-color` in `vite.config.ts` disagree for any retuned identity. rb `vite.config.ts:41-44` ("`colorScheme` mirrors `<BasaltProvider defaultColorScheme>`") and rb `styles.css:5-12` (`#27272a` literal with `theme-allow raw-hex`) show the same value spelled in three files; obsidian wrote `vite-plugins/ios-status-bar.ts` to override a hardcoded plugin default.
Proposal: one shared `basalt.config.ts` (`{derive, colorScheme, ...}`) read by both the plugin and `createBasaltTheme`, or accept `derive` in the plugin. Have the boot `<style>` also set the `html` background that rb hand-writes.
Breaking: no. Consumers: rb, argo, linewatch, obsidian.

### tokens-theme-21 (minor, stale-consumer) rb re-implements `color-scheme`/html background the framework already owns

Evidence: rb `apps/web/src/styles.css:14-25` ("Mantine ... never sets the native `color-scheme` property"), but `src/vite-boot.ts:15-16` documents that Mantine's own layer sets `color-scheme: var(--mantine-color-scheme)`; the `html` background duplicates `--mantine-color-body`. Check with a doctor rule `redundant-color-scheme-css` or document in the shipped `basalt-tokens` rule.
Proposal: delete the two rules from rb; teach `doctor` to flag them.
Breaking: no. Consumers: rb.

### tokens-theme-22 (minor, perf) `styles.css` imports Spotlight, Notifications and three font families unconditionally

Evidence: `src/styles.css:20-22` (`@mantine/notifications` and `@mantine/spotlight` layer CSS), `:25-27` (three `@fontsource-variable` imports) even when #285 gates the Spotlight runtime on `defineCommands` and when `createBasaltTheme({fonts})` replaces all three families. #285 does not touch the stylesheet.
Proposal: split `styles.css` into `styles.css` (core + layers + tokens) and opt-in `styles/overlays.css`/`styles/fonts.css` wired by `basalt-ui init`/`doctor` (the sync already knows whether `defineCommands` ran).
Breaking: yes (consumer imports). Consumers: all five (import line).

### tokens-theme-23 (minor, a11y/consistency) Unit mix: heights in rem, insets/gaps in px

Evidence: `src/tokens/core.ts:476-481` (control heights via `pxRem`), `:520-596` (all inset/gap vars `${n}px`), `theme/index.ts:489-499` (`theme.spacing` via `pxRem`). A user raising the browser font size gets taller controls and Mantine-spaced layouts but unchanged basalt insets; only the page gutter has a stated rationale (`core.ts:584-592`).
Proposal: emit insets in rem (multiplied by `--mantine-scale` at point of use as with heights) or state the policy once in the tokens rule.
Breaking: no (visual change at non-default root size). Consumers: all.

### tokens-theme-24 (minor, css) Dead/ineffective scrollbar rules

Evidence: `src/styles.css:152-166` styles `*::-webkit-scrollbar*` while also setting standards `scrollbar-width/scrollbar-color` on `*`; in Chromium 121+ and current Safari the standard properties disable the `::-webkit-scrollbar` pseudo-elements, so the webkit block (and its `border-radius`) is effectively dead; the universal `*` selector also hits every element and every subtree.
Proposal: keep only `scrollbar-width`/`scrollbar-color` (document that thumb radius is not stylable) and scope to `html` + `.mantine-ScrollArea-viewport`.
Breaking: no. Consumers: none.

### tokens-theme-25 (minor, wiring) Provider-visible theme coupling to `defaultProps` numerics blocks CSS-only knobs

Evidence: `src/theme/index.ts:511` (`Badge.defaultProps.radius: radius.ctrl`), `:~870` (`SegmentedControl radius: radius.card`, `Progress size/radius`, `Timeline bulletSize`) are baked numbers, which is the sole reason `buildTheme` takes `{radius, spacing}` and why `theme.other.basaltRadius/Density` + `useBasaltSpacing` exist (`use-basalt-spacing.ts`; 16 readers) and why the theme lab "can only move the CSS vars" (`createBasaltThemeOptions.radius` JSDoc). Mantine accepts CSS strings for these props (the Card override already uses `'var(--vx-radius-card)'` at `theme/index.ts:~540`).
Proposal: switch these defaults to `var(--vx-radius-*)`/`var(--vx-space-*)` strings so radius/density become pure-CSS knobs; then `buildTheme` has no parameters, the stash keys and the two-theme fork (01) disappear, and the lab is exact. Keep `useBasaltSpacing` only for the AppShell numeric props.
Breaking: no. Consumers: none.

---

## Ranked priorities

1. 01+02+25 (collapse the knob pipeline into one resolver-owned channel, or delete unused knobs) - the biggest net-negative change.
2. 04 (generate/relocate the 125 component one-offs).
3. 03 (derive the zinc tail; add a neutral-sweep test).
4. 05 (self-registering series groups, delete `seriesTokens`/`derived: string[]`).
5. 07, 08, 13 (guard asymmetry, tint ladder, token alias cleanup) - the consumer-visible friction.
