# Basalt UI — Integration, Type-Safety Spine & DX Plan

> Status: proposal, pending approval. Synthesized from a multi-expert pass (4 research tracks → 6
> experts: type-spine, app-contract, composition, pit-of-success API, DX, cross-battery integration →
> 5-voter majority vote → synthesis), 2026-06-15. Companion to `MATURATION-ROADMAP.md` and
> `ENFORCEMENT-HARDENING.md`. This is the **design** axis — type-safety + API design that makes wrong
> usage *unrepresentable*. The **mechanical** axis (guards/lint/hooks that *catch* it) is in
> `ENFORCEMENT-HARDENING.md`. (The consolidation agent died on a transient socket error; the synthesis
> agent reconstructed the architecture decision from the expert output, recovered editorially.)

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
only `series` (or nothing) and pays zero cost (progressive disclosure *by construction*). Basalt reads
each slot purely by **conditional inference**, never by import or generic:

```ts
type Commands  = BasaltRegister extends { commands: infer C extends CommandMap } ? C : EmptyCommands
type CommandId = keyof Commands
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
route-tree-as-source-of-truth applied to the whole app: a *seam that infers*, not a god-object that
owns. **The provider stays a wiring point that reads `BasaltRegister` by inference and mounts managers;
it never grows a prop per battery.**

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
   `StandardSchemaV1<In, Out>`, never `ZodSchema`. The `./forms` `schemaResolver` (a thin wrap of
   Mantine v9's built-in), `createPersistedState` migrate/validate, route search params, and
   agent/notification payloads all accept any Standard-Schema lib (Zod 4 / Valibot / ArkType implement
   `~standard`). Basalt invents zero validation primitive — one schema authored next to the Elysia
   route flows unchanged through Eden → query `unwrap` → form resolver → persisted-state.
3. **"N valid states, not 2ⁿ."** Every state/event surface is a discriminated union
   (`{status:'idle'} | {status:'loading'} | {status:'success';data} | {status:'error';error}`), data
   present only where valid, consumed by an exhaustive `switch` with a `never` default. `AsyncState`,
   `AgentPart`, notification kinds, command results all share the shape — a new variant forces every
   renderer to handle it (the type system performs the exhaustiveness the guard axis is told *not* to).

### End-to-end inference chain (seams + footguns named)

```
Elysia route  (method-CHAINED — non-chaining silently drops App to `any`  ← footgun #1)
  └─ export type App = typeof app                          [seam: typeof, not codegen]
  └─ treaty<App>(url) in ./query                           [seam: client/server tsconfig path aliases MUST match ← footgun #2]
  └─ Eden {data,error} envelope → unwrap() → data
  └─ TanStack Query / useAgentStream (AsyncGenerator<AgentPart> via `for await`)
  └─ component props (chart-kind getX/getY generic over point type)
  └─ token refs: seriesTokens/groupTokens → `{[K in keyof T]: `var(--vx-…${K})`}` exact-keyed (stale key fails tsc)
  └─ chart-kind series.color: a branded SeriesToken produced ONLY by the factory (raw `string` = explicit bespoke escape hatch)
```

**Brand sparingly (scalpel, not policy):** brand only `CommandId` vs `OverlayKey` (structurally
identical strings that must not be interchanged at a call site) and the `SeriesToken` ref. Do **not**
brand route paths, notification kinds, or series keys — their `keyof`-union already separates them and
over-branding taxes autocomplete.

## The live bug to fix first

Today `seriesTokens`/`groupTokens` return `Record<string,string>` and `defineSeries` returns
`SeriesMap` (`tokens/index.ts:181-198`) — so the documented **"stale keys fail tsc" is FALSE**, proven
by the manual re-key block with `!` assertions in `apps/playground/src/demo/series.ts:32-43`. Fixing
the factory signatures to const-generic + mapped-return is the smallest change that makes the whole
philosophy true at its root and sets the idiom every later `defineX` copies. **This is the
single highest-leverage fix in the whole plan.**

## Phased plan (majority-vote ordered)

**Phase 0 — make the idiom true (now):** `exact-keyed-token-factories` (the live bug) ·
`satisfies-not-annotation-defaults` (keep default literal types alive) · `definex-factory-contract`
(write the one factory shape into CLAUDE.md + the tokens rule) · `fix-version-source-of-truth`.

**Phase 1 — the spine + house style (now):** `register-interface-spine` (ship `interface
BasaltRegister {}` + the conditional-inference extractors) · `standard-schema-seam` (declare the
cross-boundary `StandardSchemaV1` contract before any battery) · `discriminated-union-house-style`
(the canonical `AsyncState<T,E>` + exhaustive-switch pattern) · `eden-treaty-seam-contract`.

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
   {title,icon,navSection,command?}` projects into `SidebarSection[]` (now an *output*) + breadcrumb +
   a `CommandId`. A nav target outside the route tree fails tsc.
3. **define-a-series → chart + legend + theme-lab** in lock-step — `defineSeries` → `groupTokens` →
   `SeriesToken` per key → `MultiLine.color` + `ChartLegend` swatch + theme-lab `COLOR_GROUPS` from
   `keyof S`. Renaming `sessions`→`sessoins` fails tsc at the chart, legend, **and** lab at once.
4. **define-a-command in its own file** → palette + help-overlay + nav row + page-action all type-check
   without editing a central object (the spine litmus test).
5. **agent stream end-to-end + control-as-commands** — one `AgentPart` union: Elysia `async function*`
   → Eden `for await` → `useAgentStream` → `PartList` exhaustive switch; `agent.stop`/`regenerate`
   registered as `when:streaming` commands reachable from a global shortcut.
6. **form draft → persisted-state → notification with one schema** — a Standard Schema next to the
   Elysia route validates the form resolver **and** the `useFormDraft` draft migrate/validate (one
   object); restore emits `notify('draft.restored', { action: discard-command })`.

## DX plan — types are the primary doc

- The tarball already ships `src/` + declaration maps, so go-to-definition lands in commented source —
  **lean into this over a docs site.** The exact-keyed inferred return types *are* the affordance map
  (autocomplete on `groupTokens('demo',S).` or `notify(` surfaces only legal keys) — higher-leverage
  for Claude than prose.
- **`@example` on every public export** (enforced as a hard contract) — it ships in src, can't drift,
  and is what Claude copies verbatim into correct usage. Backfill `defineSeries`, the 7 kinds,
  `BasaltShell`, `buildPaletteCss` first.
- **Co-locate Props as namespace exports** (`MultiLine.Props`, mirroring Mantine v9) — typing
  `MultiLine.` discovers Props with no extra import.
- **Two agent-discovery surfaces from one data source:** `basalt info --json` (for agents that run the
  bin) + `llms.txt` (for agents that read files) — both enumerate subpath ownership so Claude never
  guesses `basalt-ui/charts` vs `basalt-ui` vs `basalt-ui/tokens`.
- The canonical playground example (`series.ts`) **must model the post-fix inference idiom** (3 lines),
  not ceremony — Claude pattern-matches on the most-discoverable example.
- Advisory rules (`basalt-query`/`state`) are part of the DX surface — they must model the glued seams
  as the default, or they train consumers toward the hand-wiring the batteries exist to replace.

## Risks

- **The `BasaltRegister` extractors must default to a never-keyed empty type** for un-augmented slots —
  get it wrong and an un-augmented consumer gets `any` (silent inference death). Validate with a
  charts-only scratch consumer that augments nothing.
- **Eden's two silent-`any` footguns** (non-method-chained Elysia routes; mismatched client/server
  tsconfig path aliases) are inference breaks a consumer/Claude *cannot see* — document both loudly in
  the query rule + scaffold; a type-level not-`any` assertion is only a partial guard.
- **Branding must stay a scalpel** — over-branding route paths/notification kinds/series keys taxes
  autocomplete and forces casts; hold the line at the three that genuinely cross. Make `SeriesToken`
  `SeriesToken | string` so bespoke charts + the alpha visx prop types still accept raw strings.
- **`nav-staticdata-projection` is L-effort + depends on the not-yet-built router adapter** — keep the
  manual `sections` prop as the always-available degrade so it ships incrementally.
- **`provider-wires-not-owns` is a discipline, not a mechanism** — the god-object will be tempting as a
  threaded `BasaltAppContext<TCommands,…>` generic; reject any provider generic in review.
- Mantine v9 `schemaResolver` + the TanStack `Register` pattern are load-bearing external facts (the
  research worker hung mid-verify) — confirm against live docs before pinning the peer matrix.

## Open decisions

1. **`SeriesToken` brand encoding** — tendency: minimal `& { readonly __brand }` intersection so it
   stays assignable *to* `string`, but raw string is not assignable *back* without the factory.
2. **Cross-registry call-site helpers** — standalone `runCommand`/`openOverlay`/`notify` (tree-shaking +
   go-to-def) vs hook-returned bound callbacks; tendency: standalone, hooks only where React lifecycle
   is needed (`useRegisterCommand`).
3. **Does `basalt info` introspect the consumer's `BasaltRegister`?** (augmentation is type-only, erased
   at runtime) — tendency: v1 reports only framework-owned surface, leave consumer concerns to llms.txt.
4. **Notification history persistence** — default-on vs opt-in; tendency: opt-in (privacy + storage).
5. **`useFormDraft` shared-schema** — make the hook *take* the schema and derive both resolver + draft
   validate from it (structural reuse) vs doctrinal; tendency: structural.
6. **Adapter subpath granularity** — single `./router-tanstack` (Start uses the same route tree +
   `staticData` projection) vs split; tendency: single.

---

## Where the two axes meet — `type-as-guard`

The design axis (this doc) and the mechanical axis (`ENFORCEMENT-HARDENING.md`) interlock at exactly
one seam: **a typed registry from the design axis is the guard the mechanical axis gets to delete.**

- `exact-keyed-token-factories` (here) makes "stale series key" a **tsc error** → the enforcement
  axis's `off-system-surface-var` check-theme kind shrinks to bespoke-escape-only.
- `register-interface-spine` (here) makes "nav row references a deleted command" a **tsc error** → no
  runtime guard needed for the bus at all.
- `branded-token-types` appears in *both* plans — it's the literal handoff point: the design axis
  defines `VxColor`/`SeriesToken`, the mechanical axis's `branded-token-types` (Phase 7) is the same
  work, retiring the corresponding lint guard.
- `discriminated-union-house-style` (here) makes a missing `AgentPart`/notification-kind case a **tsc
  error** → the enforcement axis never has to lint for unhandled variants.

So the sequencing across both docs is: **design-axis types first, mechanical guards only for what types
can't express.** Every guard the enforcement plan ships should be checked against "could a type from
the integration plan make this deletable?" first.
