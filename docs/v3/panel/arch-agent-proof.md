# Architecture proposal: AGENT-PROOF

Lens: an agent with no taste cannot produce a bad UI. Date 2026-11-09. Slugs are the digest's shorthand. Tags: **F** read in the cited report, **F-panel** measured for this document, **J** judgement, **U** unverified.

## 0. Premises challenged

1. **The lens as worded is false.** Nothing mechanical gives good hierarchy: `shot detect` scored 100 on boards with 17-19 defects, and composition quality has no owner (gap-guardrail section 6). Achievable is a **floor**: an agent cannot produce an _off-system_ UI, and a page's structure comes from typed frames. Above the floor sit the reviewer (advisory) and the owner's eye.
2. **Swapping Mantine fixes 6% of the recorded pain** (13 of 234 argo rows). Agent-proofing must target our own API shapes. Tailwind freedom is a new hole Mantine did not have: unguarded, the console has 34 restyles, 66 arbitrary values, 39 viewport variants, 67 inline styles (ext-guard), one filter in 3 UIs, 16 bordered vs 4 shadow cards.
3. **`className` everywhere is the actual risk of this rewrite.** Bought lint narrows values, not _who may decorate_. The one idea this proposal adds to the digest: **app code gets a layout allowlist, not a denylist** (6.2).
4. **Skills guarantee nothing.** Benchmarks show -1.3 to -4.2 pp and -1.8; diagnostics naming the fix took every model to zero findings in about one round (ext-guard). No "never" may be owned by prose.

A defect is owned at the highest rung that can express it; rungs 9-10 never own a "never".

Rungs: **1** absence (prop or export does not exist); **2** types (closed unions, tuples, required, discriminated); **3** resolver (`exports` map, seam alias); **4** closed `@theme` (class compiles to nothing, so **silent**, only valid paired with 5, gap-token); **5** lint at `error` naming the fix (waiver with reason, counted); **6** ledger (`doctor`, `sync --check` in CI); **7** dev assertion, literal `NODE_ENV` gate; **8** gates (layout, axe, budget, contract); **9** edit-time hook (shell tools skip it); **10** skill or rule text (ignorable).

| Recorded defect                                                                  | Rung   | Mechanism                                                                                 |
| -------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| Hue per card, coloured icons (ext-visual)                                        | 1      | `icon: LucideIcon` in a neutral tile; no `tone`, `color` on cards                         |
| Coloured left bars, wireframe borders, uppercase micro labels (epos)             | 5      | outside the app allowlist                                                                 |
| Single-item menu (epos); unknown delta reads as good (ext-visual)                | 2      | `menu: readonly [Item, Item, ...Item[]]`; `polarity` required, no default                 |
| Tinted status cells, status fill as text                                         | 1, 5   | `Status` dot + label is the only render; `col.status`                                     |
| Box in box                                                                       | 7      | surface context: nesting beyond depth 2 throws in dev                                     |
| Hand padding, card insets (argo 92 rows); hex, arbitrary values, `text-sm` split | 5, 4+5 | padding denied in app code, surfaces own it; closed theme, shadcn rules, `--text-sm` = 13 |
| One filter 3 UIs; six freshness stacks                                           | 2, 5   | `FilterSpec` by home; typed `FreshnessClass` + `data-primitive`                           |
| Table squish on phone                                                            | 2+8    | `priority` required per column, CSS tiers derived, layout 320-1440                        |
| Hand tables, hand-SVG charts (6 of 10 repos)                                     | 5      | `primitive-bypass`, fix = `basalt-ui add data-table`                                      |
| Unnamed controls, dialog without title (gap-a11y)                                | 2      | required `label`, `title`, icon Button `aria-label` by union                              |
| Chat truncation, fail-open Markdown (gap-perf)                                   | 3+5, 2 | raw `useChat` import denied; `contentTrust` required                                      |
| Agent weakens the guard to pass it                                               | 6+9    | committed preset, ledger, deny on protected paths                                         |
| Weak hierarchy, wrong emphasis                                                   | none   | typed frames reduce it (8.4); reviewer and eye own the rest                               |

## 1. Layering and dependency direction

Imports flow down only, enforced by `import-boundary`, the dist layering check and a Vite-resolved pack-test.

```text
L0 tokens      derive, emit, CSS entries. No React, no DOM.
L1 engine      state, query, live, table core, chart compiler, format, form binding, ai runtime.
               React allowed; no class strings, no chrome, no seam import.
L2 ui          Base UI + cva + cn. Managed copies delivered as source.
               A leaf: imports other L2 files and basalt-ui/cn only.
L3 composites  shell, cards, table UI, chart card, controls UI, forms UI, content, chat parts.
               L1 + L2 through @basalt/ui/<name>. NEVER @base-ui/react directly.
L4 wiring      BasaltProvider, vite plugin, CLI.
app            zones A (default), K (src/composites), X (declared free), V (src/basalt, managed).
```

- **L3 never touches Base UI**, or a consumer's eject stops propagating (gap-dist proved propagation: StatCard picked up an edited `icon-sm`).
- **L2 is a leaf**, so `add` closes over L2 only and strings arrive by props. That is what makes shell-less, take-what-you-want installs first class (linewatch, weatherorb).
- **L1 has no class strings**, so chrome changes never touch the 44% of source that ports as-is (self-process-lessons).

## 2. Repo and package layout

One published package: one version moves tokens, rules, seeds and contracts atomically, which a ledger needs (email-gateway declared 2.29, installed 1.36).

```text
packages/basalt-ui/
  src/{tokens, engine/*, composites/*, app, lint, cli, testing}/
  src/ui/{button,dialog,...}.tsx + *.guard.ts   authored seeds; not in dist; lint at seed strictness
  contracts/                                    GENERATED: variants.json, no-restyle contracts, slots.ts, llms*.txt
  agent/{rules,skills,reviewer,templates}/      migrations/<version>.json (rows generate MIGRATING)
apps/playground/   8 routes, exemplar + oracle     tests/layout/fixture/   geometry suite

consumer after init:
  src/basalt/ui/*.tsx *.guard.ts   MANAGED: every file is in the ledger; an unknown file is a doctor error
  .basalt/manifest.json            version, sha256, status pristine|ejected, eject reason
  .basalt/base/**                  as-installed copies, the three-way base; committed, generated
  .basalt/budget.json              ceilings (ejects, waivers, K files); a raise is a reviewed diff
  .oxlintrc.basalt.json            GENERATED preset, exact plugin pins; sync --check red until applied
  src/composites/**                zone K, app-owned composites
  vite.config.ts                   basalt() (alias, ssr.noExternal, tsconfig paths check)
```

**Managed files live in `src/basalt/ui`, not `src/components/ui`** (deviation from gap-dist): regex recognition cannot tell managed from app-owned in one directory (F, gap-dist 3). `components.json` is not written, so `shadcn add` cannot land an unmanaged copy. **One import spelling across the fleet:** `@basalt/ui/button`, so rules, skills and messages can name it literally; `import-boundary` denies every other path into `src/basalt`.

## 3. Published subpaths

A subpath exists only if it hides a heavy peer or a separate lifecycle. Twelve runtime subpaths, exactly the ceiling (digest row 24): adding one means deleting one.

| Subpath     | Purpose                                                                                                                                                   | Heavy peer             | gz ceiling, KB                       |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------ |
| `basalt-ui` | `BasaltProvider`, scheme, `useFormat`, messages, `notify()` queue (Toaster lazy)                                                                          | none                   | **5**, decides weatherorb (gap-perf) |
| `/shell`    | `AppShell`, `defineNav`, `Page`, `PageBar`, `PageAside`, `Section`, `CardGrid`, `SplitPage`, `InnerNav`, `CommandPalette`, `defineCommands`, `DragRegion` | router                 | fixture                              |
| `/state`    | field stores, `persisted`, `createSyncedState`, `makeQueryClient`, `unwrap`, `QueryState`, optimistic helper                                              | query                  | fixture                              |
| `/live`     | `createChannel`, `liveQuery`, `bindInvalidation`, `useConnection`, `useFreshness`, `useNow`, `ConnectionIndicator`                                        | eventsource-parser     | ~700 lines                           |
| `/controls` | `defineControls`, `field.*`, `FilterSpec`, renderers by home                                                                                              | router                 | fixture                              |
| `/forms`    | `Form`, `Field`, `useBasaltForm`, `useFormDraft`, `CalendarDate`                                                                                          | react-form, day-picker | +16.3 (+40 zod)                      |
| `/table`    | `DataTable`, `defineColumns`, `useDataTable`, `VirtualList`                                                                                               | react-table, virtual   | +23.3 (+33.5)                        |
| `/charts`   | `CartesianChart`, kinds, `Sparkline`, `MiniBars`                                                                                                          | @tanstack/charts       | spark 36, all 44.4                   |
| `/cards`    | `Card`, `Inset`, `Row`, `StatCard`, `ChartCard`, `StatGroup`, `Status`, `Delta`, `IdChip`, `Lozenge`, `KanbanCard`                                        | none (`/charts` lazy)  | fixture                              |
| `/content`  | `Prose`, `Callout`, `TOC`, `Markdown`, `CodeBlock`                                                                                                        | react-markdown, remend | 60                                   |
| `/ai`       | `chatFor`/`closeChat`, part views, chat parts, `defineBlock`, `defineCatalog`                                                                             | ai, @ai-sdk/react, `m` | motion 34                            |
| `/testing`  | `renderApp`, `settled`, `SLOTS`, `expectShellInvariants`, `fakeChannel`                                                                                   | none                   | n/a                                  |

Tooling entries, no runtime symbols: `./index.css`, `./tokens.css`, `./typography.css`, `./prose.css`, `./cn`, `./vite`, `./lint`, `./stylelint`. Merged: `/ai/ui` into `/ai` (no headless-only consumer). Dropped: `./query`, `./connectivity`, `./controls-dates`, `./commands`, `./theme-lab`, `./provider`, `./dashboard`. **Take-what-you-want without losing the look:** parts are chosen by subpath and `add`; **rules and tokens are not chosen**. Profiles `tokens` (CSS only, stylelint, zero install for static sites), `components`, `shell`, `agent` only decide which files land. An unsatisfiable rule is a bug (linewatch), so every `primitive-bypass` message ends in an `add` command.

## 4. Distribution: hybrid managed copy, confirmed with amendments

**Confirmed.** Compiled-only fails the reason for leaving Mantine (`sm:px-2.5` survives `px-4`; `bun patch` dropped at exit 0). Registry-only destroyed 4/4 edits and cannot tell stale from edited (F, gap-dist). From this lens a second reason: agents read the primitive they use, and an in-repo file teaches better than `node_modules`, provided seeds pass our own rules. Limits: 183 lines, three parts, Vite only, pnpm U; carried as R3.

**A weakness the bake-off did not name:** composites are compiled JS, so `tsc` never sees a composite's internal `<Button size="icon-sm">`. Remove that variant in a copy and you get no error, only a silent fallback to the default size. The guard file is the only link.

| #   | Amendment                                                                                                             | Why                                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | Each `*.guard.ts` encodes the axes npm composites call, generated from composite source, **managed even after eject** | Only type link across the compiled boundary                           |
| 2   | Ejected files stay in the ledger as `status: ejected`                                                                 | Call sites stay under provenance rules; doctor counts them            |
| 3   | Exact-byte sha256; `init` adds `src/basalt` to the formatter ignore, doctor verifies                                  | Deletes format normalisation (F: one oxfmt run marked a copy drifted) |
| 4   | Dedicated managed directory, one seam spelling                                                                        | Exact, machine-checkable recognition                                  |

**`basalt-ui eject button --reason "..."`** keeps the same path and specifier, so npm composites pick the change up with no import edit. Ledger gets `status: ejected`, required reason, `fromVersion`; `sync` stops writing it, `doctor` flags upstream movement, `sync --ejected button` merges on request. The file moves from zone V to K rules: closed tokens still apply. Guard stays managed, so dropping an axis fails `tsc`. Budget `ejected <= 3` per app. `eject --undo` restores pristine. Variants are added by eject only; three consumers ejecting for the same variant means it goes upstream, the fleet probe counts this (digest row 29). Tamper chain: PreToolUse denies edits on `src/basalt/**`, `.basalt/**`, the preset and shipped rules, naming `eject` in its message. Shell tools bypass that, so **`doctor` in CI is the gate** and the hook is fast feedback. `init` registers the hook and `doctor` runs a seeded offender through it (only rb had one). Conflicts are git-native diff3 markers labelled `local / installed / shipped`, exit 1.

## 5. Framework vs consumer

| Area             | Framework                                                                                                       | Consumer                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Shell, pages     | 5-area grid, scrollport, mobile projection, landmarks, `h1`, print unclip, `Page`/`Section`/`CardGrid` geometry | nav items, routes; not using the shell at all                                            |
| Controls, forms  | scopes, `FieldHandle`, precedence, render by home, `Field` anatomy, draft                                       | vocabulary, defaults, schema library, copy                                               |
| State, live      | taxonomy primitives, envelope, codec, retry law, channel, classes, indicator                                    | keys, auth, cache numbers, frame schema, WS adapter                                      |
| Table            | engine, kinds, tiers, phone card, views, keyboard, a11y                                                         | columns, custom kinds, detail, bulk actions, export                                      |
| Charts, cards    | host, kinds, cursor, null law, card anatomy, state heights, one left edge                                       | series colours, units, domains, icon, metric, chart slot                                 |
| AI, MDX          | owned `Chat`, trust tiers, catalog contract                                                                     | transport, persistence, thread list, catalog entries                                     |
| Look, primitives | tokens, derive, gates, seeds, contracts, guards                                                                 | accent, neutral, vibrancy, radius, density, fonts within gates; ejects; `src/composites` |

Not framework in 3.0: Week/Month schedule, Timeline, drag engine, WebSocket adapter, TanStack DB, translation tooling, RTL, MCP server.

## 6. Token to Tailwind contract

### 6.1 Generated bridge

`gap-token` section 9 stands, with the rename in section 7. One emitter, one table, never authored. Resets first or definitions are wiped (F); colours `inline` so a re-pointed `--vx-*` wins; `--spacing: .25rem` fixed, density moves `--vx-ctl-h`, `--vx-row-h` (`h-ctl`, `min-h-row`, `size-icon`); viewport `md=840`, `xl=1200`, the rest dead; containers `@compact`, `@regular`, `@wide`; rungs micro 11, xs 12, sm 13, md 15, base 16, lg 18, display 30.

```css
@theme inline {
  --color-card: var(--vx-card);
  --color-inset: var(--vx-inset);
  --color-accent: var(--vx-row-hover); /* hover, never blue */
  --color-primary: var(--vx-ink);
  --color-brand: var(--vx-brand);
  --radius-card: var(--vx-radius-card);
}
```

Tests shipped with it: every target is an emitted var; `--color-accent` never the blue; resets precede definitions; coarse input computes 16; inks >=4.5 on canvas, inset, card; status >=4.5 on surface and own tint; fill >=3.0 on every allowed surface; card vs inset >=.03 L. The emitter refuses a failing config. `valueShifts` in the contract version. A `--vx-surface-*` alias block for the 38 tokens rollhook consumes stays until it migrates. Rung 4 is silent, so `no-unknown-classes` on dead breakpoints must be proven before the reset (digest row 3).

### 6.2 Zone table: an allowlist for app code

Named spacing is not worth it: Tailwind accepts `--spacing-card` beside the multiplier, and with no multiplier every numeric size dies, `h-8` and `w-48` included (F-panel, tailwindcss 4.3.4). Numbers stay; the policy decides who may use which.

| Family                                                                         | A (app default)                                                                    | K, ejected, X | V (managed)                                         |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ------------- | --------------------------------------------------- |
| Flex, grid, position, overflow, size, truncate                                 | yes                                                                                | yes           | yes                                                 |
| `gap-*`                                                                        | `0.5, 1, 1.5, 2, 3, 4`                                                             | ladder        | ladder                                              |
| Padding, margin                                                                | **no**, except `m?-auto`                                                           | ladder        | ladder                                              |
| Type                                                                           | `text-{xs,sm,md}`, ink trio, `font-{medium,semibold}`, `font-mono`, `tabular-nums` | all rungs     | all rungs                                           |
| `bg`, `border`, `ring`, `rounded`, `shadow`, colour text, motion, `z`, opacity | **no**                                                                             | tokens        | tokens                                              |
| `uppercase`, `tracking-*`, `font-bold`, `dark:`, `!`, `[...]`                  | **no**                                                                             | **no**        | seeds: `has-data-[slot]` only                       |
| Container variants                                                             | yes                                                                                | yes           | yes                                                 |
| `md:`, `xl:`                                                                   | **no**                                                                             | **no**        | sizing only; shell composites exempt in the package |

**Measured cost** (F-panel: class tokens in app `.tsx`, excluding `components/ui`, from `className`, `cn`, `cva`, `clsx` strings). Console, 2,074 tokens in 61 files: kept 77.7%, padding 7.7%, margin 2.2%, decorative 12.4%, 38 of 61 files carry a decorative class, 18 of 186 `gap-*` outside 0, px, 0.5-4 and 6. Epos, 14,144 in 292: kept 69.8%, padding 7.9%, margin 7.3% (`m-0` x589 is a reset), decorative 15.0%, 223 of 292 files, 24 of 925 likewise. "Kept" is an upper bound: it does not subtract type rungs outside xs-md or tokens behind `md:`-style variants (56 console, 371 epos).

Roughly a quarter of today's tokens go. I claim most are hand-built primitives that should be `Card`, `Inset`, `Row`, `Status`, `Button`; that claim is unproven and is R1. Byproduct: with padding and margin denied, physical-direction classes nearly vanish, settling digest row 5 without a rule.

Zones are glob overrides in the generated preset. K is `src/composites/**`, ceiling 40 files. X is declared in `basalt.config.ts` for deep-rendering surfaces (shutterflow's editor, weatherorb's map), each printed by `doctor`. Moving code to K to escape is possible and shows as a count in a reviewed budget file: loud, not impossible.

## 7. Naming

**`Shell` means the application frame and nothing else:** component `AppShell`, vars `--shell-*`, slots `shell-*`. The surface role and the card frame both become **`card`**: `--vx-card`, `bg-card`, `--radius-card`, component `Card`. shadcn already binds `--color-card` and every agent predicts `<Card>`, so it removes an alias. `panel` is taken by Base UI (`Tabs.Panel`) and the control home; `frame` and `surface` are words nobody predicts. `--vx-shell` is only a v3 proposal (2.x emits `--vx-surface-*`), so the rename is free until the token map freezes.

One concept, one word; the rejected synonym does not exist as an export. Only `BasaltProvider` keeps the prefix; agents predict `DataTable`.

| Word                                                | Means                                                   | Not                             |
| --------------------------------------------------- | ------------------------------------------------------- | ------------------------------- |
| `AppShell`                                          | App frame                                               | `Layout`, `BasaltShell`         |
| `Page` / `Section`                                  | Routed screen / titled group inside it                  | `Screen`, `Band`                |
| `Card` / `Inset` / `Row`                            | Ringed frame / recessed region / fixed-height list row  | shell, well, `ListItem`         |
| `PageAside` / `Sheet`                               | Right inspector region / edge overlay on Base UI Drawer | `Inspector`, `Panel` / `Drawer` |
| `canvas, card, inset, raised` / `ink, muted, faint` | Four surfaces / three text levels                       | `shell`, `elevated`, `subtle`   |
| `brand` / `primary`                                 | The blue / ink-inverted main action                     | `accent` stays shadcn's hover   |
| `chrome` / `home`                                   | Native window furniture / where a control may live      | app frame, placement            |

## 8. Composition model

### 8.1 Managed primitive

```tsx
// src/basalt/ui/button.tsx: seed passes no-arbitrary-values, unlike stock base-nova
const button = cva('inline-flex h-ctl items-center gap-1.5 rounded-ctrl text-sm font-medium', {
  variants: {/* closed */},
})
type Common = Omit<ComponentProps<typeof Base>, 'style' | 'color'> & {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}
export type ButtonProps = Common &
  (
    | { icon?: never; children: ReactNode }
    | { icon: LucideIcon; 'aria-label': string; children?: never }
  )
```

Seeds spell unions out (the extractor reads them, avoids TS9010), put `data-slot` on every styled element, own the hit floor and coarse sizing, and use Base UI's `render` as the only polymorphism. `button.guard.ts`: `@ts-expect-error` on closed axes, exact equality on axes composites call. Variants: at most `variant`, `size`, `tone`; `no-restyle` contracts generated with `deny: ["h-*","w-*"]` on controls (ext-guard).

### 8.2 Composites take data, not nodes

TypeScript cannot constrain a `ReactNode`: every JSX element has one type. **A `ReactNode` prop is an unguardable hole**, so:

**Data slot** (default): typed object or tuple (`footer`, `delta`, `menu`, `actions`), rungs 1-2, anatomy cannot break. **Box slot**: `render: (box) => ReactNode`, content open, geometry owned and clipped. **Body slot**: `children`, only on `Page`, `Section`, `Card`, `Inset`, no style props, surface context checks nesting.

```tsx
export type StatCardProps = {
  icon: LucideIcon
  title: string
  subtitle?: string
  value: string
  sub?: string
  delta?: { value: number; polarity: 'up-good' | 'down-good' | 'neutral' }
  chart?:
    | { kind: 'spark'; series: Series; future?: boolean }
    | { kind: 'bars'; bars: Bar[]; highlight: number }
    | { kind: 'custom'; render: (box: { width: number; height: 56 }) => ReactNode }
  xLabels?:
    | readonly [start: string, end: string]
    | readonly [start: string, now: string, end: string]
  footer?: readonly [Stat, Stat]
  menu?: readonly [MenuItem, MenuItem, ...MenuItem[]]
  href?: LinkOptions
  state?: 'ready' | 'loading' | 'error' | 'empty' | 'stale'
  // deliberately absent: className, style, color, tone, padding, variant
}
```

### 8.3 Headless plus styled

Headless lives in L1 and is public; the styled result is **one component with typed configuration, not a kit of parts**. Parts are where agents reassemble things badly. Different anatomy means `useDataTable` plus your own composite in zone K, which is deliberate and visible.

```tsx
const columns = defineColumns<Order>()((col) => [
  col.money('total', { label: 'Total', priority: 1, currency: 'EUR' }),
  col.status('state', { label: 'State', priority: 2, tone: orderTone }),
  col.custom('risk', { label: 'Risk', priority: 3, render, sortValue, exportValue, card: 'meta' }),
])
;<DataTable
  mode={{ kind: 'server', rowCount, facets }}
  columns={columns}
  getRowId={(o) => o.id}
  state={tableState}
  phone="cards"
  detail={(o) => <OrderDetail id={o.id} />}
  aria-label="Orders"
/>
```

**`data-slot`** is kebab-case, enumerated in generated `SLOTS`; public to tests and managed primitives, **not** to app styling (stylelint `selector-disallowed-list`, `class-policy` on arbitrary variants). That replaces obsidian's 14 `!important` and shutterflow's Mantine selectors. **Escapes contain their name and are counted:** `col.custom`, `chart.kind:'custom'`, `field.custom`, waivers, ejects, X zones, printed by `basalt-ui lint --stats`. A growing count is product feedback.

### 8.4 Typed page frames attack the unowned class

```tsx
<Page title="Revenue" actions={[exportAction]} controls={revenueControls}>
  <Section title="This month">
    <CardGrid min="regular">
      <StatCard {...mrr} />
      <StatCard {...churn} />
    </CardGrid>
  </Section>
  <Section title="Orders">
    <DataTable {...orders} />
  </Section>
</Page>
```

`actions` max 5 on `Page`, 3 on `Section`, one `primary`. `CardGrid` takes one closed `min` container and no column count, so four cramped columns at 390 px cannot be written. These are the 2.x `PageBar`/`Section`/`StatGroup` laws made the only way to lay out a page. No archetype library: a template without a named consumer fails adopt-or-delete.

## 9. Enforcement inventory

The ceiling of 18 holds; the digest asked the panel to cut. Merging forms into one id is sound because severity per id only existed for the grace ladder (gap-guardrail).

| Own id                                                        | Absorbs                                                                                                                            |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `import-boundary`                                             | Base UI outside V, Radix, cmdk, sonner, streamdown, tailwind-merge, engine outside `/charts`, raw `useChat`                        |
| `class-policy`                                                | zone table; `viewport-keyed`, `dark-fork`, `important-modifier`, `fixed-colour`, `status-fill-as-text`, `raw-scroll`, `tw-off-law` |
| `primitive-bypass`                                            | raw `button`, `select`, `input`, `table`, `h1`; hand SVG polylines; `Intl.*`, `toLocaleString`                                     |
| `control-home`                                                | placement residue types cannot express                                                                                             |
| `router-search`                                               | `route-view-transition`, `validate-search-pure`, `loader-deps-narrow`                                                              |
| `data-primitive`                                              | `realtime-primitive`, deprecated Query fetches, `QueryClient` outside `makeQueryClient`                                            |
| `untrusted-markdown`, `colour-literal`, `waiver-needs-reason` | as gap-guardrail                                                                                                                   |

9 ids + repo-only `no-dev-helper` + reserve `compound-structure` = **11 of 18**. Bought: 6 `@shadcn/lint` + 5 stylelint core, exact pins, contracts and messages generated by us. Cost: a `class-policy` waiver covers a line, not a sub-kind; accepted because a reason is mandatory and the count is budgeted. Every digest row 4 proposal maps to a type, one of these ids, a dev assertion or a skill line; none is added. Delivery: PostToolUse lints the edited file (0.27-0.5 s, exit 2), one Stop re-check; `make check` and CI are the gate. A message saying only "not allowed" fails review. Every never-bullet has a fixture; the repo dogfoods the preset. Skills (2 skills, 5 rules) teach _why_ and _which_, never _don't_.

## 10. Budgets

In `check-budgets`. A raise needs a named consumer outside argo (95 of 124 values name it).

| Budget                                | 3.0.0                                                                       | Today or source           |
| ------------------------------------- | --------------------------------------------------------------------------- | ------------------------- |
| Runtime subpaths / value symbols      | <=12 / <=100                                                                | 13 / 124                  |
| Managed primitives                    | <=48 files                                                                  | gap-dist 40-60, tightened |
| Lint and guard code                   | <=900 lines, 11 of 18 ids                                                   | ~7,700                    |
| CLI, tokens, state, forms, live lines | <=4.5k, ~1,900, ~4,400, ~2,500, ~700                                        | gap-dist, digest          |
| Provider JS gz                        | <=5 KB                                                                      | 20.5 KB                   |
| Hard zeros per fixture                | streamdown, cmdk, Radix, tailwind-merge, full motion, dev chunks            | gap-perf                  |
| Table runtime vs fixture              | paint <=1,300 ms, sort <=1,150, virtual <=150                               | gap-perf                  |
| Playground; per route                 | 8 routes, demo + scenarios <=10k; `budgets.json`, `maxScripts: 0` on static | gap-repo, gap-perf        |
| Per app: ejects, K files, waivers     | <=3, <=40, <=1 per 500 TSX lines (J)                                        | 63 waivers in 10 repos    |

## 11. DEFAULT-PENDING-OWNER

Spec 523 is unreadable and blocks nothing here; it can only move the console's role.

| #      | Default taken                                                                                                                       | Alternative                                    |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 2      | Same npm name; 3.0 sanctioned in the doctrine and gate                                                                              | New name                                       |
| 4      | Managed copy, eject as section 4, no public registry                                                                                | Compiled with eject (D)                        |
| 5, 6   | Ink primary, accent B, flush inset; dense, app-fixed                                                                                | Blue primary (2.76 on dark card); user density |
| 7      | Lucide; `data-theme`; read legacy scheme key, write new                                                                             | Tabler; class-based scheme                     |
| 9, 10  | One `DataTable`, `phone="cards"`, personal views, no inline edit; `KanbanCard` + `onMove`, no bundled drag, no Timeline or schedule | Parts kit; own schedule in 3.0                 |
| 11     | Sparkline on the engine if <=36 KB                                                                                                  | Hand SVG as console does                       |
| 12, 13 | `/ai` for epos first, ~10 blocks; `createSyncedState`, `/live` as code                                                              | Recipes only                                   |
| 15, 16 | Ceiling 18; `init` registers hook; tokens-only is a tier                                                                            | Hook left to consumer; full install            |
| 17, 18 | Own rail, localStorage collapse; RTL non-goal, no MCP                                                                               | shadcn Sidebar, cookie; German pack            |
| new    | App allowlist (6.2) is the default profile                                                                                          | Denylist only, as the digest assumed           |

## 12. Three biggest risks

**R1. The allowlist over-constrains and agents learn to escape it.** 22% (console) to 30% (epos) of existing class tokens are outside it (F-panel). If a real share is legitimate, the result is waivers, K-zone dumping and the moving-lint friction argo paid for (109 rewrites). _Falsify, half a day:_ run a stand-alone `class-policy` over console, epos, and linewatch after the layout codemod; hand-classify 100 random denied sites as hand-built primitive, missing composite, or genuine need. **Kill:** genuine need above 15%, or a real screen port above 1 waiver per 300 lines. Fallback: zone A denylist plus the padding ban, a one-file preset change.

**R2. The floor holds but pages stay mediocre.** Constraint can yield uniform blandness. _Falsify, one day after the StatCard exemplar:_ three fixed briefs (dashboard, list-detail table, settings form) on the cheapest available model, with and without skills, reviewed at 1800x1200 and 390x844 on the trial v7 bar (~75), the owner's eye on a blind sample. **Kill:** no-skill under 70, or more than 10 points below with-skill. Then the surface is not carrying the taste: grow the frames in 8.4 or trade this lens for the reviewer loop.

**R3. Managed copies do not survive real churn.** Monthly Base UI minors across 48 files in 12 repos could become recurring conflict PRs, and agents resolving diff3 may quietly drop behaviour. Console's 10 `ui/` files have 4 commits in their history (F-panel), so low churn is plausible, not shown. _Falsify, one day:_ put those 10 files under the prototype ledger, replay Base UI 1.6 to 1.9 and base-nova diffs across 12 simulated apps with 20% local edits, let the cheapest agent resolve conflicts, diff behaviour against a clean merge, repeat under pnpm. **Kill:** more than one conflict per release per app, or under 90% correct resolution. Fallback: compiled primitives with the seam kept, 1-2 days of package work (gap-dist).

Watch: oxlint JS plugins alpha and `@shadcn/lint` 0.2.5 (exact pins, rule tests under both RuleTesters, fork-ready); a v3 scale change voids the 375/375 codemod fidelity (digest row 11).
