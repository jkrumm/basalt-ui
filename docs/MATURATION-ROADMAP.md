# Basalt UI — Maturation Roadmap

> ⚠️ **RECONCILED 2026-07-05 — SUPERSEDED by [`STATUS.md`](./STATUS.md).** Every phase below is
> BUILT except the owner-gated finish line (push · PR · npm Trusted Publisher · review · release).
> The "proposal / remaining / pending" language is historical — kept for provenance, not live work.

> Status: proposal, pending approval. Synthesized from a multi-agent pass (18 research + 18
> repo-grounded analyses → consolidation into 146 deduped recommendations + 11 conflict
> resolutions → 6 backward-join lenses → majority-vote synthesis), 2026-06-15. Channels Tanner
> Linsley's framework philosophy: lean headless cores, end-to-end type safety, composition over
> configuration, ruthless restraint on surface.

## TL;DR — the decision

**The lean-vs-batteries question is a false binary that basalt already escaped via export
topology.** The answer is **one package, four export layers, three battery channels** — batteries
are delivered through opt-in subpaths (optional peers), a scaffolding CLI, and the Claude plugin,
**never** as hard dependencies and **never** as scoped sub-packages.

The "one dependency + one Claude Code setup prompt" north star is satisfied **honestly** by
reframing it as: **`basalt-ui` (one dep) + `basalt init` + the plugin** — not by literally
hard-depending on the consumer stack. A charts/tokens-only consumer pays zero Mantine; a non-Query
consumer pays zero `@tanstack/*`; an agent app opts into the AI SDK via a subpath that simply fails
to resolve if its optional peer is absent.

**Sequencing law: gates before bundler swap; bundler swap before new channels.** The first work is
unglamorous correctness (a rotted pack-test assert, a stored-NPM_TOKEN supply-chain hole) that
undercuts every other guarantee. Build no new surface until the published artifact is trustworthy
and the enforcement core exists.

**1.0 cut line (binding owner decision, 2026-06-19, supersedes open-decision #5):** 1.0 ships **all seven adapter batteries as runtime subpaths** — `./query`, `./router-tanstack`, `./agent`, `./commands`, `./forms`, `./notifications`, `./data` — on top of Phases 0–3. No battery is demoted to doctrine-only. The audit's demotion-risk findings are accepted as **hardening requirements**, not as reasons to trim: every fragility the review surfaced (speculative-API freeze, Eden stream-typing, alpha/Tailwind-coupled peers, the keystone-ordering cycle) is converted below into a concrete gate that makes shipping that battery in 1.0 safe. The single authoritative cut-line statement, the build ordering it implies, and the SUPERSEDED-doc markers live in **§ The 1.0 cut line (authoritative)** at the end of this doc — that section overrides any phase-table or BLUEPRINT scope that disagrees.

---

## Architecture model

### Export topology (the spine that delivers "one dependency")

| Layer                                      | Subpaths                                                                                                                                       | Mantine?                             | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Layer-0** (headless)                     | `./tokens`, `./charts`, `./guard` _(new)_                                                                                                      | **free**                             | root barrel never re-exports them; `@visx/*` only in `src/charts/**`; the pack-test walks the **resolved `./tokens` and `./charts` dist entry graphs** and fails if either reaches any `@mantine/*` — assert the headless graphs are Mantine-free, **not** that the root never reaches them (the root provider/theme legitimately deep-imports `../charts/theme` + `../tokens` one-way to share the `--vx-*` identity — that direction is intended and must stay allowed) |
| **Root `.`** (batteries)                   | provider, theme, shell, async-state trinity, error boundary, `errorReporter` seam, `notify` helper, `createPersistedState`, native-feel tokens | coupled                              | the everything-an-app-needs-identically layer; depends one-way on the Mantine-free `./charts`/`./tokens` trees                                                                                                                                                                                                                                                                                                                                                            |
| **Adapter subpaths** (opt-in, **all 1.0**) | `./query`, `./router-tanstack`, `./agent`, `./commands`, `./forms`, `./notifications`, `./data`                                                | varies                               | heavy stack libs declared as **optional peers**; the headless layer never imports up into these                                                                                                                                                                                                                                                                                                                                                                           |
| **Tooling surfaces** (non-adapter)         | `./vite`, `./theme-lab`                                                                                                                        | `./vite` free, `./theme-lab` coupled | dev/tooling, **not** optional-peer adapters — they owe no rule/skill/guard triad and carry no optional peer (a discriminated `SurfaceSpec` tooling variant)                                                                                                                                                                                                                                                                                                               |
| **Raw presets**                            | `./configs/*`, `./styles.css`                                                                                                                  | —                                    | `extends`-by-reference (oxlint/tsconfig) vs copy-by-scaffold (oxfmt/lefthook/check.yml)                                                                                                                                                                                                                                                                                                                                                                                   |

**Mechanical root-barrel guard (Phase 0/1, ships before adapters):** a ~20-line pack-test step walks the `./tokens` + `./charts` resolved dist subtrees and red-builds on any `@mantine/*` reference. This converts the single highest-leverage topology invariant from a prose comment into a CI failure — required now because seven adapters multiply the surface where an autocomplete-driven re-export could silently collapse the free layer. `./theme-lab` is reclassified out of the adapter band (it imports `@mantine/core`, has no optional peer) into the tooling band.

**Optional-peer discipline:** every heavy stack lib sits in `peerDependencies` + `peerDependenciesMeta.{name}.optional: true` (the proven `@mantine/dates` pattern), version-coherent with its siblings.

- **Mantine overlay peers exact-pin `@mantine/core`.** `@mantine/dates`, `@mantine/notifications`, `@mantine/spotlight`, and `@mantine/modals` declare an **exact** `@mantine/core` peer (e.g. `9.3.2`), not a range — so a consumer who pins `@mantine/core@9.3.0` and opts into `./notifications@9.3.2` will see peer warnings. Document in the optional-peer contract that Mantine overlay peers require **lockstep `@mantine/*` versions** (upgrade them together), and that `@mantine/dates` transitively pulls a **mandatory** `dayjs`.
- **Land the version-coherence + optional-peer-audit gate with the FIRST adapter, not after the matrix is full.** Every declared peer must back a shipped import, and sibling overlay peers must stay version-coherent. With seven adapters each carrying 1–5 optional peers, this is cheap now and expensive to retrofit across the full matrix.

### Three battery channels

1. **CODE** — only what basalt genuinely _owns_ and every app needs identically: provider-mounted
   overlay managers, the async-state trinity + error boundary, headless ports/primitives
   (versioned persistence, notify), the native-feel CSS/motion/density token tiers. Deep modules,
   IoC seams. **Never** a `createBasaltApp({giant config})` or `<Chart type=>`/`<Form config=>`
   god-object.
2. **SCAFFOLD** — `basalt init`/`sync` (sha256 manifest) writes the consumer's _own_ version-coupled,
   app-shaped files (`query-client.ts`, `eden.ts`, `_protected.tsx`, the bound-field kit,
   viewport-fit `index.html`, motion/view-transition CSS) so editable wiring lives where it can be
   edited, not frozen behind a runtime API. New `basalt create` _subcommand_ (not a separate
   published package).
3. **DOCTRINE** — advisory rules (scaffolded into `.claude/rules`) + plugin skills, backed by
   **mechanical guards** so misbehavior is a build failure, not a markdown plea:
   edit-time PreToolUse deny → save-time oxlint squiggle → commit-time lefthook → CI gate.

### Per-concern mapping

| Concern         | CORE                                                           | SCAFFOLD                 | DOCTRINE                                     | Hard dep?                         |
| --------------- | -------------------------------------------------------------- | ------------------------ | -------------------------------------------- | --------------------------------- |
| TanStack Query  | `./query` (client + unwrap + devtools)                         | wired files              | rule (fix Eden drift)                        | optional peer                     |
| TanStack Router | router-agnostic seam stays                                     | —                        | rule                                         | `./router-tanstack` optional peer |
| TanStack Start  | SSR-safety bug fixes + `deploy:'spa'\|'start'` Vite shape      | head/palette recipe      | rule                                         | **no** (RC mid-2026)              |
| TanStack DB     | —                                                              | —                        | advisory only + `db-no-dependency` invariant | **no** (pre-v1, SSR unresolved)   |
| Forms           | — (Mantine `schemaResolver` is transitive)                     | bound-field kit template | rule (fix obsolete resolver)                 | **no package code**               |
| Motion          | duration/ease token tier + `respectReducedMotion`              | view-transition CSS      | View Transitions = default route story       | optional peers (`motion`)         |
| Auth            | shell user-slot + `UserMenu` (agnostic plain object)           | sign-in forms            | double-guard, typed-session                  | `better-auth` consumer peer       |
| AI streaming    | _(deferred)_ `./agent` build-when-driven                       | —                        | advisory + bans + guard + skill **now**      | optional peers                    |
| Notifications   | provider mount + `notify` helper                               | —                        | advisory; persistent center deferred         | optional peers                    |
| Overlays        | provider mounts modals/notifications/spotlight (opt-out flags) | —                        | rule + guards                                | three `@mantine/*` optional peers |
| Client state    | one `createPersistedState` primitive                           | —                        | advisory (zustand recommended)               | **no store dep**                  |
| SSR / islands   | bug fixes + Vite preset variant                                | —                        | Selective-SSR doctrine; RSC de-scoped        | no islands/RSC runtime            |

---

## Roadmap — majority-vote phasing

The 6 join lenses converged on the same ordering. Phases are dependency-ordered; within a phase,
lanes parallelize.

### Phase 0 — Correctness floor _(blocks everything; all S/M, no external unknowns)_

Unanimously elevated by every lens. Nothing new ships until this is green.

- `fix-packtest-phantom-assert` — **done** (Phase 0): removed the rotted `settings.stanza.json` tarball assert.
- `consolidate-publish-oidc` — **deterministic dual-publish bug, fix in flight.** At HEAD, `release.yml` ran its own `NPM_TOKEN` publish job AND `@semantic-release/github` created a Release that triggered `publish.yml`'s OIDC publish — **two `npm publish` calls for the same version on every release**, the second failing `EPUBLISHCONFLICT`. Collapse to ONE path: delete `release.yml`'s publish job (the working tree already does), let OIDC `publish.yml` be the sole publisher, configure the npmjs.com Trusted Publisher entry, and delete the `NPM_TOKEN` secret. Closes the 2026 stored-credential vector. (S)
- `add-publint-gate` + `add-attw-gate` — the two bundler-independent package linters basalt lacks (exports/metadata shape; `.d.ts` resolution across node16/nodenext/bundler). **Add as `publint .` + `attw --pack .` steps in `pack-test.sh` NOW — do NOT wait for the tsdown migration.** publint 0.3.x + attw 0.18.x are the confirmed 2026 standard, bundler-independent, and especially important for a seven-subpath package. (S)
- `assert-charts-mantine-free-dist` + the **root-barrel dist guard** — extend pack-test to (a) do a **second scratch install WITHOUT the Mantine peers** that actually `import('basalt-ui/charts')` and asserts it loads, and (b) walk the resolved `./charts`/`./tokens` dist graphs and fail on any `@mantine/*`. Today only `./tokens` is asserted peer-free, and the scratch consumer installs Mantine before testing — so the central optional-peer claim is currently lint-asserted, not artifact-asserted. With all seven batteries shipping, this is the load-bearing proof. (M)
- `audit-mantine-dates-peer` — verify or remove the optional peer (no consuming code found; only `vite.ts` dedupe hints + a comment). (S)
- `charts-tokens-only-resolution+render` pack-test — the load-bearing proof of the whole optional-peer architecture.

### Phase 1 — Enforcement IoC + the type-spine _(the spine; ship BEFORE any adapter subpath)_

**SEQUENCING LAW (binding):** the `SURFACES` registry and the `BasaltRegister` type-seam are a **prerequisite for every adapter subpath, not a parallel track.** All seven 1.0 batteries cross-reference the merged Register (`SidebarItem.command?: CommandId`, `keyof typeof APP_COMMANDS`, the per-slot `keyof`-of-another-slot refs), so the spine must compile and be fixture-proven before a single adapter ships — otherwise each battery bolts on a local type that later has to be retro-threaded (the calcification the greenfield mandate forbids). Build order: **BasaltRegister (type seam) → SURFACES (enforcement registry) → `createPersistedState` → adapter subpaths.**

- `register-interface-spine` — ship the empty augmentable `interface BasaltRegister {}` + the conditional-inference extractors (`BasaltRegister extends { commands: infer C extends CommandMap } ? keyof C : never`). The pattern is verified-safe on TS 6.x (the `interface Register {}` declaration-merge idiom is the live TanStack Router v1 / Query v5 mechanism). **The one footgun is the empty-default type: it MUST be `{}` (→ `keyof {} = never`), NEVER `Record<string, never>` (→ `keyof Record<string,never> = string`, which silently widens `CommandId`/`OverlayKey` to `string` and accepts any string).** Gate with **two compile fixtures** in `tests/` (mirroring `series.type-guard.ts`): an **augments-nothing** consumer (must get never-keyed empty, not `any`) and an **augments-all** consumer (must get exact keys). The spine release is gated on both fixtures compiling. (M)
- `headless-guard-core` — extract `checkSource()` into a `./guard` subpath + a `GUARD_RULES`
  registry, decoupled from the CLI. One policy, three adapters (CLI + future oxlint plugin + PreToolUse hook). Build it thin: extract first, then add the broken-fixture compile test (below) before the type tier is trusted. (M)
- `surfaces-registry` — single source of truth for `{subpath → layer, forbidden-imports, rule, skill, guardKinds}`. Build **incrementally** to avoid the god-object trap: derive `RULE_NAMES` from it FIRST (the one drift the audit confirmed — the hardcoded `['tokens','charts','mantine','router','query','state']` array) with a set-equality test, **prove the literal-union fires with a broken-fixture compile test BEFORE wiring the oxlint-config generator or manifest**, and keep the projections (both ban-lists, the manifest, the triad contract) independent until drift is observed. Use a discriminated `SurfaceSpec` (doctrine vs tooling) so `./vite`/`./theme-lab` owe no triad. (toolchain)
- `state-create-persisted-state` (**pulled into Phase 1 — keystone**) — the ~30-line inline `useSyncExternalStore` persistence primitive (versioned + `migrate` + Standard-Schema), Mantine-free and dependency-free, living in a Mantine-free location reachable from charts/tokens-only consumers (NOT root `.`). It is a **hard prerequisite** of `./agent` chat-history, `./forms` drafts, and `./notifications` history — three 1.0 batteries — so it must land before them, not in Phase 3 behind the batteries that need it. (S)
- `triad-contract-check-coverage` — `basalt check-coverage`: a new public subpath is "not done"
  until its **rule + skill + guard** triad lands. Gates every adapter. (S)
- `wire-defence-in-depth-templates` — close the commit-time + CI-freshness holes (sync `--check` in
  `check.yml`, **dogfood `basalt check-theme` on basalt's own `src/`** in `ci.yml` + lefthook — set `basalt.roots` to the real package src, not the argo default paths). (S)
- `cli-runtime-portability` — resolved to **Bun-everywhere** (open-decision 1). Swap the build scripts' Bun-only `import.meta.dir` → `import.meta.dirname` (Node 20.11+ and Bun) so the artifact build is runtime-portable; keep the `#!/usr/bin/env bun` bin shebang under the documented Bun requirement. (M)
- `oxlint-preset-sync-contract-test` — assert the shipped `configs/oxlint.json` is a structural superset of the repo-local `.oxlintrc.json` Mantine-free + `@visx` bans for `charts/**` **and** `tokens/**` (the shipped preset currently omits the `tokens/**` override — the D2 gap). A cheap version is buildable NOW without the SURFACES generator; the generator absorbs it in Phase 2. (toolchain)
- `fix-router-doctrine-currency` — strip the phantom-ban claim from `basalt-router.md` (the shipped preset does NOT ban `react-router`; the ban was removed in Phase 0). Router preference stays **advisory, never a hard ban**. Add the rule-currency drift check so a rule claiming "the preset bans X" must map to a real `forbiddenImports` entry. (S)

### Phase 2 — Build pipeline, then compiler _(strictly serial, externally gated)_

- _(new)_ `tsdown-unbundle-css-spike` — throwaway spike proving `*.module.css` + `styles.css`
  passthrough under unbundle, **gating** the migration. (S)
- `migrate-tsdown` — replace tsup + the two hand-rolled `.mjs` post-processors; native publint/attw.
  Run a `visx-4-stable-bump` co-scheduled (after `charts-version-preflight` confirms stable 4.x is
  published) so the dist gate runs once. (L)
- `compile-at-publish` → `pin-compiler-exact` → `compiler-safety-lint` → `pack-test-render-compiled`
  → `drop-hand-memo-charts` — ship dist compiler-processed (the React Compiler doesn't process
  `node_modules`), then mount a compiled component from dist in the gate, then remove the hand-memo
  wraps. (L chain)

### Phase 3 — Genuinely-owned core primitives _(small, every-app-identical, no speculation)_

> `createPersistedState` **moved to Phase 1** (keystone — see the sequencing law). The standalone `./state` adapter row is **dropped**: the primitive is one inline `useSyncExternalStore` in a Mantine-free location, not a separate subpath. Delete any remaining `./state` topology row.

- `semantic-tier-vx-vars` (**keystone**) — promote a semantic/intent tier (`--vx-bg`/`--vx-fg`/`--vx-accent`/`--vx-danger`/`--vx-border`), retire the `gray-2/3/4` resolver hack (`theme/index.ts:211-218`); unblocks typed refs + a contrast guard. (M)
- `native-feel-css-tokens` + `shell-consume-native-tokens` + `shell-ssr-safe-collapse` — safe-area insets (incl. `env(safe-area-inset-bottom)` on the mobile footer), `svh`, momentum/overscroll in `styles.css`; effect-gated collapse default. (S/M)
- `async-state-trinity-core` + `error-boundary-core` (`BasaltErrorBoundary` wired to `QueryErrorResetBoundary`). (M)
- **`errorReporter` seam on `BasaltProvider` (1.0 provider-shape decision, reserve before freeze)** — a single vendor-agnostic `onError?: (error: unknown, ctx: { kind: 'render' | 'window' | 'unhandledrejection' }) => void` prop + a `BasaltErrorBoundary` mounted inside the provider + a once-wired SSR-guarded `window` error/unhandledrejection listener. basalt calls `onError`, never imports Sentry/PostHog. Defaults to `console.error` in dev, no-op when unset. This is an API-shape commitment that must land before the provider prop surface freezes at 1.0, not a post-1.0 add. (S)
- **CSP `nonce?: string` prop on `BasaltProvider` (1.0 provider-shape decision)** — thread a per-request nonce onto the injected palette `<style>` so CSP-enforcing dashboards avoid `style-src 'unsafe-inline'`. Pair with the `injectPalette={false}` head-injection escape hatch. (S)
- `notify-token-helper` + `prop-overridable-strings` + `density-axis` + motion duration/ease tokens. (S/M)
- `responsive-chart-wrapper` — one SSR-safe `ResponsiveChart` render-prop over `@visx/responsive`
  `useParentSize` (width-gated skeleton, no width-0 server render). (M)

### Phase 4 — Adapter subpaths _(all seven ship in 1.0; each gated by the Phase-1 spine + a real playground demo)_

Every adapter compiles against the `BasaltRegister`/`SURFACES` spine and `createPersistedState` (Phase 1). None is demoted to doctrine-only — the hardened battery specs in **Round 2** carry the per-battery safety gates.

- `query-subpath-helpers` (`./query`: `createBasaltQueryClient` + `unwrap` + devtools) + `scaffold-data-layer-files` + `fix-query-rule-eden-drift` + `/basalt:data` skill. The advisory `basalt-query.md` must replace the `.data!` hand-unwrap example with the typed `unwrap()` seam, and document the two Eden silent-`any` footguns (method-chaining required; shared-root-tsconfig path-alias) as hard authoring rules. (M/L)
- `router-tanstack-adapter-subpath` (`./router-tanstack`: `useBasaltNav` + `useRouterBreadcrumbs`
  over `useMatches`/`staticData`, made optional via `StaticDataRouteOption` augmentation). ~90% of consumers use it. (L)
- `agent-subpath` (`./agent`) — see the hardened **AI streaming** spec in Round 2 (yield-time-only validation, explicit `AsyncGenerator<AgentPart>` return type, headless markdown renderer). (L)
- `commands-subpath` (`./commands`) — see the hardened **Command layer** spec in Round 2 (typed registry + projectors ship; the alpha hotkeys binding runtime carries a documented risk). (M/L)
- `forms-subpath` (`./forms`) — see the hardened **Forms** spec in Round 2 (`@mantine/form` as a declared optional peer; `useFormDraft` on `createPersistedState`). (M)
- `notifications-subpath` (`./notifications`) — see the **Notifications** spec in Round 2 (thin headless layer over `@mantine/notifications` + persisted history). (M/L)
- `./data` — `data-table` (TanStack Table `>=8 <9`) + `virtual-list` (TanStack Virtual `>=3 <4`) kinds, optional peers. (M/L)
- `overlays-peers` → `overlays-provider-mount-managers` (mount modals/notifications/spotlight behind
  opt-out flags via a composable `<BasaltOverlays>`, NOT a prop-per-battery on the provider). (S/M)
- `skills-grouped-by-workflow` — group skills with progressive-disclosure references. (L)

### Phase 5 — Deferred / speculative _(advisory-only until a real consumer drives them)_

> **Owner override (2026-06-19):** `agent-runtime-subpath` and `notifications-persistence-subpath` are **promoted out of this kill-list into the 1.0 cut** (hardened — see Round 2). The speculative-API/semver-freeze risk for the seven batteries is **knowingly accepted**; the per-battery hardening gates below are the mechanism that makes the accepted risk safe to freeze.

Still deferred (build runtime later, keep as advisory rules + guards now): `headless-use-bottom-sheet`, `basalt-pwa-vite-helper` + `pwa-runtime-hooks`, `canvas-line-kind`, `appshell-aside-slot`, `db-ssr-guard` runtime, `create-basalt-app` (after CLI portability + oxlintrc scaffold + dep-scaffold), `dtcg-interchange`, `@mantine/dropzone` upload doctrine, the full `<Chat>` composite + voice/audio.

**The reframed "no speculative API" invariant** now reads: _do not freeze the API of an **unforced** surface._ It no longer forbids the seven driven batteries — it forbids the genuinely-undriven ones above. Where a battery's transport or backend is uncertain (Eden/Elysia for `./agent`/`./query`), the seam is **injected** (`AgentTransport`, scaffolded `eden.ts`), not hard-coded — so the 1.0 surface freezes the seam, not the backend assumption.

---

## Enforcement contract (defence-in-depth)

A new public subpath is **not done** until its **rule + skill + guard** triad lands —
mechanized by `basalt check-coverage`. The guard core (`./guard`) is extracted once and consumed by
the CLI, a future `oxlint-plugin-basalt`, and a `PreToolUse` deny hook.

Four enforcement tiers per surface: **edit-time deny (hook) → save-time squiggle (oxlint) →
commit-time (lefthook) → CI gate**. Highest-leverage move: **convert guards into tsc errors**
(`semantic-tier-typed-refs`, the `BasaltRegister`-keyed `CommandId`/`OverlayKey`/notification-kind registries) — a check that becomes a compile
error is a guard you delete.

**Platform-reality caveats (verified 2026):**

- **`PreToolUse` `additionalContext` is dead** (issues #15664/#19432/#55889 closed _not-planned_; the model never receives it). All edit-time steering text must live in **`permissionDecisionReason`** (the only reliable model-facing channel from a `PreToolUse` hook; `systemMessage` is the fallback). The `deny` decision itself blocks reliably — only the context-injection channel is broken. Tier-2 stays best-effort and steer-only.
- **The oxlint JS-plugin system is alpha (since 2026-03).** Keep the regex `check-theme` kinds as the zero-dep fallback; do not hard-depend on plugin loading. The custom `oxlint-plugin-basalt` AST path stays a **deferred experiment** behind the stable regex + tsc tiers.
- **The `SURFACES` literal-union typing is non-trivial TS** — a broken-fixture compile test **must** prove the error actually fires, or the contract is theatre. Land it before any guarantee leans on the type tier.

Add the missing meta-guards: oxlint-preset-sync contract test, root-barrel re-export ban, per-subpath dist dep-isolation assertion, optional-peer audit (every declared peer must back a shipped import + sibling version-coherence), rule-currency drift check.

---

## Completeness additions (the forgotten concepts)

Genuinely missing for a "battery-included" dashboard framework — all cheap, mostly advisory/core,
land in parallel with Phase 3:

- **errorReporter seam** on `BasaltProvider` + `window` error/unhandledrejection wiring (Sentry/
  PostHog/console, vendor-agnostic). _(core)_
- **env validation** — `basalt-env.md` + a tiny `validateEnv(schema)` Standard-Schema helper.
- **document head / title** — `useDocumentTitle` tying `title ← route ← breadcrumb` (SPA + Start).
- **Intl formatting doctrine** — `basalt-format.md`: native `Intl` date/number/currency/relative-time,
  explicit timezone stance (a data-dense charting framework currently has none).
- **`useOnlineStatus` + offline banner** — in-app network status, distinct from PWA SW updates. _(core)_
- **print stylesheet** — `@media print` block collapsing shell chrome (dashboards get PDF'd).
- **security-headers / CSP doctrine** — the inline `<style>` palette injection + auth cookies + SSR
  all intersect CSP; document the nonce path.
- **clipboard-with-feedback** primitive (theme-lab already uses raw `navigator.clipboard`).
- **`@mantine/dropzone`** optional peer + upload doctrine (Eden multipart → Elysia seam).
- **keyboard-shortcut registry** beyond Spotlight's `mod+K` + a shortcuts-help overlay.
- **consolidated testing story** — `test-preset-toolchain` (Vitest 4 browser-mode + RTL + jest-dom),
  `axe-a11y-gate`, visual-regression (self-hosted Playwright CT, **not** Storybook/Chromatic),
  `start-smoke-test`, owned by one `configs/check.yml`.

---

## The setup flow after this lands (honest)

```
bun add basalt-ui            # one dependency (+ peers it prompts for)
bunx basalt create           # scaffolds provider/shell/vite + data-layer/auth files + .oxlintrc + .claude doctrine
claude plugin install basalt@basalt-ui   # one-time, user scope → skills in every project
```

`basalt create` prints the **honest residual-step floor** (peers to install per chosen battery), not
a false "everything's wired". `basalt doctor` detects the half-installed state (init-without-plugin
or plugin-without-init).

---

## Rejected (codified as ADRs)

Scoped sub-packages (`@basalt-ui/*`); a meta-package; hard deps on any `@tanstack/*` / `motion` /
`better-auth` / AI-SDK; a second overlay primitive lib (cmdk/Radix/Base UI); hosted notification
SDKs (Knock/Novu); islands/RSC runtime; Storybook; Chromatic.

---

## Open decisions for you

1. **CLI runtime** — _resolved: Bun-everywhere_ (documented; templates assume `bunx`). Build scripts swap `import.meta.dir` → `import.meta.dirname` for artifact-build portability.
2. **visx stable bump — OWNER DECISION TO FLAG (not auto-applied).** Stable `@visx/* 4.0.0` shipped 2026-06-11, but the **package CLAUDE.md intentionally holds the `4.0.0-alpha.11` pin, co-scheduled with the Phase-2 tsdown migration so the dist gate runs once** (`PHASE-1-HANDOVER.md §7`: "Do NOT bump the `@visx/*` pin"). The audit recommends **decoupling** the stable bump (it has no API changes beyond `prop-types`/`lodash` removal + React-18 floor, and is independently provable by the existing pack-test) so the package does not ship a pre-release dep under a stable 1.0. **This is a flagged owner decision — do not silently bump.** Choose: (a) hold the co-schedule as documented (bump rides tsdown), or (b) decouple and bump `alpha.11 → exact 4.0.0` + add `@visx/responsive@4.0.0` now in its own commit. Tendency: (b), but it overrides a standing intentional hold, so confirm.
3. **`createPersistedState` placement** — _resolved: inline `useSyncExternalStore`, Mantine-free, pulled into Phase 1_ (keystone — see the sequencing law).
4. **Notifications scope for 1.0** — _resolved: full battery ships_ (history + bell + center), per the MAXIMUM-AMBITION cut line.
5. **1.0 cut line** — _resolved: see § The 1.0 cut line (authoritative)_ — all seven batteries ship as runtime subpaths in 1.0, hardened.
6. **Scaffold vs runtime for the data layer** — _confirmed: scaffold the consumer's own `query-client.ts`/`eden.ts`_; the transport is an injected seam, swappable without touching basalt.

## Risks

- **`streamdown@2` requires Tailwind** for its styling (`@source` directive + shadcn-style CSS custom properties), which conflicts with basalt's **Tailwind-free 1.0 identity**. Mitigation (binding): ship `StreamingMarkdown` behind a **headless render-prop / Tailwind-free renderer** so a Mantine-only consumer never sets up Tailwind; `streamdown` stays an optional peer behind that seam.
- **`./agent` Eden stream-typing is fragile** — applying a response schema to the `async function*` route drops the `AgentPart` union to `any` (`eden#231`). Mitigation (binding): yield-time-only validation + explicit `AsyncGenerator<AgentPart>` return type + a broken-fixture compile gate. Accepted-and-hardened, not a blocker.
- **`./commands` ships an alpha optional peer** (`@tanstack/react-hotkeys@0.9.1`). Mitigation: the typed registry + projectors are the safe core; the alpha _binding runtime_ + `ShortcutsHelp` carry a documented risk and re-verify before wiring; Spotlight `Mod+K` covers the 80%. Exact-pin discipline holds.
- **Optional-peer matrix is large** (seven adapters, 1–5 peers each; Mantine overlays exact-pin `@mantine/core`). Mitigation: the optional-peer audit + sibling version-coherence gate lands with the FIRST adapter; document the lockstep-`@mantine/*` requirement + `@mantine/dates`'s mandatory `dayjs`.
- tsdown `*.module.css` behavior under unbundle is the one unverified build risk → the CSS spike gates the migration (and the intentional visx-pin hold — see open-decision 2).
- The React Compiler doesn't process `node_modules` → dist must ship compiler-processed; until then hand-memo stays. Pull the Rules-of-React `compiler-safety-lint` forward onto `src` now (free insurance), defer the compilation step to post-bundler.
- Doctrine re-forks if argo/dotfiles cleanup is deferred past the rules shipping.

---

# Round 2 — resolved decisions & finalized battery specs (2026-06-15)

Maintainer decisions on the open questions, plus four researched battery specs (visx, forms,
notifications, AI streaming) and the new command/shortcut layer. Each spec was research-verified
against current 2026 versions.

## Open decisions — resolved

1. **CLI runtime → Bun-only.** Declare Bun a hard requirement everywhere (templates already assume
   `bunx`). No Node-compat shim. `cli-runtime-portability` resolves to "Bun-everywhere, documented".
2. **visx → bump to stable.** Stable `@visx/* 4.0.0` shipped **2026-06-11** (the "no stable visx 4"
   premise is now stale). Bump alpha.11 → **exact `4.0.0`**, add `@visx/responsive@4.0.0`, keep
   exact-pin discipline, co-schedule with `migrate-tsdown` behind the pack-test. Update the stale
   CLAUDE.md note in the same commit. visx 4 dropped `prop-types` + `lodash` and floors React 18 —
   all wins for basalt.
3. **`createPersistedState` → inline, Mantine-free.** ~30-line `useSyncExternalStore` impl so it's
   reachable from charts/tokens-only consumers. Confirmed CORE; wired into shell prefs, form drafts,
   notification history, and chat history.
4. **Notifications → full battery (see below), not just `notify`.** Maintainer reimplements this
   every app; ship the mature version.
5. **`./query` + `./router-tanstack` → pulled into 1.0** (were Phase 4). They're the common case.
6. **Data layer → Elysia/Eden default, server pluggable.** basalt ships the generic `./query`
   battery and _scaffolds_ an editable `eden.ts`; the transport is a seam, swappable without touching
   basalt. basalt never hard-couples to Elysia.

## AI streaming → first-class `./agent` (net-new, hardened for 1.0)

**Net-new, no argo precedent.** Argo has **no** existing streaming/chat/voice code — the `feat/argo-voice` branch does not exist. This battery is **net-new**, built on argo's proven typed-Eden _discipline_ (not on any argo streaming port). Say so plainly: the only thing inherited is the method-chained-Elysia + typed-Eden pattern, not a streaming implementation. The owner ships `./agent` in 1.0 knowingly; the gates below make that safe.

- **Default path = Eden-native typed streaming, zero extra deps.** One discriminated `AgentPart`
  union declared once in the consumer's `lib/agent-parts.ts`; an Elysia `async function*` route yields
  it → Eden Treaty consumes it as a typed `AsyncGenerator` via `for await` → React renders it typed.
- **BINDING STREAM-TYPING GATES (the 1.0-safety contract for this battery):**
  1. **Validate at YIELD-TIME only.** **NEVER apply a `t.Object` / `t.Union` response schema to the `async function*` stream route** — `elysiajs/eden#231` (open 2026) drops the inner discriminated `AgentPart` union to `any` under response validation. Validate each part as it is yielded, or skip Treaty's response-schema on the stream endpoint entirely.
  2. **Require an explicit `AsyncGenerator<AgentPart>` return type** on the route handler so the inner yield type survives inference (without it, even a chained route can widen).
  3. **Gate with a broken-fixture compile test:** a fixture that applies a response schema (or omits the explicit return type) and proves the `AgentPart` union collapses to `any` — so a future edit that re-introduces the footgun red-builds. This is the `no-raw-stream` guard's compile-time half.
  4. The two upstream Eden footguns are hard authoring rules in `basalt-agent.md`: **method chaining required** on all Elysia routes (no chaining → `App` widens to `any`), and a **shared root tsconfig** both client and server extend (path-alias mismatch → `any`).
- **AI SDK is an opt-in transport, not the spine** (`ai@6`, `@ai-sdk/react@3` as optional peers behind
  `aiSdkTransport`) — both verified live and stable in 2026.
- **`StreamingMarkdown` must be Tailwind-free.** `streamdown@2`'s styling **requires Tailwind** (a `@source` directive + shadcn-style CSS custom properties), which **conflicts with basalt's Tailwind-free 1.0 identity**. Ship `StreamingMarkdown` as a **headless render-prop / Tailwind-free renderer** so a purely-Mantine consumer styles markdown with Mantine/CSS and never sets up Tailwind. `streamdown` stays an _optional_ peer behind that seam, never a default that drags Tailwind into a Tailwind-free framework. **Recorded in the Risks section.**
- **Surface (`./agent`):** headless `useAgentStream<TPart>({ transport })` (returns
  `parts/status/send/stop/regenerate`), an `AgentTransport` seam (`edenTransport` default,
  `aiSdkTransport` opt-in), `PartList` + default `TextPart/ReasoningPart/ToolCallPart/SourcePart`
  renderers, the Tailwind-free `StreamingMarkdown`, `StickToBottom` (wraps `use-stick-to-bottom@1`), `createChatHistoryStore` (on the Phase-1 `createPersistedState`).
- **Channels:** CODE = the hook + transport seam + renderers; SCAFFOLD = the Elysia stream route +
  `agent-parts.ts` union + Eden wiring (secret-bearing, app-owned); DOCTRINE = `basalt-agent.md` + `/basalt:agent` skill + the `no-raw-stream` guard.
- **Defer:** full `<Chat>` composite, message-bubble kit, voice/audio, multi-agent orchestration UI.

## Forms → `@mantine/form` (decisive), `./forms` subpath

- **Decision: `@mantine/form` is the default.** Decisive fact: it supports **Standard Schema natively** via `schemaResolver` — the same Zod 4 / Valibot schema validates the Elysia route, types the Eden client, and validates the form. **Correction (verified):** `schemaResolver` shipped in **Mantine v9.0.0**, not v9.3.1 — it has been in every v9 release (confirmed against the 9.0.0 changelog + package tarball). The earlier "new in v9.3.1" framing is stale; the decision and API are unchanged and correct. Runner-up TanStack Form; **not** RHF.
- **`@mantine/form` is a declared `./forms` optional peer** (`peerDependenciesMeta.optional`). The state/forms doctrine teaches `import { useForm, schemaResolver } from '@mantine/form'`, so the package **must declare it** — today it is absent from `peerDependencies`, so a consumer following the rule gets an unresolved-module error with no signal from basalt. Add it as an optional peer (same pattern as `@mantine/dates`) so the import resolves when the consumer opts into `./forms`.
- **Surface (`./forms`, `@mantine/form` optional peer):** `createForm` (typed `useForm` wrapper,
  basalt defaults), `Field` typing helper, `FormErrorSummary`, and **`useFormDraft`** — autosave/
  restore/clear-on-submit on the Phase-1 `createPersistedState` (versioned, namespaced).
- **Channels:** CODE = the subpath helpers; SCAFFOLD = the editable bound-field kit + a worked create/edit form using `useFormDraft`; DOCTRINE = `basalt-forms.md` (split out of `basalt-state.md`) + a `form-localstorage` guard. Validation lib: **Valibot** default, Zod 4 if already standardized.

## Notifications → thin headless layer over Mantine (`./notifications`)

Mantine's `@mantine/notifications` already does id-dedup + stacking, so basalt adds only the
semantics/typing/persistence/visibility layer — never re-implements a toast engine.

- **Surface (`./notifications`, `@mantine/notifications` optional peer):** `notify` +
  `notifySuccess/Error/Warning/Info` + `notifyPromise` (intent→VX color + ReactNode icon + per-intent
  autoClose + aria-live); `defineNotifications` typed registry (`emit('kind', payload)`); headless
  `NotificationStore` port + `createPersistedState`-backed history (read/unread, seen, grouping, ring
  buffer); `NotificationBell` + center for the shell `globalActions` slot; `usePushSubscription` —
  a server-agnostic Web Push client seam (`onSubscribe`/`onUnsubscribe` callbacks; sw.js + Elysia
  route are SCAFFOLD, not shipped). `withNotifications` provider toggle.
- **Two-layer dedup:** Mantine id-dedup (same toast on screen) + a basalt `dedupKey`+window (kills
  bursts after auto-close). **Visibility-aware delivery:** buffer non-urgent toasts while
  `document.hidden`, flush+collapse on `visibilitychange` → reliable "see it once, when looking".
  **Mark-seen** via IntersectionObserver in the center (`seenAt` distinct from `readAt`).
- **Channels:** CODE = all of the above; SCAFFOLD = sw.js + Elysia push route stubs + the registry
  seed; DOCTRINE = `basalt-notifications.md` + `/basalt:notify` skill + guards (`direct-toast-import`
  ban outside the battery, `notify-missing-dedupkey` in event handlers, aria-live correctness).
- **Defer:** server push infra (`web-push` send, VAPID gen, subscription DB), cross-device synced
  read-state, per-kind preferences/quiet-hours.

## Command / global-interaction layer → new `./commands` subpath

The connective tissue for "how do global interactions open modals/views" — a **command bus** so a
shortcut, a Spotlight entry, a notification-bell click, a nav item, and a programmatic call all funnel
through one typed action.

- **Shortcuts decision: TanStack Hotkeys** over Mantine `useHotkeys` — because it _is_ a registry (template-literal-typed combos, sequences like `g-d`, scoping, conflict policy, help-overlay formatters) that projects into the command palette + help overlay. **Version correction (verified):** the package is **`@tanstack/react-hotkeys` v0.9.1 (alpha)** — **`v0.10.0` does not exist on npm**. Fix the pin to `0.9.1` and keep exact-pin discipline. **Alpha-peer risk (flagged, not waved away):** an alpha optional peer in a published 1.0 means an upstream alpha breaking change can force a basalt adapter change; the blast radius is confined to the one `defineCommand`-wraps-the-alpha adapter. The owner ships `./commands` in 1.0 knowingly; the typed registry + projectors are the safe core and the alpha _binding runtime_ is the documented-risk part (see 1.0-vs-defer below).
- **Surface (`./commands`, optional peers `@mantine/{spotlight,modals,notifications}` +
  `@tanstack/react-hotkeys@0.9.1`):** `defineCommands` / `defineCommand` (typed `{ id, label, group?, icon?,
shortcut?, when?, run(ctx) }`), `defineOverlays`, an imperative `overlays.open(key, props)`, and projectors `toSpotlightActions` / `toHotkeyBindings` / `toShortcutList` / `runCommand`.
- The `keyof typeof APP_COMMANDS` id-union (and the `BasaltRegister`-keyed `CommandId`/`OverlayKey` cross-refs) make a trigger referencing a nonexistent command a **tsc error** — **this safety requires the Phase-1 `BasaltRegister` spine to land first** (the spine is the prerequisite, not parallel). Ship the registry only after the augments-nothing/augments-all fixtures pass.
- **Imperative vs route-driven rule:** _Does this overlay belong in the URL?_ Shareable/back-button/
  refreshable → route-mask via `./router-tanstack` (`ctx.navigate`). Ephemeral (confirm, drawer, help)
  → `overlays.open`. Triggers never know which — they only reference a command `id`.
- **Channels:** CODE = registry + projectors + overlay controller + `ShortcutsHelp`; SCAFFOLD = `app-commands.ts` / `app-overlays.ts` + Spotlight wiring; DOCTRINE = `basalt-commands.md`
  - `/basalt:commands` skill + guards (`raw-overlay-open`, `raw-key-listener`).
- **1.0 (all of `./commands` ships) vs the alpha-runtime carve-out:** ship the typed registry + `defineOverlays` + imperative `overlays.open` +
  `toSpotlightActions`/`runCommand` + the `shortcut?` _type_ at 1.0. The `@tanstack/react-hotkeys` _binding runtime_ + `ShortcutsHelp` overlay ship behind the documented alpha risk, with Spotlight `Mod+K` covering the 80% — re-verify the alpha API has not broken before wiring the runtime.

## The 1.0 cut line (authoritative)

**This section is the single source of truth for 1.0 scope. It overrides any phase table, the BLUEPRINT argo-migration stages, and open-decision #5 (now resolved).**

**1.0 = Phases 0–3 (correctness floor + enforcement IoC + type-spine + build pipeline + owned core primitives) PLUS all seven adapter batteries as runtime subpaths:** `./query`, `./router-tanstack`, `./agent` (the Eden-typed-streaming core), `./commands` (typed registry + imperative overlays), `./forms`, `./notifications`, and `./data`. **No battery is demoted to doctrine-only.** The speculative-API/semver-freeze risk for the seven is knowingly accepted; the per-battery hardening gates (Round 2 + Phase 1 spine) are what make freezing them safe.

**Binding build order (the sequencing law):**

1. **Phase 0** — correctness floor (OIDC publish consolidation, publint/attw, charts-dist Mantine-free + root-barrel guard).
2. **Phase 1 spine** — `BasaltRegister` (empty-default `{}`, augments-nothing + augments-all fixtures) → `SURFACES` registry (`RULE_NAMES` derived, broken-fixture compile test) → `createPersistedState` (keystone). **No adapter subpath ships before the spine compiles and is fixture-proven.**
3. **Phases 2–3** — build pipeline, then owned primitives (semantic-tier vars, error-boundary, `errorReporter`/`nonce` provider-shape decisions, responsive-chart).
4. **Phase 4** — the seven adapters, each gated by its Round-2 hardening spec and a real playground demo.

**SUPERSEDED:** The BLUEPRINT "Argo migration plan" (the S0–S5 staged-extraction table) and its **`feat/argo-voice` "hard prerequisite for S4"** framing are **superseded as a definition of basalt's own roadmap.** They describe an **orthogonal argo-side migration concern**, not basalt-ui's build sequence — and the shell is already shipped in `src/shell/`, so the voice-branch prerequisite is already moot. Read basalt's roadmap from **this** cut line and the phase ordering above; treat BLUEPRINT S0–S5 only as the argo-consumer's later adoption story. (`feat/argo-voice` does not exist; `./agent` is net-new — see the AI-streaming spec.)

**Phase-id collision note:** "Phase 1" means different things across docs (MATURATION macro-phases, ENFORCEMENT enforcement sub-phases, INTEGRATION type sub-phases). When orchestrating, prefix per-axis (M1/E1/I1) — do not assume a bare "Phase 1" is the same unit across docs.

## Updated optional-peer matrix (subpath → optional peers)

| Subpath             | Optional peers (all `peerDependenciesMeta.optional`)                                         |
| ------------------- | -------------------------------------------------------------------------------------------- |
| `.` (root)          | `@mantine/dates` (verify/keep)                                                               |
| `./query`           | `@tanstack/react-query` (+ devtools)                                                         |
| `./router-tanstack` | `@tanstack/react-router`                                                                     |
| `./forms`           | `@mantine/form`                                                                              |
| `./notifications`   | `@mantine/notifications`                                                                     |
| `./commands`        | `@mantine/spotlight`, `@mantine/modals`, `@mantine/notifications`, `@tanstack/react-hotkeys` |
| `./agent`           | `ai`, `@ai-sdk/react`, `streamdown`, `shiki`, `use-stick-to-bottom`                          |
| `./data`            | `@tanstack/react-table`, `@tanstack/react-virtual`                                           |

Every optional peer must back a _shipped import_ (the optional-peer audit gate) and stay
version-coherent with its siblings. The `no @tanstack/* / no zustand / no motion` CLAUDE.md invariant
is clarified to **"no hard dep / no hard peer / not in the root barrel"** — opt-in subpath optional
peers are the sanctioned adapter model.

> **Enforcement hardening** (advancing the `.claude` rules/skills + oxlint rules so misbehavior is
> mechanically prevented) is the subject of a dedicated multi-expert analysis — see the forthcoming
> `docs/ENFORCEMENT-HARDENING.md`.
