# Basalt UI v3 architecture, slimness lens

Date 2026-11-09. Lens: the smallest framework that still delivers every differentiator in `BRIEF.md`. Tags: **F** read or run (cited), **J** judgement, **U** unverified. Slugs as in `DISCOVERY-DIGEST.md` (the digest). Numbers without a tag are budgets, which are proposals. Decisions the digest reserves for the owner are marked **DPO** (DEFAULT-PENDING-OWNER) and listed in section 13.

## 0. Verdict

1. **12 published entries (15 today), about 26k source lines (79k today, `wc` of `src/**` non-test, F), 4 required peers (36 declared today, F).** Nothing in the brief loses a home; section 2 shows what does.
2. **Hybrid is confirmed; copy-by-default is refuted.** Logic, composites, lint and skills stay in npm as measured. Primitives also start in npm, and `basalt-ui eject <name>` copies one into the app. The digest calls managed copy "the only measured option" (row 1), but gap-dist measured shape D (compiled + eject) too, and D tied C on bytes, SSR and fleet result for un-ejected apps. C won on three judgements, one of which is a fixable bug (section 6).
3. **The primitive layer is 24 parts, not 40-60.** "40-60" is a catalogue count; nothing measured it. Argo needs 25 Base UI parts for 31 Mantine components (gap-perf), the console imports 10 `ui/` files (F, grep).
4. **Subpaths split only on a peer or a hard byte budget.** That one rule dissolves `./state`, `./forms`, `./commands`, `./format`, `./tokens`, `./controls-dates`, `./agent` and rejects the proposed `./live`, `./ai`, `./ai/ui`, `./testing`, `./test/a11y`.
5. **`cn` does not merge.** It is `clsx`. `no-restyle` already bans the overrides merging exists for, the merge is lossy anyway (gap-dist: `sm:px-2.5` survives `px-4`), and it costs 8.5 KB gz (gap-perf) when weatherorb has about 8 KiB headroom. It also removes a build step and a bug class (`text-red-500 text-display` losing the colour, gap-perf 4.1). Risk 3 falsifies this.
6. **"Shell" means the app shell, only.** The card frame and its surface role become `card`, which is the name shadcn already uses (section 8).
7. **The premise check holds.** Swapping Mantine fixes 13 of 234 argo friction rows (consumer-argo). Everything cut here is cut to make room for the other 94%: the seams, table breadth, draft and freshness primitives consumers rebuilt by hand. Bytes are not a reason for the move and this document claims no byte win from it (gap-perf).

## 1. The four cut tests

An export ships in 3.0 only if it passes one of the first two, and all of the last two.

| #   | Test                                                                                                           | Source                                           |
| --- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 1   | Brief names it as a differentiator or a need                                                                   | BRIEF                                            |
| 2   | 3+ hand-rolled copies in the fleet (count copies, not imports: "no consumer" deletions were wrong three times) | digest section 3 lessons, row 29                 |
| 3   | No library or platform does it within a 20-line recipe                                                         | gap-perf 5.3 (`chatFor` is 3 lines)              |
| 4   | Guaranteed by a type or a rule, otherwise it is a recipe                                                       | self-process-lessons (growth outran enforcement) |

A budget raise needs a named consumer outside the dominant app (self-process-lessons: 95 of 124 values name argo).

## 2. What 3.0 refuses to ship

| Refused                                                                                              | Today                                   | Why                                                                                                          | What replaces it                                                                                               |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `./agent` runtime                                                                                    | 6,438 lines + 10,440 tests, 0 consumers | Plain `useChat` passes; the one silent failure is fixed by an externally owned `Chat` (gap-perf 5.3)         | `chatFor`/`closeChat`, 4 lines, in `./content`                                                                 |
| Chat UI parts (message, scroller, trace, composer)                                                   | part of `./agent`                       | Test 2 fails: 1 real copy (epos, on assistant-ui)                                                            | Skill reference. Reinstate when a second consumer writes one                                                   |
| `Board`, drag adapter, timeline, Week/Month schedule                                                 | Board 415 lines, 0 consumers            | Reference image is not a consumer (row 17); schedule is argo alone                                           | `KanbanCard` + typed `onMove` + "Move to" menu. Argo keeps a schedule in app code                              |
| `theme-lab`, `VX.*` JS map, `createBasaltTheme`, theme object                                        | 764 + 3,445 lines                       | Dev tool with 0 consumers; Tailwind classes own the mapping; charts keep a closed internal name union        | `--vx-*` vars, `tailwind.css`                                                                                  |
| Runtime derive / tenant `emitCss` export                                                             | `./tokens`                              | No consumer needs runtime tenants (gap-token section 8)                                                      | `basalt-ui tokens:css --accent`, build-time                                                                    |
| Consumer byte tooling `budget` verb                                                                  | proposed                                | Test 2 fails: weatherorb alone                                                                               | Framework gates its own fixtures; route budgets stay a weatherorb script                                       |
| `shot`, `docs` CLI verbs                                                                             | CLI                                     | `shot` scored 100 on boards with 17-19 defects (self-agent-layer) and is Mantine-bound; `docs` is `cat`      | Repo-internal script on `data-slot`, never a score; `node_modules/basalt-ui/docs/<name>.md` linked from skills |
| `migrate` in the tarball                                                                             | proposed                                | Scaffolding, not product                                                                                     | Unpublished `tools/migrate-v3`, deleted when the fleet is green                                                |
| `./testing`, `./test/a11y`                                                                           | proposed                                | `renderApp` is a recipe; Base UI needs no shims in jsdom (gap-migration); `expectShellInvariants` has 1 copy | `SLOTS` from `./app`; recipe in the skill                                                                      |
| Profiles (`tokens-only`, `charts`, ...)                                                              | proposed                                | Tiers come from what you import; guards keyed to parts already (consumer-linewatch)                          | Rules fire by import provenance                                                                                |
| Form wrapper (`useBasaltForm`)                                                                       | `./forms`                               | 0 of 12 apps depend on `@tanstack/react-form` (F, section 14)                                                | Consumer calls TanStack Form; `FormField` and `useFormDraft` are structurally typed                            |
| Zustand peer, nuqs, cmdk, sonner, streamdown, tailwind-merge, `@tanstack/react-hotkeys`              | various                                 | Hard zeros (gap-perf). Hotkeys is beta with breaking minors (ext-tanstack)                                   | React state + one-paragraph recipe; own 45-line `rank()`; own single-listener matcher in `defineCommands`      |
| Chart kinds Donut, MirroredBars, StackedArea, foldBands, chartCurve; Meter zones; `Tree`             | `./charts`, unconsumed, obsidian alone  | Digest 2.9; test 2 fails                                                                                     | Compose `CartesianChart`; Meter stays plain; obsidian rebuilds its Tree on Base UI in app code                 |
| Three-way merge on managed files, `.basalt/base/` for every primitive, per-file format normalisation | proposed                                | Only ejected files diverge (section 6)                                                                       | Base copy for ejected files only; no hash on owned files                                                       |
| Regex guard, grace ladder, `audit-allows`, warn level                                                | 2,848 lines                             | gap-guardrail                                                                                                | Native directives + reason rule                                                                                |
| WebSocket client, `streamedQuery` wrapper, TanStack DB, BroadcastChannel sync                        | proposed                                | Not in 3.0 (ext-realtime); `eventStream` seam lets a WS adapter stay in app code                             | Recipe                                                                                                         |
| Headless hooks as public API                                                                         | proposed `useShell` etc                 | Only renderers-in-plural need them (section 9)                                                               | Internal `core` files                                                                                          |

Reinstatement is cheap by design: every refused item is additive, none changes a shipped signature.

## 3. Layering and dependency direction

| Layer         | Contents                                                                            | May import                                                | Must not import                           |
| ------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------- |
| L0 data       | `tokens/` table, HCT derive, `emit` (build and CLI only)                            | nothing runtime                                           | React, Base UI, Tailwind                  |
| L1 css        | generated `tokens.css`, `tailwind.css`, `prose.css`                                 | L0 output                                                 | any JS                                    |
| L2 core       | root entry: provider, `cn`, format, messages, `persisted`, scheme, `notify`, drafts | React                                                     | Base UI, TanStack                         |
| L3 ui         | primitives and leaf composites                                                      | L2, `@base-ui/react`, sibling `ui/*` by package specifier | L4                                        |
| L4 composites | `app/`, `query/`, `table/`, `charts/`, `content/`                                   | L2, L3, own peer                                          | each other, except `app` -> `query` types |
| L5 tooling    | `cli/`, `lint/`, `vite.ts`, `agent/`                                                | L0                                                        | L2-L4 at runtime                          |

- L4 modules never import sideways. Cross-wiring happens in consumer code or through a one-prop port: `DataTable detail={...}` renders a Sheet by default, an app passes `PageAside`. This is what makes "take what you want" true.
- `src/charts/**` and `src/tokens/**` stay Base-UI-free (the Mantine-free boundary, retargeted). `src/charts/host.tsx` stays the only engine importer.
- Everything is enforced by `import-boundary` and the existing dist-layering check. Layer violations are errors, never waivers.
- The `ui` import rule is the seam: composites import `basalt-ui/ui/button`, never relative. Nothing else changes when a consumer ejects (section 6).

## 4. Repo and package layout

One published package, no scoped split.

```
packages/basalt-ui/
  src/tokens/            table derive hct emit                                       L0
  src/css/               generated: tokens tailwind prose                            L1
  src/                   index provider cn format messages persisted scheme notify draft  L2
  src/ui/                button field select ... stat-card kanban-card               L3
  src/{app,query,table,charts,content}/   app = shell nav commands url controls      L4
  src/{cli,lint}/ vite.ts                                                            L5
  agent/  rules skills reviewer templates      docs/  generated .md per part, llms.txt
apps/playground/  8 routes, exemplar + visual oracle      apps/marketing/  frozen (DPO 19)
tools/migrate-v3/ unpublished, deleted at fleet green
```

Tarball ships `dist`, `src/ui` (the eject source, also what an agent reads), `docs`, `agent`. Build: tsdown unbundled (ext-toolchain). `ui/*` uses tsc declarations (`dts:{oxc:false}`) because `isolatedDeclarations` rejects cva exports and `Select = Primitive.Root` (gap-dist, F, TS9010); composites and logic keep isolated declarations.

## 5. Published entries

Peer rule (F census, section 14): 8 consumer apps carry Router + Query; image-gateway and shutterflow's gallery carry Query alone; rollhook neither; `@tanstack/charts` 4; `@tanstack/react-table` 3; `@tanstack/react-form` 0. So Router and Query split, Table and Charts split, Form gets no entry.

| Entry                    | Purpose                                                                                                                                                                                             | Peers beyond react                                 | Key exports (≤) | Ceiling                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | --------------- | ------------------------------------------------------------- |
| `basalt-ui`              | Provider, `cn`, `useFormat`/`createFormat`, typed messages, `persisted`, scheme switch, `notify`, `useFormDraft`                                                                                    | none                                               | 10              | provider JS **5.0 KB**                                        |
| `basalt-ui/ui/*`         | 24 primitives + 8 leaf composites, one module each                                                                                                                                                  | `@base-ui/react`                                   | 32 modules      | ten-primitive page 95, 25-part page 118 KB                    |
| `basalt-ui/app`          | Router-bound app wiring: `Shell`, `defineNav`, page slots, `PageAside`, `SplitPage`, `CommandPalette`, `defineCommands`, `createSearchStore`, `defineControls`, `field.*`, `FilterSpec`, `ViewTabs` | `@tanstack/react-router`                           | 38              | shell-only fixture seeded at first build, `sideEffects:false` |
| `basalt-ui/query`        | Query layer + freshness: `makeQueryClient`, `QueryState`, `unwrap`, optimistic helper, `liveQuery`, `createChannel`, `useConnection`, `useFreshness`, `createSyncedState`                           | `@tanstack/react-query`                            | 12              | seed at first build                                           |
| `basalt-ui/table`        | `DataTable`, `col.*`, `TableState`, `VirtualList`                                                                                                                                                   | `@tanstack/react-table`, `@tanstack/react-virtual` | 6               | 24.5 / 35.5 KB (13 features / + virtual)                      |
| `basalt-ui/charts`       | `CartesianChart`, kinds, `Sparkline`, `MiniBars`, `ChartCard`, cursor group                                                                                                                         | `@tanstack/charts`                                 | 14              | engine floor + ≤4 KB each                                     |
| `basalt-ui/content`      | `Markdown`, `Prose`, `Callout`, `CodeBlock`, `defineBlock`/`defineCatalog`, `chatFor`/`closeChat`, `partView`                                                                                       | react-markdown, remend                             | 8               | 60 KB lazy                                                    |
| `basalt-ui/tokens.css`   | Zero-JS, zero-Tailwind token emit. Static sites (jkrumm.com, weatherorb landing)                                                                                                                    | none                                               |                 | 0 JS                                                          |
| `basalt-ui/tailwind.css` | `@theme` bridge + base layer; own `@source`                                                                                                                                                         | tailwindcss                                        |                 | section 7                                                     |
| `basalt-ui/prose.css`    | `.vx-prose` with `:where()`                                                                                                                                                                         | none                                               |                 | 0 JS                                                          |
| `basalt-ui/vite`         | `basalt()`: head, manifest, ejected aliases                                                                                                                                                         | vite                                               | 1               | build-time                                                    |
| `basalt-ui/lint/*`       | oxlint preset + plugin, stylelint preset                                                                                                                                                            | oxlint, @shadcn/lint, stylelint                    |                 | build-time                                                    |

Why `./app` is one door: the three things it merges (shell, nav and commands, URL and controls) share a peer and are adopted together, and a shell-less app imports only `defineControls` and pays only for that under `sideEffects:false`. Internal folders keep their own layout-suite and bundle fixtures. Why `./query` is separate despite 1.29's C1 removal: two real apps have Query without Router, and the 1.29 reasoning had no peer rule.

`./ai`, `./live`, `./forms`, `./state`, `./tokens`, `./format`, `./commands`, `./controls-dates` do not exist. State homes follow their peer: URL in `./app`, device and draft in root, server and synced in `./query`, component and memory are React. Memory-global state is a recipe (DPO 13); teach it through the where-does-state-live table, not through a store API.
Optional peers are reachable only through their entry. Importing `basalt-ui/query` is the declaration; no peer is secretly needed by a barrel or a CSS file (the frozen-install failure, memory and self-process-lessons).

## 6. Distribution

**Confirmed from gap-dist:** logic, composites, lint, skills in npm; primitives ownable in source; a ledger; three-way merge via `git merge-file --diff3`; provenance-keyed lint from a manifest; pure registry fails (F: `--overwrite` destroyed 4/4 edits, stale copies indistinguishable).

**Refuted: copying every primitive by default.** Reasons:

| Point                                                                                                                                                                                                                                                                            | Evidence                                                    | Consequence                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------- |
| D was measured and matched C on bytes (≤0.1%), SSR, and fleet results for un-ejected apps                                                                                                                                                                                        | gap-dist 5, D rows in 4                                     | Digest row 1's "only measured option" is wrong                                  |
| C's three wins over D are J: "own and bend", agent readability, and the TS/Vite split                                                                                                                                                                                            | gap-dist 5                                                  | The split is fixed by writing tsconfig `paths` on eject (F, gap-dist 3.1 D row) |
| "Own the implementations" means owning them instead of Mantine; that happens in `src/ui`. Consumer bending is one command away                                                                                                                                                   | BRIEF, J                                                    | Bend stays possible, never silent                                               |
| C's managed policy already forbids unejected edits (`doctor` exit 1 on `drifted`), so in-place source edit is not actually available in C either                                                                                                                                 | gap-dist 2                                                  | C has no ownership D lacks                                                      |
| The three-way merge in C only ran on edits its own `doctor` rejects                                                                                                                                                                                                              | gap-dist 2 vs 3.1                                           | The merge belongs to ejected files                                              |
| C costs per-repo: 24+ files x 12 repos, churn on every primitive tweak, format-then-hash (F: one `oxfmt` run marks drifted), lint Zone V, mandatory alias + `tsconfig` + `ssr.noExternal` (F: `ERR_MODULE_NOT_FOUND` without it), guard files in copies, Vite-only (U elsewhere) | gap-dist 1-3, 6                                             | D needs none of this until a file is ejected                                    |
| Fleet churn is the recorded pain: 29 minors in 25 days, rollhook about 14 re-emit-only bumps, linewatch about 36 bumps                                                                                                                                                           | self-process-lessons, consumer-rollhook, consumer-linewatch | npm absorbs it as one version bump (F: 0.43 s, 12/12, 0 human)                  |

**What D costs and how it is paid:**

| Cost                                                     | Evidence                                                                                     | Answer                                                                                                                      |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Tailwind scans the whole `dist` so unused parts emit CSS | F: dir-granular `@source`; proxy measure +7.4 KB gz for a 39-file primitive dir (section 14) | `init` writes `@source not` for layers the app does not import (gap-dist F: restores byte size); ceiling 12 KB gz full-scan |
| Source lives in `node_modules`; ripgrep ignores it       | J                                                                                            | Generated `docs/<name>.md`; AGENTS block names `src/ui/<name>.tsx`; `.d.ts` is full                                         |
| Stock agent output imports `@/components/ui/button`      | J (shadcn default)                                                                           | `import-boundary` autofixes to `basalt-ui/ui/button` unless ejected                                                         |
| Declarations for `ui/*` need tsc                         | F                                                                                            | One build line                                                                                                              |

**Reversibility (the real answer):** `eject --all` produces shape C from D in one command per app; C to D is delete + one regex (gap-dist 5). Choose the shape that costs least until a pilot proves otherwise. Risk 1 is the falsifier.

### What eject means

```bash
basalt-ui eject button        # or: eject --all (shape C)
# writes src/components/ui/button.tsx from node_modules/basalt-ui/src/ui/button.tsx
#        header: // basalt:ejected button@3.4.1
# writes .basalt/base/button.tsx  (as-installed, the three-way base; one per ejected file)
# adds   manifest.ejected.button = { path, version }
# adds   tsconfig paths "basalt-ui/ui/button" -> src/components/ui/button.tsx
```

| Property   | Rule                                                                                                                                                                                                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ejectable  | Primitives only. Leaf composites (`StatCard`, `KanbanCard`...) and L4 are not: their types are the guarantee. To replace one, write your own in `src/components/` on `ui/*`, fully linted                                                                                     |
| Resolution | `basalt()` reads the manifest and aliases `basalt-ui/ui/<name>` to the local file. npm composites follow it (gap-dist F: bent `icon-sm` reached StatCard; alias holds in Vite and SSR)                                                                                        |
| Lint       | Token rules stay ON inside (`no-raw-colors`, `no-arbitrary-values`, `tw-off-law`); `no-restyle` is off in the file, still on at call sites using the ejected file's own variants. **Eject transfers structure, never tokens.** This is what keeps take-what-you-want one look |
| Upgrades   | `sync` three-way-merges upstream into ejected files, `--diff3`, exit 1 on conflict; `sync --check` is the fleet gate (F). No hash, no normalisation                                                                                                                           |
| Visibility | `doctor` lists ejected files and versions behind. Never an error, always printed                                                                                                                                                                                              |
| Undo       | Delete the file, run `sync`: stale manifest and paths entries are removed                                                                                                                                                                                                     |

CLI is five verbs: `init`, `sync`, `doctor`, `eject`, `tokens:css`. Doctor covers install drift (email-gateway), multi-app roots (argo), non-file routes (rb). Unknown flag exits 1; skipped is not passed. `add` does not exist because npm already has the part. Agent-layer files keep today's managed ledger unchanged. **Public `@basalt` registry: not at 3.0 (DPO 4).**

## 7. Token-to-Tailwind contract

gap-token section 9 is the contract, with the renames from section 8. Generated by `emit`; never authored. One table, one emitter, three files.

| Decision      | Value                                                                                                                                                                                                                                                   | Source                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Spacing       | `--spacing:.25rem` fixed. Density = `--vx-ctl-h`, `--vx-row-h` (28/32/40, 32/40/48) via `h-ctl`, `min-h-row`                                                                                                                                            | gap-token 1, row 9        |
| Theme resets  | All `*: initial` in the first `@theme` block, before definitions (F: reversed order wiped radii and rings)                                                                                                                                              | gap-token 2               |
| Colours       | `@theme inline` so descendants and tenants re-point; scalars non-inline                                                                                                                                                                                 | gap-token 8, 9            |
| Breakpoints   | `--breakpoint-*: initial`, `md=840`, `xl=1200`. Conditional on the `no-unknown-classes` spike                                                                                                                                                           | row 10                    |
| Containers    | Extended, not reset: `compact 240`, `regular 480`, `wide 800`                                                                                                                                                                                           | gap-token 2               |
| Type          | 7 rungs, `text-sm` = 13/20; coarse-only input floor                                                                                                                                                                                                     | gap-token 3, row 27       |
| Names         | shadcn aliases in the bridge so stock class vocabulary lands correctly: `primary` = ink inverted, `accent` = hover surface (never blue), new `brand`/`brand-fill`/`on-brand`, `good`/`warn`/`bad` + `-tint`, `inset`, `selected`, `faint`, `chart-1..5` | gap-token 7, DPO 5        |
| Emitted names | ≤70 `--vx-*` (220 today). Consumers use 35-38 (console, rollhook)                                                                                                                                                                                       | self-tokens-theme, digest |
| Tenancy       | Build-time `tokens:css --accent --neutral --vibrancy --scope`; emitter refuses a failing contrast gate                                                                                                                                                  | gap-token 8               |
| Version       | Provenance header carries contract version + `valueShifts`; `doctor` reads it                                                                                                                                                                           | consumer-rollhook         |

Static-site line: `tokens.css` is the entire product for jkrumm.com and the rollhook G0. No React, no Tailwind required (gap-token, consumer-jkrumm-com). Rollhook's existing `--vx-*` bridge keeps working only because `--vx-*` keeps its prefix; the rename from `--vx-shell` to `--vx-card` needs one MIGRATING row.

## 8. Naming

**Resolved: `Shell` is the application frame and nothing else** (row 20).

| Thing                | Old or contested             | v3                                                                                                                                                                                      |
| -------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App frame            | `BasaltShell`, `AppShell`    | `Shell`, `data-slot="shell-*"`, vars `--shell-*`                                                                                                                                        |
| Card frame component | "shell" (ext-visual)         | `Card`, parts `CardBand`, `CardInset`, `IconTile`                                                                                                                                       |
| Card surface role    | `shell` (gap-token)          | `card`: `--vx-card`, `bg-card` (shadcn already calls this `card`, so the bridge gains an identity, not a mapping). `shadow-shell` -> `shadow-card`, `--radius-shell` -> `--radius-card` |
| Surface roles        | canvas, inset, shell, raised | canvas, inset, **card**, raised                                                                                                                                                         |

Rules for the rest: no `Basalt` prefix except `BasaltProvider` (`BasaltDataTable` -> `DataTable`); `accent` is never the blue in code, docs or skills (`brand` is); `defineX` factories for data declarations (`defineNav`, `defineControls`, `defineCommands`, `defineBlock`), `createX` only where a live store is returned (`createSearchStore`, `createSyncedState`, `createChannel`); `useX` hooks. Field vocabulary, handle, `{v,value}` envelope and URL codec stay frozen; factories rename by codemod (row 13). Files kebab-case, components PascalCase, named exports only.

## 9. Composition model

| Tier           | Mechanics                                                                                                                                                                          | Bend surface                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Primitive      | One file. Base UI wrapper, `render` prop (never `asChild`), `data-slot` on every part, cva variants closed by type, sizes via `h-ctl`, `pointer-coarse:` hit area in the primitive | `className` layout only (`no-restyle` contract denies `h-*`/`w-*`), new variant via eject |
| Leaf composite | Fixed anatomy in `ui/`. Props are typed data, tuples for count budgets, one ReactNode slot only where content is genuinely open                                                    | Slot, `state`, no class passthrough                                                       |
| L4 composite   | Data-first API with a thin styled surface over an internal `core`                                                                                                                  | Typed slots, ports                                                                        |

Three things are deliberately absent: `classNames`/`styles` per-part APIs (Mantine's override channel, which produced the `!important`s in obsidian), a public `unstyled` mode, and a parallel headless API. Headless logic exists only where there are several renderers: table (row, card), controls (pill, row, card), charts (engine, kinds). It lives in `core/`, is tested through the public component, and is not exported until a second consumer needs it (test 2).

`data-slot` is a public contract and the only sanctioned CSS and e2e hook (`SLOTS` constant, rendered-DOM snapshot, gap-migration); class names are private. It replaces shutterflow's 26 Mantine-keyed e2e files and obsidian's `.mantine-AppShell-header` selectors. `app-css-targets-shell-internals` folds into `import-boundary`'s CSS lane.

```tsx
// ui/button.tsx: primitive, ejectable
const buttonVariants = cva('inline-flex items-center gap-1.5 rounded-ctrl text-sm h-ctl pointer-coarse:min-h-11', {
  variants: { variant: { primary: 'bg-primary text-primary-foreground', secondary: 'bg-secondary shadow-ring', ghost: '' }, size: { ctl: '', icon: 'size-ctl' } },
  defaultVariants: { variant: 'secondary', size: 'ctl' } })
export const Button = ({ variant, size, className, ...p }: ButtonProps) =>
  <BaseButton data-slot="button" className={cn(buttonVariants({ variant, size }), className)} {...p} />
<Button render={<Link to="/settings" />} variant="ghost">Settings</Button>

// ui/stat-card.tsx: leaf composite, not ejectable, no charts dependency (the chart is a slot)
<StatCard icon={Rocket} title="Shipped" subtitle="this week vs last" value={388}
  delta={{ value: 378, polarity: 'up-good' }} /* required: unknown never reads as good */ sub="vs 10 last week"
  chart={<Sparkline values={v} ariaLabel="Shipped per day" />} xLabels={['Mon', 'Today', 'Sun']}
  footer={[{ label: 'Merged', value: 41 }, { label: 'Open', value: 7 }]} state={query.status} href="/shipped" />

// app: data, not children. data-slot: shell-header shell-main shell-aside shell-nav shell-tabbar
const nav = defineNav([{ id: 'main', items: [{ to: '/runs', label: 'Runs', icon: Play, mobile: 'tab', badge: { dot: true, tone: 'warn' } }] }])
<Shell nav={nav} chrome="web"><Outlet /></Shell>
const filters = defineControls({ id: 'runs', scope: 'page', fields: { status: field.enum(STATUSES, { default: 'all' }), q: field.string({ default: '' }) } })
<PageBar filters={[{ handle: filters.status, label: 'Status' }]} />                // renders pill or row by home

<DataTable mode={{ type: 'client' }} data={rows} getRowId={r => r.id} state={table} phone="cards" detail={r => <RunDetail id={r.id} />}
  columns={[col.entity('name', { priority: 1 }), col.money('mrr', { priority: 2 }), col.status('status', { tones })]} />

useQuery(liveQuery(runsOptions, { pushed: { fallback: '60s' } }))                  // closed freshness classes
const chat = chatFor(threadId, { transport })                                      // useChat({ chat }); bare useChat() is a lint error
const catalog = defineCatalog([defineBlock({ name: 'metric', description, props: Schema, limits, render, sample })])
catalog.prompt(); catalog.jsonSchema(); catalog.validate(json); <catalog.BlockRenderer blocks={blocks} />
```

Forms need no wrapper. `FormField` and `useFormDraft` take a structural type, so TanStack Form stays the consumer's dependency and a TanStack Form 2 change cannot break 3.0's peer range:

```ts
type FieldLike<T> = {
  state: { value: T; meta: { errors: unknown[] } }
  handleChange(v: T): void
  handleBlur(): void
}
useFormDraft(form, { key: 'run-edit', version: 1, schema }) // restore via form.reset(draft, { keepDefaultValues: true })
```

## 10. Framework or consumer

| Area                   | Framework                                                                                        | Consumer                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Tokens, type, spacing  | Everything, generated                                                                            | Accent seed, neutral preset, density default                |
| Primitives             | 24 parts                                                                                         | Fork by eject; new variants there                           |
| Shell, nav             | Grid, scrollport, safe area, aside claims, mobile projection, skip link, landmarks, print unclip | Nav items, strip content, masthead, brand                   |
| Router, data loading   | Search stores, default lifecycle in the skill                                                    | Route tree, auth, loaders, cache numbers                    |
| Controls               | Scopes, `FieldHandle`, three homes, dirty dot, FilterSpec                                        | Vocabulary, defaults, backend mapping                       |
| Forms                  | `FormField`, draft, field error envelope                                                         | Form library instance, schema, copy                         |
| State, realtime        | URL, device, synced, draft, freshness classes, `createChannel`, connection state                 | Keys, transports, conflict policy, frame schema, WS adapter |
| Table                  | Engine, kinds, phone projection, views, selection, keyboard                                      | Columns, custom kinds, bulk actions, export                 |
| Charts                 | Host, kinds, sparkline, tooltip, cursor                                                          | Series colours, units, domains                              |
| Cards                  | StatCard, Section, Meter, KanbanCard anatomy                                                     | Icon, metric, link, chart slot, drag engine                 |
| AI, MDX, notifications | `chatFor`, Markdown pipeline, catalog, trust tiers, `notify` registry and inbox                  | Transport, persistence, thread UI, channels, copy           |
| Desktop                | `chrome`, drag-region slot, lead/trail inset vars                                                | Host code, window state                                     |
| Guardrails             | Preset, messages, doctor                                                                         | `DESIGN.md`, reasoned waivers                               |

## 11. Guardrails at the same slim standard

gap-guardrail's 15 + 1 ids, cut further by merging rules with one mechanism: **13 shipped ids + 1 repo-local + reserved `compound-structure`**. Row 4's "the panel must cut, not add" holds; ceiling 18 stays (DPO 15).

| Id                                                                                                                                       | Absorbs                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `import-boundary`                                                                                                                        | chart engine, `cmdk`, `@radix-ui/*`, `streamdown`, `rehype-raw`, raw `@base-ui/react` in app code, `@/components/ui/*` when not ejected                      |
| `tw-off-law`                                                                                                                             | `viewport-keyed`, `dark-fork`, `important-modifier`, numeric `@sm:`, off-ladder spacing, `bg-black/40` and white literals (gap-guardrail's bought-rule hole) |
| `colour-literal`, `status-fill-as-text`, `raw-scroll`, `control-home`, `realtime-primitive`, `untrusted-markdown`, `waiver-needs-reason` | as listed; `colour-literal` takes `fixed-colour`                                                                                                             |
| `primitive-bypass`                                                                                                                       | `hand-rolled-table` (6 of 10 repos, row 4)                                                                                                                   |
| `router-search`                                                                                                                          | `route-view-transition` as a second message                                                                                                                  |
| `agent-chat-owned`, `no-raw-intl`                                                                                                        | silent truncation (gap-perf); 5 of 7 apps pin locale (row 4)                                                                                                 |

Bought: 6 `@shadcn/lint` rules with basalt-authored contracts and messages (`no-restyle` denies `h-*`, `w-*`, `min-h-*`, `size-*`), 5 stylelint core rules. Everything else in row 4's 31 names becomes a type (`polarity` required, tuples, closed tones, `getRowId` required with selection) or is dropped. Agent layer: 5 rules, 2 skills, reviewer, as the digest sets (row 24).

## 12. Budgets (checked by `check-budgets` in `pre`, a raise needs a consumer outside argo)

| Budget                             | Today                               | 3.0                                                                                                                                |
| ---------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Published entries                  | 15                                  | 12                                                                                                                                 |
| Value symbols excl. `ui/*`         | 124                                 | ≤90                                                                                                                                |
| `ui/*` modules                     | n/a                                 | 24 primitives + 8 leaf                                                                                                             |
| Required peers                     | 36 total                            | 4: react, react-dom, `@base-ui/react`, tailwindcss                                                                                 |
| Runtime deps                       |                                     | clsx, cva, eventsource-parser, fonts (row 28)                                                                                      |
| Source lines, non-test (F today)   | 79,024                              | ≤26,600: tokens 1,300; root 1,200; ui 3,000; app 6,000; query 1,400; table 2,500; charts 6,000; content 1,800; CLI 2,500; lint 900 |
| CLI, authored lint                 | 8,852, ~7,700 lines                 | 5 verbs ≤2,500, ≤900                                                                                                               |
| Emitted `--vx-*` names             | 220                                 | ≤70                                                                                                                                |
| Provider JS                        | 20.5 KB                             | ≤5.0 KB; toaster and overlay host mount in `Shell` or the app, never the provider (L2 stays Base-UI-free)                          |
| `cn`                               | 8.5 KB (proposed compiled)          | clsx (≈0.3 KB)                                                                                                                     |
| Full-scan CSS fixture (all layers) | n/a                                 | ≤12 KB gz                                                                                                                          |
| Route bars (consumer)              |                                     | argo ≤700 KB JS / ≤50 KB CSS, rb ≤340 / ≤30, weatherorb `/map` ≤704 KiB, 0 JS landing                                              |
| Table runtime                      | 1,972 ms                            | ≤1,300 ms nav-to-paint on the fixture, virtual ≤150 ms                                                                             |
| Playground, rules, skills          | 21k lines; 266 rule lines, 3 skills | 8 routes; 5 rules; 2 skills                                                                                                        |

## 13. Risks and owner decisions taken

### The three biggest risks

| #   | Risk                                                                                                                                                   | Cheap falsifier                                                                                                                                                                                                 | Flip condition                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | npm-default primitives underperform for agents (stock `@/components/ui` output, source out of view) or get ejected en masse, so D pays C's cost anyway | One day: same-bar agent trial, console StatCard page plus one dense table page, D vs `eject --all` (C), identical skill text. Then count ejects in the G1 and G2 pilots (linewatch, rb)                         | Trial score drops 3+ points against C on the same bar, or more than 3 ejects per app in both pilots: make `init` run `eject --all`. One-command per-app change                                     |
| 2   | Slimming repeats the three "no consumer" deletions; refused items regrow                                                                               | Half a day before the surface freeze: hand-rolled-copy census across 12 consumers for every row in section 2 (grep `Board`, schedule, `Tree`, chat parts, testing helpers). Peer census already run, section 14 | Any refused row with 3+ copies is reinstated before freeze. Second consumer re-implementing a refused item after a pilot gets a MIGRATING entry and a re-test                                      |
| 3   | `cn` without merge leaves silent class conflicts (`cn('p-2', x && 'p-4')` in app code, or `className` passed to app-owned composites)                  | Half a day: script over console + epos `cn()` call sites flagging same-group utilities;, then count what `no-restyle` catches on the G1 pilot                                                                   | Real conflicts not catchable by lint exceed a handful: swap `cn.ts` to compiled (single module, 8.5 KB, plus the stale-table gate). Weatherorb then needs its ~10 KB from native inputs (gap-perf) |

Second-order and tracked by others: `no-unknown-classes` proof on dead breakpoints, Base UI Drawer on iOS, table VoiceOver spike, TS 7 extractor, `./app` tree-shaking under native SSR ESM. Each has a digest row.

### Owner decisions, defaulted

| DPO                          | Default taken                                                                                | Alternative                                           |
| ---------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 2 Package identity, doctrine | Same name `basalt-ui`, 3.0 sanctioned, version gate changed on purpose                       | New package name, keeping the gate                    |
| 3 Release                    | R1 (gap-repo), `latest` stays 2.x during `next`, 2.x fix-only reviewed at 120 days           | Different window                                      |
| 4 Distribution               | **Refuted digest tendency**: npm default + eject. Hybrid split confirmed; no public registry | Managed copy of all primitives: `eject --all` at init |
| 5 Eye set                    | Accent B, ink-inverted primary, flush inset, tinted delta badge (tendencies)                 | Owner renders and picks; only the token table changes |
| 6, 7 Density, icons, scheme  | App-fixed density; Lucide; `data-theme`, read legacy scheme key, write new                   | User density control; Tabler; class attribute         |
| 8 Argo                       | Branch rewrite, last gate (G5)                                                               | Route-by-route with the coexistence kit, earlier      |
| 9 Table                      | Phone `cards`, one component, no inline edit, personal views via `ViewStore` port            | Scroll default; parts API                             |
| 10 Board, schedule           | KanbanCard + `onMove` only; drag engine consumer-owned                                       | Bundled drag adapter; own schedule                    |
| 11 Charts                    | Sparkline on the engine if ≤36 KB holds; StatCard has no chart dependency                    | Hand SVG sparkline; `series` prop on StatCard         |
| 12, 13 AI, state             | `chatFor` + catalog, epos first; synced in `./query`; memory a recipe, no Zustand peer       | Ship chat parts now; Zustand optional peer            |
| 14 Controls                  | Widget state in URL (`w.<id>.<field>`), root retain                                          | Saved views instead                                   |
| 15 Guardrails                | Ceiling 18, hook registered by `init`                                                        | Lift ceiling; leave hook to consumer                  |
| 16, 17 Tiers, shell          | Tokens-only by construction (`tokens.css`), no profiles; own rail, localStorage collapse     | Named tiers; shadcn Sidebar                           |
| 18, 19 Scope, marketing      | RTL non-goal, no MCP at 3.0, English chrome with typed hook; marketing frozen, rebuilt late  | German pack; rebuild now                              |

Spec 523 (DPO 1) stays unknown; nothing here depends on its answers except console's role, which only changes the G0 pilot order.

## 14. Measured for this document

| What                         | Result                                                                                                                                                                                                                                                    | How                                          |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Source, entries, peers today | 79,024 non-test lines across `src/*`; 15 export keys; 36 peers                                                                                                                                                                                            | `find`/`wc`, `jq` on `package.json`          |
| Primitive demand             | console imports 10 `ui/` files; epos's `ui` dir 39 files, 2,748 lines                                                                                                                                                                                     | grep and `wc`                                |
| Peer census                  | Router+Query: argo, rb, linewatch, finances, email-gateway, weatherorb, obsidian, shutterflow desktop. Query only: image-gateway, shutterflow gallery. Charts: argo, linewatch, finances, weatherorb. Table: argo, finances, shutterflow desktop. Form: 0 | `jq` over each consumer `package.json`       |
| Unused-primitive CSS proxy   | Theme floor 4.5 KB gz; +console `ui/` 8.2; +epos `ui/` 11.9; both 12.4                                                                                                                                                                                    | Tailwind CLI, `gap-token` theme, stdout only |

Not measured: the 24-part primitive set itself (the proxy is a real but different component set), `./app` fixture bytes, whether `import-boundary` can autofix the specifier rewrite under oxlint JS plugins (alpha, U), and any of the visual decisions: all need the owner's eye (section 5 of the digest).
