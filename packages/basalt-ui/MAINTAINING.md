# Basalt UI — Maintaining

The maintainer invariants file for the package. Lives in the repo only — it is not in `files`, so it never
ships in the tarball. The repo-root `AGENTS.md` is the monorepo file; `AGENTS.md` next to this one is the
shipped consumer quick reference.

The only published package (npm: `basalt-ui`). An opinionated framework for React apps on Base UI, Tailwind 4 and TanStack
Charts: `BasaltProvider` (`basalt-ui`, re-exported by `basalt-ui/router`), an app shell with a page bar and a
control tier, a TanStack Charts chart system, a three-tier `--basalt-*` token system, a Vite preset,
raw toolchain presets, and the `basalt-ui` CLI.

This file is **invariants and footguns** — the things that are load-bearing and not obvious from the
code. Mechanics live where they can't drift: **API shape → the JSDoc on the export**; **subpath map →
`llms.txt` + `AGENTS.md`**; **current state → `../../docs/STATUS.md`**; **what broke → `MIGRATING.md`**;
**consumer doctrine → `agent/rules/*.md`**. Don't restate any of those here.

## Published surface

Named exports only — **no default exports**. Files `kebab-case`, components `PascalCase`.

| Subpath        | UI?          | Owns                                                                                                                                                                |
| -------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.`            | ui           | the state seams (`persisted`, `notify`, `createChannel`, `externalField`, `useNow`, `createFormat`)                                                                 |
| `./charts`     | **headless** | `CartesianChart` + the `Lines`/`Bars`/`Sparkline`/`Heatmap`/`BandStrip`/`IntervalTrack` kinds, `ChartCard`, `chartCursor` — no token, formatter or engine re-export |
| `./tokens`     | **headless** | `BASALT`, `alpha`, `BP`/`p`, `buildPaletteCss`, `seriesTokens`, `groupTokens`                                                                                       |
| `./controls`   | headless     | the control tier: `FilterSet` over `spec(...)`, `ViewTabs`, `ControlView`, `ControlHome`, `filterSlot` and the v3 forms                                             |
| `./table`      | headless     | `col<Row>()` kind columns, `useDataTable`, `DataTable` and its parts, `tableCodec`                                                                                  |
| `./content`    | ui           | `Prose`, `Markdown`, `CodeBlock`, `MermaidDiagram`, MDX map                                                                                                         |
| `./vite`       | —            | `basalt()` (gates, sources.css, head/PWA)                                                                                                                           |
| `./styles.css` | —            | `@layer basalt` base styles, the iOS input floor, the font stack — mandatory import                                                                                 |
| `./configs/*`  | —            | raw toolchain presets (real paths — `extends` needs them)                                                                                                           |

**2.0:** 15 published subpaths (V2-SPEC § 1), plus the v3 subpaths added since; `./forms`, `./commands`, `./agent` and `./state` were deleted in 3.0 with the 2.x runtime (`removed-2x.json` names each export); `./guard`, `./data/virtual`,
`./llms.txt` and `./package.json` are no longer exports. **C1 (1.29.0):** `./query`, `./connectivity` and bare `./data` were dropped — 26 published subpaths
→ 20. `utils/`+`motion/`+`query/error-message` merged into `src/common/`. The 2.x view layer (`src/dashboard/`, `./controls-dates`, the 2.x files of `./charts`, `./table`, `./controls`, `./shell` and `./content`) was deleted in 3.0; `migrations/areas/removed-2x.json` names each export. Full symbol mapping:
`MIGRATING.md` § 2.x to 3.0.

`src/surfaces.ts` is the SSOT behind that table, `llms.txt`, `AGENTS.md`, the oxlint boundary globs
and the doctrine triad; `check-coverage` and `tests/{surfaces-coverage,agents-sync,llms-sync}.test.ts`
fail on any drift. Add a subpath there first, or the gates will tell you.

## Common primitives (`src/common/**`)

The prop, ref, message and validation vocabulary every component shares. **Not a subpath** — the
pieces are re-exported from the root barrel, because `BasaltProps` is the base a consumer's own
props extend and `src/surfaces.ts` stays the SSOT for real subpaths.

- **Every component's props type extends `BasaltProps`** (`className` + `style`, both spelled
  `| undefined` because `exactOptionalPropertyTypes` is on). The isomorphic harness first counted 98
  of 123 exports dropping `className`; six adopter waves closed most of it, down to 37 of 125 (18 of
  those real gaps, the rest providers/SVG marks/portal targets). The `NO_CLASSNAME` ledger in
  `tests/isomorphic/props.tsx` ratchets in both directions, so adopting it means DELETING that
  component's entry.
- **`className` + per-slot `classNames`, and nothing else** — no `styles`, no `vars`. basalt does
  not spread `...rest` onto the DOM (which is why the harness saw zero unknown-attribute warnings),
  and a composite that paints more than one box declares its slot union instead:
  `SlotStylesProps<'root' | 'header' | 'body'>`. `Section` is the reference adoption.
- **The validate idiom is two functions, and the split is the point.** `assertRequiredProps` THROWS
  in every build, before the component reads into the prop — that is the F-ERR-1 remedy. F-ERR-1
  originally named 54 call sites failing as a raw `TypeError` swallowed by `BasaltErrorBoundary`
  (only `QueryState` named itself); six adopter waves remedied 33 of them, leaving 22 still raw —
  chart primitives (since replaced by the TanStack Charts rung) and three misses
  (`OverflowMenu`, `ThreadDetailPanel`, the third-party `QueryClientProvider` re-export). `useValidateProps` is dev-only, `console.error`s each message ONCE per
  `(component, message)`, and constant-folds away in production. A misuse that would crash anyway
  throws; one that merely renders the wrong thing warns. `FilterSet` and `Section` are the two
  reference adoptions.
- **Every message is built in `common/errors.ts`** — `requiredProp` / `oneOf` /
  `duplicateMount` over one `BASALT_PREFIX`, so consumers can grep `[basalt] <Component>:`.
- **The module imports no UI framework and is `@visx`-free** (the test keeps the `@visx` ban as a tripwire for a stray import), enforced twice: a `no-restricted-imports`
  override in `.oxlintrc.json` (repo-local, like `state`/`query`/`guard`) and
  `src/common/boundary.test.ts`, which also forbids a VALUE import reaching outside `common/` or
  `utils/`. That is what lets `./charts` and `./tokens` reach `cx`/`mergeRefs` without breaching the
  layer boundary. `Tier` is re-exported from `widget-header` **type-only**, so it emits no runtime
  edge into the UI half.
- `Tone`/`ToneWithNeutral` is the ONE status vocabulary. Forks exist (`SidebarBlockTone`
  byte-identical; `AccountBadgeTone`, `NotificationIntent`
  differ) — an adopter ALIASES its fork to this type; nothing gets renamed out from under a
  consumer.

## Layering: UI vs headless

- `src/charts/**` and `src/tokens/**` import no UI framework. The chart engine is
  `@tanstack/charts` `~1.5.0` (+ `d3-scale` `^4.0.2`, optional peers, subpath-required for
  `./charts`); `@visx/*` is banned everywhere. `src/charts/**` imports only `@tanstack/charts/*`,
  `d3-scale`, `react`, `../tokens`, `../format/{shared,number}` and `../common`. `@visx/*` is banned
  in basalt's own source and `@tanstack/charts/react` stays inside `src/charts/host.tsx`, the single
  importer of the engine's DOM host: both are `no-restricted-imports` overrides `scripts/gen-oxlint.ts`
  projects from `SURFACES` into `/.oxlintrc.json` (the host file's own block comes last). Consumers get
  the same boundary from `basalt/import-boundary` in the v3 presets.
- It protects two things. **Layering**: `tokens` is pure data that the generated stylesheet and the
  chart layer both read, so an import the other way cycles through the token layer or lets a chart
  fork chrome and charts apart.
  **Packaging**: `./charts`/`./tokens` resolve with **no UI framework installed** — CI-tested by
  `scripts/check-dist-layering.mjs` (dist-graph walk) and `scripts/pack-test.sh` (scratch install +
  SSR render).
- **The root barrel does not re-export `./tokens` / `./charts`.** It keeps the arrow pointing one
  way, and it means a charts-only consumer never pulls the app layer in by importing the root.
- `motion` is framework-agnostic, so `src/motion` is importable from both halves.
- `src/core/list` is the one part of `src/core` on Base UI: the list engine `Select`, `Combobox` and the
  palette share imports `@base-ui/react`, cva and `ui/avatar`, because an ejected seed reaches
  shared code only through `../core/<path>`. The exception is declared in `docs/v3/ARCHITECTURE.md`
  § 1; no other `src/core` module takes a peer but react.
- `./controls` resolves with only its own peers: `check-dist-layering.mjs` walks the built graph and
  `pack-test.sh` renders one with every other peer absent.

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

1. `bin/basalt-ui.mjs` imports `../dist/cli/index.js`, so `lint` / `doctor` validate the last
   BUILD. After touching `src/lint/**` or `src/cli/**`, build before trusting them — and
   `bun run pre`'s `lint` loads `basalt-ui/lint` from `dist`, so a stale `dist` can make `pre` green
   over source it never read.
2. `apps/playground/tsconfig.json` declares no `paths`, so its `tsc` resolves `basalt-ui/*` through
   node_modules → `exports` → `dist/**/*.d.ts`, while Vite aliases the RUNNING playground to `src/`.
   A new export or a widened signature is invisible to `bun run typecheck` until you build.
3. The playground runs its scripts from `src/`, but its stylesheets (`basalt-ui/*.css`) and the
   graph `basalt()` reads for `.basalt/sources.css` come from `dist/`: after a change to a package
   stylesheet or to the classes a part writes, build before trusting the playground. **The pack-test
   is what proves the published artifact resolves** — it is the dist gate, and it runs in CI.

## Dependencies

- **`dependencies` are the three variable fonts plus `clsx`, `class-variance-authority` and `eventsource-parser`.** `bun add basalt-ui` with no peers pulls those and nothing else (`tests/layout/one-look/tokens-install.layout.test.ts` holds the exact set).
- **Every peer is `optional` in `peerDependenciesMeta`** — no peer is required, `react` included —
  because npm expresses optionality per PACKAGE and never per SUBPATH, and `./tokens`/`./charts`
  really do resolve without them. The trade: a missing peer is a bundler
  resolution error instead of an install warning. Version-mismatch warnings are unaffected and must
  stay that way, so every peer stays listed in `peerDependencies` (`tests/required-peers.test.ts`
  pins both halves).
- **Peers are ranged by how tightly basalt is coupled to them** (`tests/peer-table.test.ts` checks the table below against `peerDependencies`, class by range shape):
  - **stable**: a caret from the tested floor (`^4.3.5`), for a package used through its public API only. A consumer ahead of the floor in range is met by `doctor`, which checks the declared range and not equality.
  - **coupled**: a tilde (`~1.9.0`), for a package whose data attributes, row model or engine marks basalt reads; a minor can move them.
  - **pinned**: exact, for 0.x and alpha tooling, with the reason in the table.
    `oxlint` is declared as an optional peer and `peerDependencies` is the one source of its pin: `gen-oxlint` writes it into the presets and `init` installs it at that pin. A scheduled job (`.github/workflows/newest-peers.yml`) installs the newest in-range version of every peer and runs the unit and pack tests; it reports and never gates a pull request. The three `@fontsource-variable/*` dependencies are exact. `remend` is `./content`'s one eagerly-imported peer.

<!-- peers:begin -->

| Peer                                | Class   | Range         | Reason                                                                                    |
| ----------------------------------- | ------- | ------------- | ----------------------------------------------------------------------------------------- |
| `@astrojs/react`                    | stable  | `^7.0.1`      | Astro integration used by the site profile; basalt reads no internals                     |
| `@atlaskit/pragmatic-drag-and-drop` | stable  | `^4.0.0`      | public drag API only                                                                      |
| `@axe-core/playwright`              | stable  | `^4.14.0`     | public test helper API                                                                    |
| `@base-ui/react`                    | coupled | `~1.9.0`      | data attributes and slot structure that the primitives style                              |
| `@shadcn/lint`                      | pinned  | `0.2.5`       | 0.x; a patch can add findings, and the preset names the rules                             |
| `@shikijs/langs`                    | stable  | `^4.5.0`      | public grammar bundle                                                                     |
| `@shikijs/themes`                   | stable  | `^4.5.0`      | public theme bundle                                                                       |
| `@tailwindcss/vite`                 | stable  | `^4.3.5`      | public plugin API                                                                         |
| `@tanstack/charts`                  | coupled | `~1.5.0`      | engine marks and scale internals under the chart kinds                                    |
| `@tanstack/react-form`              | stable  | `^1.33.0`     | public API                                                                                |
| `@tanstack/react-hotkeys`           | pinned  | `0.27.1`      | 0.x API, no stability promise                                                             |
| `@tanstack/react-query`             | stable  | `^5.104.0`    | public API                                                                                |
| `@tanstack/react-router`            | stable  | `^1.170.0`    | public API                                                                                |
| `@tanstack/react-router-devtools`   | stable  | `^1.166.13`   | dev panel, public API                                                                     |
| `@tanstack/react-table`             | coupled | `~9.3.1`      | row model and column internals under `DataTable`                                          |
| `@tanstack/react-virtual`           | stable  | `>=3.14.0 <4` | public API; the range excludes the next major                                             |
| `ai`                                | stable  | `^7.0.137`    | public chat API                                                                           |
| `astro`                             | stable  | `^7.3.8`      | integration hook and `astro:assets` only                                                  |
| `d3-scale`                          | stable  | `^4.0.2`      | public scale API                                                                          |
| `motion`                            | stable  | `^14.1.0`     | public animation API                                                                      |
| `oxlint`                            | pinned  | `1.93.0`      | JS plugin API is alpha and outside semver, so the preset and its rules sit on one version |
| `pele`                              | stable  | `^1.13.0`     | public API                                                                                |
| `postcss-html`                      | stable  | `^2.0.0`      | public stylelint syntax                                                                   |
| `react`                             | stable  | `^19.3.0`     | React 19 public API                                                                       |
| `react-day-picker`                  | stable  | `^10.0.2`     | public API                                                                                |
| `react-dom`                         | stable  | `^19.3.0`     | React 19 public API                                                                       |
| `react-markdown`                    | stable  | `^10.1.0`     | public API                                                                                |
| `react-resizable-panels`            | stable  | `^4.22.1`     | public API                                                                                |
| `rehype-sanitize`                   | stable  | `^6.0.0`      | public API                                                                                |
| `remark-gfm`                        | stable  | `^4.0.1`      | public API                                                                                |
| `remend`                            | stable  | `^1.4.0`      | public API                                                                                |
| `shiki`                             | stable  | `^4.5.0`      | public highlighter API                                                                    |
| `stylelint`                         | stable  | `^18.0.0`     | public config and plugin API                                                              |
| `tailwindcss`                       | stable  | `^4.3.5`      | public theme and utility API                                                              |
| `vite`                              | stable  | `^7 \|\| ^8`  | public plugin API; two majors are tested                                                  |
| `vite-plugin-pwa`                   | stable  | `^1.3.0`      | public plugin API                                                                         |

<!-- peers:end -->

- **NO** zustand, **NO** `@tanstack/*` as a dependency, **NO** icon package — icons are `ReactNode`.
- `sideEffects: ['*.css']`.

## Token system — the derived palette

Three tiers: **palette data** (pure data, zero React/DOM) → **`--basalt-*` CSS variables**
(resolution is pure CSS, so a scheme flip restyles everything with no re-render) → **`BASALT.*` refs**
(just `var()` strings plus non-color sizing constants, so they work outside components).

- **The shipped palette is GENERATED, not hand-authored.** `tokens/derive.ts` computes the accent
  family, the categorical fills, the surface stops, the ink ramp and the status solids from
  `DEFAULT_DERIVE_CONFIG`; `tokens/palette.ts` builds them once at module load. **Never hand-edit a
  palette hex** — retune the config or the calibrated constants. `derive.ts`/`hct.ts` are themselves
  exempt from the `raw-hex` guard because they ARE the source. Structural, non-derived tokens
  (shadows, the overlay surface, dividers, the raw hue ramps) stay hand-authored.
- **Four config dimensions, ONE entry point**, and never a second config surface: `derive` is one
  accent seed plus five bounded knobs; `fonts` is the only route to the `--basalt-font-*` vars;
  `radius` and `density` are integer LEVELS over a law (`deriveRadius` / `deriveSpacing`), with
  level 0 pinned to the shipped values.
- **Density is a multiplier with named exceptions, and the exceptions are the interesting part**:
  `SPACE_FIXED` structurals are exempt by design, the 4px stack rhythm rebuilds from one shared unit
  so its 2:1 pairs survive every level, several touch targets carry hard floors (mobile bar and row,
  the sidebar search trigger, `touchControlHeight`) because the law would take them below the
  minimum target.
- **Keep the `--basalt-` prefix.** Renaming it costs every consumer and buys nothing.
- **The one known gap**: `BASALT.legendGap` / `BASALT.margin` / `BASALT.dotR` are
  frozen at module load from the level-0 snapshot and never re-derive from a `density` option.
  `deriveSpacing`'s JSDoc has the full accounting.
- **Series color is consumer data.** `BASALT.series` is not in the framework: an app declares its own in
  one guard-exempt file, `src/basalt.tokens.ts`, which `tokens:css --extra` emits as `--basalt-<group>-<key>`
  (`groupTokens` mints the refs). `buildPaletteCss({ groups })` is internal. Every
  `defineX` factory follows ONE shape — `<const T extends Constraint>(spec: T): T`, exact-keyed, no
  widening annotation, no fluent builder, no accumulating config bag. A new factory matches that
  shape before it reaches the public surface.
- **The fill band.** A filled control does not invert across schemes, so its color must clear a white
  label AND stay visible on both pages. That pins every fill into one narrow luminance band: hue
  varies, luminance does not. Never fill with the ink accent — fill with `--basalt-accent-fill` /
  `--basalt-fill-{family}`. The derivation holds the band; `src/tokens/invariants.test.ts` asserts the
  `on-brand` contrast against `brand-fill` per scheme.
- **On-color in CSS, never in JS.** Basalt emits `--basalt-on-{color}` per scheme and every filled
  surface reads it; no component resolves a foreground in JS.
- **Depth is three tokens split control / panel / floating**, and focus LAYERS over the resting
  depth. `shadowRaised` is ring-free-outset on purpose: an outset ring paints in the color of
  whatever it is drawn over, so one value could not otherwise ride a fill, a tint and a panel alike.
  Depth is static — a hover lift and a materializing `subtle` shadow were both tried and reverted.

## Shell, homes and the control tier

The 2.x shell (`BasaltShell`, `PageBar`, `PageAside`, `projectMobileNav`, the sidebar and
mobile-nav modules) and the 2.x control tier (`FilterSet` children, `SettingsRow`, the `ctl` size
slots) were deleted in 3.0; their invariants went with them. The v3 shell, homes and controls are
specified in `../../docs/v3/ARCHITECTURE.md` and its concepts, and their maintainer-facing
properties live in the JSDoc of `src/shell/index.ts`, `src/page` and `src/controls`, where the
guards that hold them are named.

## CLI

One bin, **named like the package** so `bunx basalt-ui` can never resolve a stranger (an unrelated
`basalt` exists on npm — never print `bunx basalt`): `init | sync | doctor | lint |
tokens:css | fonts:css | help` (C2, 1.29.0: `info` is gone — nothing published it
depended on; `check-coverage` moved to `bun scripts/check-coverage.ts`, a repo-internal script, not
a CLI subcommand). Each subcommand's mechanics live in its own JSDoc in `src/cli/index.ts`; what
belongs here is the properties that are easy to break:

1. **Nothing fails open.** `--version`/`-v` resolve before dispatch and print one greppable line;
   every subcommand validates its flags against `COMMAND_FLAGS` and exits 1 naming the first it does
   not accept (`doctor --json` used to run doctor and exit 0); an unknown COMMAND says so above the
   usage block rather than dumping help and reading like a choice.
2. **One resolver: `BASALT_CWD` → cwd, and a declared `basalt.roots` — nothing inferred** (C2
   deletes the two-level descend and the ascend-to-nearest-ancestor fallback `doctor`/`sync` used
   to share). Two candidates is reported as ambiguous, never guessed. The pre-C2 ascend existed
   because the 2.x text guard used to FABRICATE `roots: ["src"]` and report the invention back under
   that name — 22 of 44 files scanned, exit 0, no note; the fix is a declared root, not a smarter
   guess.
3. **`sync` refreshes; `init` creates.** `sync` exits 1 rather than scaffolding a second consumer,
   and the refusal runs BEFORE the `basalt.roots` backfill, which was half the damage. It also
   **prunes the rule/skill files a newer basalt no longer ships** (the derived namespaces are the
   only managed sets whose membership moves between versions), with the same three-way discipline as
   every other managed unit: untouched is deleted, locally edited is left and reported, `--force`
   finishes it, `--check` is red until it is applied.
4. **Every invocation the CLI EMITS runs the resolved local bin**, never `bunx`. `bunx` does not
   re-resolve a cached package, which is how a consumer filed a P0 against a 1.20.0 cache while
   pinned to 1.22.0. The bin runs under Node 22.18 or newer (the first with type stripping on by default, which loading
   `basalt.tokens.ts` needs) and under Bun (`engines.node`): `node:`
   built-ins only, no `Bun` global on any CLI path, because `init` installs with npm, pnpm or yarn
   and the edit hook runs the bin on every edit. A fix-it line renders its install command from the
   lockfile (`src/cli/package-manager.ts`).
5. **A block is copied once and merged after.** `add` installs `blocks/<name>/` into the app and
   records an `origin: 'block'` row beside the eject rows; `sync` merges each file three ways
   (`src/cli/sync/blocks.ts`). `add` never overwrites a file: the shadcn registry's
   `add --overwrite` lost four of four edits (primitives-distribution section 8). A block imports
   only published specifiers, so the installed bytes are the shipped bytes; `src/cli/add/blocks.test.ts`
   holds that. **Promotion rule:** a block that two consumers run unchanged is promoted to a
   composite on an npm subpath, and the block is retired.
6. **What `init` writes, `sync` refreshes and `doctor` checks.** Beside the agent files, `sync`
   renders the hook shim, the basalt entries of `.claude/settings.json` (spliced in, every other
   byte kept) and each token sheet the manifest records (`renderInstallUnits`), so a fix to any of
   them reaches every install on its next `sync`. `manifest.json` and `budget.json` carry
   `format`; a change to a key's shape bumps it and adds a step to `MIGRATIONS` in `manifest.ts`
   (or the budget's reader), and `sync` rewrites the older file. The pre-edit guard refuses a hand
   edit of the CLI-owned manifest keys (`CLI_OWNED_KEYS`) and passes the consumer's.
7. **Eject is experimental in 3.x.** Its on-disk format (the header line, the `ejected` row, the
   seed digest the build checks) may change in a minor; its help, `docs/eject.md` and the usage
   line say so.

## Guards — shipping a stricter one

**A change that makes a lint rule reject code it previously accepted ships `warn` for one minor, then
promotes to `error`.** The justification is specific: between majors (see [Major lines](#major-lines)) a
consumer has no semver channel telling them enforcement tightened, and lint is the one part of
basalt that can hard-fail their build.

- Mechanically: the level of a shipped rule is the preset's, generated from the rule table
  (`src/lint/rule-table.ts`, `src/lint/preset.ts`, `scripts/gen-oxlint.ts`), so a stricter rule ships
  `warn` in the preset first and promotes in its own commit. No rule is in a grace minor today: the
  2.x plugin's `PLUGIN_RULE_GRACE` ledger retired with it, and `scripts/check-grace.ts` still takes any
  ledger (`scripts/release.sh` runs it against the version the dry run COMPUTED). The release gate
  exists because the test-time half reads the version already PUBLISHED, so it can only go red on the
  first push AFTER the release that shipped a due entry (`release.yml` runs no tests and the
  `chore: release … [skip ci]` commit skips CI). Restore a ledger from git when the first entry needs one.
- **A rule the current minor WIDENS does not promote in that minor** — widening restarts the grace.
  Narrowing restarts nothing.
- **Catching a new FORM means a new rule id.** A level is per-id, so widening an existing `error`
  rule would land the new form as `error` with no grace at all.
- **A `SCANNABLE_EXT` widening is outside the mechanism, by design** — the ledger is keyed per KIND
  and a file-set widening widens all of them at once. Measure the incumbent violations across every
  consumer and widen at `error`; if the count is nonzero, fix them.

## Frame value types

`basalt-ui/cards` owns the types every frame part shares: `Phase`, `QueryStateLike`, `Empty`,
`FrameState`, `CardMenu`, `MenuEntry`, `Delta`, `Verdict`, `Tone` (the six-member port type) and
`FootFacts`. They are re-exports of `core/ports` and `core/phase`, never copies. The card
composites are the frames, so a doc for any frame part (page, table, charts too) names this one
subpath, and `scripts/gen-docs.ts` writes it. Neither the root nor `basalt-ui/charts` re-exports
them: the 2.x aliases are gone in 3.0 (`cards.json` rows `cards-frame-types-*`).

## Deprecation lifecycle

Returns with the first 2.x deprecation (the `DEPRECATED_EXPORTS` ledger, `basalt/deprecated-export` and `check-grace.ts`'s removal gate); 2.0.0 ships none.

## Shipping a rendering change — what a minor may move

Between majors (see [Major lines](#major-lines)) the version number can never warn a consumer their
charts will look different.

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

- **Six rules, three skills, two templates**, budgeted by `scripts/check-coverage.ts`: per-file
  ceilings in `AGENT_LINE_BUDGETS` and a whole-layer ceiling (rules + skills + the AGENTS block) in
  `AGENT_LAYER_TOTAL_BUDGET`, both set to the LANDED values (W9: rules 271, layer 576; W10: layer 616, `basalt-app` 257 for the streaming snippet; layer 659, `basalt-app` 300 for the form-dialog snippet; W31: layer 679, `basalt-design` 36 for the design-round procedure, +2 for the AGENTS block naming the skills and reviewer; the skill rewrite: `basalt-design` 50 lines as a map of short lines, where the byte ceiling is the bar that binds) so the next
  edit fails CI on growth. A skill body also has a byte ceiling in `AGENT_BYTE_BUDGETS` (8,000; `basalt-app` at its landed 12,900), because a line ceiling alone is met by long lines. `check-budgets.ts` `ruleLines` bounds the rules alone (spec target 450).
  A rule bullet ends in its enforcement tag (`[basalt/<rule>]`, `[lint:<id>]`,
  `[type <Name>]`); `check-agent-doc-drift.ts` (Checks F–H) resolves the tags, rejects prose
  outside bullets, repo-local and removed rule ids, and unpublished names in the llms.txt header.
- **Rule `paths:` differs by copy**: a consumer's installed rules get `'<root>/**'` per `basalt.roots` (rendered by `init`/`sync`); this repo's `/.claude/rules` keep the shipped `'**/src/**'` verbatim (`make sync-self`), which loads for `packages/*/src/**` and `apps/*/src/**`.
- **Every rule file opens with a GENERATED `<!-- basalt:coverage -->` block** —
  `bun scripts/check-coverage.ts --write` renders it from `SURFACES` (the union over every surface
  sharing that `rule`), `--check` is the CI gate, and a block that DISAGREES is a hard failure. `not guarded`
  is printed even when empty, because a rule claiming full coverage is a claim someone can check.
- **Say each thing once**: the identity and the waiver form (`// oxlint-disable-next-line basalt/<id> -- <why>`) live in `basalt-tokens.md`, the
  precedence in `AGENTS-block.md.tpl`, the overlay mount in `basalt-ui.md`, the Eden footguns in
  `basalt-batteries.md`. The guard-kind list lives nowhere — the generated headers carry it.
- **No API reference, no version history, no incident narrative in a rule.** Those belong in JSDoc /
  `llms.txt`, and `CHANGELOG.md` / `MIGRATING.md`.
- **No hex and no pixel constant in a rule.** The palette and the spacing scales are derived from a
  config a consumer may move, so a literal in prose is a value that can go stale silently.
- `scripts/check-agent-doc-drift.ts` runs in CI: a bolded-backtick name must be a real export, a
  removed API is denylisted outright (and the denylist itself is asserted still-removed).

## Major lines

A major exists only when `CURRENT_MAJOR` in `scripts/release.sh` is raised with the owner's reason
in the commit, following the release runbook in the repo root `AGENTS.md` (§ Release Process). Between
majors commitlint refuses `feat!:` and `BREAKING CHANGE:`; a change that breaks a public shape ships
as a `feat:` plus a row in `migrations/`, and a value change ships a `valueShifts` row. Only the
current line is maintained; 2.x stays on npm as published and receives no further releases. If a
breaking footer reaches master after the designated commit: `git revert <sha>` with the default
message, then re-apply as a plain commit. The analyzer drops reverted commits. If the revert is
impossible, land a one-release `releaseRules` override (`{"breaking":true,"release":"minor"}`) in a
`ci:` commit and remove it in the next one.

## Development guidelines

- Strict TS, no `any`, explicit types on public exports; typed object params, low nesting, early
  returns. Function components only; no `React.FC`, no default exports.
- Respect the token-layer boundary and the chart-engine boundary (`host.tsx` is the one `@tanstack/charts/react` importer).
- Don't reintroduce Tailwind, OKLCH foundation palettes, ShadCN/Tremor/Starlight compat, or any
  `import.meta.env` reference in shipped code.
- **One verb per role.** `define` declares a value that is data (`defineNav`, `defineControls`);
  `create` builds an instance that holds state or a connection (`createQueryClient`,
  `createSyncedState`, `createChannel`); `set` writes a process-wide default and returns nothing
  (`setFormatDefaults`). `make` is not a verb of this
  surface. An activation callback is `onClick` on every action, card target and menu item; the
  empty sentence is `cause`; a frame's pending node is `skeleton`, and `loading` is a boolean.
  An action's identity is `id`; every data part takes `phase`; a width has one word (`compact` is
  the window class, `narrow` the 240 px container). `tone` (`good`, `warn`, `bad`, `info`) is the
  verdict color of a read-out (`Alert`, `Status`, `Num`, `Meter`, `Progress`, `Lozenge`,
  `Toast`); a `Button` is an action, not a read-out, so its `variant` names the role
  (`primary`, `secondary`, `ghost`) and the destructive one is `danger`: the one written exception.
- When extending the public API, keep it grounded in the consumer need that drove it, and update
  `src/surfaces.ts` + this file in the same commit.
