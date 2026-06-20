# Phase 1 SPINE — Unified Public-API Design (recommended)

> **Status: AWAITING OWNER SIGN-OFF.** Output of the Phase-1 **design** workflow (3 lens-diverse
> designs → 3 weighted judges → synthesis → adversarial critic, 2026-06-20). Base design **A
> (Tanner-purist)** won; best ideas from B (enforcement) + C (DX) grafted. The critic compiled every
> load-bearing type trick against the repo's own **TS 6.0.3** — all HARD invariants hold, **zero
> invariant violations, zero design flaws**. It blocked sign-off on **two non-compiling example
> fixtures** (J.2 symbol guard, J.3 broken-fixture) — the exact "theatre" the adversarial pass exists
> to catch — plus 2 should-fixes + 2 notes. **All six are resolved in-place** (marked `CRITIC-FIX`),
> each with the critic's verified-passing form. This doc, once signed off, **becomes the
> implement-phase spec**.
>
> Sign-off document → becomes the implement-phase spec. Every `file:line` is verified against
> `feat/s0-mantine-pivot`. TypeScript blocks are the **frozen 1.0 surface**. Two seams interlock: a
> typed `SURFACES` enforcement registry whose every adapter is a *projection* (re-derived + asserted),
> and an augmentable `BasaltRegister` design seam whose typed slots are guards the enforcement axis
> gets to delete — each deletion gated on a named green fixture.

## Recommended design — overview

```
        ┌──────────── src/surfaces.ts  (ENFORCEMENT seam · G1 · dependency-free, Mantine-free) ───────────┐
        │  SURFACES = {...} satisfies Record<SurfaceKey, SurfaceSpec>   (discriminated doctrine | tooling)  │
        │  literal-union teeth: rule | skill[] | guardKinds[] | layer | forbiddenImports                    │
        └──┬──────────────┬───────────────┬────────────────┬──────────────────┬──────────────────────────┘
   projections (generated, deep-equal asserted)            │                  │
           ▼              ▼               ▼                ▼                  ▼
      RULE_NAMES     shipped ban     repo-local ban    managedFiles()     triad + plugin-skill
      =derived       (configs/       (.oxlintrc.json)  rules rows         coverage check
      doctrine.rule  oxlint.json)    glob-duality      (cli/index.ts)     (check-coverage)

        ┌──────────── src/register.ts  (DESIGN seam · G3 · re-exported from root barrel ".") ──────────────┐
        │  interface BasaltRegister {}      Slot<K,C> single extractor      Series / SeriesKey              │
        │  AsyncState<T,E> · assertNever · StandardSchemaV1<In,Out>   ── closes series.ts:35 cast (G5) ──►   │
        └──────────────────────────────────────────────────────────────────────────────────────────────────┘

        ┌──────────── src/guard/index.ts  (./guard subpath · G1 · dependency-free, Mantine-free) ───────────┐
        │  GUARD_RULES registry · checkSource(text, relPath, cfg) → Finding[]   (one policy → CLI/oxlint/hook)│
        └──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Base design: A (design-tanner-purist).** It won 2 of 3 judge panels and topped the two highest-weighted axes (`typeSafetyCohesion` + `simplicityTannerBar`) in the panels that weight the design axis as the point. Its `Slot<K,C>` single-extractor idiom, its structurally-tighter discriminated `SurfaceSpec`, and its honest fixture-coexistence reasoning are the spine.

**Grafted from C (design-dx-first)** — the panel's DX winner and overall #1 on one panel:
1. **The `#`-prefix registry-key device** (`#router` / `#query` / `#state` / `#app`). This is the single most-cited graft across all three panels: it resolves the one place A is weaker. A modeled advisory rules as subpath-shaped keys (`'./router'`) that *aren't* exports, forcing an extra "subpath-export-coverage" test arm to disambiguate `keyof SURFACES` (claimed to be "the published subpaths") from the rule set. C's `#`-prefix cleanly separates the two conflated concerns — published-subpath keys vs rule-carrying doctrine surfaces — so `RULE_NAMES` derives all 6 with no fake subpaths and no extra arm. Two judges named this the correct key strategy.
2. **`@example`-bearing JSDoc on every frozen export** (the strongest "go-to-def IS the documentation" execution; the tarball ships `src`, so the inferred types are what Claude reads).
3. **The `MANTINE_BANS` shared const + `v`/`vg` helper constructors** for readable, single-sourced registry authoring.
4. **The dist-vantage assertion folded into the existing pack-test** (catches a `.d.ts` declaration-emit regression a `src`-only fixture can't, without a new workspace package).

**Grafted from B (design-enforcement-first)** — third overall but holds the single best enforcement idea in the panel:
5. **The deep-equal sync-contract test** — `projectBanList('shipped'|'repo')` re-derived and `toEqual`-asserted against the committed JSON, plus the two **named** load-bearing assertions ("charts override permits `@visx/*`" = the re-allow holds; "tokens override bans `@visx/*` AND `@mantine/*`" = D2 closure). This turns the load-bearing `@visx`-absence from a comment into a red-on-drift assertion. All three panels graft this.
6. **The bidirectional broken-fixture** — a *tooling* surface illegally declaring `rule` must also tsc-error (`rule?: never`), proving both directions of the discriminant teeth.
7. **The producer-vs-consumer `sync --check` correction** — basalt is the *producer* and has no `.basalt/manifest.json`, so `sync --check` on basalt's own `ci.yml` would falsely report every managed file out-of-date. A and C both put it there uncritically; B caught the category error. `sync --check` ships into the *consumer* `check.yml` template; basalt's own `ci.yml`/lefthook get `check-theme` only. Verified: no `.basalt/manifest.json` exists in the repo.

**Conflicts resolved against base A:** A's subpath-shaped advisory keys → replaced with C's `#`-prefix (judge consensus). A's `sync --check`-on-producer → replaced with B's split (judge consensus). A's `SeriesKey` re-exported *through* `./tokens` (a `tokens → register` coupling edge two judges flagged as a category smell) → replaced with a **direct type-only re-export from `./charts`** (C's cleaner edge; types are erased, so no Mantine leak). Everything else is A.

---

## A. SURFACES registry — the one hard source

### A.1 The `SurfaceSpec` type — discriminated `doctrine | tooling` (resolves §7 #4)

A `doctrine` surface owes the full triad (`rule` + `skill[]` + `guardKinds[]`). A `tooling` surface (`./vite`, `./theme-lab`, `./guard`) owes **none** — the discriminant makes "does this surface owe a triad?" a type-level fact (resolves the ENFORCEMENT open question for tooling subpaths). This is structurally tighter than required-nullable-everywhere: `tooling` *cannot* claim a triad, `doctrine` *cannot* omit one.

```ts
// src/surfaces.ts — imports ONLY ./guard/types. Zero @mantine, zero React, zero @visx.
import type { GuardKind } from './guard/types'

/** The 6 on-disk rule names (agent/rules/basalt-{name}.md — the set-equality target). */
export type RuleName = 'tokens' | 'charts' | 'mantine' | 'router' | 'query' | 'state'

/** The 3 plugin skill names (plugins/basalt/skills/basalt-{name}/). */
export type SkillName = 'basalt-app' | 'basalt-design' | 'basalt-charts'

/** Logical layer — the glob PREFIX is supplied per projection target, never stored here. */
export type Layer = 'mantine-coupled' | 'headless' | 'app-global' | 'non-js-asset'

/** A single import ban. `{ctx}` in the message is filled per target so shipped/repo wording is one source. */
export type ForbiddenImport = {
  /** Exact module specifier (`'antd'`) OR a glob group (`'@visx/*'`). */
  readonly spec: string
  /** 'path' → exact-name ban; 'group' → pattern ban. Mirrors oxlint paths vs patterns. */
  readonly match: 'path' | 'group'
  /** Message; may contain a `{ctx}` placeholder (the boundary name for this glob). */
  readonly message: string
  /** Ban holds ONLY in the shipped consumer preset (e.g. antd) — never repo-local. */
  readonly shippedOnly?: true
  /** Ban holds ONLY in the repo-local config. (Reserved; nothing repo-only-banned today.) */
  readonly repoOnly?: true
}

/** Per-target rule override not derivable from layer (no-console:off, no-underscore-dangle:off). */
export type RuleOverride = {
  readonly rule: string
  readonly level: 'off' | 'warn' | 'error'
  readonly target?: 'shipped' | 'repo'
}

type BaseSurface = {
  readonly layer: Layer
  readonly forbiddenImports: readonly ForbiddenImport[]
  readonly ruleOverrides?: readonly RuleOverride[]
  /**
   * REPLACE-not-inherit-and-add (the load-bearing @visx-absent-in-charts fact). When true, this
   * surface's forbiddenImports are the COMPLETE ban set for its glob — the generator MUST NOT
   * inherit-and-add the parent (src/**) bans. Charts sets this so the @visx/* ban from src/** does
   * NOT leak into the charts override (which would re-ban visx). The projection emits the full list.
   */
  readonly replaceBans?: true
}

/** A doctrine surface owes the full triad. A bad rule/skill/kind name is a tsc error (literal-union). */
export type DoctrineSpec = BaseSurface & {
  readonly kind: 'doctrine'
  readonly rule: RuleName
  /** A LIST (skill↔surface is many-to-one — basalt-design covers tokens AND mantine AND state). */
  readonly skill: readonly SkillName[]
  /** Required, but [] is legal for advisory surfaces (router/query: rule only, no guard). */
  readonly guardKinds: readonly GuardKind[]
}

/** A tooling surface owes NO triad — these fields are statically ABSENT (cannot be set). */
export type ToolingSpec = BaseSurface & {
  readonly kind: 'tooling'
  readonly rule?: never
  readonly skill?: never
  readonly guardKinds?: never
}

export type SurfaceSpec = DoctrineSpec | ToolingSpec
```

**Resolution of §7 #4 (required-nullable vs router/query out).** Neither. The discriminated union: `doctrine` keeps `guardKinds` and `skill` **required**, with `[]` legal for advisory surfaces (router/query ship a rule, no guard). `[]` (not `null`) is a required-present-but-empty contract the triad test reads as "advisory, no guard expected." This is tighter than B's required-nullable (`| null` still lets a doctrine author write `null`) — and the discriminant means `tooling` can't accidentally claim a triad. **The `.` root barrel** (a doctrine surface with no own rule file) is handled by the key strategy in A.2, not by a nullable `rule`.

### A.2 The registry key strategy — `#`-prefix for non-export keys (grafted from C, resolves the panel's #1 conflict)

The keys split into two kinds:
- **JS-subpath keys** (`.`, `./charts`, `./tokens`, `./theme-lab`, `./vite`, `./guard`) — these are real `package.json` exports.
- **`#`-prefixed synthetic keys** (`#router`, `#query`, `#state`, `#app`) — advisory doctrine surfaces that carry a *rule* but ship *no JS export* (router/query/state), plus the synthetic global app-wide ban layer (`#app`). The `#`-prefix guarantees they are never mistaken for export paths.

This dissolves the conflict the judges flagged: `RULE_NAMES` derives all 6 rule names with **no fake subpaths** (A's flaw) and **no dropped surfaces** (B's contradiction — B's literal had only 6 keys, none of router/query/state, so its own `RULE_NAMES = filter(doctrine).map(rule)` projection yielded only 3 names and would fail the set-equality test). The published-subpath set is a separate, cleanly-derivable projection (`keyof SURFACES` filtered to non-`#` keys).

```ts
// Shared ban const + helpers (grafted from C — single-sourced authoring).
const v = (spec: string, message: string, extra?: Partial<ForbiddenImport>): ForbiddenImport =>
  ({ spec, match: 'path', message, ...extra })
const vg = (spec: string, message: string, extra?: Partial<ForbiddenImport>): ForbiddenImport =>
  ({ spec, match: 'group', message, ...extra })

const MANTINE_BANS = [
  v('@mantine/core', '{ctx} must be Mantine-free — no Mantine imports allowed.'),
  v('@mantine/hooks', '{ctx} must be Mantine-free — no Mantine imports allowed.'),
  vg('@mantine/*', '{ctx} must be Mantine-free — no Mantine imports allowed.'),
] as const

export const SURFACES = {
  // ── JS-subpath surfaces ──────────────────────────────────────────────────────────────────
  '.': {
    kind: 'doctrine', layer: 'mantine-coupled',
    rule: 'mantine', skill: ['basalt-app', 'basalt-design'], guardKinds: [],
    forbiddenImports: [], // the no-charts/tokens-reexport invariant is comment-only today; see A.6
  },
  './charts': {
    kind: 'doctrine', layer: 'headless',
    rule: 'charts', skill: ['basalt-charts'], guardKinds: ['raw-hex', 'raw-color-fn', 'raw-visx-axis'],
    replaceBans: true, // ← @visx/* MUST NOT inherit from src/** (the re-allow). Full list emitted.
    forbiddenImports: [
      ...MANTINE_BANS,
      v('@visx/tooltip', 'Use ChartTooltip + TooltipHeader/Row/Body from {ctx}.'),
      // LOAD-BEARING ABSENCE: no @visx/* group ban here — charts uniquely permits @visx/*.
    ],
    ruleOverrides: [{ rule: 'no-underscore-dangle', level: 'off', target: 'repo' }],
  },
  './tokens': {
    kind: 'doctrine', layer: 'headless',
    rule: 'tokens', skill: ['basalt-design', 'basalt-charts'],
    guardKinds: ['raw-hex', 'raw-color-fn', 'off-identity-accent', 'off-system-surface-var'],
    forbiddenImports: [
      ...MANTINE_BANS,
      vg('@visx/*', 'Direct @visx/* imports are only allowed inside the charts boundary ({ctx}).'),
    ], // ← shipped tokens override is MISSING today → this projection EMITS it (closes D2)
  },
  './theme-lab': { kind: 'tooling', layer: 'mantine-coupled', forbiddenImports: [] },
  './vite':      { kind: 'tooling', layer: 'mantine-coupled', forbiddenImports: [] },
  './guard':     { kind: 'tooling', layer: 'headless', forbiddenImports: [] }, // ← NEW 6th JS subpath

  // ── #-prefixed synthetic surfaces (advisory rules + global ban layer; NOT export keys) ──────
  '#router': { kind: 'doctrine', layer: 'mantine-coupled', rule: 'router', skill: ['basalt-app'], guardKinds: [], forbiddenImports: [] },
  '#query':  { kind: 'doctrine', layer: 'mantine-coupled', rule: 'query',  skill: ['basalt-app'], guardKinds: [], forbiddenImports: [] },
  '#state':  { kind: 'doctrine', layer: 'mantine-coupled', rule: 'state',  skill: ['basalt-design'], guardKinds: ['localstorage-theme'], forbiddenImports: [] },
  '#app': {  // synthetic global app-wide ban layer — the src/**+app/** glob
    kind: 'doctrine', layer: 'app-global', rule: 'mantine', skill: ['basalt-app'], guardKinds: [],
    ruleOverrides: [{ rule: 'no-console', level: 'off', target: 'repo' }], // cli/bin/scripts, repo-local only
    forbiddenImports: [
      v('antd', 'Use Mantine — antd is not part of the basalt-ui stack.', { shippedOnly: true }),
      v('@visx/tooltip', 'Use ChartTooltip + TooltipHeader/Row/Body from {ctx}.'),
      vg('@visx/*', 'Direct @visx/* imports are only allowed inside the charts boundary ({ctx}).'),
    ],
  },
} as const satisfies Record<string, SurfaceSpec>
```

> Note `#app`'s `rule: 'mantine'` is shared with `.` (both map to the `basalt-mantine.md` rule — that is correct, the rule covers the app-global Mantine doctrine). `RULE_NAMES` dedups, so the duplicate is harmless. `#app` exists only to project the global ban glob; the set-equality test reads the *deduped set*, which is exactly the 6 on-disk files.

### A.3 The five projections (glob-duality, per-target-extras, replace-not-merge, required-nullable)

```ts
// PROJECTION 1 — RULE_NAMES (delete the literal at cli/index.ts:429; derive instead).
// Extract<…,string> guards the keyof-includes-symbol footgun (§6.3); dedup via Set.
export const RULE_NAMES = [
  ...new Set(
    Object.values(SURFACES)
      .filter((s): s is DoctrineSpec => s.kind === 'doctrine')
      .map((s) => s.rule),
  ),
] as const satisfies readonly RuleName[]
// → ['mantine','charts','tokens','router','query','state'] — set-equality tested vs on-disk basalt-*.md
```

- **PROJECTION 2 + 3 — both oxlint ban-lists (glob-duality).** The G2 generator walks `SURFACES`, applying a per-target glob prefix: a `GLOB_PREFIX[target][layer]` lookup *in the generator, never in the frozen spec*. Shipped → consumer-relative globs (`**/charts/**`, `**/tokens/**`, `#app` → `['src/**','app/**']`); repo-local → package-relative (`packages/basalt-ui/src/charts/**`, …). `shippedOnly`/`repoOnly` filter per target (antd → shipped only; `no-console:off` → repo only). `replaceBans` makes the charts glob emit the **complete** `no-restricted-imports` list (faithfully omitting `@visx/*`), never inherit-and-add. **D2 closes**: `./tokens.forbiddenImports` is non-empty, so the shipped projection emits the missing tokens override.
- **PROJECTION 4 — `managedFiles()` manifest.** The rules portion (`cli/index.ts:520`) maps `RULE_NAMES`; everything else (CLAUDE-block, DESIGN-seed, oxfmt/lefthook copies, `.oxlintrc` seed-stub) stays declarative. **Critical:** the `.oxlintrc.json` seed-stub's `source:'configs/oxlint.json'` is **doc-only** — the projection must NOT treat it as bytes-to-copy (`render()` emits the inline extends-stub). Resolves §7 #11: leave as `seed`.
- **PROJECTION 5 — triad + plugin-skill coverage.** One `check-coverage` test asserts: every `doctrine` spec's `guardKinds ⊆ keyof GUARD_RULES`; its `rule` exists on disk; its `skill[]` entries exist in `plugin.json`. `tooling` surfaces are exempt by the discriminant. `plugin.json.skills` is checked (not derived — §7 #12) as the deduped union over `doctrine.skill`. A separate **subpath-export-coverage** assertion confirms every non-`#`, non-`.` JS-subpath key has a `package.json.exports` entry.
  **CRITIC-FIX (synthetic `#`-surface semantics — make explicit):** synthetic `#`-keys (`#router`/`#query`/`#state`/`#app`) participate in the **rule-existence** check (their `rule` must map to an on-disk `basalt-*.md`) and the **`guardKinds ⊆ keyof GUARD_RULES`** check, but their `skill[]` feeds the `plugin.json.skills`-union assertion **only** — a synthetic glob-carrier (`#app`) does NOT get an independent per-surface skill-coverage *row* (it is a projection artifact, not a user-facing surface). Iterate skill-coverage over the **deduped rule set**, not per-spec, so `#app`+`.` both carrying `rule:'mantine'` assert `basalt-mantine.md` once.

### A.4 The deep-equal sync-contract test (grafted from B — the airtight projection guarantee)

`tests/oxlint-preset-sync.test.ts` (root, off the package boundary) calls `projectBanList('shipped')` / `projectBanList('repo')`, reads the committed `configs/oxlint.json` + root `.oxlintrc.json`, and asserts **deep-equal on the `overrides` array** — drift is red. Plus two **named** assertions:
- `charts override permits @visx/*` — asserts no `@visx/*` pattern in the projected charts override (proves the re-allow holds).
- `tokens override bans @visx/* AND @mantine/*` in both targets (proves D2 closure).

This is what makes "generated, never hand-forked" mechanically true rather than asserted.

### A.5 Generator scope (resolves §7 #8)

The generator owns **only** the `no-restricted-imports` overrides array + the `#app` global block. The shared base (plugins, categories, the 11 rules at `oxlint.json:3-28`) stays a hand-maintained template the generator splices into — smaller blast radius, fewer regenerated lines to review. Per-target extras handled by `shippedOnly`/`repoOnly` + `ruleOverrides` (resolves §7 #9).

### A.6 The root `.` re-export ban — flagged honest, not faked

The "root barrel forbidden from re-exporting `./charts`/`./tokens`" invariant is enforced today *only by a comment* (`index.ts:5-6`). We leave `'.'.forbiddenImports: []` and **do not** invent an oxlint rule for it — oxlint can't express "this barrel may not re-export from these local paths" without a custom AST plugin (a Phase-4 `oxlint-plugin-ast-guards` candidate). The spine does not pretend a guard exists; it is documented in the `mantine` rule and noted as a Phase-4 plugin candidate.

---

## B. BasaltRegister — the augmentable design seam

### B.1 The empty interface + the single `Slot<K,C>` extractor (from A — the minimal mechanism)

```ts
// src/register.ts — re-exported from the root barrel ".". Augmented via `declare module 'basalt-ui'`.
import type { SeriesMap } from './tokens' // type-only; SeriesMap = Record<string, ColorPair>

/**
 * The one augmentable seam — TanStack Router/Query's `interface Register {}` applied to the whole app
 * shape. Declaration-merge your truth ONCE per concern, in that concern's own file. Every slot is
 * optional and defaults to a never-keyed empty type; a charts-only consumer augments only `series`
 * (or nothing) and pays zero cost.
 *
 * @example
 * // src/theme/series.ts — augment ONE slot in its own file, 3 lines:
 * declare module 'basalt-ui' {
 *   interface BasaltRegister { series: typeof DEMO_SERIES }
 * }
 */
export interface BasaltRegister {}

/**
 * Extract a slot or fall back to the NEVER-KEYED EMPTY OBJECT `{}`.
 * `{}` → keyof = never (correct). `Record<string,never>` → keyof = string (silent widening — FORBIDDEN).
 * `infer S extends Constraint` is a BOUND-CHECK, not a cast — an ill-typed augment falls through to `{}`
 * rather than poisoning the union. This ONE generic is the frozen mechanism every future battery slot
 * (commands, overlays, notifications, router, query) instantiates against; only `series` ships in Phase 1.
 */
export type Slot<K extends string, Constraint> =
  BasaltRegister extends { [P in K]: infer S extends Constraint } ? S : {}

/** The consumer's registered series map, or `{}` when un-augmented. */
export type Series = Slot<'series', SeriesMap>

/** The legal series keys — Extract<…,string> drops the symbol/number members keyof always includes
 *  (§6.3), so the literal union never widens via a symbol key. */
export type SeriesKey = Extract<keyof Series, string>
//        ^ un-augmented: never  |  augmented {sessions,signups,revenue,churn}: that exact union
```

### B.2 The `{}`-vs-`Record<string,never>` lock + symbol guard

`keyof {}` is `never` — an un-augmented consumer's `SeriesKey` is `never`, so a color accessor typed `(key: SeriesKey)` is uncallable until they register a series (correct: no series, no keys → progressive disclosure). `keyof Record<string,never>` is `string` — silent widening that would accept every string as a "legal" key (the TS 6.0.3 footgun). The default `{}` and the `Extract<keyof, string>` symbol guard are baked into this one place. Both behaviors are locked by fixtures J.1 / J.2.

### B.3 Module split + export site (resolves §7 #13)

- `src/surfaces.ts` — the **enforcement** registry (G1). Imports only `./guard/types`. Mantine-free, dependency-free (the CLI + oxlint generator import it).
- `src/register.ts` — the **design** seam (G3): `BasaltRegister`, `Slot`, `Series`, `SeriesKey`, plus §D house-style primitives. May import a *type* from `./tokens`.
- `src/state.ts` — `createPersistedState` (§E), its own module so a non-Mantine consumer can reach it via `./state`.
- `src/index.ts` — re-exports `register.ts` + `state.ts`.

Separate modules keep G1 (enforcement, edits `cli/index.ts`) and G3 (design, edits `register.ts` + barrel) on disjoint file sets. `BasaltRegister` belongs on the root barrel `.` (the Mantine-coupled surface read by conditional inference) because `declare module 'basalt-ui'` targets the package main entry — a consumer cannot augment `basalt-ui/charts`.

---

## C. ./guard — headless policy core

### C.1 `checkSource` signature + `cfg` shape

```ts
// src/guard/types.ts — Mantine-free, dependency-free (zero imports beyond TS types).
export type GuardKind =
  | 'raw-hex' | 'raw-color-fn' | 'localstorage-theme' | 'off-identity-accent'
  | 'raw-spacing' | 'raw-radius' | 'raw-surface' | 'off-system-surface-var'
  | 'raw-html-layout' | 'inline-spacing' | 'inline-display' | 'raw-visx-axis' // exactly 12

/** A structured finding — the chosen testable surface (see C.4). Renames the current `Violation`. */
export type Finding = { readonly relPath: string; readonly line: number; readonly token: string; readonly kind: GuardKind }

/** Everything a single-file scan needs — no walk, no FS. Collapses the positional 9-field patterns bag
 *  (cli/index.ts:170-184): the 3 dynamic regexes are DERIVED here from cfg, never passed in. */
export type GuardConfig = {
  readonly spacingSteps: readonly number[]      // default [10,12,16,20,32]
  readonly forbiddenAccents: readonly string[]  // default ['teal','violet','grape','indigo','pink']
  readonly rawSurface: boolean
  readonly offSystemSurfaceVar: boolean
  readonly rawHtmlLayout: boolean
  readonly inlineSpacing: boolean
  readonly inlineDisplay: boolean
  readonly rawVisxAxis: boolean
  /** Allow-comment policy: a line containing this substring is skipped. Default 'theme-allow'
   *  (pure-comment lines are always skipped, cli/index.ts:190/195). */
  readonly allowComment: string
}
```

```ts
// src/guard/index.ts — Mantine-free, dependency-free. The defaults exported so CLI + tests share one source.
export const DEFAULT_GUARD_CONFIG: GuardConfig

/**
 * Scan ONE file's text for theme-guard violations. Pure: same (text, relPath, cfg) → same Finding[].
 * No FS, no walk, no console. The 3 dynamic regexes (forbiddenAccent, spacing, radius) are derived
 * INTERNALLY from cfg. isChartFile(relPath) is applied internally so the oxlint-plugin / PreToolUse-hook
 * adapters — which have one file's text and NO walk — get correct kind-applicability for free.
 *
 * @example
 * const findings = checkSource(src, 'src/Dashboard.tsx', DEFAULT_GUARD_CONFIG)
 * if (findings.some((f) => f.kind === 'raw-hex')) { ... }
 */
export function checkSource(text: string, relPath: string, cfg: GuardConfig): Finding[]
```

### C.2 The `GUARD_RULES` registry shape

`GUARD_RULES` is a `Record<GuardKind, GuardRule>` so the triad test asserts `surface.guardKinds ⊆ keyof GUARD_RULES` at runtime, and the type makes a missing kind a tsc error:

```ts
type GuardRule = {
  readonly kind: GuardKind
  /** Static regex, or a builder over cfg for the 3 dynamic kinds (forbiddenAccent/spacing/radius). */
  readonly pattern: RegExp | ((cfg: GuardConfig) => RegExp)
  /** Path-applicability: e.g. raw-visx-axis only fires in chart files (isChartFile). */
  readonly appliesTo?: (relPath: string) => boolean
  /** Knob gating (rawSurface/inlineSpacing/…); always-on kinds (raw-hex etc.) omit it. */
  readonly enabled?: (cfg: GuardConfig) => boolean
  /** The per-kind fix-hint message (moves here from the 14-line stderr blob at cli/index.ts:350-364). */
  readonly message: string
}
export const GUARD_RULES = { /* 12 entries; raw-surface = 3 patterns, one kind; raw-html-layout = the
                                one multi-regex line predicate handled inline */ } satisfies Record<GuardKind, GuardRule>
```

`checkSource` iterates `GUARD_RULES` (+ the inline raw-html-layout three-regex check), skipping `allowComment` and pure-comment lines, pushing `Finding`s. No kind logic lives outside the registry, so a future oxlint plugin's rule body literally `for (const r of GUARD_RULES)`.

### C.3 What stays the thin walker

**Into `./guard`:** all regex consts (`cli/index.ts:90-155`), the two `DEFAULT_*` arrays (L90-91), `isChartFile`/`AXIS_WRAPPER_FILE`, the 2 dynamic-regex builders, the `Violation` type (→ `Finding`), the per-line scan body (L186-253).

**Stays in `cli/index.ts` as the thin FS walker:** `walkTsFiles` (L257-277), `readBasaltConfig` (L159-168), roots/exempt resolution + relative-path normalization (L321-329), grouping/reporting/exit-code (L331-367). `checkTheme()` becomes: read cfg → build `GuardConfig` → walk → per file `checkSource(text, rel, cfg)` → group → report → exit.

### C.4 The chosen test surface — structured `Finding[]`, NOT stderr capture (resolves §3.5)

`checkSource` returns `Finding[]`; the CLI's walker owns the `console.error` formatting. The extraction is the moment to choose the testable surface, and a structured array is: decoupled from `console.error` capture; exact-assertable (`expect(findings).toContainEqual({kind:'raw-hex', line:3, …})`); adapter-neutral (the oxlint plugin maps `Finding → diagnostic`, the hook maps `Finding[] → permissionDecisionReason`, the CLI maps `Finding[] → grouped stderr + exit code`); order-stable and diffable. None of the three adapters can fork the policy because they all consume the one return shape. The existing temp-dir `check-theme.test.ts` stays as the walker integration test; the new unit tests assert `checkSource` directly. All three designs converged here.

---

## D. House style — cross-boundary contracts

### D.1 `StandardSchemaV1<In, Out>` — vendored spec, not a dependency

```ts
// src/register.ts — the published Standard Schema v1 `~standard` contract, vendored verbatim (it is a
// SPEC, not a package; ~25 lines, zero deps). Zod 4 / Valibot / ArkType all implement `~standard` and
// are assignable. Every validation boundary (createPersistedState, future form resolver, route search,
// agent payloads) types against THIS — never `ZodSchema`. Basalt invents ZERO validation primitive.
//
// @example createPersistedState('draft', { schema: z.object({ title: z.string() }), version: 1 })
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': {
    readonly version: 1
    readonly vendor: string
    readonly validate: (
      value: unknown,
    ) => StandardSchemaV1.Result<Output> | Promise<StandardSchemaV1.Result<Output>>
    readonly types?: { readonly input: Input; readonly output: Output }
  }
}
export namespace StandardSchemaV1 {
  export type Result<Output> =
    | { readonly value: Output; readonly issues?: undefined }
    | { readonly issues: readonly Issue[] }
  export type Issue = { readonly message: string; readonly path?: readonly PropertyKey[] }
  export type InferOutput<T> = T extends StandardSchemaV1<infer _, infer O> ? O : never
}
```

> **FLAG for `/research` before freeze:** the exact `~standard` field shape (the spec is post-cutoff). The *design decision* — ship our own copy of the interface, type against it, zero validation peer — is firm regardless. Re-verify field names via `/research` (research-gateway) before the G3 commit; do not assert byte-correctness from memory (research-first rule).

### D.2 `AsyncState<T,E>` + `assertNever` + the fourth-variant gate

```ts
// src/register.ts
/**
 * The house discriminated-union shape — N valid states, not 2ⁿ. data present ONLY in 'success',
 * error ONLY in 'error'. The shape AgentPart / notification kinds / command results copy in later phases.
 *
 * @example
 * function view<T>(s: AsyncState<T>) {
 *   switch (s.status) {
 *     case 'idle':    return null
 *     case 'loading': return <Spinner/>
 *     case 'success': return <Data value={s.data}/>
 *     case 'error':   return <Err e={s.error}/>
 *     default:        return assertNever(s) // tsc errors here if a variant is unhandled
 *   }
 * }
 */
export type AsyncState<T, E = Error> =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'success'; readonly data: T }
  | { readonly status: 'error'; readonly error: E }

/** Exhaustiveness sentinel. A bare `default: return null` is FORBIDDEN house-style. The `never` param
 *  turns an unhandled union member into a compile error. */
export function assertNever(value: never): never {
  throw new Error(`Unhandled discriminated-union variant: ${JSON.stringify(value)}`)
}
```

The fourth-variant compile fixture (J.4) proves adding a variant without a case is a tsc error — the gate that lets the enforcement axis's Tier-1 unhandled-variant lint be deleted.

### D.3 Eden-treaty-seam doctrine (resolves §7 #16 — doctrine ONLY, no wiring)

Shipped as an `@example`-bearing JSDoc block in `register.ts` next to `StandardSchemaV1`, **and** as prose in `agent/rules/basalt-query.md`. No `treaty<App>` wiring, no `./query` export, no `eden`/`@elysiajs/eden` peer in Phase 1.

```ts
/**
 * EDEN-TREATY SEAM (house-style DOCTRINE — basalt ships no treaty wiring; that lands in the Phase-4
 * ./query battery). The seam is a `typeof` seam, never codegen:
 *   export type App = typeof app      // Elysia app
 *   const api = treaty<App>(url)       // Eden infers the whole API from the type
 *
 * THREE silent-`any` footguns — each drops a type to `any` with NO error:
 *   1. Elysia routes MUST be method-chained (`app.get(...).post(...)`) — a non-chained route silently
 *      drops App to `any`.
 *   2. Client & server tsconfig path aliases MUST match — a mismatch erases the inferred types.
 *   3. An `async function*` STREAM route MUST declare `: AsyncGenerator<AgentPart>` and carry NO
 *      t.Object/t.Union response schema (eden #231) — the inner union drops to `any`. Validate at yield-time.
 */
```

---

## E. createPersistedState — Mantine-free `useSyncExternalStore` primitive

### E.1 Module home — a new `./state` subpath

It must be reachable by a charts/tokens-only consumer **without** pulling `@mantine/*`, and it uses React's `useSyncExternalStore` (React is a peer, allowed everywhere). It is React state, not tokens/charts (folding it there is a category error), and it must not be on the Mantine-coupled root barrel. **Home: a new Mantine-free `src/state.ts`, exported as a new `./state` JS subpath** — parallel to `./guard`. The `#state` SURFACES entry already predicts this slot (it carries the `localstorage-theme` guard + `basalt-state.md` rule). Adding the subpath requires a separate `chore:` lockfile commit (§6.2).

### E.2 The ~30-line primitive

```ts
// src/state.ts — Mantine-free, React-only (react is a peer), Standard-Schema validated.
import { useSyncExternalStore } from 'react'
import type { StandardSchemaV1 } from './register' // type-only import — verbatimModuleSyntax safe

export type PersistedStateOptions<T> = {
  readonly key: string
  readonly version: number
  readonly initial: T
  /** Migrate a previous-version persisted value forward. */
  readonly migrate?: (persisted: unknown, fromVersion: number) => T
  /** Standard-Schema validate the (post-migrate) value. Invalid → falls back to `initial`. Sync path
   *  only — an async schema (returns a Promise) is treated as invalid (sync storage can't await). */
  readonly schema?: StandardSchemaV1<unknown, T>
}

/**
 * Versioned, Standard-Schema-validated localStorage state via useSyncExternalStore (no zustand).
 * SSR-safe (getServerSnapshot returns `initial`). Cross-tab via the storage event. Keys are namespaced
 * `basalt:*` so they never collide with the `localstorage-theme` guard pattern. Common case is 3 lines.
 *
 * @example
 * export const useFilterDraft = () =>
 *   createPersistedState({ key: 'filters', version: 1, initial: DEFAULT, schema: FilterSchema })
 * // in a component:
 * const [draft, setDraft] = useFilterDraft()
 */
export function createPersistedState<T>(
  opts: PersistedStateOptions<T>,
): () => readonly [T, (next: T) => void]
```

Read path: parse the `{ v, value }` envelope → migrate if `v !== version` → validate; invalid/absent → `initial`. SSR guard: `typeof window === 'undefined'` returns `initial` (no subscribe).

---

## F. Provider freeze — BasaltErrorBoundary + onError(error, ctx) + nonce (resolves §7 #15, #14)

### F.1 The error boundary + `onError` (ship together — no no-op prop)

```ts
// src/provider/index.tsx
import { Component, type ErrorInfo, type ReactNode } from 'react'

/** Where an error surfaced — drives consumer routing (a render error vs a global rejection differ). */
export type BasaltErrorContext =
  | { kind: 'render'; info: ErrorInfo }
  | { kind: 'window'; event: ErrorEvent }
  | { kind: 'unhandledrejection'; reason: unknown }

export type BasaltProviderProps = {
  children: ReactNode
  theme?: MantineProviderProps['theme']
  injectPalette?: boolean        // ALREADY SATISFIED (provider/index.tsx:32, default true) — no work
  paletteOptions?: BuildPaletteOpts
  defaultColorScheme?: MantineProviderProps['defaultColorScheme']
  /**
   * Report errors caught by the in-provider boundary AND global window/unhandledrejection listeners.
   * Unset → console.error in dev (NODE_ENV !== 'production'), no-op in prod. NEVER a no-op prop — the
   * BasaltErrorBoundary + listeners that feed it ship in this same freeze.
   * @example <BasaltProvider onError={(e, ctx) => Sentry.captureException(e, { tags: { kind: ctx.kind } })}>
   */
  onError?: (error: unknown, ctx: BasaltErrorContext) => void
  /** CSP nonce for the raw palette <style> at provider/index.tsx:60 — the one element ...rest can't reach. */
  nonce?: string
} & Omit<MantineProviderProps, 'children' | 'theme' | 'defaultColorScheme'>
```

A real `BasaltErrorBoundary` class (`getDerivedStateFromError` / `componentDidCatch`) wraps `BasaltBridge` + children **inside** `MantineProvider` (so a thrown render error still has theme context for a fallback). `componentDidCatch` → `onError(error, { kind: 'render', info })`. A `useEffect` in `BasaltBridge` registers `window` `'error'` and `'unhandledrejection'` listeners → `onError(…, { kind: 'window'/'unhandledrejection' })`, **SSR-guarded** (`typeof window !== 'undefined'`), removed on unmount. `BasaltErrorBoundary` is **also exported** so consumers can mount nested boundaries. Default when `onError` unset: dev → `console.error` (`process.env.NODE_ENV`, never `import.meta.env` — CLAUDE.md ban); prod → no-op.

### F.2 nonce threading (resolves §7 #14)

The raw palette `<style>` at `provider/index.tsx:60` receives `nonce` directly: `<style nonce={nonce}>{buildPaletteCss(paletteOptions)}</style>`. This is the **one element `...rest` provably cannot reach** (it is basalt's own JSX, not a Mantine prop), which justifies the dedicated prop. Mantine's own injected styles get their nonce via the existing `...rest` passthrough.

> **FLAG for `/research` before freeze:** Mantine v9's exact nonce mechanism through the spread (does `MantineProvider` accept a top-level `nonce`, or is it `getStyleNonce: () => string`, and does it flow through `...rest`?). Designs A's research claimed `getStyleNonce: () => string` reachable via `...rest` (no extra work), but per research-first this must be re-confirmed via `/research` (research-gateway) before the G4 commit — do not assert the prop name from memory. The dedicated `nonce?: string` prop owns the L60 `<style>` regardless of the Mantine-side outcome; document that a CSP consumer also passes Mantine's nonce mechanism via `...rest` once research pins the name.

---

## G. Chart-color hole closure (resolves §7 #3 — owner-resolved IN SCOPE)

Re-type the two dynamic-color props against `SeriesKey`. Bars stays untouched (literal `color: string`, `Bars.tsx:27,39,51`, per owner resolution).

```ts
// src/charts/kinds/Donut.tsx:14  — was: colorForKey: (key: string) => string
import type { SeriesKey } from '../../register' // type-only; erased at runtime, no @mantine value
colorForKey: (key: SeriesKey) => string

// src/charts/kinds/StackedArea.tsx:28 — was: colorForGroup: (group: string) => string
colorForGroup: (group: SeriesKey) => string
```

**Boundary-safe wiring (conflict resolved):** `SeriesKey` is **re-exported type-only from `./charts`** (`src/charts/index.ts`: `export type { SeriesKey } from '../register'`), and the kinds import it from `../../register` directly. This avoids A's `tokens → register` coupling edge (two judges flagged it as a category smell). A pure type re-export from a Mantine-free module is clean — oxlint bans `@mantine/*` *imports* (values), and `SeriesKey` is erased; `register.ts` imports only the `SeriesMap` *type* from `./tokens`. One type-only edge, no value cycle, no Mantine leak. **CRITIC-FIX (verified):** the `register → tokens` (type) / `charts → register` (type) / `charts → tokens` (re-export) triangle is type-only and erased, AND there is **no `import/no-cycle` lint rule** enabled in either `.oxlintrc.json` or `configs/oxlint.json` (grep-confirmed), so the triangle trips no cycle guard. The G5 implementer needs no extra accommodation.

**The consumer cast disappears** (`apps/playground/src/demo/series.ts:35`). Once `colorForKey: (key: SeriesKey) => string`, the playground augments and `demoColor` becomes exact-keyed:

```ts
// apps/playground/src/demo/series.ts
declare module 'basalt-ui' {
  interface BasaltRegister { series: typeof DEMO_SERIES }
}
// SeriesKey → 'sessions'|'signups'|'revenue'|'churn'. The cast + ?? fallback are GONE:
export function demoColor(key: SeriesKey): string {
  return demoColors[key] // exact-keyed; no Record<string,string|undefined> cast, no `?? 'var(--vx-line)'`
}
```

`demoColors[key]` is now `string` (exact-keyed × `SeriesKey = keyof DEMO_SERIES`), not `string | undefined`. A renamed series key fails tsc at the Donut/StackedArea call site. A charts-only consumer who never augments `series` gets `colorForKey: (key: never) => string` — intentionally unusable until they register a series (progressive disclosure).

---

## H. Fixture architecture — THE RECOMMENDATION (owner's open question §7 #1)

### H.1 What the fixtures test, and who owns them

|-|-|-|
| Fixture | Tests | Vantage |
|-|-|-|
| `augments-nothing` / `augments-all` | The package's **public type seam** as a *consumer* sees it (declaration-merge → `keyof` resolution) | Consumer-of-the-package |
| `asyncstate-fourth-variant` | A **house-style discipline** the consumer copies (exhaustive switch + `assertNever`) | Consumer-authored code |
| `surfaces-broken` | The package's **internal literal-union teeth** (a bad rule/kind name, and an illegal tooling `rule`, are tsc errors) | Package-internal contract |
| `series.type-guard.ts` (existing) | The package's public **factory return type** is exact-keyed | Consumer-of-the-package |

### H.2 The recommendation — hybrid in the playground, NOT a dedicated workspace package

**Compile fixtures live in `apps/playground/src/*.type-guard.ts`** (next to the existing `series.type-guard.ts`). **Runtime fixtures live in root `tests/` + co-located `src/guard/*.test.ts`.** Plus a **one-line dist-vantage assertion folded into the existing pack-test**.

The reasoning, against the four candidates:

- **(b) package-internal `src/**/*.test.ts` — REJECTED twice.** `packages/basalt-ui/tsconfig.json:14` excludes `*.test.*` from tsc → a compile `@ts-expect-error` there is invisible (runtime-only); and it is on the `packages/basalt-ui/**` commit boundary (the `isolated-basalt-ui` guard + semantic-release commit-back).
- **Root `tests/` for compile fixtures — REJECTED.** Verified: root `tsconfig.json` includes only `scripts/**`, so `tests/` is in **no** tsconfig include → a `@ts-expect-error` there is **DEAD**. The docs' "mirror series.type-guard.ts in tests/" is internally inconsistent. `series.type-guard.ts` works *only* because it sits in playground `src` (a typechecked include).
- **(c) dedicated `apps/type-tests` workspace package (B's choice) — REJECTED for Phase 1.** Two of three panels penalized it hard on the Tanner bar: it adds a `package.json` + tsconfig + `workspace:*` dep + CI wiring + a second fixture location, buying only "fresh-consumer isolation" that the playground's `workspace:*` resolution already provides. Worse, B's broken fixture imports `SurfaceSpec` from `basalt-ui/surfaces` — a subpath that **does not exist** in `package.json.exports` (verified) — so it would either grow the frozen public surface by exposing the internal enforcement registry's type, or need a tsconfig path-alias hack. That is exactly the minimal-frozen-surface discipline A/C respect by keeping fixtures in the playground and re-exporting `SurfaceSpec` from the existing barrel. Revisit a dedicated package only when fixtures need *multiple conflicting augmentation states* in isolation (a real future driver, not Phase 1).
- **(d) dist-consumer-vantage — ADDED as a thin pack-test assertion.** The pack-test already scratch-installs the tarball; add one `.ts` that imports from the installed `basalt-ui` and runs `tsc` against the dist `.d.ts`. This is the only vantage that catches a tsup `.d.ts`-emission regression (a type that compiles in `src` but doesn't survive declaration emit). **CRITIC-FIX (implementer brief must specify):** the current `pack-test.sh` scratch-installs only `react react-dom @mantine/core @mantine/hooks` and runs `node test.mjs` (runtime resolution only — never `tsc`). The dist-vantage assertion therefore adds (1) `typescript` to the scratch `bun add`, (2) a scratch `tsconfig.json` with the **same strict flags as the package** (`strict`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `isolatedModules`, `noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature` — the `.d.ts` vantage only catches a declaration-emit regression *under the same strict flags*), and (3) a `tsc --noEmit` invocation against the new `.ts`. It is one extra `.ts` plus three lines of scratch setup, not a package — but the brief must name all three so the G5 implementer doesn't ship a no-op.

### H.3 The coexistence insight that makes the playground work (A's sharpest call, judge-consensus)

The playground compilation globally sees the `declare module 'basalt-ui' { interface BasaltRegister { series } }` augment (from G's chart-color closure). So `augments-nothing` **cannot** assume `SeriesKey` is `never` in that compilation. Resolution (the load-bearing fixture-correctness call all three judges flagged as mandatory): **`augments-nothing` tests `Slot<'nonexistent', X>` resolving to `{}` (keyof → never)**, which holds *regardless* of what `series` augment exists globally. `augments-all` tests `SeriesKey` resolving to the exact DEMO union. Both compile together in one playground compilation — no dedicated package needed. (Both B and C shipped a contradictory `augments-nothing` that assumed global emptiness; only A confronted this.)

### H.4 The expose for `surfaces-broken`

The broken fixture needs the `SurfaceSpec` *type*. **Re-export `SurfaceSpec` (and `RuleName`/`GuardKind`/`SkillName` for completeness) type-only from the root barrel** (`src/index.ts`) — the value `SURFACES` stays internal. This keeps the fixture consumer-side and typechecked without exposing the registry value or adding a `./surfaces` subpath.

### H.5 Naming convention (resolves §7 #2)

**Codify:** `*.type-guard.ts` = compile fixture (in tsc include, OUT of `bun test`); `*.test.ts` = runtime fixture (in `bun test`, excluded from tsc). Document in `apps/playground/CLAUDE.md`. The convention is load-bearing — a mis-named compile fixture is silently un-typechecked.

---

## I. Self-dogfood wiring (resolves §7 #17 — with B's producer/consumer correction)

`package.json` already has `"basalt": { "roots": ["src"] }` (verified) — correct, points at real package src, not argo defaults. The gap is that nothing invokes it.

- **`.github/workflows/ci.yml`** — add **`check-theme` only** (NOT `sync --check` — see below).
  **CRITIC-FIX:** pin ONE invocation, no `bunx` fallback (`bunx` bypasses the `minimumReleaseAge`
  cooldown and can re-fetch — a supply-chain concern in a shipped CI file). Run the package's own bin
  directly against its own `basalt.roots:["src"]` (verified: `package.json.bin.basalt = "./bin/basalt.mjs"`,
  `basalt.roots = ["src"]`):
  ```yaml
  - name: Theme guard (dogfood check-theme on basalt's own src)
    working-directory: packages/basalt-ui
    run: bun ./bin/basalt.mjs check-theme
  ```
  The G7 implementer **verifies this exact command resolves locally** (`cd packages/basalt-ui && bun ./bin/basalt.mjs check-theme` exits 0 on clean src) before writing it into `ci.yml` — pin the verified form, do not ship a try/fallback.
- **`lefthook.yml`** — add a pre-commit `check-theme` command scoped to staged `packages/basalt-ui/src/**` (the glob gates *whether* it runs; check-theme walks all roots regardless of the staged subset — acceptable, it's fast).
- **`sync --check` goes into the shipped CONSUMER `configs/check.yml` template, NOT basalt's own ci.yml** (grafted from B; verified: no `.basalt/manifest.json` exists). Basalt is the *producer* — it has no manifest, so `sync --check` on itself would report every managed file out-of-date (theatre). The drift gate belongs where a consumer runs it.

These are root files (`ci.yml`, `lefthook.yml`) off the `packages/basalt-ui/**` boundary → a **separate commit** (`ci:`-typed, no release).

---

## J. The four compile fixtures + runtime guard fixtures

```ts
// J.1 apps/playground/src/register-augments-nothing.type-guard.ts
import type { Slot } from 'basalt-ui'
type Empty = Slot<'nonexistent', Record<string, unknown>>
export function f1(): keyof Empty {
  // @ts-expect-error keyof {} is `never` — a string key is NOT assignable, proving {} (keyof→never),
  // NOT Record<string,never> (keyof→string). Holds regardless of the global `series` augment (H.3).
  return 'anyKey'
}
// PROVES: an un-augmented slot defaults to never-keyed {}. Locks the {} vs Record<string,never> footgun.
```

```ts
// J.2 apps/playground/src/register-augments-all.type-guard.ts
import type { SeriesKey } from 'basalt-ui/charts' // resolves to DEMO_SERIES keys via the playground augment
const SYM: unique symbol = Symbol()
export function f2(k: SeriesKey) {
  const ok: 'sessions' | 'signups' | 'revenue' | 'churn' = k // exact union, no widening, no symbol leak
  // @ts-expect-error a symbol VALUE is NOT in SeriesKey (Extract<keyof,string> dropped symbol keys).
  // CRITIC-FIX: assign a REAL symbol value, NEVER `Symbol() as never` — `never` is assignable to
  // everything, so that cast makes the directive UNUSED (TS2578) and the fixture theatre.
  // (critic-verified on TS 6.0.3: `Symbol() as never` → EXIT 2; this `unique symbol` form → EXIT 0.)
  const bad: SeriesKey = SYM
  return [ok, bad]
}
// PROVES: an augmented slot resolves to exact literal keys + Extract<,string> keeps symbol keys out.
```

```ts
// J.3 apps/playground/src/surfaces-broken.type-guard.ts
import type { SurfaceSpec } from 'basalt-ui' // type-only re-export from the root barrel (H.4)
// CRITIC-FIX: a single @ts-expect-error suppresses ONLY the immediately-following line. The earlier
// one-directive-over-a-multi-line-literal form left the skill/guardKinds errors UNSUPPRESSED (TS2322,
// EXIT 2). Each bad field needs its OWN directive on the line directly above it. The literal MUST be
// formatted one-field-per-line. (critic-verified on TS 6.0.3: this form → EXIT 0.)
const broken: SurfaceSpec = {
  kind: 'doctrine',
  layer: 'headless',
  // @ts-expect-error 'not-a-rule' is not a RuleName — literal-union rejects
  rule: 'not-a-rule',
  // @ts-expect-error 'nope' is not a SkillName
  skill: ['nope'],
  // @ts-expect-error 'fake-guard' is not a GuardKind
  guardKinds: ['fake-guard'],
  forbiddenImports: [],
}
const badTooling: SurfaceSpec = {
  kind: 'tooling',
  layer: 'headless',
  forbiddenImports: [],
  // @ts-expect-error a tooling surface CANNOT carry `rule` (rule?: never) — the OTHER direction of the teeth
  rule: 'tokens',
}
export { broken, badTooling }
// PROVES (both directions): the SURFACES literal-union teeth actually FIRE — not theatre. (Graft from B.)
```

```ts
// J.4 apps/playground/src/asyncstate-fourth-variant.type-guard.ts
import { assertNever, type AsyncState } from 'basalt-ui'
type Extended = AsyncState<number> | { status: 'refreshing'; data: number }
export function render(s: Extended): string {
  switch (s.status) {
    case 'idle': return 'idle'
    case 'loading': return 'loading'
    case 'success': return String(s.data)
    case 'error': return String(s.error)
    // @ts-expect-error 'refreshing' is unhandled — `s` is not `never`, assertNever rejects it
    default: return assertNever(s)
  }
}
// PROVES: adding a variant without a case is a tsc error via assertNever — gates the Tier-1 lint deletion.
```

**Runtime guard fixtures** (`src/guard/check-source.test.ts` unit + `tests/check-theme.integration.test.ts`):
- **Unit** (co-located, excluded from tsc) — assert `checkSource(text, relPath, DEFAULT_GUARD_CONFIG)` returns the exact `Finding[]` for **all 12 kinds** (the existing `check-theme.test.ts` covers only 6). Plus: one `theme-allow` skip test, one pure-comment-skip test, one `isChartFile`-gates-`raw-visx-axis` test (fires in `src/charts/k.tsx`, not in `src/page.tsx`). The structured-return surface (C.4) pays off here.
- **Integration** (root `tests/`) — the existing temp-dir + exit-code contract for the walker/reporter half.

---

## K. Module/file map + the implement-phase disjoint groups

```
packages/basalt-ui/src/
  surfaces.ts            ← G1: SURFACES, SurfaceSpec, RuleName, SkillName, RULE_NAMES (imports only ./guard/types)
  guard/types.ts         ← G1: GuardKind, Finding, GuardConfig
  guard/index.ts         ← G1: GUARD_RULES, checkSource, DEFAULT_GUARD_CONFIG (dep-free, Mantine-free)
  guard/check-source.test.ts  ← G5
  register.ts            ← G3: BasaltRegister, Slot, Series, SeriesKey, AsyncState, assertNever, StandardSchemaV1
  state.ts               ← G3: createPersistedState (→ ./state subpath)
  index.ts               ← G3+G4: re-export register/state + type-only SurfaceSpec; G4 also for provider
  provider/index.tsx     ← G4: onError + BasaltErrorBoundary + nonce
  charts/index.ts        ← G5: type-only re-export of SeriesKey
  charts/kinds/{Donut,StackedArea}.tsx  ← G5: SeriesKey re-type (depends on G3's register.ts)
  cli/index.ts           ← G1 + G6: RULE_NAMES derivation + guard extraction + check-coverage
packages/basalt-ui/scripts/gen-oxlint.ts  ← G2
apps/playground/src/*.type-guard.ts        ← G5 (compile fixtures)
apps/playground/src/demo/series.ts         ← G5 (augment + drop cast)
tests/oxlint-preset-sync.test.ts           ← G2
tests/check-theme.integration.test.ts      ← G5
.oxlintrc.json, configs/oxlint.json        ← G2 (regenerated)
.github/workflows/ci.yml, lefthook.yml     ← G7 (dogfood)
```

**Build-order (the sequencing law: Register → SURFACES → guard → createPersistedState).** Concretely: `guard/types.ts` first (both `surfaces.ts` and `guard/index.ts` depend on `GuardKind`), then `surfaces.ts` + `guard/index.ts` (G1), then `register.ts` (G3), then `state.ts` (G3, depends on `register.ts`'s `StandardSchemaV1`), then the barrel, then provider (G4), then the chart re-type + fixtures (G5).

**Disjoint @implementer groups (respecting the G1 collision):**

|-|-|-|
| Group | Files (disjoint) | Sequencing / collision |
|-|-|-|
| **G1 (one mandatory group)** | `surfaces.ts`, `guard/{types,index}.ts`, `cli/index.ts` (RULE_NAMES derive + guard extraction), `package.json` (+`./guard` export) | **⚠ RULE_NAMES derivation AND guard extraction both edit `cli/index.ts` → ONE group** (file-ownership rule). `agent/rules/*` read-only. |
| **G6 (sequence AFTER G1 commits)** | `cli/index.ts` (`check-coverage` subcommand), plugin-skill coverage, move `tests/plugin-version-lockstep.test.ts` under the registry suite | **⚠ also edits `cli/index.ts`** → sequence after G1, separate commit (folding bloats G1 past one concern). |
| **G2 (after G1)** | `scripts/gen-oxlint.ts`, `configs/oxlint.json` (regen), `.oxlintrc.json` (regen), `tests/oxlint-preset-sync.test.ts` | Depends on G1's `SURFACES`. Closes D2. Root files separate from package commit. |
| **G3 (after G1; parallel-safe with G2 — disjoint)** | `register.ts`, `state.ts`, `index.ts` barrel, `package.json` (+`./state` export) | Barrel collides with G4 → sequence the barrel edit. |
| **G4 (after G3 — sequence the barrel)** | `provider/index.tsx`, `index.ts` barrel | Both edit `index.ts`. |
| **G5 (last, after G3+G4)** | `charts/index.ts`, `charts/kinds/{Donut,StackedArea}.tsx`, `apps/playground/src/*.type-guard.ts`, `apps/playground/src/demo/series.ts`, `tests/`, `src/guard/*.test.ts` | Depends on G3's `SeriesKey`. Playground+tests off the package boundary. |
| **G7 (independent)** | `.github/workflows/ci.yml`, `lefthook.yml` | Root files, separate `ci:` commit. |

**Commit discipline:** every `packages/basalt-ui/**` group = its own commit (`isolated-basalt-ui` guard). Root files (`tests/`, `.oxlintrc.json`, `ci.yml`, `lefthook.yml`, `bun.lock`, `apps/playground/**`) never staged with package files. The `+./guard` and `+./state` exports require a deliberate `bun install` + **separate `chore:` bun.lock commit** (§6.2). Empty scope (`feat:` not `feat(spine):`); body ≤100 chars/line, no body line starting `word:`; amend-rule for follow-up fixes; no AI attribution. **Rebuild-before-typecheck** (§6.1): after G3 adds barrel exports, `bun --filter basalt-ui build` before any G5 fixture import resolves.

---

## Resolved decision table

|-|-|-|
| # | Final resolution | Rationale |
|-|-|-|
| #1 fixture placement | Compile fixtures → `apps/playground/src/*.type-guard.ts`; runtime → root `tests/` + co-located `src/guard/*.test.ts`; one dist-vantage assertion folded into the existing pack-test. **No dedicated workspace package.** (owner-elevated) | Playground `src` is the only proven-typechecked consumer vantage; root `tests/` is in no tsconfig (dead `@ts-expect-error`); a dedicated package is Tanner-bar bloat + would need to expose the internal registry type. |
| #2 fixture naming | **Codify** `*.type-guard.ts` (compile, in tsc) vs `*.test.ts` (runtime, in bun test). Document in `apps/playground/CLAUDE.md`. | A mis-named compile fixture is silently un-typechecked. |
| #3 chart-color hole | **Close** via `BasaltRegister['series']` — re-type `Donut.colorForKey` + `StackedArea.colorForGroup` to `SeriesKey`; consumer cast `series.ts:35` disappears. Bars untouched. (owner-resolved IN SCOPE) | The slot exists precisely to close this; a renamed key becomes a tsc error at the call site. |
| #4 guardKinds/skill | **Discriminated `doctrine | tooling`**: doctrine keeps `guardKinds`+`skill` required (`[]` legal for advisory); tooling owes neither (`?: never`). | Tighter than required-nullable; tooling can't claim a triad; keeps all 6 rules in RULE_NAMES. |
| #5 skill cardinality | `skill: readonly SkillName[]` (a list); `plugin.json.skills` = deduped union. | `basalt-design` covers tokens + mantine + state — many-to-one is real. |
| #6 forms first-class | **Keep folded** into `basalt-state.md` for Phase 1 (no `./forms` battery, `@mantine/form` not a declared peer). | Split when the Phase-4 battery ships. |
| #7 D2 tokens gap | **Close** — shipped tokens override emits both `@mantine/*` AND `@visx/*` bans (mirrors repo-local); named sync-contract assertion verifies. | The CLAUDE.md Mantine-free claim is false for tokens downstream today. |
| #8 generator scope | Generator owns **only** the `no-restricted-imports` overrides + `#app` block; the shared base (plugins/categories/11 rules) stays a hand-maintained template it splices into. | Smaller blast radius; the base isn't a drift source, the overrides are. |
| #9 per-target extras | `shippedOnly`/`repoOnly` flags on `ForbiddenImport` + a `RuleOverride[]` slot with optional `target`. | antd (shipped-only), no-console:off / no-underscore-dangle:off (repo-only) aren't layer-derivable. |
| #10 merge strategy | **Drop** `'merge'` from the manifest producer (no `ManagedFile` declares it — dead producer); cut from the public `Strategy` union if nothing produces it. (Touches `cli/index.ts` → folds into G1.) | The spine must not model dead surface (settings.json use-case is gone). |
| #11 .oxlintrc seed→block | **Leave as `seed`** for 1.0; `source` stays doc-only — the projection must NOT treat it as bytes-to-copy. | Re-asserting the extends line after consumer edits is a Phase-4 concern. |
| #12 plugin lockstep | **Check, not derive** — move the existing root test under the registry suite; `check-coverage` (G6) owns the assertion. | Deriving couples two independently-bumped artifacts; a check is the smaller surface. |
| #13 module split | **Separate** `surfaces.ts` (enforcement, imports only `./guard/types`) + `register.ts` (design seam) + `state.ts`, all re-exported from `index.ts`. | Keeps G1 (enforcement, edits cli) and G3 (design, edits register+barrel) disjoint. |
| #14 nonce | Dedicated `nonce?: string` prop → the L60 `<style>` (the one element `...rest` can't reach); rely on `...rest` for Mantine's own styles. **`/research`-gated** before freeze. | Only L60 provably needs it; Mantine's prop name is post-cutoff (research-first). |
| #15 onError | **Ship `BasaltErrorBoundary` + `onError(error, ctx)` together** in the G4 freeze (no no-op prop). `BasaltErrorBoundary` also exported. (owner-resolved IN SCOPE) | A frozen prop with no boundary behind it is a 1.0 lie. |
| #16 eden-treaty-seam | **Doctrine only** — `@example` JSDoc in `register.ts` + `basalt-query.md` (the seam + 3 footguns); no `treaty<App>` wiring, no `./query` export/peer. (owner-resolved IN SCOPE) | Cheap, high-honesty type-discipline statement; wiring is Phase-4. |
| #17 self-dogfood | **`check-theme` in basalt's `ci.yml` + lefthook**; **`sync --check` into the consumer `check.yml` template** (NOT basalt's own — producer has no manifest). (owner-resolved IN SCOPE; B's producer/consumer split grafted) | Proving the guard runs clean on basalt's own src is cheap; `sync --check` on the producer is theatre. |
| #18 cli-runtime-portability | **Deferred** (out of the spine). (owner-resolved) | Rides the Phase-2 tsdown rewrite that touches those scripts anyway. |

---

## Open questions that still need owner sign-off

These are the genuine public-API forks where an external fact (post-cutoff) gates the freeze — both must be `/research`-confirmed, but neither blocks starting the non-provider groups (G1/G2/G3-design/G5/G6/G7).

1. **Mantine v9 nonce reachability (#14, blocks G4 freeze only).** Confirm via `/research`: does `MantineProvider` accept a top-level `nonce` through `...rest`, or is it `getStyleNonce: () => string`, and is the prop name stable in v9? **Recommendation:** ship the dedicated `nonce?: string` prop for the L60 `<style>` regardless (it provably owns the one unreachable element); resolve only the documentation/`...rest`-mapping half after research. Run the research immediately before the G4 implementer brief.

2. **Standard Schema v1 `~standard` exact field shape (#D.1, blocks G3 freeze only).** Confirm the `~standard` interface byte-for-byte via `/research` before vendoring (it is a post-cutoff spec). **Recommendation:** the design decision (vendor our own copy, type every boundary against it, zero validation peer) is firm; only the literal field names need confirmation. Bake the verified shape into the G3 implementer brief.

Both are research-gated facts, not design disagreements — every other surface is grounded against live source and resolved above.
