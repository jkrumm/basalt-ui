# Basalt UI — Enforcement Hardening Plan

> ⚠️ **RECONCILED 2026-07-05 — SUPERSEDED by [`STATUS.md`](./STATUS.md).** The guard core, SURFACES
> SSOT, `gen-oxlint`/`gen-llms` projection, `check-coverage`, and the `guard-hook` PreToolUse adapter
> are all BUILT. The "proposal / pending approval" phrasing below is historical — kept for provenance.

> Status: proposal, pending approval. Synthesized from a multi-expert pass (5 research tracks → 6
> experts: rules, skills, oxlint, guard-core, distribution-DX, adversarial → consolidation of 55→30
> deduped recs → 5-voter majority vote → synthesis), 2026-06-15. Companion to
> `MATURATION-ROADMAP.md`. This is the **mechanical** axis — guards/lint/hooks that *catch* wrong
> usage. The **design** axis (type-spine + API design that makes wrong usage unrepresentable) is in
> `INTEGRATION-DX.md`.

Tanner bar: **the best guard is one you can delete** because the type system or the build now holds
the line. Expert maturity of the current layer: **4–5/10** — solid bones, large headroom, several live
bugs.

## Live bugs found (fix today — Phase 0)

| Bug | Reality | Fix |
|-|-|-|
| **Fresh `basalt init` doesn't enforce** | `init` writes oxfmt/lefthook/CI but **never the `.oxlintrc.json`** that `extends` the shipped preset — so every shipped import-ban is dead code in a fresh consumer. | scaffold an `.oxlintrc.json` extends-stub (`scaffold-oxlintrc-extends`) |
| **All skill triggers silently dropped** | frontmatter uses `when-to-use` (hyphen); the recognized field is **`when_to_use`** (underscore) — every authored trigger is ignored for routing *and* the listing budget. | rename the key in all 3 SKILL.md (`fix-when-to-use-frontmatter-field`) |
| **Preset contradicts basalt doctrine** | shipped `configs/oxlint.json` bans `react-router`/`react-router-dom` and steers `@tabler/icons` — but basalt is **router-agnostic** and ships icons as `ReactNode`. Punishes legitimate consumer choices. | strip the phantom bans (`fix-shipped-preset-drift`, ranked #1, p91) |
| **A rule teaches a non-existent API** | `basalt-state.md:77` instructs a hand-rolled `zodResolver`; `@mantine/form` v9 has **native `schemaResolver`** (Standard Schema). The rule actively teaches the wrong API against the pinned peer. | rewrite to `schemaResolver` (`fix-forms-rule-currency-schemaresolver`) |
| **Plugin/package version skew** | `plugin.json` 1.0.0 vs `package.json` 0.4.2 — "which doctrine version am I on?" has no answer. | lockstep version gate test (`lockstep-plugin-version-gate`) |

## Architecture — one policy, many adapters

Everything derives from a **single typed source**; each enforcement surface is a generated/derived
adapter over it, never a hand-authored fork.

### The spine: `src/guard/` (a dependency-free, Mantine-free `./guard` subpath)

- **`SURFACES`** — `const SURFACES = {...} satisfies Record<Subpath, SurfaceSpec>`, where
  `SurfaceSpec = { layer, forbiddenImports, rule, skill, guardKinds }`. The `rule`/`skill`/`guardKinds`
  fields are **literal-union-typed** against the actual rule files, skill names, and `GUARD_RULES`
  ids — so naming a non-existent one, or omitting a required field for a new subpath, is a **tsc
  error**. Single source of truth for: layer boundaries, import-ban lists, `RULE_NAMES`, the
  scaffold/manifest rule set, and the triad contract.
- **`GUARD_RULES` + `checkSource(text, relPath, cfg)`** — the violation-detection policy. Every regex
  currently inline in `checkTheme()` moves here behind one registry; `checkTheme()` becomes a thin
  filesystem walker over `checkSource()`. The lint plugin and the PreToolUse hook call the *same*
  `checkSource()` — never fork it.

`RULE_NAMES` (the hardcoded array at `cli/index.ts:434`) is **deleted and derived from `SURFACES`**.
The published-surface table, both oxlint ban lists, and the manifest rule keys all become projections.

### The five tiers (escalating teeth; a hard invariant lives at type- or save-time, never doctrine alone)

| Tier | Mechanism | Notes |
|-|-|-|
| **1. Type-time** (strongest, deletable) | the `SURFACES` literal-union fields (incomplete triad = compile error) + branded `VxColor` (raw hex unrepresentable on basalt-owned color props) | `seriesTokens` already proves the registry-as-tsc-error pattern |
| **2. Edit-time** | a plugin `PreToolUse` deny hook (matcher `Edit\|Write\|MultiEdit`) pipes `tool_input` through `checkSource()` → `permissionDecision: "deny"` | **constraint:** no `additionalContext` (#15664) — steer lives entirely in `permissionDecisionReason`; best-effort (Edit-deny had bugs #37210/#33106) |
| **3. Save-time** | two oxlint configs whose `no-restricted-imports` blocks are **generated from `SURFACES`**; AST-shaped guards as lint rules | **constraint:** oxlint `extends` is two-phase — inherited `overrides` win, per-glob ban lists are **replaced not merged**, so the duplication is load-bearing and must be *emitted*, not hand-copied |
| **4. Commit-time** | basalt's own lefthook runs oxlint+oxfmt+**check-theme** on staged files | today it runs only oxlint+oxfmt+commitlint — basalt must dogfood |
| **5. CI-time** | full stack on basalt's own source: oxlint, check-theme, `sync --check`, preset-sync contract test, SKILL.md schema test, `check-coverage`, lockstep version | the consumer `check.yml` adds `sync --check` alongside check-theme |

### The triad contract (mechanized)

A public subpath is "not done" until **rule + skill + guard** all land. Two layers: (a) the `SURFACES`
required literal-union fields make an incomplete triad a **tsc error**; (b) `basalt check-coverage` is
the deletable runtime residue — asserts each named rule file, skill section, and guard kind exists,
exits non-zero on a gap. New surfaces (notifications, forms, agent, commands, hotkeys, persisted-state)
each get a `SURFACES` entry + rule + skill section + guard/ban entries, **or the build fails**.

## Phased plan (majority-vote ordered)

**Phase 0 — quick correctness (ship today, no deps):** the five live-bug fixes above.

**Phase 1 — build the spine:** `guard-core-subpath` (extract `GUARD_RULES` + `checkSource()`) →
`surfaces-registry-typed` (the `satisfies Record<Subpath, SurfaceSpec>` with literal-union fields) →
`rule-names-from-registry` (delete the hardcoded array, derive + set-equality test).

**Phase 2 — generate + gate the oxlint configs:** `generate-oxlint-configs` (emit both configs'
ban blocks from `SURFACES` with per-glob duplication expanded) → `scaffold-oxlintrc-extends` (the
missing init stub) → `oxlint-preset-sync-contract-test` (re-derive + assert both match; drift = red) →
`dogfood-preset-in-playground` (the preset is exercised by nothing today).

**Phase 3 — coverage contract + dogfood:** `check-coverage-command` → `skill-frontmatter-schema-check`
(typed allowed-field set; rejects `when-to-use`, enforces the 1,536-char budget) →
`self-dogfood-guard-stack` (wire the full stack into basalt's own ci.yml + lefthook — today ci.yml runs
neither check-theme nor `sync --check`).

**Phase 4 — edit/save-time teeth (soon):** `audited-theme-allow` (require `theme-allow: <reason>`;
bare allow stops suppressing) · `oxlint-plugin-ast-guards` (migrate raw-visx-axis / localstorage-theme
/ off-system-surface-var off regex) · `plugin-pretooluse-deny-hook` · `new-subpath-import-bans` (forms
bans RHF/formik, agent confines the AI SDK, etc.).

**Phase 5 — doctrine for new surfaces (soon):** `split-forms-rule` (extract `basalt-forms.md`) ·
`author-new-surface-rules` (notifications/agent/commands, each leading with its mechanical backstop) ·
`acknowledge-path-scope-best-effort` · `document-extends-vs-copy-contract`.

**Phase 6 — skills regrouping + setup DX + currency (later):** `regroup-skills-by-workflow` ·
`new-surface-skill-references` · `basalt-doctor` · `scaffold-peer-deps` · `rule-currency-pin` ·
`design-core-rule-consistency-gate`.

**Phase 7 — type-time apex (later, highest teeth/risk):** `branded-token-types` (`VxColor` brand on
basalt-owned color props — surgical, ships last once the registry is stable).

## The three sub-plans

**Rules** — target set: `basalt-{tokens,charts,mantine,router,query,state,forms,notifications,agent,commands}`
(state trimmed to placement + the guarded localStorage-theme invariant; forms split out). Three drift
mechanisms: (1) **currency** — `verified:` frontmatter naming the peer API version + a `check-currency`
that **warns** (currency is judgement; consumers may lag); (2) **existence/identity** — `RULE_NAMES`
derived from `SURFACES` + a fileset set-equality test; (3) **precedence consistency** — a byte-identical
marker check across DESIGN-CORE / CLAUDE-block / DESIGN templates. **Scoping honesty:** `paths:` is a
context hint, **not** enforcement (#23478: loads on Read, not Write) — every must-hold invariant a
narrow rule documents is *also* guard/lint/type-backed. Each rule names its guard up front. Router/icon
preferences stay **advisory**, never hard bans.

**Skills** — 3 workflow verbs, not surface-per-skill: `/basalt:data` (charts how-to + design law),
`/basalt:shell` (provider/shell/theme/router/query/state + new surfaces as referenced sections with
their own `when_to_use`), `/basalt:app` (scaffold/sync). New surfaces fold in as progressive-disclosure
sections, not slash-commands-per-surface. A CI schema test validates frontmatter (kills the
`when-to-use` class). Skills point at the deny hook + oxlint as their teeth. **Dropped:**
`inject-live-guard-verdict-in-skills` (shell-exec fragility on skill load).

**oxlint** — strip the phantom bans; **generate** both configs' ban blocks from `SURFACES` (the per-glob
`@mantine/*`/`@visx/tooltip` duplication is load-bearing, expanded by the generator); a contract test
re-derives + asserts. AST-shaped guards: oxlint has **no native `no-restricted-syntax`** — use
`jsPlugins: ['./node_modules/oxlint-plugin-eslint']` + `eslint-js/no-restricted-syntax` esquery
selectors for the simple cases (a config line, not a bespoke plugin); author a custom
`oxlint-plugin-basalt` **only** where autofix/scope analysis is genuinely needed, and its rule body
calls the shared `checkSource()`. New lever: `oxlint.config.ts` supports base-object spread to merge
restriction lists — adopt `.ts` repo-local for DRY authoring, emit expanded JSON for the shipped
artifact, both from the one generator.

## Conflicts resolved

- **check-theme regex vs oxlint plugin for the same AST guard** → not either/or: policy lives once in
  `checkSource()`; the oxlint rule is the primary save-time home (IDE diagnostics + autofix) and calls
  the shared core; the regex kind is retained only as the zero-dep fallback and retired once the lint
  rule covers it.
- **custom plugin vs `eslint-js/no-restricted-syntax`** → default to the built-in selector; escalate to
  a custom plugin only on demonstrated need (autofix/scope).

## Risks

- **PreToolUse deny is best-effort** (bugs #37210/#33106; no `additionalContext` #15664) — never the
  sole barrier; verify on the target Claude Code version.
- **oxlint JS-plugin system is alpha** (since 2026-03) — keep regex kinds as the zero-dep fallback;
  don't hard-depend on the plugin loading.
- **oxlint extends/jsPlugins need full `./node_modules/...` paths** (#15538) — breaks under PnP/relocated
  modules; `basalt doctor` checks the stub resolves.
- **`branded-token-types` is invasive** — keep surgical to basalt-owned props; ship last.
- **`SURFACES` literal-union typing is non-trivial TS** — a broken-fixture compile test must prove the
  error actually fires, or the contract is theatre.
- **path-scoped rules don't load on Write/Edit** (#23478) — relying on a narrow rule to steer
  new-file scaffolding is false safety; the maintainer note is the only defense.

## Open decisions

1. **`oxlint.config.ts` (TS, spread-merge) vs `.oxlintrc.json` (JSON)** for the repo-local config —
   tendency: `.ts` repo-local for DRY, emit JSON for shipped, both from one generator (confirm
   oxfmt/lefthook handle a `.ts` config first).
2. **Custom `oxlint-plugin-basalt` scope** — which kinds truly need it vs an esquery selector (resolve
   per-kind in Phase 4; default to the selector).
3. **`check-coverage` for tooling subpaths** (`./vite`, `./theme-lab`, `./guard`) — tendency: a
   discriminated `SurfaceSpec` union (`doctrine` vs `tooling`) so the type encodes which surfaces owe a
   triad.
4. **PreToolUse hook performance** — size cap / kind-subset / `.ts`-`.tsx`-only matcher to stay
   sub-100ms per edit.
5. **Rule currency: gate vs warn** — chosen warn for consumers; consider a hard fail on basalt's *own*
   pinned peers.
6. **Marketplace/plugin version derivation** — tendency: exact-equal to `package.json`, bumped in the
   release commit.
