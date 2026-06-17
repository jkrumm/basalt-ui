# Basalt UI — Maturation Roadmap

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

---

## Architecture model

### Export topology (the spine that delivers "one dependency")

| Layer | Subpaths | Mantine? | Rule |
|-|-|-|-|
| **Layer-0** (headless) | `./tokens`, `./charts`, `./guard` *(new)* | **free** | root never re-exports; `@visx/*` only in charts; pack-test asserts the resolved dist graph is Mantine-free |
| **Root `.`** (batteries) | provider, theme, shell, async-state trinity, error boundary, `notify` helper, `createPersistedState`, native-feel tokens | coupled | the everything-an-app-needs-identically layer |
| **Adapter subpaths** (opt-in) | `./query`, `./router-tanstack`, `./state`, `./data`, `./agent`, `./notifications`, `./vite`, `./theme-lab` | varies | heavy stack libs declared as **optional peers**; root never imports them |
| **Raw presets** | `./configs/*`, `./styles.css` | — | `extends`-by-reference (oxlint/tsconfig) vs copy-by-scaffold (oxfmt/lefthook/check.yml) — contract to be documented |

**Optional-peer discipline:** every heavy stack lib sits in `peerDependencies` +
`peerDependenciesMeta.{name}.optional: true` (the proven `@mantine/dates` pattern), version-coherent
with its siblings (the three `@mantine/*` overlay packages track `@mantine/core ^9.3`).

### Three battery channels

1. **CODE** — only what basalt genuinely *owns* and every app needs identically: provider-mounted
   overlay managers, the async-state trinity + error boundary, headless ports/primitives
   (versioned persistence, notify), the native-feel CSS/motion/density token tiers. Deep modules,
   IoC seams. **Never** a `createBasaltApp({giant config})` or `<Chart type=>`/`<Form config=>`
   god-object.
2. **SCAFFOLD** — `basalt init`/`sync` (sha256 manifest) writes the consumer's *own* version-coupled,
   app-shaped files (`query-client.ts`, `eden.ts`, `_protected.tsx`, the bound-field kit,
   viewport-fit `index.html`, motion/view-transition CSS) so editable wiring lives where it can be
   edited, not frozen behind a runtime API. New `basalt create` *subcommand* (not a separate
   published package).
3. **DOCTRINE** — advisory rules (scaffolded into `.claude/rules`) + plugin skills, backed by
   **mechanical guards** so misbehavior is a build failure, not a markdown plea:
   edit-time PreToolUse deny → save-time oxlint squiggle → commit-time lefthook → CI gate.

### Per-concern mapping

| Concern | CORE | SCAFFOLD | DOCTRINE | Hard dep? |
|-|-|-|-|-|
| TanStack Query | `./query` (client + unwrap + devtools) | wired files | rule (fix Eden drift) | optional peer |
| TanStack Router | router-agnostic seam stays | — | rule | `./router-tanstack` optional peer |
| TanStack Start | SSR-safety bug fixes + `deploy:'spa'\|'start'` Vite shape | head/palette recipe | rule | **no** (RC mid-2026) |
| TanStack DB | — | — | advisory only + `db-no-dependency` invariant | **no** (pre-v1, SSR unresolved) |
| Forms | — (Mantine `schemaResolver` is transitive) | bound-field kit template | rule (fix obsolete resolver) | **no package code** |
| Motion | duration/ease token tier + `respectReducedMotion` | view-transition CSS | View Transitions = default route story | optional peers (`motion`) |
| Auth | shell user-slot + `UserMenu` (agnostic plain object) | sign-in forms | double-guard, typed-session | `better-auth` consumer peer |
| AI streaming | *(deferred)* `./agent` build-when-driven | — | advisory + bans + guard + skill **now** | optional peers |
| Notifications | provider mount + `notify` helper | — | advisory; persistent center deferred | optional peers |
| Overlays | provider mounts modals/notifications/spotlight (opt-out flags) | — | rule + guards | three `@mantine/*` optional peers |
| Client state | one `createPersistedState` primitive | — | advisory (zustand recommended) | **no store dep** |
| SSR / islands | bug fixes + Vite preset variant | — | Selective-SSR doctrine; RSC de-scoped | no islands/RSC runtime |

---

## Roadmap — majority-vote phasing

The 6 join lenses converged on the same ordering. Phases are dependency-ordered; within a phase,
lanes parallelize.

### Phase 0 — Correctness floor *(blocks everything; all S/M, no external unknowns)*
Unanimously elevated by every lens. Nothing new ships until this is green.

- `fix-packtest-phantom-assert` — pack-test asserts a file that no longer exists; the CI gate is
  currently dishonest. (S)
- `consolidate-publish-oidc` — delete the active `NPM_TOKEN` publish path; publish only via OIDC
  trusted publishing. Closes the 2026 credential-theft vector. (S)
- `add-publint-gate` + `add-attw-gate` — the two bundler-independent package linters basalt lacks
  (exports/metadata shape; `.d.ts` resolution across node16/nodenext/bundler). (S)
- `assert-charts-mantine-free-dist` — extend pack-test to prove the `./charts` resolved dist graph
  is Mantine-free (today only `./tokens` is asserted peer-free). (M)
- `audit-mantine-dates-peer` — verify or remove the optional peer (no consuming code found). (S)
- *(new)* charts/tokens-only **resolution+render** pack-test — the load-bearing proof of the whole
  optional-peer architecture.

### Phase 1 — Enforcement IoC *(the most Tanner-correct cluster; ship before batteries)*

- `headless-guard-core` — extract `checkSource()` into a `./guard` subpath + a `GUARD_RULES`
  registry, decoupled from the CLI. One policy, three adapters (CLI + future oxlint plugin + hook).
  **Pull early** so AST-shaped guards are authored once, not as throwaway regex. (M)
- *(new)* **SURFACES registry** — single source of truth for `{subpath → layer, forbidden-imports,
  triad-status}`. The keystone that must precede subpath proliferation. (toolchain)
- `triad-contract-check-coverage` — `basalt check-coverage`: a new public subpath is "not done"
  until its **rule + skill + guard** triad lands. Gates everything downstream. (S)
- `wire-defence-in-depth-templates` — close the commit-time + CI-freshness holes (sync `--check` in
  `check.yml`, check-theme in the package's own lint + lefthook). (S)
- `cli-runtime-portability` — resolve the Bun-only shebang (or declare Bun-everywhere explicitly)
  **before** expanding the CLI surface. (M)
- *(new)* contract test: shipped consumer oxlint preset ≡ repo-local oxlint config (they have
  already drifted). (toolchain)
- *(new)* **provider prop-shape ADR** + align the shipped oxlint preset with basalt's own invariants
  (it currently bans `react-router` / mandates `@tabler/icons` that basalt doesn't ship).

### Phase 2 — Build pipeline, then compiler *(strictly serial, externally gated)*

- *(new)* `tsdown-unbundle-css-spike` — throwaway spike proving `*.module.css` + `styles.css`
  passthrough under unbundle, **gating** the migration. (S)
- `migrate-tsdown` — replace tsup + the two hand-rolled `.mjs` post-processors; native publint/attw.
  Run a `visx-4-stable-bump` co-scheduled (after `charts-version-preflight` confirms stable 4.x is
  published) so the dist gate runs once. (L)
- `compile-at-publish` → `pin-compiler-exact` → `compiler-safety-lint` → `pack-test-render-compiled`
  → `drop-hand-memo-charts` — ship dist compiler-processed (the React Compiler doesn't process
  `node_modules`), then mount a compiled component from dist in the gate, then remove the hand-memo
  wraps. (L chain)

### Phase 3 — Genuinely-owned core primitives *(small, every-app-identical, no speculation)*

- `semantic-tier-vx-vars` (**keystone**) — promote a semantic/intent tier
  (`--vx-bg`/`--vx-fg`/`--vx-accent`/`--vx-danger`/`--vx-border`), retire the `gray-2/3/4` hack;
  unblocks typed refs (`semantic-tier-typed-refs`) + a contrast guard. (M)
- `native-feel-css-tokens` + `shell-consume-native-tokens` + `shell-ssr-safe-collapse` — safe-area
  insets, `svh`, momentum/overscroll baked into `styles.css`; effect-gated collapse default. (S/M)
- `async-state-trinity-core` (`DataState`/`EmptyState`/`ErrorState`) + `error-boundary-core`
  (`BasaltErrorBoundary` wired to `QueryErrorResetBoundary`). The correctness layer every dashboard
  re-implements badly. (M)
- `state-mantine-free-decision` → `state-create-persisted-state` — one versioned + `migrate` +
  Standard-Schema persistence primitive (resolve Mantine-free placement first; tendency: inline a
  ~30-line `useSyncExternalStore` so it's reachable from charts-only consumers). (S→M)
- `notify-token-helper` + `prop-overridable-strings` + `density-axis` (one `emitDensity()` on
  `[data-basalt-density]`) + motion duration/ease tokens. (S/M)
- `responsive-chart-wrapper` — one SSR-safe `ResponsiveChart` render-prop over `@visx/responsive`
  `useParentSize` (width-gated skeleton, no width-0 server render). (M)

### Phase 4 — Adapter subpaths *(each gated by a real demo in the playground)*

- `query-subpath-helpers` (`./query`: `createBasaltQueryClient` + `unwrap` + devtools) +
  `scaffold-data-layer-files` + `fix-query-rule-eden-drift` + `/basalt:data` skill — server state is
  the most-touched real surface (argo-proven). (M/L)
- `router-tanstack-adapter-subpath` (`./router-tanstack`: `useBasaltNav` + `useRouterBreadcrumbs`
  over `useMatches`/`staticData`). ~90% of consumers use it. (L)
- `overlays-peers` → `overlays-provider-mount-managers` (mount modals/notifications/spotlight behind
  opt-out flags; consider a composable `<BasaltOverlays>` over boolean-prop soup). (S/M)
- `./data` — `data-table` (TanStack Table) + `virtual-list` (TanStack Virtual) kinds, optional
  peers. (M/L)
- Forms doctrine pivot: `forms-fix-resolver-rule` → `forms-split-rule` (extract `basalt-forms.md`) →
  `state-rule-versioned-escalation` (edit the now-trimmed `basalt-state.md`). Ordered to avoid the
  same-file conflict. (S/M)
- `skills-grouped-by-workflow` — group skills (`/basalt:data`, `/basalt:shell`) with
  progressive-disclosure references; drop `forms-skill`/`db-skill` as standalone. (L)

### Phase 5 — Deferred / speculative *(advisory-only until a real consumer drives them)*

Tanner's kill-list (drop from near-term; keep as advisory rules + guards now, build runtime later):
`agent-runtime-subpath`, `notifications-persistence-subpath` (store/bell/registry),
`headless-use-bottom-sheet`, `basalt-pwa-vite-helper` + `pwa-runtime-hooks`, `canvas-line-kind`,
`appshell-aside-slot`, `db-ssr-guard` runtime, `create-basalt-app` (lands after CLI portability +
oxlintrc scaffold + dep-scaffold), `dtcg-interchange`. **Codify a "no speculative API" invariant**:
do not design the API of an unforced battery.

---

## Enforcement contract (defence-in-depth)

A new public subpath is **not done** until its **rule + skill + guard** triad lands —
mechanized by `basalt check-coverage`. The guard core (`./guard`) is extracted once and consumed by
the CLI, a new `oxlint-plugin-basalt` (AST guards + autofix), and a `PreToolUse` deny hook.

Four enforcement tiers per surface: **edit-time deny (hook) → save-time squiggle (oxlint) →
commit-time (lefthook) → CI gate**. Highest-leverage move: **convert guards into tsc errors**
(`semantic-tier-typed-refs`, typed notification/kind registries) — a check that becomes a compile
error is a guard you delete.

New `check-theme` kinds land first (proven regex scanner), then the AST-shaped ones ride the
migration to the oxlint plugin. Add the missing meta-guards: oxlint-preset-sync contract test,
root-barrel re-export ban, per-subpath dist dep-isolation assertion, optional-peer audit (every
declared peer must back a shipped import), rule-currency drift check.

---

## Completeness additions (the forgotten concepts)

Genuinely missing for a "battery-included" dashboard framework — all cheap, mostly advisory/core,
land in parallel with Phase 3:

- **errorReporter seam** on `BasaltProvider` + `window` error/unhandledrejection wiring (Sentry/
  PostHog/console, vendor-agnostic). *(core)*
- **env validation** — `basalt-env.md` + a tiny `validateEnv(schema)` Standard-Schema helper.
- **document head / title** — `useDocumentTitle` tying `title ← route ← breadcrumb` (SPA + Start).
- **Intl formatting doctrine** — `basalt-format.md`: native `Intl` date/number/currency/relative-time,
  explicit timezone stance (a data-dense charting framework currently has none).
- **`useOnlineStatus` + offline banner** — in-app network status, distinct from PWA SW updates. *(core)*
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

1. **CLI runtime** — make `basalt` Node-compatible, or commit to Bun-everywhere (templates already
   assume `bunx`)? Gates the whole scaffold channel.
2. **visx stable** — is stable `@visx/* 4.x` actually published mid-2026? If not, the
   responsive-chart + visx-bump + tsdown co-schedule chain stalls; decide whether to stay on
   `alpha.11` or proceed tsdown-only.
3. **`createPersistedState` placement** — inline a ~30-line dependency-free `useSyncExternalStore`
   (keeps `./state` Mantine-free, recommended) vs a `.`-only export.
4. **Notifications scope for 1.0** — ship only the `notify` helper + provider mount (recommended),
   or also the persistent center now?
5. **1.0 cut line** — Phases 0–3 (correctness + enforcement + build + owned primitives) as the 1.0,
   adapters/forms (Phase 4) as 1.1+ (recommended), or pull `./query` + `./router-tanstack` into 1.0?
6. **Scaffold vs runtime for the data layer** — confirm the "scaffold the consumer's own
   `query-client.ts`/`eden.ts`" stance over a runtime API.

## Risks

- tsdown `*.module.css` behavior under unbundle is the one unverified build risk → the CSS spike
  gates the migration.
- The React Compiler doesn't process `node_modules` → dist must ship compiler-processed; until then
  hand-memo stays.
- Optional-peer count is unbounded → the audit gate + version-coherence check must land with the
  adapters.
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
   battery and *scaffolds* an editable `eden.ts`; the transport is a seam, swappable without touching
   basalt. basalt never hard-couples to Elysia.

## AI streaming → promoted to first-class (`./agent`)

Was Phase-5 deferred; now 1.0-track — nearly every consumer app needs typed AI context streaming.
**Grounding caveat:** argo has *no* existing streaming/chat/voice code (the `feat/argo-voice` branch
does not exist) — this is net-new, built on argo's proven typed-Eden discipline.

- **Default path = Eden-native typed streaming, zero extra deps.** One discriminated `AgentPart`
  union declared once in the consumer's `lib/agent-parts.ts`; Elysia `async function*` route yields
  it → Eden Treaty consumes it as a typed `AsyncGenerator` via `for await` → React renders it typed.
  No codegen, no `any`. This *is* the "typed AI context streaming" ask.
- **AI SDK is an opt-in transport, not the spine** (`ai@6`, `@ai-sdk/react@3` as optional peers behind
  `aiSdkTransport`). Tanner-correct: don't import a foundation the stack doesn't use.
- **Surface (`./agent`):** headless `useAgentStream<TPart>({ transport })` (returns
  `parts/status/send/stop/regenerate`), an `AgentTransport` seam (`edenTransport` default,
  `aiSdkTransport` opt-in), `PartList` + default `TextPart/ReasoningPart/ToolCallPart/SourcePart`
  renderers, `StreamingMarkdown` (wraps `streamdown@2`, optional peer; shiki for highlighting),
  `StickToBottom` (wraps `use-stick-to-bottom@1`), `createChatHistoryStore` (on `createPersistedState`).
- **Channels:** CODE = the hook + transport seam + renderers; SCAFFOLD = the Elysia stream route +
  `agent-parts.ts` union + Eden wiring (secret-bearing, app-owned); DOCTRINE = `basalt-agent.md` rule +
  `/basalt:agent` skill + a `no-raw-stream` guard (ban raw `EventSource`/`fetch().body.getReader()` in
  consumer frontend; require explicit `AsyncGenerator<…>` return type so inference survives).
- **Defer:** full `<Chat>` composite, message-bubble kit, voice/audio (maintainer's `audio-proxy` is
  the audio backbone, not argo), multi-agent orchestration UI.

## Forms → `@mantine/form` (decisive), `./forms` subpath

- **Decision: `@mantine/form` v9.3.1** is the default. Decisive new fact: it now supports **Standard
  Schema natively** (`schemaResolver`) — the same Zod 4 / Valibot schema validates the Elysia route,
  types the Eden client, and validates the form, which erased the one reason to prefer TanStack Form.
  Plus zero binding tax on Mantine inputs (`form.getInputProps`). Runner-up TanStack Form; **not** RHF
  (uncontrolled-first fights Mantine's controlled inputs).
- **Surface (`./forms`, `@mantine/form` optional peer):** `createForm` (typed `useForm` wrapper,
  basalt defaults), `Field` typing helper, `FormErrorSummary`, and **`useFormDraft`** — autosave/
  restore/clear-on-submit on `createPersistedState` (versioned, namespaced; gates on
  `createPersistedState` landing first).
- **Channels:** CODE = the subpath helpers; SCAFFOLD = the editable bound-field kit
  (`TextField`/`SelectField` + a worked create/edit form using `useFormDraft`); DOCTRINE = the forms
  section split out of `basalt-state.md` into `basalt-forms.md` + a `form-localstorage` guard (ban raw
  `localStorage` in form files — force `useFormDraft`). Validation lib: **Valibot** default (tiny,
  Elysia-native), Zod 4 if already standardized.

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

- **Shortcuts decision: TanStack Hotkeys** (`@tanstack/react-hotkeys` v0.10.0, **alpha**) over Mantine
  `useHotkeys` — because it *is* a registry (template-literal-typed combos, sequences like `g-d`,
  scoping, conflict policy, display formatters for a help overlay) that projects into the command
  palette + help overlay. Mantine `useHotkeys` is a flat document-level array with none of that.
  Wrapped behind basalt's own `defineCommand` registry so the alpha API is one thin adapter's concern.
  (Runner-up Mantine for a zero-extra-peer minimal mode.)
- **Surface (`./commands`, optional peers `@mantine/{spotlight,modals,notifications}` +
  `@tanstack/react-hotkeys`):** `defineCommands` / `defineCommand` (typed `{ id, label, group?, icon?,
  shortcut?, when?, run(ctx) }`), `defineOverlays` (typed keys+props), an imperative
  `overlays.open(key, props)` over Mantine's modals manager + a drawer-store shim, and projectors:
  `toSpotlightActions`, `toHotkeyBindings`, `toShortcutList`, `runCommand`. One map → every surface.
- **Imperative vs route-driven rule:** *Does this overlay belong in the URL?* Shareable/back-button/
  refreshable → route-mask via `./router-tanstack` (`ctx.navigate`). Ephemeral (confirm, drawer, help)
  → `overlays.open`. Triggers never know which — they only reference a command `id`.
- **Channels:** CODE = registry + projectors + overlay controller + `ShortcutsHelp`; SCAFFOLD = the
  consumer's `app-commands.ts` / `app-overlays.ts` + Spotlight wiring; DOCTRINE = `basalt-commands.md`
  + `/basalt:commands` skill + guards (`raw-overlay-open` ban on direct `modals.open`/`<Drawer opened>`
  outside the battery, `raw-key-listener` ban). The `keyof typeof APP_COMMANDS` id-union makes a
  trigger referencing a nonexistent command a **tsc error** (a guard you delete).
- **1.0 vs defer:** ship the typed registry + `defineOverlays` + imperative `overlays.open` +
  `toSpotlightActions`/`runCommand` (rides the planned `overlays-provider-mount-managers`) + the
  `shortcut?` *type* so commands are forward-compatible. Defer the TanStack Hotkeys binding runtime +
  `ShortcutsHelp` overlay to 1.1 (alpha dep; Spotlight `Mod+K` covers the 80% now).

## Revised 1.0 cut line

1.0 = Phases 0–3 (correctness floor + enforcement IoC + build pipeline + owned core primitives)
**plus** `./query` + `./router-tanstack` + the `./agent` Eden-typed-streaming core + the `./commands`
typed registry + imperative overlays. Forms `./forms`, notifications `./notifications`, and the
TanStack-Hotkeys binding runtime land 1.1, each gated on `createPersistedState` + its rule/skill/guard
triad.

## Updated optional-peer matrix (subpath → optional peers)

| Subpath | Optional peers (all `peerDependenciesMeta.optional`) |
|-|-|
| `.` (root) | `@mantine/dates` (verify/keep) |
| `./query` | `@tanstack/react-query` (+ devtools) |
| `./router-tanstack` | `@tanstack/react-router` |
| `./forms` | `@mantine/form` |
| `./notifications` | `@mantine/notifications` |
| `./commands` | `@mantine/spotlight`, `@mantine/modals`, `@mantine/notifications`, `@tanstack/react-hotkeys` |
| `./agent` | `ai`, `@ai-sdk/react`, `streamdown`, `shiki`, `use-stick-to-bottom` |
| `./data` | `@tanstack/react-table`, `@tanstack/react-virtual` |

Every optional peer must back a *shipped import* (the optional-peer audit gate) and stay
version-coherent with its siblings. The `no @tanstack/* / no zustand / no motion` CLAUDE.md invariant
is clarified to **"no hard dep / no hard peer / not in the root barrel"** — opt-in subpath optional
peers are the sanctioned adapter model.

> **Enforcement hardening** (advancing the `.claude` rules/skills + oxlint rules so misbehavior is
> mechanically prevented) is the subject of a dedicated multi-expert analysis — see the forthcoming
> `docs/ENFORCEMENT-HARDENING.md`.
</content>
</invoke>
