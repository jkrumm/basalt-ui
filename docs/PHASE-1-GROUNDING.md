# Phase 1 SPINE — Grounded Work-List

> Output of the Phase-1 **understand** workflow (8 parallel read-only readers → synthesis →
> completeness critic, 2026-06-20). Verified ground truth for the spine — typed `SURFACES` registry +
> augmentable `BasaltRegister` + headless `./guard` extraction + StandardSchema/AsyncState house style
> + `createPersistedState`. Every `file:line` is re-verified against the live `feat/s0-mantine-pivot`
> checkout. The critic's 6 corrections are folded in (marked `[critic]`). This is the analog of the
> Phase-0 handover's "§2 verified work-list", but for the spine. **Reviewed by the owner before any
> design begins.**

---

## 1. Enforcement seam — current state

The enforcement seam is the set of policy artifacts that today are **hand-maintained, independently
editable, and already drifting**. The spine collapses them into projections of one `SURFACES`
registry plus a headless `./guard` module.

### 1.1 Where each artifact lives today (verified)

| Artifact | Location (verified) | Shape today |
|-|-|-|
| `RULE_NAMES` literal | `src/cli/index.ts:429` | `const RULE_NAMES = ['tokens','charts','mantine','router','query','state'] as const` |
| `RULE_NAMES` sole consumer | `src/cli/index.ts:520` | `RULE_NAMES.map((name) => ({ dest: '.claude/rules/basalt-${name}.md', strategy:'copy', source:'agent/rules/basalt-${name}.md', ... }))` |
| `RULE_NAMES` re-export | `src/cli/index.ts:894` | `export { managedFiles, MANIFEST_PATH, RULE_NAMES }` |
| On-disk rule files (set-equality target) | `packages/basalt-ui/agent/rules/` | `basalt-{charts,mantine,query,router,state,tokens}.md` — **6 files, exact match** to `RULE_NAMES` |
| Guard regex consts | `src/cli/index.ts:90-155` `[critic: block starts L92 (SKIP); L90-91 are DEFAULT_SPACING_STEPS/DEFAULT_FORBIDDEN_ACCENTS, which the extraction must also pull]` | `SKIP`/`HEX`/`FUNC`/`LOCALSTORAGE_THEME`/`SURFACE_*`/`OFF_SYSTEM_SURFACE_VAR`/`RAW_HTML_TAG`/`INLINE_STYLE`/`LAYOUT_SURFACE_PROP`/`INLINE_SPACING`/`INLINE_DISPLAY`/`RAW_VISX_AXIS`/`AXIS_WRAPPER_FILE` + `isChartFile()` |
| `Violation` type | `src/cli/index.ts:157` | `{ rel, line, token, kind }` — the guard output shape |
| `readBasaltConfig` | `src/cli/index.ts:159-168` | reads consumer `package.json` `basalt` key |
| `scanFile` (**12 guard kinds** `[critic: 12, not 13]`) | `src/cli/index.ts:170-254` | per-line scanner; loop body L186-253 is the core of `checkSource()` |
| `walkTsFiles` (thin FS walker) | `src/cli/index.ts:257-277` | recursive; skips `node_modules`/`.git`/`dist` |
| `checkTheme()` orchestrator | `src/cli/index.ts:289-367` | resolves cfg+knobs (290-300), builds 3 dynamic regexes (302-318), walks (321-329), groups/reports/exits (331-367) |
| `Strategy` union + `ManagedFile` | `src/cli/index.ts:385-401` | `'copy'｜'block'｜'merge'｜'seed'` |
| Block markers + manifest path | `src/cli/index.ts:425-427` | `BLOCK_BEGIN_PREFIX='<!-- basalt:begin'`, `BLOCK_END='<!-- basalt:end -->'`, `MANIFEST_PATH='.basalt/manifest.json'` |
| `managedFiles()` declarative manifest | `src/cli/index.ts:519-583` | 6 rules + CLAUDE-block + DESIGN-seed + oxfmt/lefthook/check.yml copies + `.oxlintrc.json` seed-stub |
| `.oxlintrc.json` seed-stub | `src/cli/index.ts:572-580` | strategy `'seed'`, `source:'configs/oxlint.json'` (**doc-only**, never copied); `render()` emits inline `{"extends":["./node_modules/basalt-ui/configs/oxlint.json"]}` |
| `init()` | `src/cli/index.ts:731-782` | scaffold + write manifest; copy/seed skip-if-exists, block/merge always apply |
| `sync()` | `src/cli/index.ts:793-871` | sha256 three-way reconcile; `--check` = CI drift gate, `--force` overwrites |
| `run()` dispatcher | `src/cli/index.ts:878-895` | `init｜sync｜check-theme` (NO `scaffold`/`manifest`/`check-coverage` subcommand) |
| Shipped consumer ban-list | `configs/oxlint.json:29-86` | **2 overrides**: `["src/**","app/**"]` + `["**/charts/**"]`. **NO tokens override** (grep exit 1) |
| Repo-local ban-list | `.oxlintrc.json:30-118` | **4 overrides**: global `@visx`, **tokens/** (L48), charts/**, cli/bin/scripts `no-console:off` |
| Plugin manifest | `plugins/basalt/.claude-plugin/plugin.json:1-9` | `version:"1.0.0"`, `skills:["./skills/basalt-design","./skills/basalt-charts","./skills/basalt-app"]` |
| 3 skills (frontmatter `when_to_use`, underscore) | `plugins/basalt/skills/basalt-{design,charts,app}/SKILL.md:1-5` | design, charts, app only |
| Version anchor | `readFrameworkVersion()` `src/cli/index.ts:455-465` | feeds `BASALT_VERSION` into the CLAUDE-block marker only; `plugin.json.version` is independent |
| Existing CLI test | `src/cli/check-theme.test.ts:1-428` | covers **6 of 12** guard kinds `[critic]`; NO init/sync/manifest/RULE_NAMES coverage |
| Existing registry-ish test | `tests/plugin-version-lockstep.test.ts:1-26` | plugin.json↔package.json share a MAJOR (root `tests/`, untracked-boundary) |

**`[critic]` The 12 distinct guard-kind strings** (the size of the `SurfaceSpec.guardKinds` literal
union + the triad-contract test): `raw-hex`, `raw-color-fn`, `localstorage-theme`,
`off-identity-accent`, `raw-spacing`, `raw-radius`, `raw-surface` (fires from 3 branches, one kind),
`off-system-surface-var`, `raw-html-layout`, `inline-spacing`, `inline-display`, `raw-visx-axis`.
`AXIS_WRAPPER_FILE`/`isChartFile` are path predicates gating `raw-visx-axis`, not a 13th kind.

### 1.2 What becomes a `SURFACES` projection

1. **`RULE_NAMES` → `keyof SURFACES` (or `SURFACES[*].rule`)** — delete the literal array
   (`index.ts:429`), make the `managedFiles()` rules loop (`index.ts:520`) map over `SURFACES`. Add a
   **set-equality test** asserting the projection equals the on-disk `agent/rules/basalt-*.md` set (6
   files present). This is the **#1 drift** the registry deletes: no live bug today, but nothing
   enforces it.
2. **Both oxlint ban-lists → `SURFACES.forbiddenImports`** (per-layer literal unions with per-entry
   message strings). Shipped preset (`configs/oxlint.json:29-86`), repo-local (`.oxlintrc.json:30-118`)
   and the scaffold extends-stub all become projections of **one** source. The generator **must
   replicate per-glob duplication faithfully** — `oxlint extends` is per-glob last-writer-wins for
   `no-restricted-imports`; a base ban does **not** merge into an override glob (documented at
   `configs/oxlint.json:2`). The `@visx/*` ban being **absent** from the charts override is
   **load-bearing** (omission = re-allow) — the projection must encode "replace, not inherit-and-add."
3. **`managedFiles()` manifest** — the rules portion derives from `SURFACES`; the rest (CLAUDE-block,
   DESIGN-seed, toolchain copies, `.oxlintrc` seed-stub) stays declarative. **Caveat:** the
   `.oxlintrc.json` managed file's `source:'configs/oxlint.json'` is **documentation-only** (`render()`
   ignores it, emits an inline extends-stub) — a naive projection treating `source` as "bytes to copy"
   would break this file (`index.ts:572-580`).
4. **Triad/skill contract** — `SurfaceSpec.guardKinds` (literal union of the 12 kind strings),
   `SurfaceSpec.skill` (the 3 plugin skill names), `SurfaceSpec.rule` (the 6 rule names). A
   triad-contract test asserts every spec's `guardKinds` exist in `GUARD_RULES`, its rule file exists
   on disk, and its skill exists. `plugin.json.skills` becomes derivable/checkable against `SURFACES`.

### 1.3 What `./guard` extraction pulls OUT vs leaves as the thin walker

**PULL OUT into `./guard` (Mantine-free, dependency-free — already is):**
- All guard regex consts (`index.ts:90-155`) + the two `DEFAULT_*` arrays (L90-91) + `isChartFile()`
- The two dynamic-regex builders (forbiddenAccent `index.ts:303-306`, spacing/radius `index.ts:307-311`)
- The `Violation` type (`index.ts:157`)
- The per-line scan loop body of `scanFile()` (`index.ts:186-253`)
- New signature: **`checkSource(text: string, relPath: string, cfg)`** where `cfg` carries
  `spacingSteps[]`, `forbiddenAccents[]`, the 6 boolean knobs, and the allow-comment policy
  (`theme-allow` substring + pure-comment skip, L190/195). Collapse the positional 9-field `patterns`
  bag (L170-184) back into `cfg` — the 3 regexes are derivable from `cfg.spacingSteps`/
  `cfg.forbiddenAccents`, avoiding a second config shape.

**STAYS in `index.ts` as the thin FS walker:** `walkTsFiles` (L257-277), `readBasaltConfig`
(L159-168), roots/exempt resolution + relative-path normalization (L321-329), violation
grouping/reporting/exit-code (L331-367). `checkTheme()` becomes: read cfg → walk → per file call
`guard.checkSource` → report. The same `checkSource` is then reusable by a future oxlint plugin and a
PreToolUse hook (one policy, many adapters). **Boundary:** `isChartFile`/`AXIS_WRAPPER` are per-line
path-based → must live in guard; the oxlint-plugin and hook adapters have a single file's text and no
walk, so `checkSource` must own everything kind-applicability needs.

### 1.4 The D2 gap (CONFIRMED at source)

Shipped `configs/oxlint.json` has **NO `tokens/**` override** (`grep -n tokens configs/oxlint.json` →
**exit 1**). Repo-local `.oxlintrc.json:48` **HAS** a `packages/basalt-ui/src/tokens/**` override
banning `@mantine/core`, `@mantine/hooks`, group `@mantine/*`, AND group `@visx/*` (messages at
`.oxlintrc.json:56,60,66`). A consumer extending the shipped preset gets **weaker tokens enforcement**
than the package enforces on itself: tokens-under-`src/` gets the `@visx/*` ban via the `src/**` glob,
but **NO dedicated `@mantine/*` ban**. The `CLAUDE.md` "Mantine-Free Boundary" claim is **FALSE for
tokens downstream**. Logged deferred in `PHASE-1-HANDOVER.md:40-42,77-79` ("should fall out as a
projection of the Phase 2 SURFACES registry, not be hand-added"). The SURFACES projection closes it.

### 1.5 `[critic]` eden-treaty-seam-contract — named Phase-1 spine deliverable, was ungrounded

`INTEGRATION-DX.md` "Phase 1 — the spine" lists **`eden-treaty-seam-contract`** alongside the four
constructs the work-list grounds (register / standard-schema / discriminated-union / persisted-state).
Grounding: it is **net-new** — no streaming/eden/treaty code exists in `src/**` (the `./query` and
`./agent` batteries are Phase 4). The Phase-1 spine work is to **declare the type contract** (the
`export type App = typeof app` → `treaty<App>(url)` seam + the Eden silent-`any` footguns: (1)
non-method-chained Elysia routes; (2) mismatched client/server tsconfig path aliases; (3) a
`t.Object`/`t.Union` response schema on an `async function*` stream route, eden #231) as **house-style
doctrine** next to the `StandardSchemaV1` seam — NOT to wire `treaty<App>` (that is scaffolded
per-consumer in the Phase-4 `./query` battery). **Decision #16 below.**

### 1.6 `[critic]` Self-dogfood gap (`wire-defence-in-depth-templates`) — Phase-1 enforcement item, was ungrounded

`MATURATION-ROADMAP` M-Phase 1 + `ENFORCEMENT-HARDENING` Tiers 4/5 require basalt to **dogfood its own
guards**. Verified: `.github/workflows/ci.yml` runs only `build` + `pack-test` (no `check-theme`, no
`sync --check`); `lefthook.yml` runs only oxlint + oxfmt + commitlint. The roadmap wants
`basalt check-theme` run on basalt's **own** `src/` in `ci.yml` + lefthook (with `basalt.roots` set to
the real package src, not argo defaults) and `sync --check` added to the consumer `check.yml`.
Borderline spine-vs-hardening, but the docs put it in Phase 1. **Decision #17 below.**

### 1.7 `[critic]` cli-runtime-portability — noted, likely out-of-spine

`MATURATION-ROADMAP` M-Phase 1 lists swapping `import.meta.dir` → `import.meta.dirname` (Node 20.11+
and Bun). Verified 3 live `import.meta.dir` uses in `packages/basalt-ui/scripts/{copy-assets,
fix-esm-extensions}.mjs`. It is a build-portability fix, not a SURFACES/Register piece, and
`PHASE-1-HANDOVER.md §5`'s spine definition omits it. **Tendency: defer (out of the spine);** can ride
the Phase-2 tsdown migration that rewrites those scripts anyway. **Decision #18 below.**

---

## 2. Design seam — current state

Entirely greenfield. Grep over `src/`: `BasaltRegister`, `StandardSchemaV1`, `AsyncState`,
`assertNever`, `createPersistedState` → **zero matches** (grep exit 1). All five appear ONLY in
`docs/*.md` prose; the single non-doc mention is the Standard Schema spec URL in
`agent/rules/basalt-state.md` (doctrine text, not implementation).

### 2.1 Where `BasaltRegister` should be exported

Root barrel `src/index.ts` exports only from `./provider`, `./theme`, `./shell` (`index.ts:9-30`) and
deliberately does **NOT** re-export `./charts`/`./tokens` (comment `index.ts:5-6`: keeps `@mantine/*`
out of a tokens/charts-only consumer). `BasaltRegister` belongs **exported from the root barrel** (the
Mantine-coupled `.` surface, read by conditional inference), alongside `BasaltProvider` (`index.ts:9`).
Per `PHASE-1-HANDOVER.md:91-94`, register slots default to **`{}` (never-keyed empty)**, NOT
`Record<string,never>` (→ `keyof` = `string`, silent widening). **Module-split decision #13 below.**

### 2.2 Current `BasaltProvider` prop shape + the three reserve-decisions

`BasaltProviderProps` (`provider/index.tsx:24-40`):
- `children: ReactNode`
- `theme?: MantineProviderProps['theme']`
- `injectPalette?: boolean` (L32, default `true`)
- `paletteOptions?: BuildPaletteOpts`
- `defaultColorScheme?: MantineProviderProps['defaultColorScheme']` (L39, default `'dark'`)
- intersected with `Omit<MantineProviderProps,'children'|'theme'|'defaultColorScheme'>` (L40) → all
  remaining MantineProvider props pass through via `...rest`.

Palette `<style>` injection happens at **exactly one site**: `provider/index.tsx:60` inside
`BasaltBridge` — `{injectPalette ? <style>{buildPaletteCss(paletteOptions)}</style> : null}`.

**Three provider-shape decisions to RESERVE before 1.0 freezes the surface:**
1. **`injectPalette={false}` escape hatch — ALREADY SATISFIED** (`provider/index.tsx:32`, default
   `true`). No work needed.
2. **`onError?(error, ctx)` / errorReporter — GENUINELY MISSING + structural.** No `onError` prop, and
   **no error boundary exists anywhere in the provider tree.** A reporter prop has nothing to hook
   into; wiring it requires adding a boundary (around `BasaltBridge`/children) — new structural code,
   not just a type slot. Risk: freezing the signature without the boundary ships a no-op prop in 1.0.
   The `ctx` shape (`{ kind: 'render'|'window'|'unhandledrejection' }`) is undecided. **Decision #15.**
3. **`nonce?: string` (CSP) — duplication risk.** Because the props intersect
   `Omit<MantineProviderProps,...>` (L40) and spread `...rest` (L79), Mantine v9 may already expose a
   nonce mechanism through the spread. **But** the raw palette `<style>` at L60 receives **no nonce
   today**, so a CSP nonce has real work at that injection site specifically. Verify Mantine v9's nonce
   reachability via `/research` before adding a top-level prop. **Decision #14.**

### 2.3 Surfaces the conditional-inference extractors key off

- **`./tokens`** (Mantine-free — only `@mantine` reference is the doc comment `tokens/index.ts:4`).
  Three factories already in canonical const-generic exact-keyed shape:
  `seriesTokens<const T extends SeriesMap>(...): {[K in keyof T]: string}` (L184-191),
  `defineSeries<const T extends SeriesMap>(map: T): T` (L198-200),
  `groupTokens<const T extends SeriesMap>(...): {[K in keyof T]: string}` (L208-213). Input constraint
  `SeriesMap = Record<string, ColorPair>` (L14-18) — the one deliberate `Record<string,...>` as the
  const-generic bound. `defineSeries` omits a baked-in `satisfies`; validation is via the `<const T>`
  bound (playground `series.ts:19` does NOT write `satisfies SeriesMap`).
- **`./charts`** re-exports the token factories (`charts/index.ts:18-28`), so consumers import
  `defineSeries`/`groupTokens` from `basalt-ui/charts`.
- **Consumer series key-off:** the framework ships **no `VX.series` tree** by design
  (`tokens/index.ts:38-40`). The `series` slot keys off `keyof T` of the consumer's `defineSeries` map
  — concretely the playground's `DEMO_SERIES` keys `'sessions'｜'signups'｜'revenue'｜'churn'`
  (`series.ts:19-24`). A `BasaltRegister['series']` augment lets a global series accessor resolve those
  keys WITHOUT threading `T` through every call site. Default must be never-keyed empty `{}`.

### 2.4 The residual chart-color type-hole

The hole is in the **CONSUMER**, not the kind files. `apps/playground/src/demo/series.ts:35`:
```ts
return (demoColors as Record<string, string | undefined>)[key] ?? 'var(--vx-line)'
```
This re-widens the exact-keyed `groupTokens` output (`{sessions|signups|revenue|churn:string}`) back
to a string-index lookup to satisfy the dynamic-color kind props. **Two corrections to the brief's
phrasing** (both verified):
- The cast is `Record<string, string | undefined>` (with `| undefined` + a `?? 'var(--vx-line)'`
  fallback), **not** the bare `Record<string,string>` the type-guard docstring describes.
- The dynamic `(key: string) => string` lookup applies to **Donut** (`Donut.tsx:14` `colorForKey`) and
  **StackedArea** (`StackedArea.tsx:28` `colorForGroup`) — NOT grouped Bars. **Bars uses literal
  `color: string`** (`Bars.tsx:27,39,51`), painted `fill={b.color}`.

Root cause is a **type-MISMATCH** between exact-keyed factory output and string-keyed dynamic-color
kind props — not a sloppy cast inside a kind. The kinds are clean. A `BasaltRegister['series']` slot
keyed off `keyof Series` would let `demoColor(key)` be typed `key: keyof Series` instead of `string`,
removing the cast. No branded `SeriesToken` exists ("never a raw hex", `MultiLine.tsx:28`, is doc-only).
**Decision #3 below.**

### 2.5 Net-new absences (CONFIRMED)

`StandardSchemaV1` / `AsyncState` / `assertNever` / `createPersistedState` / `BasaltRegister` — **zero
occurrences in any `src/**`** (grep exit 1). `createPersistedState` must be a Mantine-free
`useSyncExternalStore` primitive; the other four are root-barrel design-seam exports with no current
code to subsume. All genuinely greenfield.

---

## 3. Fixtures & test topology

### 3.1 The model: `series.type-guard.ts`

`apps/playground/src/demo/series.type-guard.ts` (L17-18) is a **never-imported, never-called `.ts`
module** (NOT `.test.ts`) holding a single `// @ts-expect-error` over `demoColors.nope`. Mechanism:
while `groupTokens` returns the exact-keyed `{[K in keyof T]: string}`, `.nope` errors and the
directive is valid; if the factory re-widens to `Record<string,string>`, `.nope` stops erroring, the
directive goes **unused**, and tsc fails **TS2578**. Enforced by `tsc --noEmit` because it lives under
`apps/playground/src/` which the playground tsconfig `include: ["src","vite.config.ts"]`
(`apps/playground/tsconfig.json:9`) compiles. Rests on the directive-unused check +
`noPropertyAccessFromIndexSignature` (no `noUnusedLocals` in any tsconfig).

### 3.2 The tsconfig split that governs fixture placement

- **Package tsconfig EXCLUDES `src/**/*.test.ts(x)`** (`packages/basalt-ui/tsconfig.json:14`; include
  `["src"]` L13). A compile fixture placed as `.test.ts` inside `packages/basalt-ui/src` is **invisible
  to tsc** — runtime-only.
- Compile fixtures must be **non-`.test.ts` files in a typechecked include** (playground `src`) OR need
  a dedicated tsconfig.

### 3.3 The placement law and the doc contradiction

- **Root `tests/`** is the commit-boundary-neutral home for cross-cutting/manifest-touching **runtime**
  tests — `tests/plugin-version-lockstep.test.ts:18-23` documents why: semantic-release commits
  `package.json` bumps back, and the `isolated-basalt-ui` lefthook guard forbids a release commit
  staging non-package files, so cross-cutting tests stay **off** the `packages/basalt-ui/**` boundary.
- **CONTRADICTION (the single biggest open decision)**: `MATURATION-ROADMAP` and `PHASE-1-HANDOVER`
  prescribe the two `BasaltRegister` **compile** fixtures live "in `tests/` mirroring
  `series.type-guard.ts`." But **`tests/` is in NO tsconfig `include`** (root `tsconfig.json` includes
  only `scripts/**`) — a fixture dropped there runs under `bun test` but is **NOT typechecked**, so an
  `@ts-expect-error` compile fixture there would be **DEAD (never enforced)**. `series.type-guard.ts`
  works ONLY because it's in playground `src`. The doc's "mirror series.type-guard.ts in tests/" is
  internally inconsistent. **Decision #1 below.**

### 3.4 How `bun test` globs

Root script `"test": "bun test"` (`package.json:19`), CI `run: bun test` (`ci.yml:44`). No args, no
`bunfig.toml [test]` → default glob `*.test.{ts,tsx,...}` recursively (skips `node_modules`), finding
**both** root `tests/` and co-located `packages/basalt-ui/src/**/*.test.ts`. Compile fixtures are gated
by the **separate** `typecheck` step (`package.json:18`), NOT bun test.

### 3.5 The four compile fixtures the spine is gated on

1. **BasaltRegister augments-nothing** — slot resolves to **never-keyed empty** (`keyof` = never), NOT
   `any`/`string`. Locks the `{}` vs `Record<string,never>` footgun at compile time.
2. **BasaltRegister augments-all** — exact keys resolve after augmentation.
3. **SURFACES broken-fixture** — a literal-union violation produces a tsc error.
4. **AsyncState fourth-variant** — an unhandled variant errors via `assertNever`.

Plus the **runtime** fixtures for `./guard`: shaped like `check-theme.test.ts` (temp-dir consumer
repos, assert exit code + stderr kind strings). **Decide:** reuse the temp-dir+stderr contract, or have
`checkSource(text,relPath,cfg)` return a structured findings array fixtures assert directly (cleaner,
decoupled from `console.error` capture — the extraction is the moment to choose the testable surface).

### 3.6 Naming convention (undocumented, one example)

`series.type-guard.ts` is a **compile** fixture (in tsc include, OUT of bun test), deliberately NOT
named `*.test.*`. `check-theme.test.ts` is a **runtime** fixture (in bun test, excluded from tsc). New
compile fixtures MUST follow the `.type-guard.ts` convention or they silently won't be typechecked.
**Codify this — decision #2 below.**

---

## 4. What a SURFACES entry must encode per current subpath

`SurfaceSpec = {layer, forbiddenImports, rule, skill, guardKinds}`. The 5 existing JS subpaths
(`package.json:44-67`: `.`, `./charts`, `./tokens`, `./theme-lab`, `./vite` + `./styles.css` +
`./configs/*`) grounded today:

| Subpath | layer | forbiddenImports (grounded) | rule | skill | guardKinds | refs |
|-|-|-|-|-|-|-|
| `.` (root barrel) | mantine-coupled | NOT `@mantine/*`; root barrel **forbidden** from re-exporting `./charts`/`./tokens` (enforced only by comment — nothing mechanical) | — | basalt-app, basalt-design | — | `index.ts:5-6,9-30` |
| `./charts` | headless | ban `@mantine/core`,`@mantine/hooks`, group `@mantine/*`, `@visx/tooltip`; **uniquely PERMITS `@visx/*`**; rule-override `no-underscore-dangle:off` (repo-local) | charts | basalt-charts | charts oxlint bans | `configs/oxlint.json:56-85`, `.oxlintrc.json:77-107` |
| `./tokens` | headless | ban `@mantine/core`,`@mantine/hooks`, group `@mantine/*` AND group `@visx/*` | tokens | basalt-design, basalt-charts | tokens check-theme kinds | `.oxlintrc.json:48-76` (**shipped MISSING — D2**) |
| `./theme-lab` | mantine-coupled | (none grounded today) | — | basalt-design | — | `package.json:56-59` |
| `./vite` | mantine-coupled | (none grounded today) | — | basalt-app | — | `package.json:60-63` |
| `./styles.css` | non-JS asset | n/a | — | — | — | `package.json:65` |
| `./configs/*` | directory glob (8 files) | n/a | — | basalt-app | — | `package.json:66` |
| **GLOBAL app surface** (synthetic) | consumer-app-wide | ban `antd` (**shipped-only**), `@visx/tooltip`, group `@visx/*` (outside charts) | — | — | — | `configs/oxlint.json:33-53` |

**Net-new rows to design:** `./guard` (the 6th JS subpath: headless, dependency-free, houses
`GUARD_RULES` + `checkSource`, add to exports + manifest) and the seven Phase-4 batteries
(`./query`, `./router-tanstack`, `./agent`, `./commands`, `./forms`, `./notifications`, `./data`).

**Encoding requirements the table demands:**
- `forbiddenImports` needs **per-entry message strings** (e.g. `antd→'Use Mantine…'`,
  `@visx/tooltip→'Use ChartTooltip…'`), not just names. Messages **drift between configs today** (shipped
  `@visx/tooltip` msg vs repo-local) → template with a path/context placeholder.
- **Glob-shape duality:** shipped globs are consumer-relative (`**/charts/**`, `src/**`, `app/**`);
  repo-local globs are package-relative (`packages/basalt-ui/src/charts/**`, `src/tokens/**`). One
  layer → DIFFERENT glob strings per projection target. Store the **logical layer**; each target
  supplies its glob prefix.
- **Per-target extras** not derivable from layer: `antd` (shipped-only), `no-console:off`
  (cli/bin/scripts, repo-local only `.oxlintrc.json:108-117`), `no-underscore-dangle:off` (charts). The
  spec needs a place for target-scoped rule overrides + a "shipped-only / global-only" flag.
- **`@visx/*` absence in charts is load-bearing** — encode "replace, not inherit-and-add."
- **`skill↔surface` is many-to-one:** `basalt-design` covers tokens AND mantine AND state
  (`basalt-design/SKILL.md:19`). `SurfaceSpec.skill` cannot be a clean per-surface single literal.
- **Triad gaps:** `router`/`query` have a RULE template only — **no skill, no guard** (the rules say
  "Advisory (the framework ships no router adapter/data layer)"). `mantine` is "by-construction via
  createBasaltTheme" — no discrete guardKind. `SurfaceSpec.guardKinds`/`skill` must be
  **required-nullable** (`[]`/`null` allowed for advisory surfaces) OR router/query stay outside SURFACES.

---

## 5. Disjoint-group map for the eventual implement phase

`@implementer` groups must be on disjoint file sets.

| Group | Deliverable | Files touched | Collision flag |
|-|-|-|-|
| **G1 (MERGED — mandatory single group)** | (a) `SURFACES` registry + `RULE_NAMES` derivation + set-equality test; (b) `./guard` extraction (`GUARD_RULES` + `checkSource`) | `src/cli/index.ts` (RULE_NAMES L429/520/894 → derive; guard L90-155, Violation L157, scanFile L186-253 → extract); new `src/guard/index.ts`; new `src/surfaces.ts`; `package.json` exports (+`./guard`); `agent/rules/*` (read-only target) | **⚠ COLLISION: RULE_NAMES-derivation AND ./guard extraction both edit `src/cli/index.ts` → MUST be ONE implementer group.** |
| **G2** | oxlint ban-list projection generator + sync-contract test (closes D2) | new generator script + `configs/oxlint.json` (regenerated) + `.oxlintrc.json` (regenerated) + new `tests/oxlint-preset-sync.test.ts` | Depends on G1's `SURFACES.forbiddenImports`. Sequence after G1. |
| **G3** | Design-seam primitives: `BasaltRegister` (`{}` default), `StandardSchemaV1`, `AsyncState`, `assertNever`, `createPersistedState` | new `src/register.ts` (design seam) + `src/index.ts` (barrel) | `src/index.ts` barrel edits collide with G4 → sequence/merge the barrel edit. |
| **G4** | Provider freeze: `onError(error,ctx)` + error boundary; `nonce` (or confirm `...rest`) | `src/provider/index.tsx` (props L24-40, BasaltBridge L46-64, palette `<style>` L60) + `src/index.ts` (barrel) | Both G3 and G4 touch the barrel → sequence/merge. `injectPalette` needs **no work**. |
| **G5** | Compile fixtures (4) + runtime guard fixtures | `apps/playground/src/*.type-guard.ts` (compile) + `tests/` (runtime) + `src/guard/*.test.ts` (guard runtime) | Depends on G1 + G3. Sequence last. Placement decision (#1) gates this. |
| **G6** | Triad/check-coverage + plugin version-lockstep | new `check-coverage` subcommand in `src/cli/index.ts` + `plugin.json` derivation + move `tests/plugin-version-lockstep.test.ts` under registry suite | **⚠ touches `src/cli/index.ts` → collides with G1.** Fold into G1 or strictly sequence after G1 commits. |

**Commit discipline:** every `packages/basalt-ui/**` group is its own commit (`isolated-basalt-ui`
guard). Groups touching `.oxlintrc.json`/`tests/` at root must NOT be staged with package files.

---

## 6. Gotchas carried from Phase 0 that bite this phase

1. **Rebuild-before-typecheck.** Compile fixtures in `apps/playground/src/` that import the root barrel
   resolve through `workspace:*` source — confirm new `BasaltRegister`/`AsyncState` exports are
   reachable from `src/index.ts` (today: provider/theme/shell only) **before** a fixture imports them,
   or tsc fails on an unresolvable import, not the intended `@ts-expect-error`. After editing package
   src, `bun --filter basalt-ui build` before `bun run typecheck` (33 phantom errors in Phase 0).
2. **bun.lock desync.** `--frozen-lockfile` in CI fails (not silently re-resolves) if `package.json`
   disagrees. Adding `./guard` export or any new peer requires a deliberate `bun install` + **separate
   `chore:` lockfile commit** (bun.lock is a root file, off the package boundary). Never `bun update`.
3. **keyof-includes-symbol.** `BasaltRegister` slots keyed off `keyof T` include `string|number|symbol`.
   The series accessor and `RULE_NAMES = keyof SURFACES` projection must constrain to `string` keys
   (`Extract<keyof SURFACES, string>`) or the literal-union widens. `keyof {}` = `never` is correct;
   the augments-all fixture must verify the symbol case doesn't leak. Interpolating a key → `String(key)`.
4. **oxlint-extends-relative-path.** oxlint `extends` **rejects bare specifiers** — consumers use
   `./node_modules/basalt-ui/configs/oxlint.json`. The generator must emit relative paths, never bare.
5. **commitlint body rules + empty scope.** `scope-empty: always` — `feat:` not `feat(spine):`. Body
   **≤100 chars/line** AND **no body line may start with `word:`** (parsed as a footer trailer). The
   **amend rule** applies (fold follow-up fixes). Each `packages/basalt-ui/**` change is a **separate
   commit**. No AI/tool attribution.

---

## 7. Open decisions for the owner

> **Owner resolutions (2026-06-20):**
> - **#1 fixture placement → ELEVATED to a design deliverable.** Not a simple where; the owner asks
>   what the fixtures actually test (the package's public types as a *consumer* sees them, the
>   implementation, or a shared surface) and who owns them — playground/`src` vs package-internal vs a
>   **dedicated workspace type-test package** vs dist-consumer-vantage. The design phase recommends.
> - **#3 chart-color hole → CLOSE via the `BasaltRegister['series']` slot** (re-type `Donut.colorForKey`
>   + `StackedArea.colorForGroup` to a `keyof Series` lookup; the consumer cast `series.ts:35`
>   disappears). IN SCOPE.
> - **#15 onError → SHIP the `BasaltErrorBoundary` + `onError(error, ctx)` together** in the provider
>   freeze (no no-op prop). IN SCOPE.
> - **#16 eden-treaty-seam → IN SCOPE** as house-style doctrine (type contract + 3 footguns); `treaty<App>`
>   wiring stays deferred to the Phase-4 `./query` battery.
> - **#17 self-dogfood `check-theme` + `sync --check` in ci.yml + lefthook → IN SCOPE** (`basalt.roots`
>   → real package src).
> - **#18 cli-runtime-portability → DEFERRED** (out of the spine; rides the Phase-2 tsdown rewrite).
> - The remaining decisions (#2, #4, #5, #8, #9, #10, #11, #12, #13, #14) are design-internal — the
>   design judge-panel proposes them with these tendencies as priors, for owner sign-off at the design gate.

Deduped across all 8 readers + the critic, each with a tendency.

1. **Compile-fixture placement (the doc/tsconfig contradiction — biggest decision).** (a) `apps/
   playground/src/` next to `series.type-guard.ts` — guaranteed typechecked, off the package boundary,
   consumer-vantage; (b) root `tests/` as docs say **plus** a new tsconfig including `tests/`; (c)
   `packages/basalt-ui/src` — REJECTED (excluded from tsc, on the boundary). **Tendency: (a) for
   compile fixtures + root `tests/` only for runtime fixtures.**
2. **Fixture naming convention.** Codify `*.type-guard.ts` (compile) vs `*.test.ts` (runtime).
   **Tendency: codify it.**
3. **Close the chart-color type-hole, or keep the guard?** Re-type Donut.`colorForKey`/
   StackedArea.`colorForGroup` to a `keyof Series` lookup (via `BasaltRegister['series']`) so the
   consumer cast (`series.ts:35`) disappears, OR leave them `(string)=>string` and keep the guard.
   **Tendency: re-type via the register slot in Phase 1 — the slot exists precisely to close this.**
4. **`SurfaceSpec.guardKinds`/`skill` required-nullable, or router/query outside SURFACES?**
   **Tendency: required-nullable (`guardKinds: []`, `skill: null`) so all 6 rules stay in SURFACES —
   keeping advisory surfaces out fragments `RULE_NAMES = keyof SURFACES`.**
5. **skill↔surface cardinality.** `SurfaceSpec.skill` must be a list, not a single literal.
   **Tendency: a list per surface; `plugin.json.skills` derives as the union.**
6. **Is `forms` a first-class subpath in Phase 1?** Today folded into `basalt-state.md`.
   **Tendency: keep folded for Phase 1 (no `./forms` battery, `@mantine/form` not a declared peer);
   split when the battery ships (Phase 4).**
7. **Close the D2 tokens gap with both `@mantine/*` AND `@visx/*` bans?** Repo-local bans both.
   **Tendency: yes — mirror repo-local exactly into the shipped tokens override.**
8. **Does the generator own the whole oxlint JSON or only `no-restricted-imports` overrides?**
   **Tendency: generator owns the overrides; the shared base (plugins/categories/11 rules) stays a
   hand-maintained template the generator splices into.**
9. **antd / per-target extras: flag shipped-only / repo-only?** **Tendency: add a `shippedOnly`/
   `repoOnly` flag on ban entries + a target-scoped rule-override slot.**
10. **Keep or drop the unused `merge` strategy?** `[critic: precise truth]` The implementation is live
    code (`mergeStanza` L511, dispatch arms L671/L690); the **dead part is the manifest producer** — NO
    `ManagedFile` declares `strategy:'merge'` (grep exit 1). **Tendency: drop the strategy — its only
    use-case (settings.json scaffolding) is gone; the SPINE must otherwise model dead surface.**
11. **Change `.oxlintrc.json` scaffold from `seed` to `block`?** `seed` is never reconciled by `sync`;
    once a consumer edits their `.oxlintrc.json`, the extends line can't be re-asserted. **Tendency:
    leave as `seed` for 1.0; the `source` field is doc-only — don't let the projection treat it as
    bytes-to-copy.**
12. **Plugin version lockstep — mechanical derivation or check?** No code links the two versions today.
    **Tendency: lockstep-CHECK (not derive) via the existing root test, moved under the registry suite;
    `check-coverage` owns the assertion.**
13. **`BasaltRegister` / SURFACES module split.** **Tendency: separate modules — `src/surfaces.ts` (the
    enforcement registry, feeds CLI/oxlint projections) and `src/register.ts` (the augmentable
    `BasaltRegister` + `AsyncState`/`assertNever`/`StandardSchemaV1`/`createPersistedState` design
    seam), both re-exported from `src/index.ts`. Keeps G1 (enforcement) and G3 (design) disjoint.**
14. **`nonce`: dedicated prop or `...rest` passthrough?** **Tendency: rely on `...rest` for Mantine's
    own styles, add a dedicated `nonce?: string` ONLY to thread into the raw palette `<style>` (the one
    element `...rest` cannot reach) — verify Mantine v9's nonce reachability via `/research` first.**
15. **`onError`: ship the boundary now or reserve the type slot only?** Freezing the signature without
    the boundary ships a no-op prop in 1.0. **Tendency: ship the error boundary + `onError` together in
    the freeze commit (G4); if the boundary isn't ready, don't reserve the prop — a frozen no-op is
    worse than deferring.**
16. **`[critic]` eden-treaty-seam-contract in Phase 1 (§1.5)?** **Tendency: declare the type contract +
    3 Eden footguns as house-style doctrine in Phase 1 (cheap, it's a type-discipline statement next to
    StandardSchema); defer the `treaty<App>` wiring to the Phase-4 `./query` battery.**
17. **`[critic]` Self-dogfood `check-theme`/`sync --check` in ci.yml + lefthook (§1.6)?** **Tendency:
    include in Phase 1 — proving the guard works on basalt's own `src/` is cheap and high-honesty;
    `basalt.roots` must point at the real package src, not argo defaults.**
18. **`[critic]` cli-runtime-portability `import.meta.dir`→`import.meta.dirname` (§1.7)?** **Tendency:
    defer (out of the spine) — let it ride the Phase-2 tsdown migration that rewrites those scripts.**

---

## Critic verdict (verbatim)

> This grounding is complete enough to design from, with two should-fix corrections. Every load-bearing
> claim spot-checked verifies against live source: RULE_NAMES (L429, 6 names) + consumer (L520) +
> re-export (L894); the D2 gap; the BasaltProvider prop shape + single palette `<style>` site; the
> barrel's deliberate omission of charts/tokens; the exact-keyed token factories; the Bars-literal vs
> Donut/StackedArea-dynamic color distinction; the `series.ts:35` cast being
> `Record<string,string|undefined>`; the greenfield absence of all five design constructs; and the §3.3
> fixture/tsconfig contradiction (`tests/` in no tsconfig include). The gaps: (1) a repeated wrong
> guard-kind count (12, not 13); (2) one omitted spine deliverable the design doc names
> (eden-treaty-seam-contract); (3) one Phase-1 enforcement item the roadmap requires (self-dogfood
> check-theme/sync --check). None is a blocker.
