# Basalt UI — Integration, Type-Safety Spine & DX Plan

> ⚠️ **RECONCILED 2026-07-05 — SUPERSEDED by [`STATUS.md`](./STATUS.md).** The type spine and all
> seven batteries shipped; every phase below is BUILT except the owner-gated finish line. The
> per-phase "remaining" language is historical — kept for provenance, not live work.

> **Status: ADOPTED 2026-06-19. Maximum-ambition 1.0 scope.** All seven batteries (`./query`,
> `./router-tanstack`, `./agent`, `./commands`, `./forms`, `./notifications`, `./data`) ship as
> runtime subpaths in 1.0 — none demoted. BLUEPRINT argo S0–S5 + `feat/argo-voice` shell-prerequisite
> framing is SUPERSEDED (shell is in `src/shell`). The governing sequence is: spine first (Phase 1,
> this doc), then hardenings (`ENFORCEMENT-HARDENING.md`), then batteries. Scope is owned by
> `MATURATION-ROADMAP.md` (revised cut line, 2026-06-19).
>
> Synthesized from a multi-expert pass (4 research tracks → 6 experts → 5-voter majority vote →
> synthesis), 2026-06-15. This is the **design** axis — type-safety + API design that makes wrong
> usage _unrepresentable_. The **mechanical** axis (guards/lint/hooks that _catch_ it) is in
> `ENFORCEMENT-HARDENING.md`.

Tanner bar: **you can't hold it wrong because the types won't let you.** Expert cohesion of the
current+designed surface: **3–6/10** — the registries exist but don't yet thread into one inferred
system; the cross-battery seam scored lowest (3).

## The headline decision

### The unifying abstraction is a TYPE SEAM, not a runtime object

There is exactly one unifying abstraction, and it is **not** `createBasaltApp({...})`. It is an empty,
augmentable **`interface BasaltRegister {}`** exported from the root — TanStack Router/Query's
`interface Register {}` pattern applied to the whole app shape. The consumer declaration-merges its
truth **once per concern, in that concern's own file**:

```ts
declare module 'basalt-ui' {
  interface BasaltRegister {
    router: typeof router
    eden: typeof edenClient
    commands: typeof appCommands
    overlays: typeof appOverlays
    notifications: typeof appNotifications
    series: typeof appSeries
  }
}
```

Every slot is **optional** and defaults to a never-keyed empty type — a charts-only consumer augments
only `series` (or nothing) and pays zero cost (progressive disclosure _by construction_). Basalt reads
each slot purely by **conditional inference**, never by import or generic:

```ts
// EmptyCommands = {} (keyof → never), NEVER Record<string,never> (keyof → string, TS 6.0.3)
type Commands = BasaltRegister extends { commands: infer C extends CommandMap } ? C : {}
type CommandId = keyof Commands // never when un-augmented, exact literal union when augmented
type OverlayKey = BasaltRegister extends { overlays: infer O extends OverlayMap } ? keyof O : never
```

Cross-battery wiring then resolves as `keyof`-of-another-slot, with **zero call-site generics and zero
config bag**:

```ts
SidebarItem.command?: CommandId                              // nav row → a real command
Command.opens?: OverlayKey                                   // command → a real overlay
notify<K extends NotificationKind>(kind: K, payload: Notifications[K])
runCommand(id: CommandId); openOverlay<K extends OverlayKey>(key: K, props: Overlays[K])
```

**Litmus test it passes:** add a command in its own file, augment the `commands` slot — and a nav row
referencing it, a help-overlay listing it, and a Spotlight entry projecting it **all type-check without
editing any central object.** Delete the command and every reference fails tsc. That is
route-tree-as-source-of-truth applied to the whole app: a _seam that infers_, not a god-object that
owns. **The provider stays a wiring point that reads `BasaltRegister` by inference and mounts managers;
it never grows a prop per battery.**

**Sequencing law (binding):** `BasaltRegister` is a prerequisite for every adapter subpath. No
battery ships cross-ref types (`CommandId`, `OverlayKey`, `NotificationKind`) until the spine exists.
Gated by two compile fixtures: (a) `augments-nothing` — every slot defaults to the empty-object type,
assert no slot leaks `any`; (b) `augments-all-six` — all six slots filled, assert exact literal keys.
Both fixtures must be green before Phase 2 work touches any battery file.

**Verdict on N-registries-vs-one:** keep **N independent `defineX` registries**. They read as one
system because (a) they share one factory idiom, (b) they all feed the one `BasaltRegister`, (c)
cross-refs are `keyof` the merged Register. Cohesion comes from the shared seam + shared idiom, not
from collapsing them into a mega-config.

## The type-safety spine — one philosophy, three clauses

1. **"Pass a literal, get an exact-keyed map back."** Every registry is
   `defineX<const T extends Constraint>(spec: T): T` (or a mapped-type projection of `T`) — identity
   passthrough at runtime, exact literal capture at the type level via `const` type params (TS 5.0+).
   **Never** a fluent builder (kills go-to-def + Claude's whole-object view), never a config bag,
   never a widening `: Type` annotation (use `satisfies`). The idiom every `defineX` copies verbatim,
   which is what makes eight surfaces read as one library.
2. **"Standard Schema in, inferred types out."** Every validation boundary is typed against
   `StandardSchemaV1<In, Out>`, never `ZodSchema`. The `./forms` `schemaResolver` (Mantine's own,
   shipped at `@mantine/form` v9.0.0 — every v9 release; `@mantine/form` is the optional `forms` peer
   declared `peerDependenciesMeta.optional`, like `@mantine/dates`), `createPersistedState`
   migrate/validate, route search params, and agent/notification payloads all accept any Standard-Schema
   lib (Zod 4 / Valibot / ArkType implement `~standard`). Basalt invents zero validation primitive —
   one schema authored next to the Elysia route flows unchanged through Eden → query `unwrap` → form
   resolver → persisted-state.
3. **"N valid states, not 2ⁿ."** Every state/event surface is a discriminated union
   (`{status:'idle'} | {status:'loading'} | {status:'success';data} | {status:'error';error}`), data
   present only where valid. Consumed by an exhaustive `switch` whose default arm calls the exported
   `assertNever(state)` — a bare `default: return null` is FORBIDDEN. `AsyncState`, `AgentPart`,
   notification kinds, and command results all share the shape. A new variant forces every renderer to
   handle it; the fourth-variant fixture (a compile-time test that adding a variant without updating
   the switch fails tsc) is the enforcement gate before the mechanical axis can delete its
   unhandled-variant lint.

### End-to-end inference chain (seams + footguns named)

```
Elysia route  (method-CHAINED — non-chaining silently drops App to `any`  ← footgun #1)
  └─ export type App = typeof app                          [seam: typeof, not codegen]
  └─ treaty<App>(url) in ./query                           [seam: client/server tsconfig path aliases MUST match ← footgun #2]
  └─ Eden {data,error} envelope → unwrap() → data
  └─ TanStack Query / useAgentStream (AsyncGenerator<AgentPart> via `for await`)
  └─ component props (chart-kind getX/getY generic over point type)
  └─ token refs: seriesTokens/groupTokens → `{[K in keyof T]: `var(--vx-…${K})`}` exact-keyed (stale key fails tsc)
  └─ chart-kind series.color: keyof T ref (NOT a branded SeriesToken — SeriesToken|string collapses to string)
```

**Agent stream routes (footgun #3):** `async function*` routes on Elysia MUST declare an explicit
`AsyncGenerator<AgentPart>` return type — NEVER a `t.Object`/`t.Union` response schema (eden #231
drops the inner union to `any`). Validate at yield-time; consume via `for await`. Residual dynamic
lookup gap: `Donut`/grouped-bars cast back to `Record<string,string>` — harden with a typed `get`
accessor keyed by `keyof T` plus a dynamic series type-guard case (see `series.type-guard.ts`).

**Brand sparingly (scalpel, not policy):** brand only `CommandId` vs `OverlayKey` (structurally
identical strings that must not be interchanged at a call site). Do **not** brand route paths,
notification kinds, or series keys — `SeriesToken | string` collapses to `string` and
`keyof`-union already separates the rest; over-branding taxes autocomplete.

## The live bug — fixed; residual gap to harden

The `seriesTokens`/`groupTokens` const-generic factories landed (`tokens/index.ts:184-213`); the
`!`-assertion re-key block in `apps/playground/src/demo/series.ts` is gone and stale keys now fail
tsc. **Residual gap:** `Donut` and grouped-bar renders still cast their color lookup to
`Record<string,string>` — harden with a typed `get` accessor keyed by `keyof T` and a dynamic series
type-guard case (`series.type-guard.ts`). This closes the last hole where a renamed key would compile
but render silently wrong at runtime.

## Phased plan (majority-vote ordered)

**Phase 0 — DONE:** `exact-keyed-token-factories` · `satisfies-not-annotation-defaults` ·
`definex-factory-contract` · `fix-version-source-of-truth`.

**Phase 1 — the spine (prerequisite for every battery):** `register-interface-spine` (empty-object
default, `augments-nothing` + `augments-all-six` fixtures) · `standard-schema-seam` (declare the
cross-boundary `StandardSchemaV1` contract before any battery) · `discriminated-union-house-style`
(`AsyncState<T,E>` + exported `assertNever` + fourth-variant fixture) ·
`persisted-state-primitive` (**pulled into Phase 1** — inline ~30-line `useSyncExternalStore`,
Mantine-free, keystone for agent/forms/notifications history) · `eden-treaty-seam-contract`.

**Phase 2 — close the chart chain + collapse dead weight (now→soon):** `typed-color-on-kinds` (brand
`SeriesToken`, type `MultiLine.color`; raw `string` stays the bespoke escape) · `series-token-brand-thread`
(theme-lab `COLOR_GROUPS` derived from `keyof T`) · `brand-the-two-that-cross` (`CommandId`/`OverlayKey`) ·
`collapse-vxtheme-context` (reduce `VxTheme` to `{colorScheme}` — the only thing CSS can't give a chart).

**Phase 3 — wire registries to each other + project nav (soon):** `cross-registry-keyof-refs`
(`SidebarItem.command?`, `Command.opens?`, etc. resolved through the merged Register) ·
`provider-wires-not-owns-mounts` (composable `<BasaltOverlays/>`, not a prop per battery) ·
`render-seam-as-house-style` (`render?: (typedProps, typedState) => ReactNode` everywhere) ·
`nav-staticdata-projection` (derive `SidebarSection[]` + breadcrumbs from route `staticData`).

**Phase 4 — cross-battery glue (soon→later):** `as-command-handle-adapter`
(`useRegisterCommand({id,label,run,when?})`) · `notification-action-command-field` (`action?: {commandId,
label}`) · `page-action-from-command` · `agent-control-as-commands` (`agent.stop`/`regenerate` as
`when:streaming` commands) · `formdraft-restore-notify-bridge`.

**Phase 5 — DX surfaces (soon→later):** `rewrite-series-example-to-inference` ·
`jsdoc-example-as-interface` (`@example` on every public export — it ships in src and is what Claude
copies) · `basalt-info-cli-surface` (`basalt info --json`) · `ship-llms-txt` ·
`realign-advisory-rules-to-glue`.

## Cross-battery integration scenarios (the seams must connect)

1. **query error → notification → command-retry** — failing Eden query; component registered its
   refetch via `useRegisterCommand` → `CommandId`; `onError` calls `notify('query.error', { action: {
commandId, label: 'Retry' } })`; the Retry button runs `runCommand`. Every hop tsc-checked; deleting
   the command fails the `notify` call site.
2. **add-a-route → nav + breadcrumb + command** appear automatically — route `staticData
{title,icon,navSection,command?}` projects into `SidebarSection[]` (now an _output_) + breadcrumb +
   a `CommandId`. A nav target outside the route tree fails tsc.
3. **define-a-series → chart + legend + theme-lab** in lock-step — `defineSeries` → `groupTokens` →
   `SeriesToken` per key → `MultiLine.color` + `ChartLegend` swatch + theme-lab `COLOR_GROUPS` from
   `keyof S`. Renaming `sessions`→`sessoins` fails tsc at the chart, legend, **and** lab at once.
4. **define-a-command in its own file** → palette + help-overlay + nav row + page-action all type-check
   without editing a central object (the spine litmus test).
5. **agent stream end-to-end + control-as-commands (NET-NEW — no argo streaming/chat/voice)** — one
   `AgentPart` union: Elysia `async function*` with explicit `AsyncGenerator<AgentPart>` return
   (NO response schema, eden #231) → typed-Eden `for await` → `useAgentStream` → `PartList`
   exhaustive switch + `assertNever`; `StreamingMarkdown` ships headless (no Tailwind dependency);
   `agent.stop`/`regenerate` registered as `when:streaming` commands reachable from a global shortcut.
6. **form draft → persisted-state → notification with one schema** — a Standard Schema next to the
   Elysia route validates the form resolver **and** the `useFormDraft` draft migrate/validate (one
   object); restore emits `notify('draft.restored', { action: discard-command })`.

## DX plan — agent-buildability surface

- The tarball already ships `src/` + declaration maps, so go-to-definition lands in commented source —
  **lean into this over a docs site.** The exact-keyed inferred return types _are_ the affordance map
  (autocomplete on `groupTokens('demo',S).` or `notify(` surfaces only legal keys) — higher-leverage
  for Claude than prose.
- **`@example` on every public export is a MECHANICAL contract** — a test fails on any public export
  lacking an `@example` block; it ships in src, can't drift, and is what Claude copies verbatim.
  Backfill priority: factories, 7 kinds, `BasaltShell`, `BasaltProvider`, `buildPaletteCss`.
- **Co-locate Props as namespace exports** (`MultiLine.Props`, mirroring Mantine v9) — typing
  `MultiLine.` discovers Props with no extra import.
- **`basalt info --json` + `llms.txt` from ONE `SURFACES` registry** — `docs/llms.md` is brand voice,
  not an API map; the registry is the single source so they cannot drift. Both enumerate subpath
  ownership so Claude never guesses `basalt-ui/charts` vs `basalt-ui` vs `basalt-ui/tokens`.
- The canonical playground example (`series.ts`) **must model the post-fix inference idiom** (3 lines),
  not ceremony — Claude pattern-matches on the most-discoverable example.
- **README front-loads the plugin + `basalt init` pair** — a consumer's first five lines are the
  plugin config and one `basalt init` call, not a wall of options.
- **Fix advisory stub-docs drift before batteries ship:** `basalt-query` non-null-assertion `unwrap!`
  → typed `unwrap` (the `!` is gone post-seam); `basalt-state` Zustand template → demoted (Zustand is
  no longer the default, `createPersistedState` is); rules import from the battery under a
  `triad-contract` check once the battery ships.

## Risks (accepted knowingly)

1. **Empty-default MUST be the empty object (`keyof` → `never`), never `Record<string,never>`** (`keyof` → `string`, TS 6.0.3, silent `CommandId` widening). Gated by two compile fixtures: `augments-nothing` (every slot a never-keyed empty type, assert no `any` leak) and `augments-all-six` (exact keys).
2. **Three Eden silent-`any` footguns** — (a) non-method-chained Elysia routes; (b) mismatched client/server tsconfig path aliases; (c) a `t.Object`/`t.Union` response schema on an `async function*` stream route (eden #231 drops the inner union to `any`). The scaffold validates at yield-time and requires an explicit `AsyncGenerator<AgentPart>` return type; document all three loudly in the query rule.
3. **`SeriesToken | string` collapses to `string`** — hold branding at `CommandId`/`OverlayKey` only; series color stays a `keyof T` ref, guarded by a `check-theme` regex on the factory output.
4. **`streamdown` v2 requires Tailwind** — `StreamingMarkdown` ships headless; never pull Tailwind into a Tailwind-free framework.
5. **`react-hotkeys` 0.9.1 alpha (0.10.0 does not exist)** — ship the typed registry + projectors + the shortcut type in 1.0; defer the alpha binding runtime to 1.1; pin 0.9.1 exactly; keep it out of the 1.0 type graph.
6. **`nav-staticdata-projection` is L-effort + depends on the not-yet-built router adapter** — keep the manual `sections` prop as the always-available degrade so it ships incrementally.
7. **`provider-wires-not-owns` is a discipline, not a mechanism** — the god-object will be tempting as a threaded `BasaltAppContext<TCommands,…>` generic; reject any provider generic in review.
8. **External facts (verified 2026):** `schemaResolver` shipped at `@mantine/form` v9.0.0 (every v9 release); `@mantine/form` is the optional `forms` peer (`peerDependenciesMeta.optional`); `PreToolUse additionalContext` is dead (issues 15664/19432) — steer via `permissionDecisionReason`; npm dual-publish fixed separately OIDC-only.
9. **OWNER DECISION — visx pin:** `CLAUDE.md` holds visx `4.0.0-alpha.11` co-scheduled with tsdown; stable `4.0.0` shipped 2026-06-11. Audit recommends decoupling the pack-test-provable bump from the tsdown gate. Decision needed and must be recorded in `CLAUDE.md`.

## Open decisions

1. **`SeriesToken` brand encoding** — tendency: minimal `& { readonly __brand }` intersection so it
   stays assignable _to_ `string`, but raw string is not assignable _back_ without the factory.
2. **Cross-registry call-site helpers** — standalone `runCommand`/`openOverlay`/`notify` (tree-shaking +
   go-to-def) vs hook-returned bound callbacks; tendency: standalone, hooks only where React lifecycle
   is needed (`useRegisterCommand`).
3. **Does `basalt info` introspect the consumer's `BasaltRegister`?** (augmentation is type-only, erased
   at runtime) — tendency: v1 reports only framework-owned surface, leave consumer concerns to llms.txt.
4. **Notification history persistence** — default-on vs opt-in; tendency: opt-in (privacy + storage).
5. **`useFormDraft` shared-schema** — make the hook _take_ the schema and derive both resolver + draft
   validate from it (structural reuse) vs doctrinal; tendency: structural.
6. **Adapter subpath granularity** — single `./router-tanstack` (Start uses the same route tree +
   `staticData` projection) vs split; tendency: single.

---

## Where the two axes meet — `type-as-guard`

The design axis (this doc) and the mechanical axis (`ENFORCEMENT-HARDENING.md`) interlock at exactly
one seam: **a typed registry from the design axis is the guard the mechanical axis gets to delete.**
Each deletion is gated on a green fixture — cite the fixture or the deletion is theatre.

- `exact-keyed-token-factories` (here) makes "stale series key" a **tsc error** → the enforcement
  axis's `off-system-surface-var` check-theme kind shrinks to bespoke-escape-only. Series color stays
  a `check-theme` regex over the `keyof T` factory output.
- `register-interface-spine` (here) makes "nav row references a deleted command" a **tsc error** → no
  runtime guard needed for the bus at all. Deletion gated on the `augments-nothing` fixture green.
- `branded-token-types` (Phase 7) narrows to **`CommandId`/`OverlayKey` only** — `SeriesToken | string`
  collapses to `string`, so series-color stays a regex guard, not a brand handoff. The design axis
  defines the brand encoding; the mechanical axis retires the corresponding lint guard only after the
  fixture confirms the brand holds.
- `discriminated-union-house-style` (here) makes a missing `AgentPart`/notification-kind case a **tsc
  error** → the enforcement axis Tier 1 unhandled-variant deletion is conditional on `assertNever`
  exported and the fourth-variant fixture green.

So the sequencing across both docs is: **design-axis types first, mechanical guards only for what types
can't express.** Every guard the enforcement plan ships should be checked against "could a type from
the integration plan make this deletable?" first. The `SURFACES` registry generates both `llms.txt`
and `basalt info --json` from one source so they cannot drift — the enforcement axis's `check-coverage`
confirms all seven batteries have a SURFACES entry before the build passes.
