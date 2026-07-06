# Execution Handover — Phase 0/1 of the basalt-ui maturation

> ⛔ **HISTORICAL — phase complete (2026-07-05).** Process artifact from the 1.0 build, kept for
> provenance. For current state and the remaining finish-line, see [`STATUS.md`](../STATUS.md).

> **Status:** Phase 0 **EXECUTED 2026-06-18** — see [`PHASE-1-HANDOVER.md`](./PHASE-1-HANDOVER.md)
> for what landed, the deviations from this plan, the gotchas discovered, and the next phase.
> Originally grounded 2026-06-17. Companion to the three planning
> docs: [`MATURATION-ROADMAP.md`](./MATURATION-ROADMAP.md) (what to build),
> [`ENFORCEMENT-HARDENING.md`](./ENFORCEMENT-HARDENING.md) (mechanical prevention),
> [`INTEGRATION-DX.md`](./INTEGRATION-DX.md) (design/type prevention).
>
> This doc is the **execution prompt**. It is grounded: every Phase 0 item below was verified
> against the actual source by a multi-agent workflow, so the file:line references are real, not
> doc-asserted. The roadmaps state *what*; this states *how to run it with Claude Code, optimally*.

---

## How to use this handover

1. Open a fresh Claude Code session **inside `basalt-ui`** (rules/skills are repo-scoped).
2. Paste **§3 The execution prompt** as your first message. It begins with the keyword
   `ultracode`, which opts the turn into multi-agent orchestration (see §1).
3. The session authors and runs the workflow in §4, reviews the returned diffs, and lands the
   commits per the split in §5. You stay in the loop between phases — read each result before the
   next fan-out.

Nothing here should be executed autonomously beyond what you explicitly ask for — per the package
`CLAUDE.md`, blueprint stages are not self-driving.

---

## 1. What `ultracode` + workflows are, and why this task wants them

**`ultracode`** is not a model — it's an orchestration posture for Claude Code:

- **Per-turn opt-in:** putting the literal keyword `ultracode` in a prompt opts *that turn* into
  multi-agent orchestration — Claude authors and runs a `Workflow` (a deterministic JS script that
  fans agents out) instead of grinding the work inline.
- **Session-level mode:** when ultracode is toggled on for the session, the opt-in is standing —
  Claude runs a workflow for every substantive task by default, optimizing for the most exhaustive,
  correct result rather than minimizing tokens. Multi-phase work (understand → implement → review)
  becomes several workflows in sequence so you stay in the loop between them.
- **`/code-review ultra`** is the separate, *user-triggered* cloud variant: a multi-agent review of
  the current branch (or `/code-review ultra <PR#>`). It is billed and cannot be launched
  programmatically — run it yourself after the implementation lands. (`/ultrareview` is a deprecated
  alias.)

**Why this task fits a workflow.** Phase 0 is **a work-list of independent, fully-specified,
verifiable fixes across disjoint files.** That is the canonical fan-out shape:

- *parallelizable* — most fixes touch different files, so they run concurrently;
- *each independently verifiable* — `bun run pre` + an adversarial reviewer per fix;
- *settled spec* — exact file:line + the precise change is in §3, so an implement-agent is a literal
  executor, not a designer.

The pattern is **pipeline: implement (parallel, disjoint file-groups) → verify each as it lands**,
plus a final `bun run pre` barrier and a `/code-review ultra` pass. Don't barrier between implement
and verify globally — let each group verify the moment its edit completes.

---

## 2. Grounded Phase 0 work-list (verified against source)

All six live bugs were confirmed by reading the actual files. **Corrections to the planning docs are
flagged** — trust this list's paths over the docs where they disagree.

### A. The type-spine root fix (highest leverage in the entire plan)

| id | file:line (verified) | change |
|-|-|-|
| `exact-keyed-token-factories` | `packages/basalt-ui/src/tokens/index.ts:181-198` | `seriesTokens(map, prefix?)` and `groupTokens(name, map)` return `Record<string, string>` (string index signature) — so "stale keys fail tsc" is **false today**. Change to const-generic + mapped return (`<const T>(spec: T)` → `{ [K in keyof T]: string }`) so a renamed/removed key is a tsc error. |
| `rewrite-series-example` | `apps/playground/src/demo/series.ts:26-43` | The `!` re-key block (`rawDemoTokens['sessions']!, …`) exists **only** to work around the widened return. Once the factory is exact-keyed, collapse it to the 3-line inference idiom. ⚠️ **Different workspace** — must be a separate commit from the package (see §5). |

This single fix makes the whole "pass a literal, get an exact-keyed map" philosophy *true at its
root* and sets the idiom every later `defineX` copies. Per the cross-axis note, it also lets the
enforcement axis's `off-system-surface-var` check shrink to bespoke-escape-only.

### B. Enforcement live bugs (ship-today, no deps)

| id | file:line (verified) | change |
|-|-|-|
| `fix-when-to-use-frontmatter-field` | `plugins/basalt/skills/{basalt-charts,basalt-design,basalt-app}/SKILL.md:4` | Field is `when-to-use:` (hyphen); recognized field is **`when_to_use`** (underscore) — every authored trigger is silently dropped from routing + the listing budget. Rename in all 3. ⚠️ **Doc path correction:** the planning docs say `packages/basalt-ui/agent/skills/**` — that path does **not exist**; skills live under `plugins/basalt/skills/`. |
| `fix-shipped-preset-drift` | `packages/basalt-ui/configs/oxlint.json:38-56` | Strip the phantom bans: `react-router`/`react-router-dom` ("Use @tanstack/react-router") and `@ant-design/icons` ("Use @tabler/icons-react"). Both contradict basalt's own router-agnostic + "icons are `ReactNode`, NO @tabler" doctrine. ⚠️ **Drift is bidirectional:** the shipped preset *also lacks* a `tokens/**` Mantine-free/visx override that repo-local `.oxlintrc.json:47-76` has. Decide whether to add it here or defer to the Phase 2 SURFACES generator. |
| `fix-forms-rule-currency-schemaresolver` | `packages/basalt-ui/agent/rules/basalt-state.md:58-96` | Rule teaches a hand-rolled `zodResolver` from `../lib/zod-resolver` and asserts "@mantine/form v9 does not export a Zod resolver." Obsolete: v9.3 ships native `schemaResolver` (Standard Schema). Rewrite to teach `schemaResolver`. |
| `lockstep-plugin-version-gate` | `plugins/basalt/plugin.json` vs `packages/basalt-ui/package.json:3` | `plugin.json` is `1.0.0`, `package.json` is `0.4.2` → "which doctrine version am I on?" has no answer. Add a test asserting plugin version == package version (exact-equal, bumped in the release commit). |
| `scaffold-oxlintrc-extends` | `packages/basalt-ui/src/cli/index.ts` | `basalt init` writes oxfmt/lefthook/CI but never an `.oxlintrc.json` that `extends` the shipped preset — so every shipped import-ban is dead code in a fresh consumer. Add the extends-stub to the scaffold. |

### C. Source-of-truth corrections (Integration Phase 0)

| id | file:line (verified) | change |
|-|-|-|
| `fix-version-source-of-truth` | `package.json:3,80-87,98-100`; `packages/basalt-ui/CLAUDE.md:5,11,41`; `docs/BLUEPRINT.md:81` | Three skews: (1) all 8 `@visx/*` pinned `4.0.0-alpha.11` while stable `4.0.0` shipped 2026-06-11 (CLAUDE.md still says "no stable visx 4 exists"); (2) `package.json` version `0.4.2` vs the documented breaking `1.0`; (3) `@mantine/*` peer `^9.3` in CLAUDE.md but `^9.2` in `BLUEPRINT.md`. ⚠️ **The visx bump is co-scheduled with `migrate-tsdown` (Phase 2) behind the pack-test** per the roadmap — here, correct only the *documentation* skew and the version string; do **not** bump the visx pin in isolation. |
| `definex-factory-contract` | `packages/basalt-ui/CLAUDE.md` + tokens rule | Document the one canonical factory shape — `defineX<const T extends Constraint>(spec: T): T`, never a fluent builder / config bag / widening annotation (use `satisfies`, never a widening `: Type`) — so every `defineX` copies it verbatim. (`satisfies-not-annotation-defaults` is the same principle, no separate file.) |

### D. Published-artifact honesty (Maturation Phase 0 — separate lane, do not block B/C on it)

`fix-packtest-phantom-assert`, `consolidate-publish-oidc`, `add-publint-gate`, `add-attw-gate`,
`assert-charts-mantine-free-dist`, `audit-mantine-dates-peer`,
`charts-tokens-only-resolution-render-packtest`. These are CI/build-gate fixes, mostly in the
pack-test script + release workflow. They are independent of A–C and can run as a parallel lane;
several pair naturally with the Phase 2 `migrate-tsdown` (native publint/attw). Sequence them after
A–C unless you want the artifact-trust floor first (the roadmap's "gates before everything" law
argues for first — your call).

---

## 3. The execution prompt (paste this into a fresh in-repo session)

```text
ultracode

Execute Phase 0 of the basalt-ui maturation. The grounded work-list, with verified file:line
references and doc-path corrections, is in docs/EXECUTION-HANDOVER.md §2. Read it first, then read
the three planning docs it links for context.

Run it as a workflow (template in §4): implement the fixes in parallel across disjoint file-groups,
verify each group the moment it lands, then a single `bun run pre` barrier across the repo. Treat
each implement-agent as a literal executor — the spec is exact, give it the file:line and the
precise change, nothing more.

Hard constraints (from CLAUDE.md — non-negotiable):
- Runtime is Bun. Lint oxlint, format oxfmt. No npm/Biome/Prettier/ESLint.
- TypeScript strict, no `any`, named exports only, kebab-case files.
- Conventional commits, EMPTY scope (commitlint scope-empty: always).
- packages/basalt-ui/** must be committed SEPARATELY from everything else (lefthook
  isolated-basalt-ui guard). Follow the commit split in §5 exactly.
- No AI/tool attribution in any artifact.
- Do NOT touch the visx pin (it's co-scheduled with the Phase 2 tsdown migration); only fix the
  documentation version skew.
- Validate with `bun run pre` (fmt:check + lint + typecheck) before committing. Fix errors in
  changed files only.

Do not commit or push until I review the diffs. After the package commits land, I will run
`/code-review ultra` myself (it's billed and user-triggered — do not attempt to launch it).
```

---

## 4. Reference workflow script

A starting template for the session to adapt. It groups by file so parallel implement-agents never
race the same file, and verifies each group as it completes (pipeline, not a global barrier). The
package edits and the playground edit are deliberately split so the commit boundary in §5 is clean.

```javascript
export const meta = {
  name: 'phase0-execute',
  description: 'Implement + verify the grounded basalt-ui Phase 0 fixes',
  phases: [
    { title: 'Implement', detail: 'one agent per disjoint file-group' },
    { title: 'Verify', detail: 'adversarially verify each landed fix' },
  ],
}

// Disjoint file-groups → safe to edit in parallel. series.ts depends on the
// token-factory signature, so it is sequenced after that group.
const GROUPS = [
  { id: 'token-factories', files: ['packages/basalt-ui/src/tokens/index.ts'],
    spec: 'Make seriesTokens/groupTokens const-generic + mapped-return (exact-keyed). See §2.A.' },
  { id: 'oxlint-preset', files: ['packages/basalt-ui/configs/oxlint.json'],
    spec: 'Strip phantom react-router + @ant-design/icons bans (lines 38-56). See §2.B.' },
  { id: 'skill-frontmatter', files: ['plugins/basalt/skills/*/SKILL.md', 'plugins/basalt/plugin.json'],
    spec: 'Rename when-to-use → when_to_use in 3 SKILL.md; add plugin/package version lockstep test. See §2.B.' },
  { id: 'forms-rule', files: ['packages/basalt-ui/agent/rules/basalt-state.md'],
    spec: 'Replace hand-rolled zodResolver doctrine with @mantine/form v9.3 schemaResolver. See §2.B.' },
  { id: 'cli-scaffold', files: ['packages/basalt-ui/src/cli/index.ts'],
    spec: 'basalt init must scaffold an .oxlintrc.json extends-stub. See §2.B.' },
  { id: 'version-truth', files: ['packages/basalt-ui/package.json', 'packages/basalt-ui/CLAUDE.md', 'docs/BLUEPRINT.md'],
    spec: 'Fix version/peer documentation skew. Do NOT bump the visx pin. See §2.C.' },
  { id: 'factory-contract', files: ['packages/basalt-ui/CLAUDE.md'],
    spec: 'Document the one defineX<const T>(spec: T): T factory shape + satisfies rule. See §2.C.' },
]

const VERDICT = {
  type: 'object', additionalProperties: false,
  required: ['id', 'correct', 'notes'],
  properties: {
    id: { type: 'string' },
    correct: { type: 'boolean' },
    notes: { type: 'string' },
  },
}

phase('Implement')
const results = await pipeline(
  GROUPS,
  (g) => agent(
    `Implement this basalt-ui fix exactly as specified, touching ONLY ${g.files.join(', ')}. ` +
    `Spec: ${g.spec} Read docs/EXECUTION-HANDOVER.md §2 for the precise file:line change. ` +
    `Bun runtime, oxlint/oxfmt, strict TS, named exports. Return a unified diff of what you changed.`,
    { label: `impl:${g.id}`, phase: 'Implement', isolation: 'worktree' },
  ),
  // Verify each group the moment its edit lands — no global barrier.
  (diff, g) => agent(
    `Adversarially verify this basalt-ui fix for group "${g.id}". Default to correct:false unless ` +
    `the diff exactly matches the spec in docs/EXECUTION-HANDOVER.md §2 and introduces no `+
    `any/widening/raw-hex/default-export. Diff:\n${diff}`,
    { label: `verify:${g.id}`, phase: 'Verify', schema: VERDICT },
  ),
)

// series.ts depends on the new token-factory signature — sequence it last.
phase('Implement')
const seriesDiff = await agent(
  `Rewrite apps/playground/src/demo/series.ts:26-43 to the exact-keyed inference idiom now that ` +
  `the token factories are const-generic (drop the ! re-key block). Return the diff.`,
  { label: 'impl:series-example', phase: 'Implement', isolation: 'worktree' },
)

return { groups: results, seriesDiff }
```

> **Note on isolation.** `isolation: 'worktree'` is used because parallel agents would otherwise
> share one working tree; with worktrees each edits an isolated copy and the orchestrator reconciles
> the diffs into the right commits afterward. If you'd rather keep it simple, drop `isolation` and
> run the implement stage **serially** (still pipelined with verify) — the file-groups are disjoint
> so a serial pass is fully deterministic and avoids reconciliation. For a Phase-0-sized batch,
> serial is usually the lower-friction choice.
>
> **Alternative (no ultracode):** the same work routes cleanly to parallel `@implementer` Sonnet
> subagents (native, on Max, each its own prompt cache) — one per disjoint file-group, each handed
> the §2 file:line spec, then a single `bun run pre` barrier. Use this when you want the offload but
> not the workflow ceremony. (The old sideclaw `implement` worker is retired — it is no longer a lane.)

---

## 5. Commit & sequencing plan (honors the separate-commit rule)

The `isolated-basalt-ui` lefthook hook **fails any staging set that mixes `packages/basalt-ui/**`
with anything else.** So group the landed work into these commits, in order:

| # | Scope | Files | Message |
|-|-|-|-|
| 1 | package | `packages/basalt-ui/src/tokens/index.ts` | `fix: exact-keyed token factory return types` |
| 2 | package | `packages/basalt-ui/configs/oxlint.json` | `fix: strip phantom router/icon bans from shipped oxlint preset` |
| 3 | package | `packages/basalt-ui/agent/rules/basalt-state.md` | `fix: teach mantine v9 schemaResolver in forms rule` |
| 4 | package | `packages/basalt-ui/src/cli/index.ts` | `feat: scaffold .oxlintrc extends-stub in basalt init` |
| 5 | package | `packages/basalt-ui/package.json`, `packages/basalt-ui/CLAUDE.md` | `docs: correct visx/mantine/version source-of-truth skew` |
| 6 | non-package | `plugins/basalt/skills/*/SKILL.md`, `plugins/basalt/plugin.json` + version-gate test | `fix: use recognized when_to_use skill frontmatter field` |
| 7 | non-package | `apps/playground/src/demo/series.ts` | `refactor: collapse series demo to exact-keyed inference idiom` |
| 8 | non-package | `docs/BLUEPRINT.md` | `docs: align mantine peer range in blueprint` |

Notes:
- Commits 1–5 are package-only; 6–8 are everything-else. Never stage across the boundary.
- Commit messages are `fix:`/`feat:`/`docs:`/`refactor:` with **empty scope**. Only commits that
  touch `packages/basalt-ui/` and are `fix:`/`feat:` trigger a release (path-filtered) — #2/#5 are
  documentation-grade but live in the package, so keep #5 as `docs:` (no release) and #2 as `fix:`
  (preset is shipped code → patch release is correct).
- Push to the feature branch only. basalt-ui is PR-required — do not push to `master`.

---

## 6. After Phase 0 — the converged Phase 1 anchor

Once the correctness floor lands, the highest-leverage next move (all three docs converge here) is
the **spine**, not a battery:

- **`ENFORCEMENT` Phase 1:** extract the headless `./guard` subpath — `GUARD_RULES` + a single
  `checkSource()` consumed by CLI, the future oxlint plugin, and the PreToolUse hook (one policy,
  many adapters). Build the typed `SURFACES` registry (`satisfies Record<Subpath, SurfaceSpec>`)
  from which `RULE_NAMES`, both oxlint ban-lists, and the triad contract become projections.
- **`INTEGRATION` Phase 1:** ship the empty augmentable `interface BasaltRegister {}` + the
  conditional-inference extractors (default every slot to a **never-keyed empty type** or an
  un-augmented consumer silently gets `any` — validate with a charts-only scratch consumer that
  augments nothing). Declare the `StandardSchemaV1` cross-boundary contract and the `AsyncState`
  discriminated-union house style before any battery is built on them.

These two are the design seam and the enforcement seam; they interlock at "type-as-guard" — every
typed registry the design axis ships is a guard the enforcement axis gets to delete. Build them
before `./query`/`./router-tanstack`/`./agent`/`./commands` (the revised 1.0 cut line) so the
batteries inherit cohesion instead of bolting it on.

Run Phase 1 as its own ultracode workflow — it's `understand → design → implement → review`, so it's
several workflows in sequence with you reviewing between them, not one fan-out.
