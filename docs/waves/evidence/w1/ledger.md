# W1 evidence — the TanStack library adoption ledger (`docs/V2-SPEC.md` § 8)

Base: `origin/master` @ `3f6e5fc`. Spike: branch `spike/w1-ledger` @
`a89a088715c7059a8ab8c455af3a36472c11405d` (pushed, never PR'd). argo read at `95d63d6`, read-only;
`argo:src/…` below means `apps/dashboard/src/…`.

## Versions (`npm view <pkg> version`, 2026-10-13)

| Package                                             | Latest                    | Published  | Note                                                    |
| --------------------------------------------------- | ------------------------- | ---------- | ------------------------------------------------------- |
| `@tanstack/react-table` / `table-core`              | 9.3.1 / 9.3.1             | 2026-10-12 | inside the 3-day `minimum-release-age` until 2026-10-15 |
| `@tanstack/react-store` / `store`                   | 0.11.2 / 0.11.2           | 2026-09-29 | `1.0.0-alpha.0` published 2026-10-10                    |
| `@tanstack/react-pacer` / `pacer`                   | 0.24.1 / 0.23.1           | 2026-10-05 |                                                         |
| `@tanstack/react-db` / `db` / `query-db-collection` | 0.5.8 / 0.13.0 / 1.4.3    | 2026-10-10 |                                                         |
| `@tanstack/react-devtools` / `devtools`             | 0.10.13 / 0.15.0          | 2026-09-23 |                                                         |
| `@tanstack/react-hotkeys` / `hotkeys`               | 0.13.0 / 0.11.0           | 2026-10-04 | 0.10.0 → core 0.8.0                                     |
| `@tanstack/react-form` / `form-core`                | 1.33.5 / 1.33.5           | 2026-08-11 | `2.0.0-alpha.2` published 2026-08-21                    |
| `@tanstack/ai` / `ai-react`                         | 0.68.0 / 0.30.3           | 2026-10-09 | 100 versions, 13 in the last 30 days                    |
| `ai` / `@ai-sdk/react` / `@mantine/form`            | 7.0.138 / 4.0.141 / 9.7.2 | 2026-10-12 |                                                         |

Dependency facts (`npm view <pkg>@<ver> dependencies peerDependencies`):

- `react-table@9.3.1`, `react-hotkeys@0.13.0`, `react-pacer@0.24.1`, `react-form@1.33.5` and
  `react-router@1.170.38` (`bun.lock:1118`) all depend on `@tanstack/react-store ^0.11`. The spike
  lockfile resolved two copies (0.11.0 for Router/Hotkeys 0.10, 0.11.2 for the rest).
- `devtools@0.15.0` renders with `solid-js ^1.9.9` + `goober`, and pulls `@neodrag/* 3.0.0-next.11`.
- `ai@0.68.0` depends on `@ag-ui/core 1.0.0`; `ai-react@0.30.3` on `@tanstack/markdown ^0.0.13` and
  peers `@mcp-ui/client ^7`.
- `react-hotkeys@0.13.0` ships ESM only (no `.cjs` in `dist/`); 0.10.0 shipped both.

## Spike setup

```bash
git worktree add ../basalt-ui-w1-ledger -b spike/w1-ledger origin/master && bun install
cd apps/playground
bun add -d "@tanstack/react-table-v9@npm:@tanstack/react-table@9.2.8" \
  "@tanstack/react-hotkeys-v13@npm:@tanstack/react-hotkeys@0.13.0" "@tanstack/react-pacer@0.24.1"
```

9.2.8, not 9.3.1: `~/.bunfig.toml`'s 3-day `minimum-release-age` refuses 9.3.1 until 2026-10-15.
Aliases keep v8/0.10 (the incumbents the playground already uses) side by side with the candidates.

## Bytes

Isolated: `SPIKE_ENTRY=src/spike/<f> bunx vite build -c spike.vite.config.ts`. React, react-dom and
`@mantine/core` stay external, and so does `@mantine/hooks` (a required peer already). `_nostore` means
`@tanstack/{react-,}store` was also external. The gzip comes from `zlib.gzipSync` over every emitted `.js`.

| Entry                                             | gzip B | `_nostore` | Non-comment LOC |
| ------------------------------------------------- | -----: | ---------: | --------------: |
| `table-v8.tsx` (incumbent, `useReactTable`)       | 15 699 |          — |             108 |
| `table-v9-use.tsx` (`useTable` + hidden features) | 22 668 |     19 769 | 102 (+54 once¹) |
| `table-v9-hook.tsx` (`createTableHook`)           | 23 323 |     20 411 | 104 (+54 once¹) |
| `debounce-incumbent.ts` (search-filter.tsx:95)    |    313 |          — |              27 |
| `debounce-pacer.ts` (`useDebouncedCallback`)      |  4 861 |      1 810 |              28 |
| `debounce-mantine.ts` (`@mantine/hooks`)          |    292 |          — |              25 |
| same, `@mantine/hooks` inlined                    |    884 |          — |               — |
| `hotkeys-v10.ts` (`getHotkeyManager`)             |  5 794 |      3 844 |               — |
| `hotkeys-v13.ts` (`getHotkeyManager`)             |  7 195 |      5 411 |               — |

¹ `table-v9-features.ts`, the one module-scope `tableFeatures` set basalt would own.

Deltas: Table v9 is **+6 969 B** gz over v8 for the same features. Of that, +2 899 B is Store, which
is shared with Router once one `react-store` copy dedupes, so the floor is **+4 070 B**.
`createTableHook` adds **+655 B** over `useTable`. Pacer adds **+4 548 B** (+1 497 B with the store
shared) over the incumbent, while `@mantine/hooks` adds −21 B. Hotkeys 0.13 adds **+1 401 B**
(+1 567 B with the store shared); this is a lazy `import()` chunk, off the first paint.

Playground (`bunx vite build`, total gzip of `dist/**/*.js`):

| Build                                                 | Total gzip B | Chunks |
| ----------------------------------------------------- | -----------: | -----: |
| baseline (`master` @ `3f6e5fc`)                       |    1 369 998 |    121 |
| + `/spike-ledger` route (v9 table + Pacer search box) |    1 393 754 |    130 |

The total delta is **+23 756 B**. The new route chunk is 20 052 B. The rest is re-chunking: `floating-ui`,
`Checkbox` and `TextInput` split out of shared chunks, plus a second `with-selector` (the duplicate
`react-store`).

## Behaviour

`bun test apps/playground/src/spike` — **9 pass, 0 fail** (13 expects):

- `table-parity.test.tsx`: v8, v9 `useTable` and v9 `createTableHook` render identical cells for
  `revenue desc` page 1/25 and for `name asc` (alphanumeric: `Project 2` before `Project 10`).
- `table-v9-nosortfns.test.tsx`: the negative control. With no `sortFns` slot, v9 sorts
  `['Project 1', 'Project 10', 'Project 2']`, so string columns degrade silently to `basic`. v8
  resolved these implicitly.
- `debounce.test.tsx`: the incumbent, Pacer and Mantine each commit once (`['abc']`) for three
  keystrokes inside 200 ms, and each follows an outside reset.

## Types

`bunx tsc -p tsconfig.json && bunx tsc -p tsconfig.test.json` — clean; every `@ts-expect-error` is
load-bearing (an unused one fails the build).

- `table-v9.type-guard.ts`: the per-table `columnMeta: metaHelper<…>()` slot rejects `{ aling }`,
  `{ align: 'end' }` and an unknown accessor key. This is today's guard without the global
  `declare module '@tanstack/react-table'` (`data-table.tsx:117`).
- `hotkeys.type-guard.ts`, against the real 0.10.0 and 0.13.0 declarations:
  - `HotkeyBinding` (`projectors.ts:33`) → `UseHotkeyDefinition` **fails on both versions**:
    `string` is not assignable to `RegisterableHotkey`. The JSDoc at `projectors.ts:36-38` claims it
    compiles.
  - `PeerModule` (`useCommandHotkeys.ts:48`) ← `{ getHotkeyManager }` **fails on both** for the same
    reason. `as unknown as PeerModule` (`useCommandHotkeys.ts:74`) hides it.
  - `Hotkey@0.10` → `Hotkey@0.13` compiles, so the move is a widening. `Key` gained `PhysicalKey`,
    `RawHotkey` gained a `code` variant, and `HotkeyRegistration` gained `activeMatch?`.
    `HotkeyManager.register` and `HotkeyRegistrationHandle` are unchanged.
  - argo's shortcuts (`Mod+B`, `Mod+/`) plus `Mod+K` and `Mod+Shift+P` satisfy `Hotkey@0.13`, while
    `Cmd+B` and `Shift+Mod+P` are compile errors.

## Incumbents and consumer reads

| Area      | basalt today                                                                                                                                                                | argo (`95d63d6`)                                                                                                                                                                                                                                                                                   |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Table     | `useReactTable` (`data-table.tsx:1514`), physical pinning `getStart('left')` (`:934`), `columnPinning.left/right` (`:1486`), `createColumnHelper` re-export (`table.ts:39`) | 8 tables, all `createColumnHelper` from `basalt-ui/data/table` (e.g. `argo:src/features/agents/agents-table.tsx:2`). None filter, select or virtualize. `PaginationState` is imported directly (`session-history.tsx:4`), and v9 still exports it with the same shape                              |
| Store     | `./state` core: a 30-line listener set + `useSyncExternalStore` (`state/fields.ts:860-890`) under 1 147 lines of lane/field vocabulary                                      | zustand ×3 (`argo:src/lib/store.ts:25`, `auth.ts:10`, `timer-store.ts:120`); `createLocalStore`/`createSearchStore`/`createPersistedState` for everything a control reads                                                                                                                          |
| Debounce  | `SearchFilter` (`search-filter.tsx:95`), `useFormDraft` autosave (`use-form-draft.ts:235-260`); `DataTable` global search is **not** debounced (`data-table.tsx:1865`)      | All hand-rolled: `diagram-shared.tsx:7-13` (250 ms), `workout-draft.ts:64,174-180` (900 ms), throttle `audio-player-card.tsx:109-138`; m365 filter is undebounced (`explorer-page.tsx:219-222`)                                                                                                    |
| Live data | —                                                                                                                                                                           | Polling only, no push channel (`argo:src/lib/queries/gym.ts:22`), no sync engine (Elysia + drizzle + postgres). Optimistic writes by hand (`gym.ts:110-119`); `ThreadsStore` (`features/hermes-chat/threads-store.ts:1-40`) is a hand-written optimistic collection                                |
| Devtools  | `BasaltDevDock` (`dev-dock.tsx`, 162 lines: router + query panels + theme lab), `BasaltQueryDevtools` (`query-devtools.tsx`, 40 lines)                                      | Dock only: `argo:src/routes/__root.tsx:15,155`; no direct devtools import                                                                                                                                                                                                                          |
| Hotkeys   | Never statically imported; `getHotkeyManager` by dynamic `import()` (`useCommandHotkeys.ts:74`), types mirrored                                                             | Commands only (`argo:src/lib/commands.tsx:86-112`); no direct hotkeys import                                                                                                                                                                                                                       |
| Forms     | `./forms` on `@mantine/form`, 878 non-test lines                                                                                                                            | `useBasaltForm` (`argo:src/lib/auth-gate.tsx:22`), one raw `useForm` (`warden/issues-section.tsx:311`); other forms are `useState`                                                                                                                                                                 |
| AI        | `./agent` + `./agent-chat` on AI SDK 7 (`ai ^7.0.15`)                                                                                                                       | Dashboard `ai 7.0.107`, api `ai 5.0.196`; **D3** (`argo:docs/HERMES-CHAT-V2.md:52`): "Dashboard stays on AI SDK v7; `apps/api` stays on v5. The skew is neutralized by a producer-side transform, not a migration" (`apps/api/src/lib/finish-reason-transform.ts:61`). No `@tanstack/ai*` anywhere |

## Commands

```bash
for p in @tanstack/react-table … ; do npm view $p version; done          # versions above
npm pack <pkg>@<ver>   # into /tmp/w1-tarballs/<pkg>/ — hotkeys 0.8.0/0.11.0/0.10.0/0.13.0 d.ts diff,
                       # react-table 9.3.1 skills/migrate-v8-to-v9 + getting-started/references/create-table-hook.md
(cd packages/basalt-ui && bun run build) && (cd apps/playground && bunx vite build)   # baseline, then + route
bun test apps/playground/src/spike
(cd apps/playground && bunx tsc -p tsconfig.json && bunx tsc -p tsconfig.test.json)
```
