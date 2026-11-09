# arch-consumer: Basalt UI v3 architecture through the consumer-fit lens

Panel input, 2026-11-09. Lens: argo (huge, all concepts), shutterflow (Tauri, deep panels), linewatch (no shell, a la carte), jkrumm.com (static, tokens only), factory console (StatCard, live stack). Each must enter at its own depth and land on one look. Tags: **F** measured in the cited report, **J** my judgement, **U** unverified. Slugs as in `DISCOVERY-DIGEST.md`.

## 0. Position

1. **One package, four depths, each strictly additive.** D0 tokens (CSS only), D1 Tailwind bridge + lint, D2 parts without a shell, D3 app with AppShell. Going deeper only adds files.
2. **Distribution: hybrid managed copy confirmed, with six amendments** (section 5). The digest overstates it: C beat A and B by measurement, but C against D (compiled + eject) was decided by judgement (gap-dist section 5 says so). The amendment that matters is one import specifier everywhere, which keeps the fallback to compiled at zero app codemods.
3. **Zero required peers.** gap-dist lists react, base-ui, cva and tailwindcss as peers. Required peers repeat the exact failure that kept consumers out: the console installed 19 MB of Mantine for a CLI (console), rollhook carries Mantine in its lockfile, epos rejected basalt for 12 non-optional peers (epos). npm peers are per package, not per subpath (ext-toolchain), so all are optional, `init` writes the ones the chosen parts need, and `doctor` checks them per part.
4. **Four boundaries coincide:** subpath = `src/` top-level dir = peer class = Tailwind `@source` unit. Tailwind scans whole directories (F, gap-dist 3.4), so this is the only shape where take-what-you-want also pays-for-what-you-take.
5. **Shell-less becomes the base case, not an opt-out.** `Page`, `PageBar`, `PageAside`, `Section`, `DragRegion` live in `./page` and render alone; `./shell` plugs into them. Linewatch never imports a thing with "shell" in its path. And "shell" now means the app shell, only: the card frame is `Card`, the surface role is `card` (section 7).

## 1. Depths and entry points

| Depth     | Adds                                                                                                                          | Install cost                                                         | Consumers                                                |
| --------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------- |
| D0 tokens | `tokens.css`, `typography.css`, `prose.css`, `fonts.css`, theme script, `tokens:css`, stylelint preset. No React, no Tailwind | `basalt-ui` + 3 font packages, 0 peers                               | jkrumm.com, weatherorb `/`, marketing later              |
| D1 bridge | `tailwind.css`, `cn`, oxlint preset, rules, skills                                                                            | + tailwindcss                                                        | rollhook, epos probe                                     |
| D2 parts  | any of the 12 runtime subpaths minus `./shell`, managed primitive closure, `basalt()` plugin                                  | + react, react-dom, @base-ui/react, cva, oxfmt (dev), per-part peers | linewatch, console, weatherorb `/map`, image-gateway     |
| D3 app    | `./shell`: AppShell, nav projection, commands, palette                                                                        | + @tanstack/react-router                                             | argo, rb, shutterflow, obsidian, finances, email-gateway |

| Consumer                                         | Depth, `--parts`                             | Natural entry                                                 | Primitives copied (J) | Not asked of it                                       |
| ------------------------------------------------ | -------------------------------------------- | ------------------------------------------------------------- | --------------------- | ----------------------------------------------------- |
| jkrumm.com                                       | D0                                           | four CSS imports, committed retuned `tokens.css`              | 0                     | React, Tailwind, Vite plugin, provider                |
| rollhook                                         | D1                                           | swap its two `@theme inline` bridges for one import           | 0                     | any JS import                                         |
| console (assumes unread Spec 523 keeps its role) | D2 `cards,charts,data,page`                  | `add --adopt` over its base-nova `ui/`, StatCard, live stack  | ~15                   | AppShell (its own stays until it wants ours)          |
| linewatch                                        | D2 `page,cards,charts,controls,router,table` | `Page` + `PageBar` + `Section` + charts                       | ~12                   | shell, `content`, `shiki`, `forms`                    |
| weatherorb                                       | D2 `charts,page`, D0 on `/`                  | charts seam-free, provider <=5 KB, tokens on landing          | ~6                    | router wrapper, forms, shell (consumer-weatherorb)    |
| shutterflow                                      | D3 + `chrome="native-overlay"`               | AppShell chrome, commands, PageAside inspector, `StorageLike` | ~35                   | canvas renderer, justified grid, undo stack (recipes) |
| argo                                             | D3 all but `ai`                              | full                                                          | ~45                   | nothing; it is the budget's stress test (R1)          |

```css
/* jkrumm.com, D0. Retune: basalt-ui tokens:css --accent <hex> --vibrancy <n> --out src/styles/tokens.css, then --check in CI. Seed sets hue only (gap-token 6): "must not desaturate" is an eye check. */
@import 'basalt-ui/fonts.css';
@import 'basalt-ui/tokens.css';
@import 'basalt-ui/typography.css';
@import 'basalt-ui/prose.css'; /* .vx-prose, all selectors in :where(), so no !important war */
```

```tsx
// console, D2: the signature composite plus the live stack. The card knows nothing about charts.
<StatCard icon={GitMerge} title="Shipped" subtitle="vs last week" value={388}
  delta={{ value: 378, polarity: 'up-good' }} sub="10 the week before"
  chart={<Sparkline series={s} ariaLabel="Shipped per day" />} xLabels={['Mon', 'Thu', 'now']}
  footer={[{ label: 'Open', value: 12 }, { label: 'Merged', value: 4 }]} state="ready" href="/runs" />
const channel = createChannel({ url: '/api/events' }); bindInvalidation(channel, queryClient, frameToRoots)
useQuery(liveQuery(runsQuery(), pushed({ fallback: 30_000 })))
// linewatch, D2: the same PageBar as argo, no shell anywhere. Renders sticky inline when no host exists.
<Page title="Line"><PageBar controls={[rangeFilter, compactToggle]} />
  <Section id="latency" open={open} onOpenChange={setOpen}><Lines ... /></Section></Page>
// shutterflow, D3: chrome is a profile, not a DOM query. One table drives hotkeys, help, palette and toMenuTemplate(commands) for the native menu.
<AppShell chrome="native-overlay" nav={nav} commands={commands} header={{ start, center, end }} />
const commands = defineCommands([{ id: 'photo.reject', chord: 'x', scope: 'viewer', enabled: hasSelection, listed: true, run }])
```

**One look contract.** The look is five atoms, all carried by D0 CSS: surface roles, ink ramp, type ladder, radii, ring + shadow. Each depth adds a layer of the same law: D1 closes the class vocabulary, D2 fixes control and row geometry (`h-ctl`, `min-h-row`), D3 fixes chrome. A static page cannot drift on the five atoms, and a la carte cannot produce a second look without an eject or a lint failure. **Gate:** a `one-look` fixture renders D0, D1, D2, D3 cards in Chrome and asserts computed-style identity on those atoms (colours, radius, font-size, line-height, box-shadow). Taste remains the owner's eye set; this gate proves sameness, not beauty.

## 2. Layering and dependency direction

Imports point down this table only. `check-dist-layering` and `import-boundary` enforce it; both exist today.

| L   | Layer                      | Contains                                                                            | May import                                | Must not                                                    |
| --- | -------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------- |
| 0   | tokens                     | HCT derive, emitter, generated CSS                                                  | nothing                                   | React, Tailwind, DOM                                        |
| 1   | core `.`                   | provider, `cn`, format, scheme, persisted/synced/external state, `FieldHandle` type | react                                     | any other peer, Tailwind classes                            |
| 2   | logic `./router`, `./data` | search stores, nav data, query client, live channel                                 | core + own peer                           | seam, class strings                                         |
| 3   | primitives (copied)        | ~45 Base UI + cva files at the seam                                                 | core (`cn`), `@base-ui/react`, cva, icons | npm composites, each other beyond the declared closure      |
| 4   | composites                 | page, cards, controls, forms, table, charts, content, ai, shell                     | layers below; declared edges only         | L3 except via seam; peers of a sibling part                 |
| 5   | app                        | `src/components/*`, routes                                                          | everything public                         | `@base-ui/react/*`, `dist` internals, framework class names |

Allowed edges inside L4 (J; any other edge is a build failure): `shell -> page, router`; `forms -> controls`; `table -> controls` (shared option shape, digest row 14); `ai -> content`. Everything else is a sibling and stays unaware.

- **Inversion at the shell seam.** `./page` defines a `PageHost` context; `./shell` provides it. `PageBar` and `PageAside` render inline without a host and claim the header strip or aside region with one (gap-controls: data-only slots via `staticData` for SSR, claims for dynamic content). The dependency runs shell to page, never back.
- **`./charts` is seam-free.** Core, kinds, card toolkit and Sparkline use only tokens, core and the engine; `ChartCard`'s menu is a slot. Weatherorb and linewatch get charts with no copied primitive.
- **`./cards` does not import `./charts`.** `chart` is a slot reserving a 56 px box at every `state`. A StatCard without a chart never pays the +31.1 KB floor (gap-perf). DEFAULT-PENDING-OWNER (#11), alt: `series`/`bars` props with a hard edge, shorter call sites, every card pays.
- **Provider is optional for D2 leaves.** Primitives and cards work with no provider (English, UTC); hosts are explicit children (`ToastHost`, `OverlayHost`), so a consumer that never toasts never loads it. This holds the 5 KB line that decides weatherorb's `/map`: 712,535 B with it, 727,000 B with today's 20 KB, against a 704 KiB (720,896 B) bar (gap-perf, J on the sum).

## 3. Repo and package layout

```
packages/basalt-ui/                       # one published package, name `basalt-ui`
  src/tokens/ src/css/                    # derive + emit; tokens.css typography.css prose.css fonts.css tailwind.css theme-script
  src/core/ src/router/ src/data/         # logic
  src/ui/*.tsx src/ui/*.guard.ts          # AUTHORED primitives; never compiled; shipped as seeds; guards are the seam contract
  src/{page,shell,cards,controls,forms,table,charts,content,ai}/   # composites; one dir per subpath
  src/{vite,lint,testing,cli}/            # tooling, never in an app bundle
  agent/{rules,skills,agents,templates}   migrations/<version>.json   # machine rows generate MIGRATING.md
  test/fixtures/{d0,d1,linewatch,console,full}/   # frozen install + SSR + tsc + lint, per profile
apps/playground/  (8 routes: exemplar and visual oracle, gap-repo)     apps/marketing/  (frozen, rebuilt late as docs)
```

Consumer at D2+:

```
src/components/ui/*.tsx      # managed copies; the app never writes this path in an import
src/components/*             # app-owned, free, fully linted
.basalt/manifest.json        # version, parts, per-file {hash, ejected?, reason?}        .basalt/base/**  # as-installed copies, three-way base
.basalt/sources.css          # generated @source list for enabled parts, plus @source not "./base"
tsconfig paths "@basalt/ui/*": ["./src/components/ui/*"]          vite.config plugins: [basalt()]
src/index.css                # @import 'basalt-ui/tailwind.css'; @import '../.basalt/sources.css';
```

`@source not "./base"` is required: committed base copies hold stale class strings that Tailwind's scan would generate rules for. gap-dist saw this class of leak with an un-ignored `dist/` (F for the mechanism, U for `.basalt/base`; the fixture proves it). Build: tsdown 0.23.x unbundled, `sideEffects: ["*.css"]`, source in the tarball, oxc d.ts with `isolatedDeclarations` for L1-L4 (ext-toolchain). Primitives never hit TS9010 because they are not compiled (F, gap-dist).

## 4. Published subpaths

Twelve runtime subpaths, the ceiling self-process-lessons proposed. Reports asked for `live`, `ai/ui`, `test/a11y`, `format`, `commands`, `query`, `state`; those fold as shown, because the budget wins (digest row 24). Tooling and CSS are counted separately since they never reach an app bundle; that changes the budget's unit on purpose.

| Subpath      | Purpose                                                                                                                                     | Peer class                         | Seam    | Value symbols (J) |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------- | ----------------- |
| `.`          | `BasaltProvider`, `cn`, `VX`, `useFormat`, `createFormat`, `setScheme`, `persisted`, `createSyncedState`, `externalField`                   | react                              | no      | 9                 |
| `./router`   | `defineNav`, search-store successors, `defineControls`, loader helpers                                                                      | react-router                       | no      | 8                 |
| `./data`     | `makeQueryClient`, `unwrap`, `liveQuery`, `createChannel`, `bindInvalidation`, `useConnection`, `useFreshness`, `useNow`, optimistic helper | react-query                        | no      | 10                |
| `./page`     | `Page`, `PageBar`, `PageAside`, `Section`, `SplitPage`, `DragRegion`, `QueryState`, `notify`, `ToastHost`, `OverlayHost`                    | react                              | yes     | 10                |
| `./shell`    | `AppShell`, `defineCommands`, `CommandPalette`, `useWindowChrome`, `toMenuTemplate`, `useSizeClass`                                         | react-router                       | yes     | 7                 |
| `./cards`    | `StatCard`, `StatGroup`, `KanbanCard`, `BarList`, `Meter`, `DeltaBadge`, `DataPanel`, `IconTile`, `StatusDot`, `IdChip`, `CardLink`         | react                              | yes     | 11                |
| `./controls` | `FilterSet`, filter kinds, `ViewTabs`, control homes                                                                                        | react                              | yes     | 8                 |
| `./forms`    | `Field`, row grammar, `useBasaltForm`, `useFormDraft`                                                                                       | react-form                         | yes     | 10                |
| `./table`    | `DataTable`, `useDataTable`, `col`, parts, `VirtualList`                                                                                    | react-table, react-virtual         | yes     | 5                 |
| `./charts`   | `CartesianChart`, kinds, `ChartCard`, `Sparkline`, `MiniBars`, series                                                                       | charts, d3-scale                   | no      | 11                |
| `./content`  | `Prose`, `Markdown`, `CodeBlock`, `Toc`, `Callout`                                                                                          | react-markdown, remend, shiki lazy | minimal | 4                 |
| `./ai`       | `chatFor`/`closeChat`, `defineBlock`, `defineCatalog`, chat parts                                                                           | ai, @ai-sdk/react, motion `m`      | yes     | 6                 |

Sum 99 of the 100 ceiling, a starting allocation, unmeasured until the freeze. `Card`, `Inset`, `Badge` and the like are primitives at the seam and cost nothing here. **Barrel rule:** a subpath barrel imports only peers every symbol in it needs. An unresolved optional peer in a barrel is what broke frozen installs in 2.x (self-process-lessons); this is why forms stays apart from controls and `.` has no router.

Tooling: `./vite` (`basalt()`: seam alias, `ssr.noExternal`, manifest-version check, paths check), `./lint` (plugin + presets per part), `./testing` (`renderApp`, `settled`, `SLOTS`, `expectShellInvariants`, `fakeChannel`). `@basalt/ui/*` is a reserved local specifier; `npm view @basalt/ui` returned 404 on 2026-11-09 and nothing should publish there. CSS entries `./tokens.css`, `./typography.css`, `./prose.css`, `./fonts.css`, `./tailwind.css`, `./theme-script` are frozen per major: rollhook's AGENTS.md is a list of CSS entries that died under it.

## 5. Distribution: hybrid managed copy, confirmed with amendments

**Confirm over A (compiled):** className overrides are lossy, `bun patch` is silently dropped (F). **Confirm over B (registry):** `--overwrite` destroyed 4/4 edits and stale copies are undetectable (F); B plus npm logic is C without the ledger. **Against D, honest position:** D matched C on size and fleet (F), and the one measured defect, Vite and `tsc` disagreeing after eject, is a one-line `paths` write. C wins on agent-readable source in the repo and on keeping the seam real from day one, both J. Console and epos already hold copied primitives; linewatch asks for this split (consumer-linewatch 7). I would pick C again, but the claim is "judged best, cheap to reverse", not "measured winner".

A premise to correct: the owner's "own the implementations" is mostly satisfied at the framework level, where basalt authors its own primitives instead of wrapping Mantine. Per-app bending is the rarer need. Managed policy already makes an unejected edit an error, so copies buy readability, a cheap bend path and fleet-visible drift, not free per-app restyling. Unified look and free per-app edits are mutually exclusive; the ledger is how we pick the look.

| #   | Amendment to gap-dist's layout                                                                                                               | Why                                                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **One specifier.** App code imports `@basalt/ui/button`, as do composites. `@/components/ui` is never written                                | Skills and lint name one path (gap-dist: "the skill cannot name `@/components/...`"). Reversal to compiled drops the app codemod to zero: repoint one alias |
| 2   | **No seam type in a public `.d.ts`.** Composite props are self-contained; pack-test asserts zero `@basalt/ui` hits in `dist/**/*.d.ts`       | Without `paths`, a seam reference silently becomes `any` under `skipLibCheck`; npm types must not depend on app state (J, not run)                          |
| 3   | **All peers optional, profile-written, `doctor` per part.** Fonts stay real deps                                                             | Section 0.3. Keep the `required-peers` test and subpath peer classes                                                                                        |
| 4   | **Version gate in `basalt()`.** `buildStart` fails when `manifest.basaltVersion` differs from the installed package, naming `basalt-ui sync` | A `bun add` without `sync` leaves new composites on old primitives, a mismatch no type catches (J)                                                          |
| 5   | **Hash after canonicalising with basalt's pinned oxfmt on both sides.** Not the consumer's formatter, not an ignore rule                     | F: `oxfmt(seed) == oxfmt(copy)`. Format-on-save stops reading as drift, and the CLI needs no formatter detection                                            |
| 6   | **Primitive closure is minimal by design.** Composites take slots over seam imports where the cost is one call site                          | Linewatch-class apps copy ~12 files, not 45; charts copy none                                                                                               |

**Verbs:** `init --parts`, `add <name> [--adopt]`, `sync [--check]`, `doctor`, `eject`, `migrate --from X [--check]`, `budget`, `docs <name>`, `tokens:css`, `shot`. `add --adopt` takes an existing shadcn file as local, the seed as shipped, and merges; it is the console and epos on-ramp.

**What eject means.** DEFAULT-PENDING-OWNER (#4), alt: unbounded eject, listed but not capped.

- `basalt-ui eject button --reason "<why>"` writes `// basalt:eject <why>` in the first three lines and drops the file from the ledger. In place, one-way, per file. The specifier does not change.
- An ejected primitive is app code: class and token rules on. Its `.guard.ts` stays, because the guard is the seam contract: remove a prop a composite needs and `tsc` fails in the guard, not in `dist`.
- `doctor` lists every ejected file and fails above 3 per app. `sync` prints upstream changes for ejected files but never writes.
- Composites do not eject in 3.0. Source ships in the tarball; copy by hand and it is app code. A CLI verb waits for a second consumer asking. Variants are added upstream or by eject, never by an app wrapper with `className` (`no-restyle` denies `h-*`/`w-*`).

## 6. Token-to-Tailwind contract

| Contract          | Decision                                                                                                                                                                                              | Evidence                                |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Source of truth   | Derive config. `tokens.css` is generated, plain `--vx-*`, zero Tailwind or React. Otherwise jkrumm stays on its hand copy                                                                             | consumer-jkrumm-com, gap-token          |
| Scheme            | `:root[data-theme=light\|dark]`. DEFAULT-PENDING-OWNER (#7), alt: class selector                                                                                                                      | console, gap-migration                  |
| Bridge            | `tailwind.css` owns the order: layer statement first, `@import 'tailwindcss'`, tokens, resets, `@theme inline` colours, `@theme` scalars. One import, so resets-first and layer-first cannot be wrong | gap-token 9, gap-migration              |
| Closed vocabulary | `--color-*`, `--shadow-*`, `--radius-*`, `--text-*`, `--breakpoint-*` reset. D0 and private bridges are untouched                                                                                     | gap-token                               |
| Spacing, density  | `--spacing: .25rem` fixed; density moves `--vx-ctl-h`, `--vx-row-h` via `data-density`; `h-ctl`, `min-h-row`, `size-icon`                                                                             | gap-token over ext-dense (digest row 9) |
| Breakpoints       | `md`=840, `xl`=1200; containers 240/480/800. Conditional on `no-unknown-classes` proving dead `sm:`/`lg:` fail                                                                                        | digest rows 3, 10                       |
| Merge             | compiled `cn` from `@theme`; tailwind-merge a hard zero. App-added tokens merge as unknown (both kept), documented                                                                                    | epos, gap-perf                          |
| Authored CSS      | Shell grid and table container tiers in `@layer basalt` (below `components`, utilities win); classes private                                                                                          | gap-migration                           |
| JS access         | `VX` typed map for charts and rare inline; `bg-[var(--vx-x)]` banned                                                                                                                                  | consumer-argo                           |
| Retune, version   | `tokens:css --accent --neutral --vibrancy --out --check`; `emitCss({config, scope})`; emitter refuses failing gates. `--vx-contract: 3`; a value shift without a migration row fails release          | gap-token 8, consumer-rollhook          |

Name map (generated): `background`/`foreground` = canvas/ink; `card` = card; `inset` = inset (new); `popover` = raised; `primary` = ink-inverted (DEFAULT-PENDING-OWNER #5, alt: blue primary, but fill on the dark card fails 3.0 at 2.76:1); `secondary` = raised; `muted-foreground` = ink-muted; `accent` = hover surface only, shadcn's meaning; `border`/`input` = ring; `ring` = brand; new `brand`, `brand-fill`, `on-brand`, `good`/`warn`/`bad` + `-tint`, `selected`, `chip`, `faint`, `dim-bar`, `chart-1..5`. A test asserts `--color-accent` never aliases the blue (gap-token 7).

**Public name budget: <=90 `--vx-*`** (today 220; core 112; console uses 35, rollhook 38). Static sites also get type ladder, rhythm (`section/group/block/row`), motion, chart + sequential ramp as vars (consumer-jkrumm-com 5). Only two classes exist at D0: `.vx-prose`, `.vx-ring`. 2.x to 3.x rename is `migrate --profile tokens`, one sed-class pass per app (jkrumm ~147 sites, 0.5 day, J). No `tokens-v2-compat.css`: every consumer is owned, and a compat layer is the dead weight rollhook complained of.

## 7. Naming

The `Shell` collision resolves by giving the word to the concept with the most consumers and the widest API. This closes digest row 20 before the token map freezes.

| Concept           | v3 name                                                       | Was                                | Note                                                                 |
| ----------------- | ------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------- |
| Application frame | `AppShell`, `./shell`, `--shell-*`, `data-slot="shell-*"`     | `BasaltShell`                      | adopts shadcn's vocabulary; one site per app, codemod trivial        |
| Card frame        | `Card`, parts `CardBand`, `Inset`                             | ext-visual "Shell"                 | shadcn's word; our managed `card.tsx` is that concept                |
| Surface role      | `card`: `--vx-card`, `bg-card`, `rounded-card`, `shadow-card` | gap-token `shell`                  | roles `canvas`, `card`, `inset`, `raised`. `bg-shell` does not exist |
| No shell          | "page kit", `./page`                                          | "shell-less", `basalt.shell:false` | the flag dies; absence of `./shell` is the state                     |
| Window frame      | `chrome`, `--chrome-lead-inset`                               | `--basalt-shell-lead-inset`        | only ever means the native window                                    |
| Brand blue        | `brand`                                                       | `accent`                           | retire `accent` for blue in rules, skills, docs                      |

## 8. Composition model

Bending ladder, in order. Skills teach it; a lint message names the next rung: **props and variants → parts → slot or `render` → eject (primitive) → copy source (composite).**

**Primitive.** Base UI part + cva + tokens, `data-slot` on every rendered part, polymorphism only via Base UI's `render`, never `asChild`.

```tsx
// src/components/ui/button.tsx, managed. Density and touch live here, once.
const button = cva(
  'inline-flex items-center gap-2 h-ctl rounded-ctrl text-sm pointer-coarse:min-h-11 ...',
  {
    variants: { variant: { primary: '...', secondary: '...', ghost: '...' } },
    defaultVariants: { variant: 'secondary' },
  },
)
export function Button({ variant, className, ...p }: ButtonProps): ReactElement {
  return <Base data-slot="button" className={cn(button({ variant }), className)} {...p} />
}
```

**Composite: headless core, styled parts, default assembly.** The default assembly's source is a readable exemplar for agents (<=80 lines). A missing prop no longer means blocked: drop one rung to the parts. That addresses bucket A (40 rows) directly.

| Domain   | Headless (no class strings, unit-tested)               | Styled parts                                                       | Default assembly   |
| -------- | ------------------------------------------------------ | ------------------------------------------------------------------ | ------------------ |
| Table    | `useDataTable`, `col.*`, view store, tiers             | `TableToolbar`, `TableBody`, `TableCards`, `TablePager`, `BulkBar` | `DataTable`        |
| Charts   | compiler, `CartesianChart` host                        | marks, tooltip rows, legend                                        | kinds, `ChartCard` |
| Shell    | `defineNav`, `projectMobileNav`, slot claims, commands | `Sidebar`, `TabBar`, `Header`                                      | `AppShell`         |
| Controls | `FieldHandle`, `FilterSpec`, census                    | pill, row, card renderers by home                                  | `FilterSet`        |

```tsx
const table = useDataTable({
  mode: { kind: 'server', rowCount: q.data.total }, // discriminated: client | server {rowCount xor cursor}
  getRowId: (r) => r.id, // required with selection or server
  columns: [
    col.entity('name', { priority: 1 }),
    col.money('amount', { priority: 1 }),
    col.status('state', { priority: 2 }),
  ],
  state: tableField, // FieldHandle<TableState>: URL, device or memory, the table does not care
  phone: 'cards', // DEFAULT-PENDING-OWNER #9, card derived from kinds; alt 'scroll'
})
return <DataTable table={table} /> // or <TableToolbar table={table} /><TableBody table={table} /> for a bespoke layout
```

**Slots and variants.** Default to typed data: `actions` is a tuple of at most 5 with one primary, `footer` a 2-tuple, `tone` a closed union. A `ReactNode` slot is allowed only where the composite owns the box: StatCard `chart` (56 px, all states), table `detail`, `Section` body. Type limits survive because composites stay in npm (F, gap-dist 3.2). Variants are closed unions. Responsiveness: CSS container tiers for layout, `useSizeClass` for chrome only, never JS layout twins; `renderCard` replaces, never adds (digest row 8).

**`data-slot` is the public DOM API**, classes are private. One kebab-case name per part, frozen per major, exported as typed `SLOTS` from `./testing`, snapshot-gated. It replaces shutterflow's 26 e2e files on Mantine selectors, obsidian's `.mantine-AppShell-header` selectors, and `shot`'s Mantine coupling. App CSS may target `[data-slot]` only for placement; `app-css-targets-shell-internals` covers the rest. Cross-file slot contracts (`in-data-[slot=button-group]`) exist only inside `ui/` and the closure declares them, because partial copies otherwise break silently (ext-shadcn).

## 9. Framework versus consumer

| Area        | Framework                                                                                                                                     | Consumer                                                                                                  |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Look        | tokens, primitive geometry, composite anatomy, card and state heights                                                                         | accent seed, neutral preset, density, fonts, series colours                                               |
| Chrome      | AppShell, mobile projection, safe area, scrollport, skip link, print unclip, `chrome` profile                                                 | nav items, strip content, Tauri/Electron host, traffic-light value, window state                          |
| State, data | query defaults, retry law, `unwrap`, freshness classes, live channel, URL codec and scopes, envelope, `StorageLike`, synced state, draft hook | keys, cadence numbers, frame schema, auth, param names, transport, conflict policy                        |
| Controls    | homes, renderers by home, dirty derived, reset                                                                                                | vocabulary, operators, backend serialisation                                                              |
| Table       | engine, kinds, tiers, phone cards, views port, keyboard, a11y                                                                                 | columns, custom kinds (must declare `sortValue`, `exportValue`, `card`, `priority`), bulk actions, export |
| Charts      | engine host, kinds, card toolkit, tooltip law, `summary`                                                                                      | data shaping, units, domains                                                                              |
| Commands    | scopes, enabled vs listed, conflict merge, palette, menu export                                                                               | key map, native menu host                                                                                 |
| Desktop     | host contract, `DragRegion`, insets, `StorageLike` seam                                                                                       | canvas renderer, GPU store, justified grid, undo (recipes until a second consumer)                        |
| AI          | owned `Chat`, block catalog, trust tiers                                                                                                      | transport, persistence, thread list                                                                       |
| Static      | CSS entries, prose, tokens CLI, stylelint                                                                                                     | layout, paper system, motion, MDX component map                                                           |

Rule from linewatch: a shipped rule a consumer cannot satisfy with shipped parts is a framework bug. `./lint` presets are generated per part set; each `test/fixtures/*` lints clean, so a shell-only exemption cannot reappear as a requirement on D2.

## 10. Budgets

Enforced by `check-budgets`; a raise needs a named consumer outside the dominant app (self-process-lessons: 95 of 124 values name argo). Byte ceilings measure the delta against an in-gate `base0`.

| Budget                                      | Ceiling                                                                                                                               | Baseline, source                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Runtime subpaths / value symbols            | 12 / 100                                                                                                                              | 13 / 124 (2.29.0)                                                                                      |
| Managed primitives / ejects per app         | 45 files / 3                                                                                                                          | digest says 40-60; the census at G1 may cut more                                                       |
| Public `--vx-*`                             | 90                                                                                                                                    | 220                                                                                                    |
| Largest authored component file             | 500 lines                                                                                                                             | `BasaltDataTable` 2,232                                                                                |
| Rules / skills / oxlint ids                 | 5 / 2 / 18                                                                                                                            | digest 2.13-2.14 (DEFAULT-PENDING-OWNER #15, alt: lift the ceiling for the top three ranked by defect) |
| D0 install, unpacked tarball                | 0 peers, 4 packages; 4 MB (J)                                                                                                         | 36 peers today, 12 required; 8.64 MB, 1,420 files                                                      |
| Provider JS gz; StatCard no chart, delta gz | 5.0 KB; 16 KB (J)                                                                                                                     | 20.5; toy 13.5 (gap-dist)                                                                              |
| Ten-primitive page / 25-part page           | 95 / 118 KB                                                                                                                           | 90.1 / 112.2 (gap-perf)                                                                                |
| Table 13 features / + virtual; Sparkline    | 24.5 / 35.5 KB; <=36 KB                                                                                                               | 23.3 / 33.5; 31.1 floor, 2.x 56.2                                                                      |
| Forms / cn / Markdown / motion              | 17 / 9 / 60 / 34 KB                                                                                                                   | gap-perf 6.1                                                                                           |
| Per route                                   | `budgets.json` required by `doctor` where routes exist. argo `/` <=700 KB JS, <=50 KB CSS; weatherorb `/` 0 scripts, `/map` <=704 KiB | gap-perf 6.2                                                                                           |

## 11. The other 94%

Where argo's 221 non-structural rows go. A swap of primitives touches none of these. Bytes are not a claimed win except CSS (gap-perf).

| Bucket                                            | Mechanism in this design                                                                                                                                                         |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A 40: missing seams and semantics                 | Headless + parts, so a missing prop has a lower rung. Card-family anatomy covers Progress, entity, record rows. New composites still need a named consumer                       |
| C 54: chart kit                                   | Series discriminated by mark, card owns height, tagged state with auto-empty, seams from linewatch (x-domain, `plot.data`, per-datum, `getMarker`). Bump the engine to 1.5 first |
| V 35: anatomy, defaults                           | Built into composites: equal state heights, tooltip law, one shared left edge asserted in layout tests. consumer-argo: quality from construction, not screenshot rounds          |
| D 47: docs, skills, lint text                     | One extractor: `llms.txt`, per-component `.md`, `docs <name>` (argo found props by `.d.ts` grep, 6 rows). Each diagnostic carries the remedy and the next bending rung           |
| T 42: tooling                                     | One project resolver (argo root, rb file routes), `sync --check`, frozen-install fixtures, unknown flag exits 1, machine migration rows                                          |
| Churn (~30 minors in 25 days, 36 linewatch bumps) | Copied primitives move only when they change. `next` channel per R1 release. Contract frozen per major: CSS entries, `data-slot`, `basalt:` envelope, URL codec, `--vx-*` names  |

## 12. Three biggest risks, cheapest falsifiers

**R1. Designed from small consumers, broken at argo.** Argo is gate G5, last, and owns 81 of 124 signatures, 153 chart files, ~1,500 style-prop sites. A 100-symbol surface shaped on G0-G3 can pass every gate and fail at the end, when change is most expensive.

- _Half a day, before the contract freeze:_ script a census mapping argo's 81 signatures and the 1,755 tags needing a mapping onto the section 4 table. **Refuted if** more than 10% have no v3 name or named rung, or the 100-symbol sum breaks.
- _Then one day:_ on a throwaway branch, port one argo dashboard route (ChartCard, DataTable, PageBar, one store) against the contract stubs at G1 time, not G5. **Refuted if** the slice needs an edge or subpath section 2 forbids.

**R2. A la carte erodes quietly.** A barrel picks up a peer, an edge sneaks between siblings, a closure grows, a rule presumes the shell. Linewatch's second-class status, rollhook's Mantine lockfile and epos's rejection all came from this drift, never from one decision.

- _One day, then keep as CI:_ the five `test/fixtures`, each `bun install --frozen-lockfile`, `tsc`, build, SSR + hydrate, lint preset, `doctor`; assert installed package count, copied file count, CSS bytes, `one-look` identity, no `.basalt/base` rules, zero seam hits in `.d.ts`. **Refuted if** the `linewatch` fixture needs `./shell`, D0 gains a peer, or a missing primitive fails without a message naming `add`.

**R3. Managed copy fails on economics or behaviour.** Two bets, neither measured at scale (gap-dist: three parts, 183 lines). Bet one: primitives change rarely. Bet two: agents treat drift as a stop, not as a reason to run `eject`. If agents eject on first friction, the ledger is theatre.

- _One hour, churn:_ `git log` over console's `components/ui/*`, epos's primitives and shadcn base-nova upstream for 6 months. **Refuted if** a typical primitive changes more than about monthly, since Base UI's monthly minors would then mean every app takes a monthly merge.
- _One day, behaviour:_ 5 agent runs on a UI task that tempts an edit to `button.tsx`, in a fixture with the diagnostic and the PreToolUse deny. **Refuted if** more than 1 in 5 ejects instead of reaching a higher rung. On refutation, move to D by repointing the alias: 1-2 days package work (gap-dist) and, with amendment 1, no app codemod. That cheap exit is why this ranks third.

## 13. Owner decisions taken as defaults

Each is DEFAULT-PENDING-OWNER; numbers from digest section 5.

| #   | Default taken                                                                                     | Alternative                                                              |
| --- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 2   | Same npm name `basalt-ui`, 3.0 sanctioned by changing the doctrine and gate on purpose            | New package name, no doctrine change, but every consumer renames imports |
| 4   | Managed copy; eject per file with reason, capped at 3; no public `@basalt` registry at 3.0        | D, compiled + eject, by repointing the alias; or uncapped eject          |
| 7   | `data-theme`; Lucide; read legacy Mantine scheme key once                                         | Class selector; Tabler                                                   |
| 9   | One `DataTable` + exported parts; phone `cards`; no inline editing                                | Parts only, heavier call sites                                           |
| 11  | Sparkline on the engine; `ChartCard` in `./charts`; StatCard takes a slot                         | Hand SVG sparkline, off the brief                                        |
| 13  | Synced state and the live stack in the framework; no Zustand peer; server draft adapter left open | Recipes only, keeps the re-growth risk                                   |
| 15  | Ceiling 18 holds; PostToolUse + Stop hooks registered by `init`                                   | Lift the ceiling; consumer wires hooks                                   |
| 16  | Tokens-only is a supported tier (D0), tested by fixture                                           | Best effort, jkrumm stays on its hand copy                               |
| 17  | Own grid and rail on shadcn vocabulary; collapse in localStorage; macOS native-overlay first      | Stock shadcn Sidebar; cookie for SSR; Windows/Linux at 3.0               |
