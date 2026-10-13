# basalt-ui 2.0 — the contract

Ground truth for the 2.0 rewrite (`docs/waves/PLAN.md`). Each 1.x spec stays authoritative for the
1.x line (`1.x` branch) and is archived once its surface is ported here. Where this file and a 1.x
spec disagree about 2.0, this file wins.

<!-- lead: header, precedence and cross-section reconciliation -->

## 1. Public surface

<!-- owner: v2-core -->

## 2. Provider and wiring

<!-- owner: v2-core -->

## 3. Strictness

<!-- owner: v2-core -->

## 4. Tokens and theme

<!-- owner: v2-core -->

## 5. Transitions

<!-- owner: v2-core -->

## 6. AI and content

<!-- owner: v2-core -->

## 7. Observability

<!-- owner: v2-core -->

## 8. Library adoption ledger

Charter point 3 decides each row: a library is adopted only on evidence. Evidence lives in
`docs/waves/evidence/w1/ledger.md`, and the spike is `spike/w1-ledger` @ `5f8e614`, never merged.
Versions are `npm view` as of 2026-10-13. Bytes are gzip from the isolated Vite lib build, with React
and Mantine external. LOC counts non-comment lines.

| Library                               | Latest                     | Stability                       | Verdict           | 2.0 surface                                    | Evidence                                                                                                                                                                                                                 | argo use case                                                          | Pin · upgrade test                                                                                                                                      |
| ------------------------------------- | -------------------------- | ------------------------------- | ----------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Table (`@tanstack/react-table`)       | 9.3.1 (tested 9.2.8)       | stable major                    | **adopt** (W6)    | `./table`                                      | spike on 9.2.8: parity 5/5; v9 22 668 B vs v8 15 699 B (+4 070 B once Store dedupes); `createTableHook` +655 B; LOC 156 (102 + the 54-line `tableFeatures` set) vs 108                                                   | 8 tables via `createColumnHelper` (`agents-table.tsx:2` …)             | peer `9.2.8` exact · before any 9.3.x bump, re-run `table-parity`, `table-v9-nosortfns`, `table-v9.type-guard` and the byte build against the candidate |
| Store (`@tanstack/react-store`)       | 0.11.2 (1.0.0-alpha.0 out) | pre-1.0                         | **reject**        | none (stays transitive)                        | no spike: `./state`'s core is a 30-line listener set (`state/fields.ts:860-890`); Store is 2 899 B, already shipped by Router                                                                                            | zustand ×3 (`src/lib/store.ts:25`) stays consumer-owned                | — · one `react-store` copy in the pack-test tree (`bun pm ls`)                                                                                          |
| Pacer (`@tanstack/react-pacer`)       | 0.24.1                     | pre-1.0                         | **reject**        | none (`@mantine/hooks` `useDebouncedCallback`) | spike: parity 3/3; Pacer +4 548 B (+1 497 B store-shared), Mantine −21 B; LOC 28 / 27 / 25                                                                                                                               | hand-rolled debounces (`diagram-shared.tsx:7`, `workout-draft.ts:174`) | —                                                                                                                                                       |
| DB (`@tanstack/react-db`)             | 0.5.8 (db 0.13.0)          | pre-1.0                         | **reject**        | none                                           | no spike: argo has no push or sync channel (`gym.ts:22`), so collections would wrap the same polling queries                                                                                                             | none; `ThreadsStore` (`threads-store.ts:1`) is `./agent` surface       | —                                                                                                                                                       |
| Devtools (`@tanstack/react-devtools`) | 0.10.13 (devtools 0.15.0)  | pre-1.0                         | **reject**        | `BasaltDevDock` stays the one mount            | no spike: the shell renders with `solid-js` + `goober` and pulls `@neodrag/* 3.0.0-next.11`; the dock already hosts router, query and theme lab                                                                          | dock only (`__root.tsx:155`)                                           | —                                                                                                                                                       |
| Hotkeys (`@tanstack/react-hotkeys`)   | 0.13.0 (core 0.11.0)       | pre-1.0                         | **adopt** (W3/W6) | `./commands`                                   | incumbent-peer upgrade, a documented exception to the demo leg: the type spike shows 0.10 → 0.13 widens and the mirrored types fail on **both**; keyboard-dispatch test 2/2 on 0.10 and 0.13; lazy chunk 5 794 → 7 195 B | `defineCommands` `Mod+B`, `Mod+/` (`src/lib/commands.tsx:86-112`)      | **required** peer `0.13.0` exact · before any bump, re-run `hotkeys.type-guard` + `hotkeys-dispatch` against the candidate                              |
| Form (`@tanstack/react-form`)         | 1.33.5 (2.0.0-alpha.2 out) | stable, next major in alpha     | **reject**        | `./forms` stays on `@mantine/form`             | no spike: `@mantine/form` binds Mantine inputs natively (`key` + `getInputProps`, guarded by `basalt/forms-field-key`); 2.0 alpha means 1.x churn                                                                        | 2 sites (`auth-gate.tsx:22`, `issues-section.tsx:311`)                 | —                                                                                                                                                       |
| AI (`@tanstack/ai`)                   | 0.68.0 (ai-react 0.30.3)   | pre-1.0, 13 releases in 30 days | **reject**        | `./agent` stays on AI SDK 7                    | no spike: speaks AG-UI (`@ag-ui/core` dep), while argo's server emits AI SDK v5 UI-message streams; D3 locks that server                                                                                                 | Hermes chat (`hermes-transport.ts:1`, `aiSdkTransport`)                | — · `ai` stays the `./agent` peer                                                                                                                       |

argo paths are relative to `apps/dashboard/` (argo @ `95d63d6`).

### Rationale (non-obvious verdicts)

- **Table: hide `createTableHook`; keep one helper.** `createTableHook` exists for several tables
  that share features and registered components. basalt has one table component, so the factory buys
  nothing and costs +655 B. The table owns one module-scope `tableFeatures` set over `useTable`. The
  `createColumnHelper` re-export becomes basalt's own function with the same name and the same
  one-generic call (`createColumnHelper<Row>()`). It returns `ColumnHelper<BasaltTableFeatures, Row>`,
  because v9's raw helper needs `<TFeatures, TData>`, a generic no consumer should spell. argo's 8
  call sites keep their import and call shape.
- **Table: why adopt at +4 kB.** v8's last release was 8.21.3 on 2025-04-14, and v9 has been GA since
  2026-08-04. v9 makes the per-table `columnMeta: metaHelper<…>()` slot available, which keeps the
  `meta: { aling }` compile error without the global `declare module '@tanstack/react-table'` that 1.x
  leaks into every consumer (`data-table.tsx:117`). That is charter point 1. The +4 070 B is a W6
  regression to beat or accept in its **Left behind**.
- **Table: pin what was tested.** 9.3.1 (published 2026-10-12) is inside `~/.bunfig.toml`'s 3-day
  `minimumReleaseAge` until 2026-10-15, so every number above is 9.2.8. The upgrade test is the gate
  for 9.3.x.
- **Table: three migration traps the spike hit.**
  - v9 sorts strings as `basic` unless `sortFns` registers `alphanumeric`, `text` and `datetime`
    (negative control: `Project 10` before `Project 2`), and the only signal is a dev warning.
  - Column `getStart`/`getAfter` and header `getStart` are declared on `columnSizingFeature`, not
    `columnPinningFeature` (`table-core@9.2.8`
    `dist/features/column-sizing/columnSizingFeature.types.d.ts:108,120,134`). Sticky pinning
    therefore needs `columnSizingFeature` registered.
  - Pinning is logical (`start`/`end`), so `data-table.tsx:934,941,1486` change.
- **Hotkeys: adopt, and stop mirroring.** The audit's "never imported, types mirrored" design is
  already broken: `hotkey: string` is not a `RegisterableHotkey` on 0.10.0 either, so
  `toHotkeyBindings()` → `useHotkeys()` never compiled. `as unknown as PeerModule`
  (`useCommandHotkeys.ts:74`) hides the same failure.
  - 2.0 deletes `HotkeyBinding`, `PeerModule` and `HotkeyHandle`, takes `import type` from the
    pinned peer, and types `CommandDef.shortcut` as the peer's `Hotkey`, which makes `'Cmd+B'` a
    compile error.
  - `BasaltProvider` wires hotkeys statically (§ 2), and § 1 makes a statically imported peer
    required.
  - 0.13 is ESM-only, which suits basalt's ESM-only build.
  - With Store shared the delta grows (+1 567 B against +1 401 B). 0.10 bundles Store 0.11.0
    (1 950 B) and 0.13 bundles 0.11.2 (1 784 B), and the 166 B smaller Store offsets part of
    Hotkeys' own growth.
- **Pacer: the incumbent is Mantine, not basalt.** basalt and argo only debounce. `@mantine/hooks`
  9.3.0 `useDebouncedCallback` has `flush`/`cancel`/`isPending` plus `flushOnUnmount`/`maxWait`
  options (`lib/use-debounced-callback/use-debounced-callback.d.ts:1-11`). It is always installed,
  because `@mantine/core` 9.7.2 peers `@mantine/hooks` exactly and non-optionally. Pacer's
  differentiators (rate-limit, queue, batch, async retry) have no caller. One way to debounce:
  SearchFilter, `useFormDraft` autosave and DataTable's global search (undebounced today,
  `data-table.tsx:1865`) move to the Mantine hook.
- **Store: already present, never exposed.** Router 1.170 (`bun.lock:1107`), Table v9, Hotkeys 0.13
  and Pacer all depend on `@tanstack/react-store ^0.11`. The cost is paid once if the tree dedupes.
  The spike lockfile held 0.11.0 and 0.11.2, which made a second `with-selector` chunk. basalt
  re-exports no Store symbol and does not surface `table.Subscribe`/`table.atoms`.
  `state/fields.ts` (1,147 lines) resolves URL ⊳ localStorage ⊳ fallback lanes, which Store does not
  do.
- **AI: D3 decides it.** Moving the client to TanStack AI means an AG-UI producer, which is the
  server migration D3 (`argo:docs/HERMES-CHAT-V2.md:52`) exists to avoid. W8 drops "TanStack AI per
  the ledger".

### Verdicts to apply mechanically (`⟂ § 8` lines in § 1 / § 2 / § 6)

| Where | Line resolves to                                                                                                                                                                                               |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| § 1   | `./table`: `BasaltDataTable`, `createColumnHelper` (basalt-owned, 1 generic). No `useTable`, `createTableHook`, `tableFeatures`, `flexRender` or row-model re-export                                           |
| § 1   | `./commands`: `HotkeyBinding` deleted; `toHotkeyBindings()` returns the peer's `UseHotkeyDefinition[]`                                                                                                         |
| § 1   | no direct `@tanstack/{store,react-store,pacer,react-pacer,db,react-db,devtools,react-devtools,react-form,ai,ai-react}` peer, dependency or symbol; the transitive `react-store` (Router, Table, Hotkeys) stays |
| § 2   | peers: `@tanstack/react-table 9.2.8` exact (required by `./table`), `@tanstack/react-hotkeys 0.13.0` exact (**required**: `BasaltProvider` imports it statically)                                              |
| § 2   | devtools mount = `BasaltDevDock` (router + query + theme lab), lazy and dev-only; no TanStack Devtools shell                                                                                                   |
| § 6   | chat runtime = AI SDK 7 (`ai`, `@ai-sdk/react`); no TanStack AI adapter or transport                                                                                                                           |

**Open:**

1. Is Table v9's +4 070 B (+6 969 B if `react-store` does not dedupe) accepted as a W6 regression,
   or must W6 offset it elsewhere in `./table`?

## 9. Charts

<!-- owner: v2-charts -->

## 10. Open questions

<!-- lead: collected from every section -->
