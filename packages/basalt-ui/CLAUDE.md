# Basalt UI — Package

**Inherits from**: `../../CLAUDE.md` (monorepo conventions).

The only published package (npm: `basalt-ui`). An opinionated framework for Mantine v9 + visx React
apps: a Mantine theme + `cssVariablesResolver`, `BasaltProvider`, an app shell with a page bar and a
control tier, a visx chart system, a three-tier `--vx-*` token system, a theme-lab, a Vite preset,
raw toolchain presets, and the `basalt-ui` CLI.

This file is **invariants and footguns** — the things that are load-bearing and not obvious from the
code. Mechanics live where they can't drift: **API shape → the JSDoc on the export**; **subpath map →
`llms.txt` + `AGENTS.md`**; **current state → `../../docs/STATUS.md`**; **what broke → `MIGRATING.md`**;
**consumer doctrine → `agent/rules/*.md`**. Don't restate any of those here.

## Published surface

Named exports only — **no default exports**. Files `kebab-case`, components `PascalCase`.

| Subpath                                    | Mantine? | Owns                                                                                                                                                                                                                               |
| ------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.`                                        | coupled  | provider + theme factory, `BasaltShell` (sidebar / mobile nav / breadcrumbs / `PageBar` / `PageAside`), `Section`, `WidgetHeader`, dashboard composites, `QueryState`                                                              |
| `./charts`                                 | **free** | `CartesianChart` + the kinds, sparklines, chart hooks, and a token re-export                                                                                                                                                       |
| `./tokens`                                 | **free** | `VX`, `alpha`, `BP`/`p`, `buildPaletteCss`, `defineSeries`, `seriesTokens`, `groupTokens`, `chartMargin`                                                                                                                           |
| `./controls`                               | coupled  | the control tier — `FilterSet`, the `FieldHandle`-bound filters, `ViewTabs`, `ActionGroup`, `OverflowMenu`, `SyncButton`; three surfaces (`pill` / `sheet` / `panel`) plus the aside's row primitives `PanelRow` + `SliderControl` |
| `./controls-dates`                         | coupled  | `DateRangePicker` only — the `@mantine/dates` implementation of `RangeFilter`'s picker seam                                                                                                                                        |
| `./state`                                  | **free** | `createPersistedState` + the field vocabulary (`field.*`, `FieldHandle`, lanes) + `createLocalStore`                                                                                                                               |
| `./router-tanstack`                        | **free** | the TanStack bridge: `defineNav`/`useNav`, `useBasaltNav`, `useRouterBreadcrumbs`, `createSearchStore`                                                                                                                             |
| `./query`                                  | **free** | `createBasaltQueryClient`, `unwrap`, lazy devtools, `toErrorMessage`/`errorStatus`                                                                                                                                                 |
| `./forms`                                  | coupled  | `useBasaltForm`, `field`, `FormErrorSummary`, `useFormDraft`                                                                                                                                                                       |
| `./notifications`                          | coupled  | `notify` + the typed registry, persisted history, bell + center                                                                                                                                                                    |
| `./commands`                               | coupled  | the typed command bus, overlay controller, Spotlight projection, `BasaltOverlays`                                                                                                                                                  |
| `./data`, `./data/table`, `./data/virtual` | coupled  | `BasaltDataTable`, `BasaltVirtualList` (prefer the narrow subpaths)                                                                                                                                                                |
| `./agent`                                  | **free** | the headless streaming layer: transports, `useAgentStream`, `useAgentThreadRuns`, threads store                                                                                                                                    |
| `./agent-chat`                             | coupled  | the Mantine thread-chat chrome over `./agent` (also re-exported from `.`)                                                                                                                                                          |
| `./content`                                | coupled  | `Prose`, `Markdown`, `CodeBlock`, `MermaidDiagram`, MDX map, `ArticleLayout`, the Article model                                                                                                                                    |
| `./connectivity`                           | coupled  | `ConnectivityProvider`, `useConnectivity`, `ConnectivityIndicator` — auto-mounted by the provider                                                                                                                                  |
| `./theme-lab`                              | coupled  | `ThemeLabControls` (structural-token inspector) — identity tuning is `DeriveControls`                                                                                                                                              |
| `./guard`                                  | **free** | `checkSource`, `GUARD_RULES`, `Finding`, the allow-annotation reader                                                                                                                                                               |
| `./vite`                                   | —        | `basaltViteConfig` (config only, never `plugins`) + `basaltAppPlugin` (head/PWA/manifest)                                                                                                                                          |
| `./styles.css`                             | —        | `@layer basalt` base styles, the iOS input floor, the font stack — mandatory import                                                                                                                                                |
| `./tokens.css`                             | **free** | the prebuilt `--vx-*` stylesheet for a consumer with no bundler, React or Mantine                                                                                                                                                  |
| `./configs/*`, `./llms.txt`                | —        | raw toolchain presets (real paths — `extends` needs them); the machine-readable surface map                                                                                                                                        |

`src/surfaces.ts` is the SSOT behind that table, `llms.txt`, `AGENTS.md`, the oxlint boundary globs
and the doctrine triad; `check-coverage` and `tests/{surfaces-coverage,agents-sync,llms-sync}.test.ts`
fail on any drift. Add a subpath there first, or the gates will tell you.

## Common primitives (`src/common/**`)

The prop, ref, message and validation vocabulary every component shares. **Not a subpath** — the
pieces are re-exported from the root barrel, because `BasaltProps` is the base a consumer's own
props extend and `src/surfaces.ts` stays the SSOT for real subpaths.

- **Every component's props type extends `BasaltProps`** (`className` + `style`, both spelled
  `| undefined` because `exactOptionalPropertyTypes` is on). The isomorphic harness counted 98 of
  123 exports dropping `className`; the `NO_CLASSNAME` ledger in `tests/isomorphic/props.tsx`
  ratchets in both directions, so adopting it means DELETING that component's entry.
- **`className` + per-slot `classNames`, and nothing else** — no `styles`, no `vars`. basalt does
  not spread `...rest` onto the DOM (which is why the harness saw zero unknown-attribute warnings),
  and a composite that paints more than one box declares its slot union instead:
  `SlotStylesProps<'root' | 'header' | 'body'>`. `Section` is the reference adoption.
- **The validate idiom is two functions, and the split is the point.** `assertRequiredProps` THROWS
  in every build, before the component reads into the prop — that is the F-ERR-1 remedy (54 of 55
  components failed as a raw `TypeError` swallowed by `BasaltErrorBoundary`; only `QueryState` named
  itself). `useValidateProps` is dev-only, `console.error`s each message ONCE per
  `(component, message)`, and constant-folds away in production. A misuse that would crash anyway
  throws; one that merely renders the wrong thing warns. `SelectFilter` and `Section` are the two
  reference adoptions.
- **Every message is built in `common/errors.ts`** — `requiredProp` / `oneOf` / `deprecatedProp` /
  `duplicateMount` over one `BASALT_PREFIX`, so consumers can grep `[basalt] <Component>:`.
- **The module is Mantine-free and `@visx`-free**, enforced twice: a `no-restricted-imports`
  override in `.oxlintrc.json` (repo-local, like `state`/`query`/`guard`) and
  `src/common/boundary.test.ts`, which also forbids a VALUE import reaching outside `common/` or
  `utils/`. That is what lets `./charts` and `./tokens` reach `cx`/`mergeRefs` without breaching the
  layer boundary. `Tier` is re-exported from `widget-header` **type-only**, so it emits no runtime
  edge into the Mantine-coupled half.
- `Tone`/`ToneWithNeutral` is the ONE status vocabulary. Five forks exist (`StatCardTone` and
  `SidebarBlockTone` byte-identical; `CalloutKind`, `AccountBadgeTone`, `NotificationIntent`
  differ) — an adopter ALIASES its fork to this type; nothing gets renamed out from under a
  consumer.

## Layering: Mantine-coupled vs Mantine-free

- `src/charts/**` and `src/tokens/**` import zero `@mantine/*`; `@visx/*` may only be imported
  inside `src/charts/**`. Three independent oxlint plugin rules enforce it —
  `basalt/visx-boundary` and `basalt/visx-tooltip` ship in the consumer preset too;
  `basalt/token-layer-boundary` is **repo-local only**.
- It protects two things. **Layering**: `tokens` is pure data that `cssVariablesResolver`
  (Mantine-coupled) reads to bind Mantine's surfaces to the same vars charts read, so an import the
  other way cycles through the theme layer or lets a chart fork chrome and charts apart.
  **Packaging**: `./charts`/`./tokens` (and `./state`/`./guard`/`./query`/`./router-tanstack`/
  `./agent`) resolve with **no `@mantine/*` installed** — CI-tested by
  `scripts/check-dist-layering.mjs` (dist-graph walk) and `scripts/pack-test.sh` (scratch install +
  SSR render). **The LAYER is Mantine-free; the FRAMEWORK is not** — `.` requires Mantine.
- **The root barrel does not re-export `./tokens` / `./charts`.** It keeps the arrow pointing one
  way, and it means a charts-only consumer never pulls Mantine in by importing the root.
- `motion` is framework-agnostic, so `src/motion` is importable from both halves. Only `@mantine/*`
  is banned in the free layer.
- `./controls` must never import `@mantine/dates`, statically OR lazily: `basaltViteConfig`
  pre-bundles the whole `@mantine` scope, so a consumer without that peer would fail to resolve.
  The picker is injected through `RangeFilter.customPicker` from `./controls-dates`.

## Tests

Run tests from the **repo root** (`bun test`), never from this directory. The DOM harness is wired
via `[test].preload` in the ROOT `bunfig.toml`, and Bun resolves `bunfig.toml` from `cwd` — there is
deliberately no package-level one, so running from here gets no DOM and fails every DOM test with
`document is not defined`. `bun run test` from here is safe: it delegates to the root.

## Build (dist-first, unbundled)

```bash
bun run build   # tsup && tsc --emitDeclarationOnly && copy-assets && fix-esm-extensions
```

- **tsup with `bundle: false`, `splitting: false`, `dts: false`, glob entry** — each module is
  transpiled in place so the subpath exports resolve to real files. `bundle: false` alone only emits
  entry modules, so the glob + `splitting: false` are both required.
- **`copy-assets.mjs`** mirrors every `src/**/*.css` (plus co-located `.module.css.d.ts`) into
  `dist/`: esbuild leaves `.module.css` imports verbatim, and `styles.css` is imported by no module.
- **`fix-esm-extensions.mjs`** fully specifies relative ESM imports so Node resolves them; the
  pack-test enforces it.
- **tsc owns declarations** — running tsup's `dts` too fights it.
- The tarball ships `dist/` + `src/` + `configs/` + `agent/` + `bin/`, so go-to-definition lands in
  real source and `init`/`sync` can place the agent layer.
- **Never use `import.meta.env`** (Vite-only) in shipped code — `process.env.NODE_ENV`.
- tsup is in maintenance mode (upstream → tsdown); the CSS-copy behaviour is the load-bearing piece.
  Re-evaluate behind the pack-test, not casually.

**Three footguns all of the same shape — a gate reading `dist`, not your working tree:**

1. `bin/basalt-ui.mjs` imports `../dist/cli/index.js`, so `check-theme` / `check-coverage` /
   `doctor` validate the last BUILD. After touching `src/guard/**` or `src/cli/**`, build before
   trusting them — and `bun run pre` runs `check-theme`, so a stale `dist` can make `pre` green over
   source it never read.
2. `apps/playground/tsconfig.json` declares no `paths`, so its `tsc` resolves `basalt-ui/*` through
   node_modules → `exports` → `dist/**/*.d.ts`, while Vite aliases the RUNNING playground to `src/`.
   A new export or a widened signature is invisible to `bun run typecheck` until you build.
3. The playground only ever exercises `src/`. **The pack-test is what proves the published artifact
   resolves** — it is the dist gate, and it runs in CI.

## Dependencies

- **`dependencies` is empty.** `bun add basalt-ui` with no peers pulls exactly one package.
- **Every peer is `optional` in `peerDependenciesMeta`**, including the five the root `.` entry
  hard-requires (`react`, `react-dom`, `@mantine/core`, `@mantine/hooks`, `@tanstack/react-query`),
  because npm expresses optionality per PACKAGE and never per SUBPATH — and `./tokens`/`./charts`/
  `./state`/`./guard` really do resolve without them. The trade: a missing peer is a bundler
  resolution error instead of an install warning. Version-mismatch warnings are unaffected and must
  stay that way, so every peer stays listed in `peerDependencies` (`tests/required-peers.test.ts`
  pins both halves).
- Exact-pinned peers: the nine `@visx/*`, `motion`, `remend`, the three `@fontsource-variable/*`.
  `motion` is required-in-practice for `./agent-chat` (imported eagerly) even though it is marked
  optional; `remend` is `./content`'s one eagerly-imported peer.
- **NO** zustand, **NO** `@tanstack/*` as a dependency, **NO** icon package — icons are `ReactNode`.
- `sideEffects: ['*.css']`.

## Token system — the derived palette

Three tiers: **palette data** (pure data, zero React/Mantine/DOM) → **`--vx-*` CSS variables**
(resolution is pure CSS, so a scheme flip restyles everything with no re-render) → **`VX.*` refs**
(just `var()` strings plus non-color sizing constants, so they work outside components).

- **The shipped palette is GENERATED, not hand-authored.** `tokens/derive.ts` computes the accent
  family, the categorical fills, the surface stops, the ink ramp and the status solids from
  `DEFAULT_DERIVE_CONFIG`; `tokens/palette.ts` builds them once at module load. **Never hand-edit a
  palette hex** — retune the config or the calibrated constants. `derive.ts`/`hct.ts` are themselves
  exempt from the `raw-hex` guard because they ARE the source. Structural, non-derived tokens
  (shadows, the overlay surface, dividers, the raw hue ramps) stay hand-authored.
- **Four config dimensions, ONE entry point**, and never a second config surface:
  `createBasaltTheme(overrides?, { derive, fonts, radius, density })`. `derive` is one accent seed
  plus five bounded knobs; `fonts` is the only route to the `--basalt-font-*` vars; `radius` and
  `density` are integer LEVELS over a law (`deriveRadius` / `deriveSpacing`), with level 0 pinned to
  today's values by `theme/{radius,spacing}.test.ts` and cross-level relations by
  `theme/density-relations.test.ts`.
- **Density is a multiplier with named exceptions, and the exceptions are the interesting part**:
  `SPACE_FIXED` structurals are exempt by design, the 4px stack rhythm rebuilds from one shared unit
  so its 2:1 pairs survive every level, several touch targets carry hard floors (mobile bar and row,
  the sidebar search trigger, `touchControlHeight`) because the law would take them below the
  minimum target, and `input-height` must keep its `rem × --mantine-scale` form.
- **Keep the `--vx-` prefix.** Renaming it costs every consumer and buys nothing.
- **The one known gap, and it is not theme-lab-only**: `VX.legendGap` / `VX.margin` / `VX.dotR` are
  frozen at module load from the level-0 snapshot and never re-derive from a `density` option, even
  through `createBasaltTheme`. `deriveSpacing`'s JSDoc has the full accounting.
- **Series color is consumer data.** `VX.series` is not in the framework: an app declares its own in
  one guard-exempt file via `defineSeries` → `seriesTokens`/`groupTokens` → `buildPaletteCss`. Every
  `defineX` factory follows ONE shape — `<const T extends Constraint>(spec: T): T`, exact-keyed, no
  widening annotation, no fluent builder, no accumulating config bag. A new factory matches that
  shape before it reaches the public surface.
- `theme-lab`'s `DeriveControls` is the DEV analog of the production path and faithful to it (same
  config through both halves of the theme), gated to dev builds at module scope so production pays
  no localStorage read. It merges the config DELTA, never a whole theme — a whole-theme merge would
  clobber the lab back to level 0 in one direction and eat consumer overrides in the other.

## Theme & provider invariants

- **The fill band.** A filled control does not invert across schemes, so its color must clear a white
  label AND stay visible on both pages. That pins every fill into one narrow luminance band: hue
  varies, luminance does not. Never fill with the ink accent — fill with `--vx-accent-fill` /
  `--vx-fill-{family}`. Retuning a fill outside the band fails `theme/contrast.test.ts`.
- **On-color in CSS, never in JS.** Mantine resolves a filled foreground once, scheme-blindly, by a
  brightness heuristic that does not track WCAG contrast. Basalt emits `--vx-on-{color}` per scheme
  and re-points every filled surface at it — including the seven components that bypass
  `variantColorResolver` and call `getContrastColor` themselves.
- **The surface system is strict**: Mantine components read raw ramp steps directly, so
  `cssVariablesResolver` collapses those steps onto the `--vx-surface-*` tokens. One border shade,
  one card background, one radius, across every component.
- **Depth is three tokens split control / panel / floating**, and focus LAYERS over the resting
  depth. `shadowRaised` is ring-free-outset on purpose: an outset ring paints in the color of
  whatever it is drawn over, so one value could not otherwise ride a fill, a tint and a panel alike.
  Depth is static — a hover lift and a materializing `subtle` shadow were both tried and reverted.
  `theme/border-coverage.test.ts` enumerates every `@mantine/core` component whose shipped CSS
  declares a border and requires it themed or allowlisted with a reason;
  `theme/shadow-surfaces.test.ts` requires every shadow site to name where its box's radius comes
  from, because the baked ring is drawn by that box's own corners.
- **`ThemeToggle` is tri-state** (Mantine's own toggle only flips two) with one sun/moon glyph —
  never a third monitor icon.

## Shell, homes and the control tier

- **`BasaltShell` is the single mount.** Every extension point is DECLARED DATA, not a `ReactNode`
  slot — `sections`, `globalActions: GlobalAction[]`, `sidebarBlocks: SidebarBlock[]`, `brand.menu`,
  `search.actions`, `settingsMenuItems`, `account` — because that is what lets basalt own the mobile
  projection (rail dot/ring, one kebab, one More-sheet row per block) instead of asking every
  consumer to re-derive it. Law C13, `../../docs/CONTROLS-SPEC.md` §2.3.
- **The router seam is ONE component**, `SidebarItem.Anchor` (a `NavAnchor`): basalt renders every
  pixel of chrome — desktop row, mobile slot, sheet row — and only hosts that component. No render
  callbacks anywhere; the breadcrumb's equivalent is `parentAnchor`.
- **The aside is a REGION a route claims, not a shell prop.** `BasaltShell` always renders an
  `AppShell.Aside`, zero-wide and `collapsed.desktop` until a page mounts `PageAside`, which claims
  it and publishes its fold back so the shell can size it (`docs/ASIDE-SPEC.md` §0, wave 1). Below
  `sm` and in a shell-less app the same ONE node renders in flow where the page wrote it — no
  portal, no fold chrome, no responsive twin (C9). Same claim/outlet/portal mechanism as `PageBar`
  row 1, one region over.
- **`PageBar` row 1 portals into the header; row 2 is in-flow and sticky**, publishing its measured
  height as `--basalt-page-bar-h` on `documentElement` behind a `height > 0` guard — a
  ResizeObserver fires once with a zero box while the element is still laid out, and publishing that
  zero is what collapsed a consumer's sticky offset mid-navigation. **No header height is React
  state**, and the header is one token tall on every viewport. An empty home renders nothing (C14).
- **Mobile nav is a TAB BAR, not a menu**, and `projectMobileNav` is a PURE projection: the surface
  is INFERRED from row count (0 drops the slot, 1 is a plain link, ≤ `menuMax` is a menu, more is a
  sheet). `menuMax` is arithmetic against the smallest supported viewport, which is why the menu runs
  `flip: false` and can never render below the fold.
- **Two mobile CSS facts that look like bugs**: `.bar` carries no `env(safe-area-inset-bottom)`
  because Mantine's `AppShell.Footer` rule already grows the box by it (the real gap is
  `--app-shell-footer-offset`, closed by `.mainSafeArea`); and the active indicator is a neutral
  ink pill behind the ICON only, never the identity accent, because a filled tab reads as chrome.
- **A home sizes its own SLOT, never its body.** Each home hoists a `MantineThemeProvider inherit`
  whose `components` default `size: 'ctl'` (`mergeMantineTheme` deep-merges, so the base `.extend()`
  vars survive) plus a `data-basalt-tier` attribute. `ChartCard` is the one exception and it is a
  boundary consequence, not an oversight: it lives inside the Mantine-free chart layer, so its
  `actions` slot carries only the tier attribute and the basalt controls there size themselves.
- Mantine's own `sm`/`xs` sizes are **not** re-pointed — a `size="sm"` in a modal keeps Mantine's
  height. The `ctl`/`icon` tiers reach Mantine through its own size system, and
  `theme/spacing.test.ts` greps every `getSize(size, '<prefix>')` / `getFontSize(size)` call in the
  components that matter and asserts each prefix has a `-ctl` declaration — a missing var (the
  `--button-padding-x-ctl` every draft omitted) fails the build rather than shipping a squashed
  button.
- **`SettingsRow.control` is law C1's THIRD home, the form row, and keeps Mantine's `md` tier.** It
  is deliberately absent from the slot set: a raw `Select` bound to a setting is right there, and its
  `size` prop is load-bearing. `settings-section.tsx` wraps `actions` in the ctl slot and never
  `control`.

## `QueryState` — the gap was correctness, not convenience

basalt owned both ends of the file (`EmptyState`, `toErrorMessage`) and nothing in between, so a
consumer wrote the four-way switch and got it wrong in the direction the shape suggested: `No images`
on a 500. Three invariants:

- **It is a component, not a hook.** The product IS the branch precedence, and a hook hands every
  call site the same switch back.
- **It lives in `src/dashboard/`, not `src/query/`** — `check-dist-layering.mjs` asserts
  `dist/query/index.js` reaches no `@mantine/*`, and this renders Mantine. `query` is typed as a
  five-field structural subset, so a composed or hand-rolled result passes with no cast; that subset
  removes the compiler, so `assertQueryStateLike` throws at runtime on a missing `isError` — which
  is precisely the "500 renders _No images_" bug.
- `errorTitle`/`errorFallback`/`errorAction` reach the **no-data** error branch only; the
  cached-data banner hardcodes its own copy. Don't document them as covering both.

## `BasaltDataTable` — the port got LONGER, and that is the finding

argo's three tables went 341 → 370–379 lines after adopting the shipped props. Column defs cost more
than bespoke rows when every cell is bespoke. **What the port buys is ownership, not brevity** — the
`type="native"` scroll footgun, alignment stated once instead of on both `th` and `td`, and
sorting/filtering/pagination no longer consumer-owned. Keep producing that number BEFORE selling a
prop as a line saving.

- `maxHeight`/`minWidth` render `Table.ScrollContainer type="native"`. Required, not preferred: a
  `ScrollArea` viewport is the positioning context a sticky `<thead>` resolves against, so the
  default type pins the header to the page viewport instead of the table's box. The escape-hatch lane
  is documented to use the identical node, so the two provably share one DOM.
- `meta.align` is a `ColumnMeta` augmentation (typo → tsc error, bad value → a throw naming the
  column); `meta.numeral` is read only as `!== false`, an opt-OUT.
- **`manualPagination` imposes a contract** on sorting, filtering and the count, and an unresolved
  one throws in dev and degrades to the honest table in production. Not silent, by design.
- Known, not shipped: `emptyState` renders inside a `<td colSpan>` counting the raw `columns` prop;
  no `emptyState="replace"`; no row selection or expansion.

## CLI

One bin, **named like the package** so `bunx basalt-ui` can never resolve a stranger (an unrelated
`basalt` exists on npm — never print `bunx basalt`): `init | sync | check-theme | check-coverage |
info | doctor | guard-hook | tokens:css | fonts:css | help`. Each subcommand's mechanics live in its
own JSDoc in `src/cli/index.ts`; what belongs here is the five properties that are easy to break:

1. **Nothing fails open.** `--version`/`-v` resolve before dispatch and print one greppable line;
   every subcommand validates its flags against `COMMAND_FLAGS` and exits 1 naming the first it does
   not accept (`doctor --json` used to run doctor and exit 0); an unknown COMMAND says so above the
   usage block rather than dumping help and reading like a choice.
2. **One resolver, announced.** `check-theme`/`doctor`/`sync` share `resolveProjectDir`:
   `BASALT_CWD` → cwd → declared workspace packages → a two-level descend → an **ascend** to the
   nearest ancestor carrying a basalt project, bounded by the repo root. Two candidates is reported
   as ambiguous, never guessed. Before the ascend existed, `check-theme` FABRICATED `roots: ["src"]`
   and reported the invention back under that name — 22 of 44 files scanned, exit 0, no note.
3. **`sync` refreshes; `init` creates.** `sync` exits 1 rather than scaffolding a second consumer,
   and the refusal runs BEFORE the `basalt.roots` backfill, which was half the damage. It also
   **prunes the rule/skill files a newer basalt no longer ships** (the derived namespaces are the
   only managed sets whose membership moves between versions), with the same three-way discipline as
   every other managed unit: untouched is deleted, locally edited is left and reported, `--force`
   finishes it, `--check` is red until it is applied.
4. **Every invocation the CLI EMITS goes through `basaltBinCommand()`** — the resolved local bin,
   falling back to `bunx` only when nothing resolves. `bunx` does not re-resolve a cached package,
   which is how a consumer filed a P0 against a 1.20.0 cache while pinned to 1.22.0.
5. **`--audit-allows` proves a waiver by re-running the scan with that one occurrence neutralized**,
   and exits 1 on a dead one. It judges plugin-rule waivers too, by re-running oxlint over one
   neutralized sibling file; where oxlint is unreachable the verdict is "cannot judge", never "dead".
   It prints the SCOPE it audited, because `0 dead` is not `0 dead anywhere` — that is exactly the
   claim standing in the wrong directory used to buy.

Two guard-scan invariants worth holding: **`profile: 'tokens-only'` must be DECLARED, never
inferred** (inferring from a missing `@mantine/core` would silence the Mantine-remedy kinds on any
repo keeping Mantine in a sibling package) while `doctor` DOES infer it, because its profile only
changes which advice it prints — the asymmetry is the safety property. And **basalt-emitted CSS is
skipped per LINE, not per file**: the canonical two-line `@generated` header earns the file nothing
more than a chance, and then each line has to be a basalt custom property, a selector, a `}` or a
self-closing comment. Whole-file marker trust was forgeable twice over.

## Guards — shipping a stricter one

**A change that makes the guard reject code it previously accepted ships `warn` for one minor, then
promotes to `error`.** The justification is specific: majors are banned here, so a consumer has no
semver channel telling them enforcement tightened, and the guard is the one part of basalt that can
hard-fail their build.

- Mechanically: a `{ since, promote, why }` entry in `GRACE_PERIOD_KINDS` (guard kinds,
  `src/guard/index.ts`) or `PLUGIN_RULE_GRACE` (oxlint rules, exported beside the plugin in
  `configs/oxlint-plugin.js` — it cannot live in `oxlint.json`, whose top-level keys are fixed by
  oxlint's parser). **Deleting the entry IS the promotion**, and it belongs in its own commit.
- **The promise is machine-checked** (law C16): `grace.test.ts` and `oxlint-plugin.test.ts` fail the
  build once `package.json`'s version reaches an entry's `promote` while it is still there, assert
  `since` precedes `promote`, and assert the ledger against the shipped preset in BOTH directions.
  Before that gate existed, five kinds sat at `warn` for five minors. **Those tests read the version
  already PUBLISHED**, so `scripts/release.sh` runs `scripts/check-grace.ts` against the version the
  dry run COMPUTED and refuses to cut it while an entry is due — without that half the gate can only
  go red on the first push AFTER the release that shipped the due entry (`release.yml` runs no tests
  and the `chore: release … [skip ci]` commit skips CI).
- **A rule that may never promote belongs in `PLUGIN_RULE_ADVISORY`** (`{ since, why }`, no
  `promote`, C16 skips it). `shadow-basalt-export` is the one entry: a name collision is evidence a
  component was forked, not proof, and renaming the fork defeats the check.
- **A rule the current minor WIDENS does not promote in that minor** — widening restarts the grace.
  Narrowing restarts nothing.
- **Catching a new FORM means a new rule id.** A level is per-id, so widening an existing `error`
  rule would land the new form as `error` with no grace at all.
- **A `SCANNABLE_EXT` widening is outside the mechanism, by design** — the ledger is keyed per KIND
  and a file-set widening widens all of them at once. Measure the incumbent violations across every
  consumer and widen at `error`; if the count is nonzero, fix them.
- **A rule whose OWN doc comment states its level states it in one place, in one form.** Each rule
  carries a single `// Ships: error` / `// Ships: warn (grace → 1.30.0)` / `// Ships: warn
(advisory)` / `// Ships: repo-local only` line directly above its `const`, and
  `oxlint-plugin.test.ts` asserts every one against `oxlint.json` and the two ledgers. The C16 gate
  could not catch the drift it replaces — the ledger is asserted against the preset, and a prose
  comment is outside the ledger, so `raw-size-literal` spent several minors telling readers it
  shipped `warn` while the preset said `error`.
- **A relaxation needs no entry.** `inline-display`/`raw-html-layout` no longer fire inside
  `src/charts/**` because both remedies name a Mantine primitive the boundary already forbids there,
  so the finding was unactionable and the only fix was a waiver written inside the directory the
  boundary protects. That change also deleted basalt's own self-exemption for both kinds — basalt
  passes `check-theme` for the same reason a consumer does, not because it silenced itself.

## Deprecation lifecycle — an export leaves over one minor, never over a major

Majors are banned, so a version number can never tell a consumer a name went away. The sunset runs
through four artifacts instead, and all four land in the SAME commit:

1. **The export stays shipped**, `@deprecated` in its JSDoc, delegating to the replacement.
2. **A row in `DEPRECATED_EXPORTS`** (`configs/oxlint-plugin.js`) — `{ subpath, name, replacement,
removeIn }`, plus `prop` when what is deprecated is a JSX attribute rather than a named export.
   `basalt/deprecated-export` reads it and nudges every import and every prop, with an autofix on
   the import rename that keeps the LOCAL binding (`{ inputProps as field }`), so no call site has
   to move in the same edit.
3. **A `MIGRATING.md` row** under `## Unreleased`, naming the replacement and the `removeIn` minor.
4. **A `removeIn` at least one minor out**, pinned by `oxlint-plugin.test.ts`. Deprecating in 1.28.0
   means removing in 1.29.0 at the earliest.

`basalt/deprecated-export` is **permanently `warn`** (`PLUGIN_RULE_ADVISORY`), and that is the whole
difference between this mechanism and the grace one above. A grace entry promotes because the code
it reports is wrong; a deprecation reports code that is _correct until a date_. Failing a build over
a schedule is exactly what the no-majors doctrine exists to avoid — enforcement arrives when the
export stops existing, not when this rule changes level.

**Removal is its own commit**, and it deletes the row, the export and the `@deprecated` JSDoc
together while the `MIGRATING.md` row stays forever.
`oxlint-plugin.test.ts` scans every `src/**/index.ts(x)` barrel for a JSDoc `@deprecated` with no
ledger row, so the published half cannot be forgotten; a deprecation written deeper in the tree is
on the author.

The plugin itself (`configs/oxlint-plugin.js`, alpha `jsPlugins`) ships inside `configs/` and is
wired by the shipped preset, so a consumer inherits it by extending. **Read the rule list and the
promotion state there, never from prose here.** Five things about it that are not obvious:

- **The control guards share ONE ancestry walk** (`createSlotContext`) that stops at a slot
  ATTRIBUTE, never at the element — so a control in a TIERED home's CHILDREN (the body form) never
  fires, while a hoisted `const pills = <Select/>` handed to `filters={pills}` does. The SUBTREE
  homes are the mirror image and take the same hoisted hop: a `const rows = <SelectFilter/>`
  rendered as `<PageAside>{rows}</PageAside>` is inside that aside. That is why the ancestry facts
  are captured during the visit and resolved at `Program:exit`.
- **The owner exemption needs a second half**: a file DEFINING `PanelRow`/`EnumFilter`/
  `SliderControl` is exempt only when it imports nothing from `basalt-ui*`. basalt's own control
  sources import each other relatively; a consumer of basalt always names the package, so one local
  `function PanelRow` can no longer switch three rules off for a whole consumer file.
- **A BOUND control's homelessness is a different rule from a raw one's**, and deliberately a
  different ID: `control-outside-home` matches `@mantine/*` tags, `bound-control-outside-home`
  matches `basalt-ui`-imported ones. Both read the same three SUBTREE homes — `FilterSet`,
  `PageAside`, `PanelRow`, where the children ARE the home, provenance-gated because `PanelRow` is
  an ordinary name for a consumer's own helper — and the bound one is the only control rule with no
  text-lane twin in `src/guard`, because a bound control's name carries no provenance a 12-line
  regex window could read. Splitting rather than widening is C16 mechanics: a
  level is per-id, so widening would have shipped the new form at the old rule's level with no
  grace, and widened it mid-grace besides.
- **The raw-filter rules gate on the tag's `@mantine/*` IMPORT, not its name** — a consumer's own
  `Select` is not Mantine's, and an ALIAS (`Select as MantineSelect`) or a namespace (`M.Select`)
  resolves through the local→imported map, because the wrapper case is exactly the one the
  provenance test exists for. **The HOME tag is gated the same way**, against `basalt-ui`/
  `basalt-ui/*` (plus a relative import inside basalt's own `src/`, or the dogfood surface goes
  silent): a consumer's own `Section`/`PageBar` is not a tiered home. The chart tag rules are
  provenance-gated the other way: a tag is skipped only when the file DEFINES a component of that
  name and does not also import it from basalt, which keeps a barrel-wrapping consumer covered.
- **`in-body-page-title` is the one id in BOTH registries** (a guard kind and a plugin rule), so one
  `theme-allow in-body-page-title` waives both lanes. `oxlint-plugin.test.ts` pins that.
- The three boundary rules honour **no** escape hatch, and the agent-chat rules honour
  `basalt-agent-allow` rather than `theme-allow`. The two annotation parsers must agree on what an
  annotation IS and may differ only on which rules each can judge — the grid is GENERATED from the
  four axes that vary and pinned row for row in both test files (37 + 8 supported/unsupported in the
  guard, 32 + 8 in the plugin; five rows are dialects only the guard scans). Asserting the
  unsupported cells is the point: it stops "unsupported" and "silently broken" reading the same.

## Shipping a rendering change — what a minor may move

Majors are banned, so the version number can never warn a consumer their charts will look different.

- **A change that moves rendering for EVERY chart ships as an opt-in prop defaulted to the OLD
  behaviour.** `AxisConfig.nice` is the reference case.
- **A change that moves rendering only for charts passing a specific opt-in prop, AND restores a
  documented law, may ship as a plain `feat:`** — with the measured before/after in the commit body
  and a named opt-out. `autoMaxFloor`'s clamp order is the reference case.
- The line is **blast radius plus correction-vs-preference**, not how much better the new behaviour
  is.
- **A rewrite that reimplements an existing law pins that law with a test BEFORE the rewrite.**
  `autoMaxFloor` was clamp-then-pad, the `CartesianChart` rebuild made it pad-then-clamp, and nobody
  noticed for two minors because only the padding's sign-safety had a test. `padAutoLower` came
  through the same rebuild unchanged precisely because its law WAS pinned.

## The agent layer

`agent/**` ships in the tarball and is placed into a consumer's `.claude/` by `init`/`sync` — Claude
Code cannot load rules or skills from `node_modules`, which is the only reason anything is copied.

- **Six rules, three skills, two templates**, with budgets enforced by `check-coverage`: rules
  ≤1,050 lines total (tokens 160 / mantine 180 / charts 140 / state 160 / controls 185 /
  batteries 220), skills ≤100 each, `CLAUDE-block.md.tpl` 40, `DESIGN.md.tpl` 45. Thirteen files
  carried 4,177 lines, 55% of it unguarded, with the identity paragraph restated six times.
- **Every rule file opens with a GENERATED `<!-- basalt:coverage -->` block** —
  `basalt-ui check-coverage --write` renders it from `SURFACES` (the union over every surface sharing
  that `rule`), `--check` is the CI gate, and a block that DISAGREES is a hard failure. `not guarded`
  is printed even when empty, because a rule claiming full coverage is a claim someone can check.
- **Say each thing once**: the identity and the `theme-allow` grammar live in `basalt-tokens.md`, the
  precedence in `CLAUDE-block.md.tpl`, the overlay mount in `basalt-mantine.md`, the Eden footguns in
  `basalt-batteries.md`. The guard-kind list lives nowhere — the generated headers carry it.
- **No API reference, no version history, no incident narrative in a rule.** Those belong in JSDoc /
  `llms.txt`, `CHANGELOG.md` / `MIGRATING.md`, and `../../docs/ARGO-MIGRATION-LEARNINGS.md`.
- **No hex and no pixel constant in a rule.** The palette and the spacing scales are derived from a
  config a consumer may move, so a literal in prose is a value that can go stale silently.
- `scripts/check-agent-doc-drift.ts` runs in CI: a bolded-backtick name must be a real export, a
  removed API is denylisted outright (and the denylist itself is asserted still-removed), and the
  tokens-only kind COUNT is checked against `TOKENS_ONLY_DISABLED_KINDS` across every doc in the
  repo, because that number was stated by hand in eight of them and shipped stale.

## Development guidelines

- Strict TS, no `any`, explicit types on public exports; typed object params, low nesting, early
  returns. Function components only; no `React.FC`, no default exports.
- Respect the Mantine-free boundary and the `@visx/*`-only-in-charts rule.
- Don't reintroduce Tailwind, OKLCH foundation palettes, ShadCN/Tremor/Starlight compat, or any
  `import.meta.env` reference in shipped code.
- When extending the public API, keep it grounded in the consumer need that drove it, and update
  `src/surfaces.ts` + this file in the same commit.
