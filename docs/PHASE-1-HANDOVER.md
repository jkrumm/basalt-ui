# Execution Handover — Phase 1 of the basalt-ui maturation

> **Status:** kickoff (NOT yet grounded). Unlike [`EXECUTION-HANDOVER.md`](./EXECUTION-HANDOVER.md)
> (Phase 0, whose work-list was verified against source before execution), Phase 1 is a *design*
> phase — `understand → design → implement → review`. Its first workflow **grounds** it; do not
> jump to implementation off this doc alone.
>
> Companion planning docs: [`MATURATION-ROADMAP.md`](./MATURATION-ROADMAP.md),
> [`ENFORCEMENT-HARDENING.md`](./ENFORCEMENT-HARDENING.md), [`INTEGRATION-DX.md`](./INTEGRATION-DX.md).

---

## 1. What Phase 0 delivered (the floor that is now in place)

Executed 2026-06-18 on `feat/s0-mantine-pivot`. The correctness floor for the maturation:

| Area | What landed |
|-|-|
| Type spine | `defineSeries` / `seriesTokens` / `groupTokens` are now `<const T extends SeriesMap>` with a mapped (`{ [K in keyof T]: string }`) return — a literal series map stays **exact-keyed**, so a renamed/removed key is a tsc error. The playground series demo collapsed to the direct inference idiom (no more `!` re-key). |
| Factory contract | The one canonical shape — `defineX<const T extends Constraint>(spec: T): T`, `satisfies` not a widening annotation, no fluent builder/config bag — is documented in `packages/basalt-ui/CLAUDE.md` so every future `defineX` copies it. |
| Shipped oxlint preset | Stripped the phantom `react-router` / `react-router-dom` / `@ant-design/icons` bans (they contradicted basalt's router-agnostic + icons-are-ReactNode doctrine). Kept `antd`, `@visx/tooltip`, `@visx/*`. |
| CLI scaffold | `basalt init` now scaffolds an `.oxlintrc.json` extends-stub (`seed` strategy) so the shipped import-bans are live in a fresh consumer instead of dead. |
| Forms doctrine | `basalt-state.md` rewritten from the obsolete hand-rolled `zodResolver` to the native `@mantine/form` v9.3 `schemaResolver` (Standard Schema). |
| Agent routing | `when-to-use:` → `when_to_use:` in the 3 plugin `SKILL.md` (the hyphenated key was silently dropped from routing). Added a `bun:test` asserting `plugin.json` version == `package.json` version, wired `bun test` into the root `package.json` + CI. |
| Version source-of-truth | `package.json` `0.4.2 → 1.0.0`; corrected the "no stable visx 4 exists" prose (stable 4.0.0 shipped 2026-06-11, pin intentionally held); aligned the `@mantine` peer to `^9.3` in `BLUEPRINT.md`. |
| Artifact gate | Removed a phantom `settings.stanza.json` assert from `pack-test.sh` (one item from Lane D, below). |

All gates green: fmt · lint · typecheck (both packages) · `bun test` (44 pass) · pack-test.

## 2. Deviations from the Phase 0 plan (trust this over the planning docs)

- The §4 reference workflow's "disjoint groups" claim was wrong in places: `version-truth` and
  `factory-contract` both edit `CLAUDE.md` (merged into one agent); `plugin.json` lives at
  `plugins/basalt/.claude-plugin/plugin.json`, not `plugins/basalt/plugin.json`.
- The type-spine fix had to also make **`defineSeries`** const-generic — the planning docs only
  named `seriesTokens`/`groupTokens`, but `defineSeries` was widening the map to `SeriesMap` first,
  destroying the keys before the others ran.
- The version-lockstep test went to the **repo root** (`tests/`), wired via the **root**
  `package.json` + CI — not the package — to keep it off the `packages/basalt-ui/**` commit boundary.
- Decisions taken: **D1** version → `1.0.0` (done); **D2** the shipped-preset `tokens/**`
  Mantine-free override **deferred** to the Phase 2 SURFACES generator; **D3** Lane D **deferred**
  except the one phantom-assert fix.

## 3. Gotchas discovered in Phase 0 (read before touching package src or builds)

- **Stale `dist` masks consumer typecheck.** The playground/consumers resolve `basalt-ui/*` *types*
  from `dist/*.d.ts` (the `types` export condition), NOT `src` — there is no src path-mapping. After
  editing package src you MUST `bun --filter basalt-ui build` before `bun run typecheck`, or you get
  phantom errors against stale dist (this produced 33 false errors in Phase 0). CI builds before
  typecheck (`ci.yml` step order), so it is fine there — but locally, rebuild first.
- **Version bumps desync `bun.lock`.** `bun.lock` records the workspace self-version; bumping
  `packages/basalt-ui/package.json` requires `bun install` to resync, or CI's `--frozen-lockfile`
  fails. `bun.lock` is a **root** file → it cannot share the package version-bump commit (the
  `isolated-basalt-ui` guard) — commit it separately (`chore:`).
- **`const T extends Record<...>` preserves keys, but `keyof T` includes `symbol`.** Iterating
  `Object.keys(map) as (keyof T)[]` and interpolating in a template literal needs `String(key)` or
  you get `TS2731: Implicit conversion of a 'symbol' to a 'string'`. (A reviewer called this "dead
  code" — it is not.)
- **oxlint `extends` rejects bare specifiers.** A consumer `.oxlintrc.json` must use the relative
  `./node_modules/basalt-ui/configs/oxlint.json` path. Relevant to the SURFACES generator that will
  regenerate the preset.
- **`pack-test.sh` had a phantom tarball-contents assert** (`settings.stanza.json`, a file that does
  not exist). Audit the remaining asserts when you touch shipped files (ties into Lane D's
  `assert-charts-mantine-free-dist` / `charts-tokens-only-resolution-render-packtest`).
- **Toolchain is TS 6.0.3 + Bun.** `const` type params + mapped types behave as expected. `bun test`
  globs the whole repo (root `tests/` + the one co-located CLI test).

## 4. Remaining deferred work (sequence around Phase 1/2 as noted)

**Lane D — published-artifact honesty** (independent of the spine; pairs naturally with the Phase 2
`migrate-tsdown`): `consolidate-publish-oidc`, `add-publint-gate`, `add-attw-gate`,
`assert-charts-mantine-free-dist`, `audit-mantine-dates-peer`,
`charts-tokens-only-resolution-render-packtest`. (`fix-packtest-phantom-assert` is done.) The
roadmap's "gates before everything" law argues for doing these first if you want the artifact-trust
floor; otherwise they can run as a parallel lane any time.

**D2 — shipped oxlint preset `tokens/**` override.** Repo-local `.oxlintrc.json` enforces a
Mantine-free + visx-free `tokens/**` boundary that the shipped `configs/oxlint.json` lacks. Deferred
because it should fall out as a **projection of the Phase 2 SURFACES registry**, not be hand-added.

## 5. Phase 1 — the spine (all three planning docs converge here)

Build the **spine**, not a battery. The two seams interlock at "type-as-guard" — every typed
registry the design axis ships is a guard the enforcement axis gets to delete.

- **ENFORCEMENT Phase 1 — the guard seam.** Extract a headless `./guard` subpath: `GUARD_RULES` +
  a single `checkSource()` consumed by the CLI, the future oxlint plugin, and the PreToolUse hook
  (one policy, many adapters). Build the typed `SURFACES` registry
  (`satisfies Record<Subpath, SurfaceSpec>`) from which `RULE_NAMES`, both oxlint ban-lists, and the
  triad contract become **projections** (this is where D2 above gets absorbed).
- **INTEGRATION Phase 1 — the design seam.** Ship the empty augmentable `interface BasaltRegister {}`
  + the conditional-inference extractors — **default every slot to a never-keyed empty type**, or an
  un-augmented consumer silently gets `any` (validate with a charts-only scratch consumer that
  augments nothing). Declare the `StandardSchemaV1` cross-boundary contract and the `AsyncState`
  discriminated-union house style **before** any battery is built on them.

Build these before `./query` / `./router-tanstack` / `./agent` / `./commands` (the revised 1.0 cut
line) so the batteries inherit cohesion instead of bolting it on.

## 6. How to run Phase 1

It is `understand → design → implement → review`, so it is **several ultracode workflows in
sequence** with you reviewing between them — NOT one fan-out (Phase 0 was a fan-out because its spec
was settled; Phase 1's is not).

1. **Understand** (workflow): parallel readers ground the current shape — where `RULE_NAMES`, the
   two oxlint ban-lists, `check-theme`, the triad/skill contract, and the token/charts surface specs
   live today, and what a `SURFACES`/`BasaltRegister` projection would have to subsume. Output: a
   grounded work-list (the Phase 0 doc's §2, but for the spine).
2. **Design** (workflow, judge panel): independent designs for the `SURFACES` shape + the
   `BasaltRegister` augmentation/extractor model; score and synthesize. This is a public-API decision
   — get sign-off before implementing.
3. **Implement** (workflow, pipeline): once the API is settled and grounded, fan out implementers on
   disjoint file-groups + verify each — the Phase 0 pattern.
4. **Review**: `bun run pre` + `bun test` + pack-test barrier, then user-run `/code-review ultra`.

## 7. Carried hard constraints (non-negotiable — from CLAUDE.md)

- Runtime Bun. Lint oxlint, format oxfmt. No npm/Biome/Prettier/ESLint.
- TS strict, no `any`, named exports only, `kebab-case` files / `PascalCase` components.
- Conventional commits, **empty scope** (commitlint `scope-empty: always`).
- `packages/basalt-ui/**` commits SEPARATELY from everything else (`isolated-basalt-ui` guard).
- No AI/tool attribution in any artifact.
- Do NOT bump the `@visx/*` pin (co-scheduled with the Phase 2 tsdown migration, behind the pack-test).
- `src/charts/**` and `src/tokens/**` stay Mantine-free; `@visx/*` only inside `src/charts/**`.
- After editing package src, `bun --filter basalt-ui build` before typechecking consumers.

---

## 8. Kickoff prompt (paste into a fresh in-repo session)

```text
ultracode

Begin Phase 1 of the basalt-ui maturation — the spine (see docs/PHASE-1-HANDOVER.md §5). Phase 0
(the correctness floor) is done; read §1–§3 of that handover for what landed and the gotchas, then
the three planning docs it links.

Phase 1 is understand → design → implement → review, so run it as SEVERAL ultracode workflows in
sequence — not one fan-out — and stop for my review between each. Start with ONLY the "understand"
workflow (§6.1): parallel readers that ground, against the actual source, where RULE_NAMES, both
oxlint ban-lists, check-theme, the triad/skill contract, and the token/charts surface specs live
today, and what a typed SURFACES registry + an augmentable BasaltRegister would have to subsume.
Return a grounded work-list with verified file:line references. Do NOT design or implement yet — I
will review the grounding and approve the design phase.

Hard constraints (CLAUDE.md): Bun; oxlint/oxfmt; strict TS, no any, named exports; conventional
commits with EMPTY scope; packages/basalt-ui/** commits SEPARATELY; no attribution; do NOT touch the
visx pin; rebuild the package before typechecking consumers; validate with `bun run pre` + `bun test`.
```
