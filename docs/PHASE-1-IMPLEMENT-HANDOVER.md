# HANDOVER — basalt-ui Phase 1: IMPLEMENT → REVIEW

> Post-compaction kickoff for the **implement** and **review** steps of the Phase-1 spine. The
> `understand` and `design` steps are **done and signed off** — do not redo them. Paste §0 into a fresh
> in-repo session.

---

## 0. KICKOFF PROMPT (paste this verbatim)

```text
ultracode

Resume basalt-ui Phase 1 — the spine. understand ✓ and design ✓ are DONE and owner-signed-off; the
IMPLEMENT step is next, then REVIEW. Read docs/PHASE-1-IMPLEMENT-HANDOVER.md §1–§7 in full, then
docs/PHASE-1-DESIGN.md (the FROZEN implement-phase spec — §A–§K are the API, §K has the disjoint
@implementer group map G1–G7 and the build order) and docs/PHASE-1-GROUNDING.md (verified file:line
ground truth). Track work with Claude Code tasks (TaskList shows #3 implement / #4 review).

Run IMPLEMENT as ONE ultracode workflow: a pipeline that fans @implementer subagents onto the DISJOINT
file-groups in design §K, then adversarially verifies each group's diff before moving on. G1 is a
MANDATORY single group (RULE_NAMES derivation + ./guard extraction both edit src/cli/index.ts — never
split). Build order (sequencing law): guard/types → surfaces.ts + guard/index.ts (G1) → register.ts
(G3) → state.ts (G3) → barrel → provider (G4) → chart re-type + fixtures (G5); G2/G6/G7 sequence per
the §K table. Before the G3 brief, run /research for the Standard Schema ~standard field shape; before
the G4 brief, run /research for the Mantine v9 nonce mechanism — bake the verified facts into those
briefs (research-first rule; do NOT assert from memory).

Each @implementer gets a COMPLETE brief (exact paths from §K, the frozen TS from §A–§J, acceptance
criteria, the CLAUDE.md constraints). It owns its files exclusively while running — parallelize ONLY on
disjoint groups, never run your own validation over a group mid-flight. After each group: adversarially
verify the returned diff against the spec + source before committing.

Stop for my review at the REVIEW gate: bun run pre (rebuild package FIRST) + bun test + pack-test
barrier, the four compile fixtures fire, then I run /code-review ultra.

Hard constraints (CLAUDE.md — non-negotiable): Bun; oxlint + oxfmt (no npm/Biome/Prettier/ESLint); TS
strict, no any, named exports, kebab-case files / PascalCase components; conventional commits EMPTY
scope; packages/basalt-ui/** commits SEPARATELY (isolated-basalt-ui guard); bun.lock + root files
(tests/, .oxlintrc.json, ci.yml, lefthook.yml, apps/playground/**) NEVER staged with package files;
commitlint body ≤100 chars/line AND no body line may start with `word:`; NO AI/tool attribution; do NOT
bump the @visx pin; src/charts + src/tokens + src/guard stay Mantine-free (@visx only in src/charts);
bun --filter basalt-ui build BEFORE bun run typecheck (stale dist masks consumer typecheck).
```

---

## 1. Where we are (done — do not redo)

Phase 0 (correctness floor) + the 9-angle trajectory audit + Phase-1 understand + Phase-1 design are
complete. The binding 1.0 = MAXIMUM AMBITION decision stands (all seven adapter batteries ship as
runtime subpaths in 1.0; the spine ships FIRST so batteries inherit cohesion — batteries are Phase 4,
NOT this work).

- **understand ✓** → `docs/PHASE-1-GROUNDING.md` (8 readers → synthesis → completeness critic; every
  file:line verified vs live `feat/s0-mantine-pivot`; 18 owner decisions, §7 holds the resolutions).
- **design ✓ + signed off** → `docs/PHASE-1-DESIGN.md` (3 lens-diverse designs → 3 weighted judges →
  synthesis → adversarial critic). Base design A (Tanner-purist) + grafts from B (enforcement) + C
  (DX). The critic compiled every load-bearing type trick on TS 6.0.3 — **zero invariant violations,
  zero design flaws** — and its two fixture blockers (J.2, J.3) are FIXED in-place (marked `CRITIC-FIX`).
  **This doc is the frozen spec; §A–§K are the API and the group map.**

Working-tree state: `docs/PHASE-1-GROUNDING.md`, `docs/PHASE-1-DESIGN.md`,
`docs/PHASE-1-IMPLEMENT-HANDOVER.md` are new/untracked planning docs (`docs:` commits, NOT on the
package boundary). The pre-existing ~14 modified/untracked files are the owner's in-flight S0–S5 WIP —
do NOT sweep them into commits; stage explicitly, file by file.

## 2. What IMPLEMENT builds (the frozen surface — read design §A–§J for the TS)

| Module | Subpath | Ships | Group |
|-|-|-|-|
| `src/surfaces.ts` | (internal) | `SURFACES` registry; discriminated `doctrine\|tooling` `SurfaceSpec`; `#`-prefix synthetic keys (`#router`/`#query`/`#state`/`#app`); `RULE_NAMES` derived + both oxlint ban-lists + manifest + triad all PROJECT from it | G1 |
| `src/guard/{types,index}.ts` | `./guard` (NEW) | `GuardKind` (12), `Finding`, `GuardConfig`, `GUARD_RULES`, `checkSource()→Finding[]`, `DEFAULT_GUARD_CONFIG` — Mantine-free, dependency-free | G1 |
| `src/cli/index.ts` | (bin) | delete `RULE_NAMES` literal → derive from SURFACES; extract guard internals → `checkTheme()` becomes thin walker calling `checkSource`; drop dead `merge` strategy; `check-coverage` subcommand (G6) | G1 (+G6) |
| `src/register.ts` | `.` (barrel) | `interface BasaltRegister {}`; one `Slot<K,C>` extractor; `{}`-not-`Record<string,never>` default; `Series`/`SeriesKey` (`Extract<keyof,string>` symbol guard); `AsyncState<T,E>` + `assertNever`; vendored `StandardSchemaV1`; eden-seam doctrine JSDoc | G3 |
| `src/state.ts` | `./state` (NEW) | `createPersistedState` — Mantine-free `useSyncExternalStore`, versioned + migrate + Standard-Schema validate | G3 |
| `src/provider/index.tsx` | `.` | `BasaltErrorBoundary` + `onError(error, ctx)` + `nonce` (shipped together, no no-op prop) | G4 |
| `src/charts/kinds/{Donut,StackedArea}.tsx` | `./charts` | re-type `colorForKey`/`colorForGroup` to `SeriesKey` (closes the `series.ts:35` cast); Bars untouched | G5 |
| `scripts/gen-oxlint.ts` + regen configs | `./configs` | the ban-list projection generator + deep-equal sync-contract test (closes D2 — shipped tokens override emitted) | G2 |
| fixtures | — | 4 compile (`*.type-guard.ts` in playground) + runtime guard fixtures + dist-vantage pack-test assertion | G5 |
| ci.yml + lefthook | (root) | dogfood `check-theme` on basalt's own src; `sync --check` into the CONSUMER check.yml template | G7 |

## 3. How to run IMPLEMENT (the core instruction)

ONE ultracode **workflow** — a **pipeline** over the groups, NOT a single fan-out (the groups have a
build-order dependency chain). Per group: an `@implementer` does the settled edits, then an adversarial
verifier checks the returned diff against the spec + live source BEFORE the orchestrator commits.

- **The orchestrator decides and verifies; it does NOT grind edits inline.** Push every multi-file edit
  to `@implementer` (Sonnet, own cache — does not invalidate the Opus orchestrator cache). Give each a
  COMPLETE brief: exact paths from design §K, the frozen TS from §A–§J, acceptance criteria, the
  CLAUDE.md constraints, and the relevant gotchas from §6 below. It is a literal executor with judgment,
  not a planner.
- **File ownership:** a running `@implementer` owns its files exclusively. Parallelize ONLY on disjoint
  groups (§K marks them). Never run your own validation/build over a group's paths mid-flight — you race
  its half-written state. G2 and G3 are disjoint and parallel-safe AFTER G1; everything else sequences.
- **The G1 collision (carried from the Phase-0 disjoint trap):** `RULE_NAMES` derivation AND the
  `./guard` extraction BOTH edit `src/cli/index.ts` → ONE implementer group. G6's `check-coverage` also
  edits `cli/index.ts` → sequence after G1 commits, separate commit. Do not split, do not parallelize
  these.
- **Build order (sequencing law):** `guard/types.ts` → `surfaces.ts` + `guard/index.ts` (G1) →
  `register.ts` (G3) → `state.ts` (G3) → barrel → `provider` (G4) → chart re-type + fixtures (G5).
  G2 after G1; G6 after G1; G7 independent.
- **Research timing (owner-chosen: auto, before the gated group):** run `/research` (research-gateway)
  for the **Standard Schema `~standard` field shape** immediately before the **G3** brief, and for the
  **Mantine v9 nonce mechanism** immediately before the **G4** brief. Bake the verified facts into those
  briefs. Do NOT assert either from memory (research-first rule). Neither gates G1/G2.
- **Adversarial verify each group:** after an implementer returns, a verifier (or you) checks the diff
  line-by-line against the frozen spec and source — the report is a claim, not proof. The four compile
  fixtures (J.1–J.4) and the deep-equal sync-contract test are the type-level proofs; confirm they fire.

## 4. Commit plan (each a separate commit — see design §K + §6)

Per the `isolated-basalt-ui` guard, every `packages/basalt-ui/**` group is its own commit; root files
never share a package commit. Expected sequence (conventional, EMPTY scope, no attribution):

1. `feat:` G1 — SURFACES + ./guard extraction + RULE_NAMES derivation + drop dead merge (package).
2. `chore:` bun.lock resync for the `./guard` export (root file — separate).
3. `test:`/`ci:` G2 — oxlint projection generator + regen configs + sync-contract test (root + package
   split as needed; `.oxlintrc.json` is root).
4. `feat:` G3 — register.ts + state.ts design seam (package); `chore:` bun.lock for `./state` export.
5. `feat:` G4 — provider freeze (package).
6. `feat:` G5 — chart-color closure + fixtures (package for kinds; playground/tests are root — split).
7. `feat:`/`ci:` G6 — check-coverage (package); G7 — dogfood ci.yml + lefthook (root, `ci:`).

(Exact splits per which files are package vs root; verify with `git status` before staging. Use the
amend rule for follow-up CI/lint fixes — never single-line fix commits.)

## 5. REVIEW gate (stop for owner)

`bun run pre` (= `fmt:check && lint && typecheck` — **rebuild `bun --filter basalt-ui build` FIRST** or
stale dist gives phantom errors) + `bun test` + `bun --filter basalt-ui pack-test` as the barrier.
Confirm the four compile fixtures fire (augments-nothing → never-keyed empty; augments-all → exact
keys; SURFACES broken-fixture → tsc error both directions; AsyncState fourth-variant → assertNever
errors) and the deep-equal sync-contract test is green. Then the **owner runs `/code-review ultra`**
(billed cloud review; you cannot launch it). Validation via `mcp__sideclaw__check` is the off-Max path
for the pre/test loops; do not run them inline.

## 6. Gotchas (verify against source before trusting)

- **Stale dist masks typecheck:** consumers resolve `basalt-ui/*` types from `dist/*.d.ts`, not src →
  `bun --filter basalt-ui build` BEFORE `bun run typecheck` (33 phantom errors in Phase 0). After G3
  adds barrel exports, rebuild before any G5 fixture import resolves.
- **bun.lock desyncs:** new `./guard` + `./state` exports → `bun install` → **separate `chore:`
  commit** (bun.lock is a ROOT file, off the package boundary; CI `--frozen-lockfile` fails otherwise).
  Never `bun update` the tree.
- **`keyof` includes `symbol`:** `SeriesKey = Extract<keyof Series, string>` is load-bearing, not dead
  code; interpolating a key → `String(key)`.
- **oxlint `extends` rejects bare specifiers:** the generator emits relative
  `./node_modules/basalt-ui/configs/oxlint.json`, never bare.
- **oxlint per-glob `no-restricted-imports` is REPLACE-not-merge:** the `@visx/*` absence in the charts
  override is load-bearing (omission = re-allow). The generator emits the COMPLETE list per glob
  (`replaceBans`), never inherit-and-add.
- **commitlint:** EMPTY scope (`feat:` not `feat(spine):`); body ≤100 chars/line AND no body line may
  start with `word:` (parsed as a footer trailer) — both traps hit in prior sessions.
- **Fixture placement:** compile fixtures go in `apps/playground/src/*.type-guard.ts` (the only proven
  typechecked consumer vantage — root `tests/` is in NO tsconfig include, so a `@ts-expect-error` there
  is DEAD). Runtime fixtures in root `tests/` + co-located `src/guard/*.test.ts`. Codify
  `*.type-guard.ts` = compile / `*.test.ts` = runtime.
- **Verified facts:** bin is `./bin/basalt.mjs`, `basalt.roots = ["src"]`; no `import/no-cycle` lint
  (the register↔charts↔tokens type triangle is clean); basalt has no `.basalt/manifest.json` (it's the
  producer → `sync --check` belongs in the consumer template, not basalt's own ci.yml).

## 7. Reference material

- `docs/PHASE-1-DESIGN.md` — the FROZEN spec. §A SURFACES, §B BasaltRegister, §C guard, §D house style,
  §E createPersistedState, §F provider, §G chart-color, §H fixture architecture, §I self-dogfood,
  §J the fixtures, §K module map + disjoint groups + build order, then the resolved decision table +
  the two open `/research`-gated questions.
- `docs/PHASE-1-GROUNDING.md` — verified file:line ground truth + the 18 decisions (§7 resolutions).
- `docs/PHASE-1-HANDOVER.md` — the original phase spec (superseded for execution by THIS doc + the
  design doc, but §1–§3 still hold for Phase-0 context + gotchas).
- `docs/MATURATION-ROADMAP.md` + `docs/INTEGRATION-DX.md` + `docs/ENFORCEMENT-HARDENING.md` — the three
  planning docs the design synthesizes (scope, design axis, mechanical axis).
- Durable audit result: `~/.claude/projects/-Users-jkrumm-SourceRoot-basalt-ui/4c67a1d4-fbf8-496a-8d04-a9b18a76282b/workflows/basalt-audit-result.json`
  (query with `jq`, don't read whole).

## 8. Hard constraints (CLAUDE.md — non-negotiable)

Bun; oxlint + oxfmt (no npm/Biome/Prettier/ESLint); TS strict, no `any`, named exports, kebab-case
files / PascalCase components; conventional commits EMPTY scope; `packages/basalt-ui/**` commits
SEPARATELY (`isolated-basalt-ui` guard); root files (`bun.lock`, `tests/`, `.oxlintrc.json`, `ci.yml`,
`lefthook.yml`, `apps/playground/**`) NEVER staged with package files; commitlint body ≤100 chars/line
AND no body line starting `word:`; NO AI/tool attribution; do NOT bump the `@visx` pin; `src/charts` +
`src/tokens` + `src/guard` stay Mantine-free (`@visx/*` only in `src/charts`); `bun --filter basalt-ui
build` before typechecking consumers.
