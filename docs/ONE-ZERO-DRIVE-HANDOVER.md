# HANDOVER — basalt-ui: drive the 1.0 PR to fully-ready + pushed

> **Save this as `docs/ONE-ZERO-DRIVE-HANDOVER.md`** — do NOT overwrite `docs/PHASE-1-HANDOVER.md` (that is the historical Phase-1 *kickoff* doc, now superseded). The "(this doc)" pointer in §0 refers to THIS file.

## 0. KICKOFF PROMPT (paste verbatim)

```text
ultracode

You are driving basalt-ui's 1.0 PR to fully-ready + pushed, on branch feat/s0-mantine-pivot.
The Phase-1 spine is DONE and committed (5 commits, nothing pushed, no PR open). Owner has
unrelated in-flight WIP uncommitted (tokens/index.ts, CLAUDE.md, BLUEPRINT.md,
EXECUTION-HANDOVER.md, root package.json, plugins/basalt/skills/*/SKILL.md x3) — LEAVE IT
UNTOUCHED; never stage or amend owner WIP.

FIRST: read docs/ONE-ZERO-DRIVE-HANDOVER.md (this doc), docs/MATURATION-ROADMAP.md (the work
ledger; the authoritative cut line is "§ The 1.0 cut line (authoritative)" lines 355-368),
docs/ENFORCEMENT-HARDENING.md (the mechanical axis), docs/INTEGRATION-DX.md (the type-safety
axis), and packages/basalt-ui/CLAUDE.md. The docs/PHASE-1-* files (HANDOVER/GROUNDING/DESIGN/
IMPLEMENT-HANDOVER) are HISTORICAL — the Phase-1 spine they planned is already built and
committed; read them only for archaeology, not as live instructions. Do NOT execute BLUEPRINT.md
S0-S5 — it is SUPERSEDED as basalt's roadmap (argo-side concern only).

THEN loop, one work unit at a time, in the binding sequence:
  Phase 0 finish -> Phase 2 build pipeline -> Phase 3 owned primitives -> Phase 4 the seven
  batteries (each gated by its Round-2 hardening spec + a real playground demo + check-coverage)
  -> completeness/skills/scaffold -> finish line.
Binding law: gates before bundler swap; bundler swap before new channels. Build no new surface
until the published artifact is trustworthy and the enforcement core exists. Phase-id collision
note: docs prefix per-axis (M#/E#/I#) — a bare "Phase 1" is NOT the same unit across docs.

FOR EACH unit, run ONE ultracode workflow: understand -> design -> implement -> review.
  1. RESEARCH-FIRST is mandatory and load-bearing. Run /research (research-gateway) for EVERY
     post-cutoff library the unit touches BEFORE writing any implement brief, and bake the
     verified facts (exact version pins, signatures, import paths) INTO the brief. Phase 1
     proved the design docs carry stale APIs (Standard Schema ~standard shape; Mantine v9 nonce
     is getStyleNonce:()=>string with NO top-level nonce prop). Treat every version/API claim
     in THIS doc the same way: the @tanstack/react-hotkeys alpha pin, the @mantine/form
     schemaResolver floor, and the @visx 4.0.0 release/changelog are ASSERTIONS to re-verify on
     npm via /research at point of use, not settled facts. Never assert a library API from memory.
  2. Fan @implementer (Sonnet, own cache) onto DISJOINT file groups (the build-order DAG).
     Sequence collision-sharing files into ONE group (two edits to cli/index.ts MUST be one
     group). Parallelize only on disjoint files. Give each implementer a COMPLETE brief: exact
     paths + frozen TS + acceptance + constraints. It is a literal executor with judgment, not
     a planner. While an @implementer runs it OWNS its files — do not run your own gate/edits
     over those paths mid-flight.
  3. Run an adversarial verifier per group BEFORE you commit. Static verifiers cannot catch
     type/lint errors — only the authoritative gate can.
  4. THE GATE (run once after the unit's workflow, before committing): run 'bun run fmt' (write)
     to normalize oxfmt first, then prefer mcp__sideclaw__check (off-Max). If it crashes
     ("Session exited with code 1") with no structured result, fall back to a ONE-SHOT direct
     bash gate IN THIS ORDER (order matters — build first so typecheck/pack-test resolve types
     from dist/*.d.ts): 'bun --filter basalt-ui build' -> 'bun run fmt:check' -> 'bun run lint'
     -> 'bun run typecheck' -> 'bun test' -> 'bun --filter basalt-ui pack-test'.
  5. The orchestrator (you) DECIDES + VERIFIES + COMMITS. You do not grind edits inline.

GATE GOTCHAS (pre-empt — each cost a fix in Phase 1):
  - oxlint per-glob no-restricted-imports is REPLACE / last-writer-wins: emit the broad block
    (#app / src/**) FIRST and the narrow re-allowing block (charts, which omits @visx/* ban)
    LAST, or the broad ban leaks into the narrow boundary. The deep-equal sync test is
    TAUTOLOGICAL and cannot catch this — only 'lint' does.
  - TS strict bites: process.env['NODE_ENV'] (index access), 'override' on React class members,
    exactOptionalPropertyTypes, verbatimModuleSyntax (use 'import type' / inline 'type').
  - oxfmt REFLOWS *.type-guard.ts compile fixtures and can split 'default: return x()' onto two
    lines, orphaning a @ts-expect-error. Put each directive on its own line directly above the
    statement; re-run typecheck after fmt.
  - check-theme dogfood on basalt's OWN src needs package.json.basalt tuned: exempt the
    palette/token/theme SOURCE files + disable consumer-layout checks
    (rawSurface/rawHtmlLayout/inlineSpacing/inlineDisplay) that don't apply to chart internals.

COMMIT DISCIPLINE (each rule cost a failed attempt in Phase 1):
  - isolated-basalt-ui lefthook guard: a commit's staged files must be ALL packages/basalt-ui/**
    OR ALL non-package — NEVER mixed. bun.lock + .oxlintrc.json + tests/ + apps/playground/** +
    ci.yml + lefthook.yml are ROOT (non-package). bun.lock = its own 'chore:' commit.
  - commitlint: header <= 80 chars (NOT 100); body lines <= 100; conventional EMPTY scope
    ('feat:' not 'feat(x):'); NO body line may start with 'Word:' (parsed as a trailer token);
    NO '(#token)' anywhere in the body (misparsed as issue-ref footer). Keep bodies plain prose.
  - NO AI/tool attribution anywhere (no Co-Authored-By, no Claude-Session footer) — attribution
    rule OVERRIDES the Bash-tool default footer.
  - NEVER pipe 'git commit' through tail/head with set -e — the pipe masks a non-zero exit. Commit
    unpiped; check exit; verify each commit landed (git log) BEFORE the next.
  - When a file has both owner WIP and your changes you cannot hunk-split non-interactively —
    confirm with owner or stage only the cleanly-yours files; leave pure-owner-WIP untouched.

AFTER EACH UNIT: STOP for owner review (basalt-ui is PR-required and NPM-published).

AFTER ALL UNITS: run the final full validation (publint/attw clean, charts-dist Mantine-free
guard green, all triads pass check-coverage, every battery's playground demo renders). Then the
OWNER runs /code-review ultra (billed cloud — you CANNOT launch it). Address findings via
@implementer + amend. Push the branch. Owner drives /ship or /pr (CodeRabbit + merge are owner's
call), then triggers the release workflow.

HARD CONSTRAINTS: Bun runtime; Mantine v9; oxlint+oxfmt (no ESLint/Biome/Prettier); TS strict no
any; named exports only (no default exports); kebab-case.ts / PascalCase.tsx; empty-scope
conventional commits; packages/basalt-ui/** ALWAYS a separate commit; Mantine-free Layer-0
(tokens/charts/guard) with @visx/* only in src/charts/**; do NOT bump @visx unilaterally UNLESS
executing the Phase-2 co-scheduled bump the owner has confirmed. Do NOT build the Phase-5
kill-list (bottom-sheet, PWA, canvas-line, aside-slot, db-ssr runtime, create-basalt-app, dtcg,
dropzone, full <Chat>/voice) — advisory-only.
```

## 1. Where we are / the work ledger

**Done — Phase 0 partial + Phase 1 spine** (committed on `feat/s0-mantine-pivot`, not pushed, no PR). Commit subjects are exact — trust them for "do not redo":

| Commit | Subject (verbatim) | What it actually shipped |
|-|-|-|
| `08a3204` | feat: add the Phase-1 spine (SURFACES enforcement + BasaltRegister seam) | surfaces.ts SURFACES registry, register.ts (BasaltRegister + AsyncState + assertNever + StandardSchemaV1 vendored spec), guard/ pure checkSource, state.ts createPersistedState |
| `af55ea3` | chore: sync bun.lock for the basalt-ui 1.0.0 version | bun.lock only |
| `6c749b9` | test: add Phase-1 compile fixtures, spine tests, and regenerated lint config | augments-nothing/augments-all + broken-fixture compile fixtures, sync + coverage tests, AND the regenerated `.oxlintrc.json` (oxlint-preset-sync is part of THIS commit) |
| `2d03fc8` | ci: dogfood check-theme on basalt's own src | ci.yml dogfood step |
| `16a53b0` | docs: add Phase-1 grounding, design, and implement handover | FOUR docs: PHASE-1-GROUNDING.md, PHASE-1-DESIGN.md, PHASE-1-IMPLEMENT-HANDOVER.md, PHASE-1-HANDOVER.md |

Earlier Phase-0 code/doc fixes already on branch: `6ff8f3e` (single-path OIDC publish, NPM_TOKEN job dropped), `436c254` (router phantom-ban stripped → advisory), `370214d` (README de-Tailwinded), `905437b`/`a9a15d1` (forms rule → native schemaResolver).

> Note: `AsyncState<T,E>` and `assertNever` live in `src/register.ts` (re-exported from `src/index.ts`), NOT in `state.ts`. `state.ts` owns only `createPersistedState`. This matters for the §4 reconciliation read.

| Unit | Phase | Status | Gate |
|-|-|-|-|
| SURFACES registry + RULE_NAMES projection + pure guard | E1 spine | done | surfaces-coverage.test.ts |
| BasaltRegister + Slot extractor + augments fixtures | E1 spine | done | broken-fixture compile tests |
| createPersistedState (./state, Mantine-free) | E1 spine | done | typecheck |
| AsyncState + assertNever + fourth-variant fixture (register.ts) | E1 spine | done | broken-fixture compile tests |
| oxlint-preset-sync (charts+tokens bans in shipped config) | E1 | done (in `6c749b9`) | oxlint-preset-sync.test.ts |
| plugin/package version lockstep | E1 | done | plugin-version-lockstep.test.ts |
| check-theme dogfood in ci.yml | E1 | partial | needs lefthook + shipped consumer template |
| publint + attw in pack-test | M0 finish | remaining | pack-test.sh |
| charts-dist Mantine-free artifact + root-barrel guard | M0 finish | remaining | pack-test.sh |
| per-subpath dist dep-isolation assertion (ALL optional-peer subpaths) | M0 finish | remaining | pack-test.sh |
| charts/tokens-only resolution + render pack-test | M0 finish | remaining | pack-test.sh |
| @mantine/dates optional-peer audit (declared — keep or drop both halves) | M0 finish | remaining | manual |
| @mantine/form optional peer + rule footnote schemaResolver floor | M0/agent-DX | remaining | install resolve |
| llms.txt + `basalt info --json` from SURFACES | I1 agent-DX | remaining | check-coverage |
| @example JSDoc on high-traffic exports + lint test | I1 agent-DX | remaining | jsdoc lint test |
| tsdown CSS spike → migrate; visx alpha.11→4.0.0 + responsive; React Compiler chain | M2 build | remaining | pack-test render-compiled |
| semantic-tier --vx-* vars + native-feel CSS + responsive-chart + notify-token + density/motion | M3 primitives | remaining | gate + playground |
| Provider freeze (errorReporter/onError + nonce + BasaltErrorBoundary + AsyncState) | M3 provider | **DONE — wiring only remains** | verify in provider, then wire downstream |
| Seven batteries (./query ./router-tanstack ./agent ./commands ./forms ./notifications ./data) | M4 | remaining | per-battery Round-2 + demo + check-coverage |
| Completeness (env/head/Intl/online/print/CSP/clipboard/shortcut-help) + testing+a11y preset | M3 parallel | remaining | gate |
| Skills regroup, scaffold peer-deps, basalt doctor | M6 | remaining | check-coverage |

## 2. The authoritative cut line + binding sequencing

**The 1.0 cut line (authoritative SSOT, MATURATION-ROADMAP.md:355-368, owner decision 2026-06-19):**
> 1.0 = Phases 0-3 (correctness floor + enforcement IoC + type-spine + build pipeline + owned core primitives) PLUS **all SEVEN adapter batteries as runtime subpaths** (`./query`, `./router-tanstack`, `./agent`, `./commands`, `./forms`, `./notifications`, `./data`) — **no battery demoted to doctrine-only**. The speculative-API/semver-freeze risk is knowingly accepted and made safe by per-battery Round-2 hardening gates + the Phase-1 BasaltRegister spine. This section **overrides** any phase table, the BLUEPRINT argo-migration stages, and open-decision #5.

> Note: the STATE-reader audit (taken pre-spine) argued for a *smaller* 1.0 (Phases 0-3 + at most ./query + ./router-tanstack, demote ./agent). The cut-line owner decision **supersedes** that audit recommendation — all seven ship. If the owner reopens this, flag it; do not silently shrink scope.

**Binding sequencing law:** gates before bundler swap; bundler swap before new channels.
1. **Phase 0 finish** — OIDC publish (owner), publint/attw, charts-dist Mantine-free + root-barrel guard, per-subpath dist isolation, peer audits.
2. **Phase 1 spine** — DONE (BasaltRegister → SURFACES → createPersistedState + AsyncState; no adapter ships before the spine compiles and is fixture-proven).
3. **Phase 2 build pipeline** — tsdown spike → migrate; the co-scheduled visx bump; React Compiler chain.
4. **Phase 3 owned primitives** — semantic-tier vars, native-feel CSS, responsive-chart, provider-shape freeze (DONE; wiring only), completeness additions.
5. **Phase 4 the seven batteries** — each gated by its Round-2 hardening spec + a real playground demo + `check-coverage`.
6. **Completeness / skills / scaffold → finish.**

**Phase-id collision caveat:** a bare "Phase 1" is ambiguous across docs — prefix per axis: **M#** (MATURATION), **E#** (ENFORCEMENT), **I#** (INTEGRATION-DX). **BLUEPRINT S0-S5 is SUPERSEDED** as basalt's roadmap (argo-consumer adoption story only); the feat/argo-voice prerequisite is moot (shell already shipped, ./agent is net-new).

## 3. The seven battery cards

Each battery is "not done" until its **rule + skill + guard triad** lands (gated by `basalt check-coverage`). CHANNELS = CODE (genuinely-owned) / SCAFFOLD (`basalt init|sync` writes app-owned editable wiring) / DOCTRINE (rule + skill + mechanical guard).

### `./query`
- **Peers:** `@tanstack/react-query` (+ devtools). *Verify exact versions via /research before implementing.*
- **Surface:** `createBasaltQueryClient` + `unwrap` + devtools.
- **Hardening gate:** basalt-query.md must replace the `.data!` hand-unwrap example with the typed `unwrap()` seam; document the two Eden silent-any footguns as hard authoring rules (method-chaining required; shared-root-tsconfig path-alias).
- **Triad:** basalt-query.md (fix Eden drift) + `/basalt:data` skill + guard.
- **Channels:** CODE = client+unwrap+devtools; SCAFFOLD = wired query-client.ts/eden.ts (editable, transport is injected seam); DOCTRINE = above.
- **/research:** @tanstack/react-query current major + devtools import path; Eden treaty current method-chaining contract.

### `./router-tanstack`
- **Peers:** `@tanstack/react-router`. *Verify version via /research.*
- **Surface:** `useBasaltNav` + `useRouterBreadcrumbs` over `useMatches`/`staticData`, made optional via `StaticDataRouteOption` augmentation.
- **Hardening gate:** router-agnostic seam stays; router preference advisory, **never a hard ban** (strip the phantom react-router ban — already removed in Phase 0, keep advisory).
- **Triad:** basalt-router.md + skill + guard.
- **Channels:** CODE = router-agnostic seam + the two hooks; SCAFFOLD = none; DOCTRINE = above.
- **/research:** @tanstack/react-router `StaticDataRouteOption` augmentation pattern + useMatches signature.

### `./agent` (net-new, no argo precedent)
- **Peers:** `ai`, `@ai-sdk/react`, `streamdown`, `shiki`, `use-stick-to-bottom`. *Verify all via /research — these are post-cutoff and fast-moving.*
- **Surface:** headless `useAgentStream<TPart>({transport})` (parts/status/send/stop/regenerate); `AgentTransport` seam (edenTransport default, aiSdkTransport opt-in); `PartList` + default Text/Reasoning/ToolCall/Source renderers; Tailwind-free `StreamingMarkdown` (headless render-prop); `StickToBottom` (wraps use-stick-to-bottom@1); `createChatHistoryStore` (on createPersistedState).
- **Binding stream-typing gates (Round-2):** (1) validate at YIELD-TIME only — NEVER apply `t.Object/t.Union` response schema to the `async function*` route (eden#231 drops the AgentPart union to `any`); (2) require explicit `AsyncGenerator<AgentPart>` return type on the handler; (3) broken-fixture compile test proving the union collapses to `any` when the footgun is reintroduced; (4) two Eden footguns as hard authoring rules in basalt-agent.md.
- **Risk:** streamdown@2 requires Tailwind — mitigated by the Tailwind-free headless `StreamingMarkdown` seam; streamdown is optional-peer behind it. AI SDK is opt-in transport, not the spine.
- **Triad:** basalt-agent.md + `/basalt:agent` skill + no-raw-stream guard.
- **Channels:** CODE = hook + transport seam + renderers; SCAFFOLD = Elysia stream route + agent-parts.ts union + Eden wiring (secret-bearing, app-owned); DOCTRINE = above.
- **DEFER:** full `<Chat>` composite, message-bubble kit, voice/audio, multi-agent UI.
- **/research:** ai/@ai-sdk/react current streaming API; eden#231 status + current treaty stream typing; streamdown v2 Tailwind dependency; use-stick-to-bottom current version.

### `./commands`
- **Peers:** `@mantine/spotlight`, `@mantine/modals`, `@mantine/notifications`, `@tanstack/react-hotkeys`. *Verify the CURRENT hotkeys alpha on npm via /research before wiring runtime — this doc's working assumption is `0.9.1` (alpha), but treat the exact latest version AND the alpha API surface as unverified until /research confirms them at point of use.*
- **Surface:** `defineCommands`/`defineCommand` (typed `{id,label,group?,icon?,shortcut?,when?,run(ctx)}`), `defineOverlays`, `overlays.open(key, props)`, projectors `toSpotlightActions`/`toHotkeyBindings`/`toShortcutList`/`runCommand`, `ShortcutsHelp`.
- **Hardening gate:** `keyof typeof APP_COMMANDS` id-union + BasaltRegister-keyed `CommandId`/`OverlayKey` make a trigger referencing a nonexistent command a tsc error — **requires the Phase-1 BasaltRegister spine first** (done; ship registry only after augments fixtures pass). Imperative-vs-route rule: shareable/back-button/refreshable → route-mask via ./router-tanstack; ephemeral → `overlays.open`.
- **1.0-vs-alpha carve-out:** ship typed registry + defineOverlays + overlays.open + toSpotlightActions/runCommand + the `shortcut?` TYPE at 1.0; the `@tanstack/react-hotkeys` binding RUNTIME + `ShortcutsHelp` ship behind documented alpha risk (Spotlight Mod+K covers 80%).
- **Triad:** basalt-commands.md + `/basalt:commands` skill + guards (raw-overlay-open, raw-key-listener).
- **Channels:** CODE = registry + projectors + overlay controller + ShortcutsHelp; SCAFFOLD = app-commands.ts/app-overlays.ts + Spotlight wiring; DOCTRINE = above.
- **/research:** @mantine/spotlight v9 actions shape; @tanstack/react-hotkeys current alpha version + exact API.

### `./forms`
- **Peers:** `@mantine/form` — **must be DECLARED as an optional peer (peerDependencies + peerDependenciesMeta.optional); today it is absent from both, so a consumer following the rule gets an unresolved-module error.** *Verify the schemaResolver floor on npm via /research — this doc's working assumption is that schemaResolver shipped earlier than the `^9.3.x` line used by the other Mantine peers; confirm the actual minimum version before freezing it as the declared floor.*
- **Surface:** `createForm` (typed useForm wrapper, basalt defaults), `Field` typing helper, `FormErrorSummary`, `useFormDraft` (autosave/restore/clear-on-submit on createPersistedState, versioned + namespaced).
- **Hardening gate:** @mantine/form is the default (Standard Schema native via `schemaResolver`). Validation lib: Valibot default, Zod 4 if already standardized. Runner-up TanStack Form; **NOT RHF**.
- **Triad:** basalt-forms.md (split out of basalt-state.md) + skill + form-localstorage guard.
- **Channels:** CODE = subpath helpers; SCAFFOLD = editable bound-field kit + worked create/edit form using useFormDraft; DOCTRINE = above.
- **/research:** @mantine/form schemaResolver signature + minimum version + the Standard Schema `~standard` shape (Phase 1 found stale docs here).

### `./notifications`
- **Peers:** `@mantine/notifications`. *Verify version via /research.*
- **Surface:** `notify` + `notifySuccess/Error/Warning/Info` + `notifyPromise` (intent→VX color + ReactNode icon + per-intent autoClose + aria-live); `defineNotifications` typed registry (`emit('kind', payload)`); headless `NotificationStore` port + createPersistedState-backed history (read/unread, seen, grouping, ring buffer); `NotificationBell` + center for shell globalActions slot; `usePushSubscription` (server-agnostic Web Push client seam; sw.js + Elysia route are SCAFFOLD); `withNotifications` provider toggle.
- **Hardening gate:** thin headless layer over @mantine/notifications (already does id-dedup + stacking) — **never re-implement a toast engine**. Two-layer dedup (Mantine id + basalt dedupKey+window). Visibility-aware delivery (buffer while document.hidden, flush on visibilitychange). Mark-seen via IntersectionObserver (seenAt distinct from readAt). Full battery ships (history+bell+center).
- **Triad:** basalt-notifications.md + `/basalt:notify` skill + guards (direct-toast-import ban outside battery, notify-missing-dedupkey, aria-live correctness).
- **Channels:** CODE = all above; SCAFFOLD = sw.js + Elysia push route stubs + registry seed; DOCTRINE = above.
- **DEFER:** server push infra (web-push send, VAPID, subscription DB), cross-device synced read-state, quiet-hours.
- **/research:** @mantine/notifications current API + id-dedup behavior.

### `./data`
- **Peers:** `@tanstack/react-table` (>=8 <9), `@tanstack/react-virtual` (>=3 <4). *Verify current versions via /research.*
- **Surface:** data-table (TanStack Table) + virtual-list (TanStack Virtual) kinds.
- **Hardening gate:** no dedicated Round-2 spec beyond the optional-peer matrix; subject to the general optional-peer audit + version-coherence gate + the per-subpath dist dep-isolation assertion (a first-class Phase-0 gate item — see §4) + the triad-contract gate.
- **Triad:** triad rule + skill + guard required by check-coverage.
- **Channels:** CODE = the two kinds; SCAFFOLD = none specified; DOCTRINE = above.
- **/research:** @tanstack/react-table v8 + @tanstack/react-virtual v3 current minor.

**Overlay mounting (all batteries):** mount modals/notifications/spotlight behind opt-out flags via a composable `<BasaltOverlays>`, **NOT a prop-per-battery** on the provider. The three @mantine/* overlay peers **exact-pin @mantine/core** (lockstep upgrade). `@mantine/dates` (if kept) transitively pulls mandatory dayjs.

## 4. Remaining non-battery work

### Phase 0 finish (M0 — release gates)
- **publint + attw** as `publint .` + `attw --pack .` steps in pack-test.sh **now** (do NOT wait for tsdown). *Verify publint / attw current versions via /research.*
- **charts-dist Mantine-free artifact assertion**: a SECOND scratch install WITHOUT Mantine peers that `import('basalt-ui/charts')` and asserts it loads; walk resolved ./charts + ./tokens dist graphs, fail on any `@mantine/*`. Today only lint-asserted, not artifact-asserted.
- **Root-barrel dist guard** (~20 lines): red-build on any `@mantine/*` in ./tokens+./charts dist subtrees, AND assert the published root barrel never re-exports `./tokens`/`./charts` (keeps root Mantine-pulling-free for charts-only consumers). Note: root provider/theme legitimately one-way deep-imports `../charts/theme` + `../tokens` to share `--vx-*` identity — that direction must stay allowed. **This is a first-class Phase-0 work item, not an open question** — ENFORCEMENT-HARDENING.md does NOT currently itemize the root-barrel ban (verified: zero hits), so it cannot be assumed covered.
- **Per-subpath dist dep-isolation assertion (first-class gate, ALL optional-peer subpaths — not just charts/tokens):** for every subpath whose peers are optional (`./query`, `./router-tanstack`, `./agent`, `./commands`, `./forms`, `./notifications`, `./data`), assert in pack-test that importing that subpath does NOT eagerly resolve an unrelated optional peer (e.g. importing `./query` must not pull `@mantine/form`). Walk each subpath's dist graph; fail on cross-subpath optional-peer leakage. ENFORCEMENT-HARDENING.md does NOT itemize this (verified: zero hits) — own it here per-subpath, gated per battery as each lands.
- **charts/tokens-only resolution + render** pack-test (load-bearing proof of the optional-peer architecture).
- **@mantine/dates optional-peer audit**: `@mantine/dates` **IS declared** today — `^9.3.0` in `peerDependencies` AND `optional: true` in `peerDependenciesMeta` — but it has no consuming code (only vite.ts dedupe hints). Decide: either **back it** with a dates kind / shell date usage, or **drop it from BOTH** `peerDependencies` and `peerDependenciesMeta`. Do not leave it declared-but-unbacked.
- **lockstep version gate** + **scaffold .oxlintrc.json extends-stub in `basalt init`** (fresh init writes oxfmt/lefthook/CI but not the .oxlintrc.json that extends the shipped preset → dead bans).

### Phase 2 build pipeline (M2)
- **tsdown CSS spike** (throwaway) proving `*.module.css` + styles.css passthrough under unbundle — **GATES the migration** (the one unverified build risk).
- **migrate-tsdown** (replace tsup + the two hand-rolled .mjs post-processors; native publint/attw).
- **visx bump** co-scheduled: alpha.11 → exact `4.0.0` + add `@visx/responsive@4.0.0` — **owner-confirmed decision required** (see §8). The release date and changelog scope are unverified post-cutoff claims — /research before the bump.
- **React Compiler chain**: pull Rules-of-React compiler-safety-lint forward onto src now (free insurance); defer the compile-at-publish step to post-bundler (ship dist compiler-processed, mount a compiled component from dist in the gate, then drop hand-memo wraps).
- **cli-runtime-portability**: swap build scripts' `import.meta.dir` → `import.meta.dirname` (Node 20.11+ and Bun); keep `#!/usr/bin/env bun` shebang. *Verify import.meta.dirname Node floor via /research.*

### Phase 3 owned primitives (M3)
- **semantic-tier --vx-* vars** (KEYSTONE): `--vx-bg/--vx-fg/--vx-accent/--vx-danger/--vx-border`, retire the gray-2/3/4 resolver hack (theme/index.ts:211-218); unblocks typed refs + contrast guard.
- **native-feel CSS tokens**: safe-area insets (incl `env(safe-area-inset-bottom)` on mobile footer), svh, momentum/overscroll; effect-gated collapse default; SSR-safe collapse.
- **responsive-chart wrapper**: one SSR-safe `ResponsiveChart` render-prop over `@visx/responsive useParentSize` (width-gated skeleton, no width-0 server render).
- **notify-token helper + prop-overridable strings + density axis + motion duration/ease tier.**
- **async-state-trinity wiring + BasaltErrorBoundary wired to QueryErrorResetBoundary.**

**ALREADY DONE by the Phase-1 provider freeze — do NOT re-add the seams; only the downstream WIRING remains.** Verified against `src/provider/index.tsx`: every seam below is present. The INTEGRATION-DX (DONE) vs STATE-reader (T9/T16 remaining) contradiction is hereby resolved — **the seams EXIST; what remains is propagating them downstream** (AsyncState into AgentPart / notification kinds / command results; wiring BasaltErrorBoundary to QueryErrorResetBoundary). Do not redo settled seam work.
- `errorReporter` / `onError?: (error, ctx: BasaltErrorContext) => void` where ctx.kind ∈ `'render' | 'window' | 'unhandledrejection'` — **present** (provider/index.tsx, the `onError` prop + `BasaltErrorContext` union).
- `nonce?: string` CSP prop on the injected palette `<style>` + `injectPalette?: boolean` escape hatch — **present**. NB: Mantine v9 has NO top-level `nonce` prop; its mechanism is `getStyleNonce: () => string`, which flows through `...rest` (the JSDoc at provider/index.tsx:66-69 already documents this). *Verify the Mantine v9 getStyleNonce contract via /research if you touch it.*
- `BasaltErrorBoundary` (exported class component) mounted inside provider + SSR-guarded `window` `error` / `unhandledrejection` listeners feeding `onError` — **present** (provider/index.tsx; addEventListener/removeEventListener pair confirmed).
- `AsyncState<T,E>` + exported `assertNever` + fourth-variant fixture — **present, in `src/register.ts`** (re-exported from `src/index.ts`), with the `idle|loading|success|error` union and the `assertNever(value: never): never` sentinel.

> **Reconciliation rule (corrected file pointers):** before implementing any of the four above, read `src/register.ts` (owns `AsyncState` + `assertNever`), `src/provider/index.tsx` (owns the `onError`/`nonce`/`getStyleNonce`-note/`BasaltErrorBoundary`/window-listener/`injectPalette` seam), and `src/state.ts` (owns ONLY `createPersistedState`). All seams already exist — the remaining work is wiring, not adding. Do NOT look for `AsyncState` in `state.ts`; it is not there and must not be re-added.

### Completeness additions (M3 parallel, mostly advisory/core)
env validation (basalt-env.md + `validateEnv(schema)` Standard-Schema helper); document head/title (`useDocumentTitle` tying title←route←breadcrumb); Intl formatting doctrine (basalt-format.md, explicit timezone stance; `formatNumber/Compact/Currency/Date/Relative`, no hardcoded en-US); `useOnlineStatus` + offline banner; print stylesheet (`@media print` collapsing shell chrome); security-headers/CSP doctrine; clipboard-with-feedback primitive; keyboard-shortcut help; **testing story** (configs/vitest.config.ts browser-mode + RTL + jest-dom; render smoke tests for BasaltShell/BasaltProvider + one chart kind per scale family; vitest-axe/Playwright-axe a11y gate; self-hosted Playwright CT visual-regression — **NOT Storybook/Chromatic**; one configs/check.yml). *Verify Vitest 4 browser-mode + vitest-axe current config via /research.*

### Agent-DX (I1)
- **llms.txt + `basalt info --json`** generated from ONE SURFACES registry (cannot drift; enumerates subpath ownership). MCP server stays deferred.
- **@example JSDoc** on highest-traffic exports (defineSeries/seriesTokens/groupTokens, the 7 kinds, BasaltShell, BasaltProvider, buildPaletteCss) + a mechanical lint test that fails on any public export lacking `@example`.
- **stub-docs drift fix**: basalt-query `.data!`→typed unwrap; basalt-state Zustand template→demoted (createPersistedState is default); rewrite series.ts example to the 3-line inference idiom; README front-loads the plugin + `basalt init` pair.

## 5. How to run each cycle

The proven Phase-1 execution shape — reuse per unit/battery:

1. **ONE ultracode workflow per unit:** understand → design → implement → review.
2. **Research-first (mandatory):** `/research` every post-cutoff library the unit touches BEFORE the implement brief; bake exact pins/signatures/import paths INTO the brief. Phase 1 proved the design docs carry stale APIs. Every version/API claim in §3–§4 (hotkeys alpha pin, form schemaResolver floor, visx release/changelog, publint/attw/vitest versions) is an assertion to re-verify, not a settled fact.
3. **Fan @implementer onto DISJOINT file groups** (the build-order DAG). Sequence collision-sharing files into ONE group (two edits to `cli/index.ts` = one group). Parallelize only on disjoint files. Complete brief = exact paths + frozen TS + acceptance + constraints. A running @implementer OWNS its files — no orchestrator gate/edit over those paths mid-flight.
4. **Adversarial verifier per group before commit** (static verifiers cannot catch type/lint errors).
5. **Orchestrator decides + verifies + commits** — does not grind edits inline.
6. **The gate (after the workflow, before commit):** `bun run fmt` (write) first to normalize oxfmt → `mcp__sideclaw__check` (off-Max). On crash ("Session exited with code 1", no structured result) fall back to ONE-SHOT direct bash IN ORDER: `bun --filter basalt-ui build` → `bun run fmt:check` → `bun run lint` → `bun run typecheck` → `bun test` → `bun --filter basalt-ui pack-test`. Build first so typecheck/pack-test resolve types from `dist/*.d.ts` (stale dist → phantom errors).

**Gate gotchas** (each cost a Phase-1 fix): oxlint per-glob `no-restricted-imports` is replace/last-writer-wins (broad block first, narrow re-allowing block last; the deep-equal sync test is tautological — only `lint` catches leakage); TS strict (index-access `process.env['X']`, `override` on React class members, exactOptionalPropertyTypes, verbatimModuleSyntax → `import type`/inline `type`); oxfmt reflows `*.type-guard.ts` and orphans `@ts-expect-error` (each directive on its own line above its statement; re-typecheck after fmt); check-theme dogfood needs `package.json.basalt` tuned to exempt palette/token/theme sources + disable consumer-layout checks.

**Commit discipline** (each cost a failed Phase-1 attempt): isolated-basalt-ui guard (staged set ALL `packages/basalt-ui/**` OR ALL non-package; bun.lock + .oxlintrc.json + tests/ + apps/playground/** + ci.yml + lefthook.yml are ROOT; bun.lock = its own `chore:`); commitlint (header ≤80, body lines ≤100, empty scope, no body line starting `Word:`, no `(#token)` in body); NO attribution footer; never pipe `git commit` through tail/head with `set -e`; verify each commit landed (`git log`) before the next; never bundle owner WIP — confirm or stage only cleanly-yours files.

**Follow-up carried from Phase 1:** `GUARD_RULES` is currently decorative — `checkSource` hardcodes the per-kind scan inline instead of iterating the registry. Wire the iteration when the first `./guard` adapter (an oxlint plugin or a PreToolUse hook) is built, so the "one policy → CLI/oxlint/hook" thesis becomes real.

## 6. Strategy-adherence invariants (every cycle must hold)

- **Mantine-free Layer-0:** `./tokens`, `./charts`, `./guard` import no `@mantine/*`; `@visx/*` only in `src/charts/**`. Enforced by oxlint no-restricted-imports (repo-local AND shipped preset) + the new charts-dist artifact guard.
- **Root barrel never re-exports** `./tokens` or `./charts` (keeps root Mantine-pulling-free for charts-only consumers). It may re-export the design seam (register.ts, state.ts, type-only SurfaceSpec/RuleName/SkillName). Enforced by the root-barrel dist guard (§4 Phase 0) — itemize it, do not assume ENFORCEMENT-HARDENING.md covers it.
- **Per-subpath dist dep-isolation:** importing any optional-peer subpath must not eagerly pull an unrelated optional peer. Asserted per-subpath in pack-test (§4 Phase 0), gated as each battery lands.
- **Optional-peer discipline:** every declared peer must back a shipped import + sibling version-coherence (LAND the optional-peer audit WITH the first adapter, not after the matrix is full). Mantine overlay peers exact-pin `@mantine/core`.
- **No god-objects:** no `createBasaltApp`, no `<Chart type=...>`, no `<Form config=...>`. Provider is a wiring point reading BasaltRegister by inference + composable `<BasaltOverlays/>` mounts — never a prop-per-battery, never a threaded `BasaltAppContext<TCommands,...>` generic (reject any provider generic in review).
- **Deep modules + injected seams:** `AgentTransport`, scaffolded `eden.ts` — 1.0 freezes the seam, not the backend.
- **Triad-per-subpath:** a new public subpath is "not done" until rule + skill + guard land and `basalt check-coverage` passes. Tooling subpaths (`./vite`, `./theme-lab`, `./guard`) owe NO triad (discriminated SurfaceSpec tooling variant).
- **BasaltRegister empty-default is `{}`** (keyof = never), NEVER `Record<string,never>` (silently widens CommandId/OverlayKey to string). Locked by augments-nothing/augments-all fixtures.
- **Named exports only**, no default exports. `kebab-case.ts` / `PascalCase.tsx`.
- **No hard dep / no hard peer / not in the root barrel** on any `@tanstack/*` / motion / better-auth / AI-SDK — opt-in subpath optional peers are the sanctioned adapter model.
- **Cross-registry refs are tsc errors:** `SidebarItem.command?: CommandId`, `Command.opens?: OverlayKey`, `notify<K>(kind, Notifications[K])`, `runCommand(id: CommandId)` — resolved through the merged Register by conditional inference, zero call-site generics. AsyncState consumed via exhaustive switch whose `default` calls `assertNever` (bare `default: return null` FORBIDDEN).

## 7. The finish line

1. **Final full validation:** publint/attw clean; charts-dist Mantine-free guard green; root-barrel dist guard green; per-subpath dist dep-isolation green; charts/tokens-only resolution+render passes; all triads pass `check-coverage`; every battery's playground demo renders; lockstep version gate green.
2. **Owner runs `/code-review ultra`** — billed cloud, the orchestrator **CANNOT** launch it. Surface the diff and prompt the owner.
3. **Address findings** via `@implementer` + `git commit --amend --no-edit` + `git push --force-with-lease` (feature branch).
4. **Push the branch.** basalt-ui is PR-required.
5. **Owner drives `/ship` or `/pr`** (CodeRabbit iteration + merge are the owner's call).
6. **Trigger the release workflow** (workflow_dispatch → semantic-release-monorepo analyzes only `packages/basalt-ui/` commits → tag + GitHub release + npm publish with provenance via OIDC).

## 8. Owner-only actions (cannot be automated)

- **npm Trusted Publisher:** configure on npmjs.com for `jkrumm/basalt-ui` → `publish.yml` (OIDC), and **DELETE the NPM_TOKEN repo secret** before release. The dual-publish race is already neutralized in code (`6ff8f3e`); without the Trusted Publisher entry the OIDC publish 403s. Closes the stored-credential vector.
- **Run `/code-review ultra`** at the finish line.
- **Confirm the visx stable-bump decision.** Working assumption: stable `@visx/* 4.0.0` shipped ~2026-06-11 with no API change beyond prop-types/lodash removal + a React-18 floor — but **both the release date AND the changelog scope are post-cutoff claims that MUST be verified via /research before the bump** (the breaking-change surface of a major-from-alpha bump cannot be asserted from memory). Round-2 resolution leans **(b) decouple + bump alpha.11 → exact 4.0.0 + add @visx/responsive@4.0.0 now in its own commit** (provable by existing pack-test once the changelog is confirmed benign). BUT the package CLAUDE.md still says **hold** (co-schedule with tsdown), and PHASE-1-HANDOVER §7 says "Do NOT bump the @visx/* pin." This is a FLAGGED owner decision overriding a standing intentional hold — **must NOT be silently applied.** Choose (a) hold/co-schedule vs (b) decouple-and-bump-now (tendency), after /research confirms the changelog.
- **Final PR merge.**

## 9. Hard constraints + deferred (do NOT build)

**Constraints (CLAUDE.md):** Bun runtime; Mantine v9 (no Tailwind); oxlint + oxfmt (no ESLint/Biome/Prettier); TS strict, no `any`; named exports only (no default exports); `kebab-case.ts` / `PascalCase.tsx`; empty-scope conventional commits; `packages/basalt-ui/**` ALWAYS a separate commit (lefthook isolated-basalt-ui guard); Mantine-free boundaries (`tokens`/`charts`/`guard` + `@visx` only in `charts`); do NOT bump `@visx` unilaterally UNLESS executing the Phase-2 co-scheduled bump the owner has confirmed.

**Phase-5 kill-list — STAY ADVISORY-ONLY (rules + guards now, runtime later; do NOT build):** headless-use-bottom-sheet; basalt-pwa-vite-helper + pwa-runtime-hooks; canvas-line-kind; appshell-aside-slot; db-ssr-guard runtime; create-basalt-app; dtcg-interchange; @mantine/dropzone upload doctrine; the full `<Chat>` composite + voice/audio. Reframed invariant: do not freeze the API of an *unforced* surface (this forbids the genuinely-undriven ones above, NOT the seven driven batteries). TanStack DB: advisory only + db-no-dependency invariant. TanStack Start: SSR-safety fixes + `deploy:'spa'|'start'` Vite shape, no hard dep.

**REJECTED (ADRs — never build):** scoped sub-packages (`@basalt-ui/*`); a meta-package; hard deps on any `@tanstack/*` / motion / better-auth / AI-SDK; a second overlay primitive lib (cmdk/Radix/Base UI); hosted notification SDKs (Knock/Novu); islands/RSC runtime; Storybook; Chromatic.