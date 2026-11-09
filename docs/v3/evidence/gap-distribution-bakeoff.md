# Evidence: v3 delivery model bake-off (built and measured, 2026-11-09)

Tags: **F** = ran it here (command and output given), **J** = my judgement, **U** = unverified. `$S` = scratch dir outside every repo
(`mktemp`, untracked; path in `/tmp/gapbake.path`). Nothing in any repo was modified; no dev server was started (production `vite build`,
SSR render, `tsc`, `oxlint`). One exception to say out loud: the shadcn CLI cannot read `file://` registries (F, below), so shape B was
served by a loopback `python3 -m http.server` on 127.0.0.1:48731 (static JSON, stopped afterwards).

Versions (installed, F): tsdown 0.23.7, TypeScript 6.0.3, React 19.3.1, `@base-ui/react` 1.9.0, Tailwind + `@tailwindcss/vite` 4.3.4
(4.3.5 is under the 3-day bun release-age floor), Vite 8.3.5, `@vitejs/plugin-react` 6.2.1, shadcn CLI 4.23.0, `@shadcn/lint` 0.2.5,
oxlint 1.92.0, oxfmt 0.76.0, jsdom 31, bun 1.4.4.

## 0. Verdict

1. **Recommend C (hybrid), primitives MANAGED**: logic, tokens, CSS bridge, composites, lint plugin, skills and the ledger CLI in npm; the ~40-60 visual
   primitives are copied into the app and tracked by an extension of the sha256 ledger, with an eject marker as the only way to stop being managed.
2. **B (pure registry) fails the two fleet tests**: `shadcn add --overwrite` fixed 12/12 apps but silently destroyed 4/4 local edits, and nothing
   can tell a stale pristine copy from an edited one (F, section 7). It has no base, no manifest, no semver.
3. **A (compiled) fails the stated reason for leaving Mantine**: the consumer cannot change internals. className overrides are lossy
   (the baked `sm:px-2.5` survives `px-4`) and `bun patch` is dropped on the next version with only a `warn` and exit 0 (F, section 1).
4. **Measured size does not discriminate**: consumer JS differs by <=0.1% across shapes, CSS is byte-identical for B and C and +13 rules for A (F, section 5).
   Choose on update UX and enforcement, not bytes.
5. **C costs one real piece of machinery A and B do not have: the seam.** Composites in npm import `@basalt/ui/<name>`; the consumer maps it to
   its copied primitives with a Vite alias + tsconfig `paths`, and SSR needs `ssr.noExternal` or Node throws `ERR_MODULE_NOT_FOUND` (F, section 6).
6. **The lint layer is shape-independent once recognition is explicit**: `@shadcn/lint` `no-restyle` flags the same 3 violations in A, B and C with
   `componentImports`; by default it sees only `components.json`-discovered local files (F, section 3). Provenance-keyed recognition from the
   manifest is exact only in C (it spares app-owned files that a regex flags).
7. **The ledger as shipped is not enough**: `normalizeForLedger` (`src/cli/index.ts:1264`) is markdown-oriented; one default `oxfmt` run marks a copied
   TSX `drifted` (F). It also stores hashes only, so no three-way merge is possible without an as-installed base copy (my extension).
8. **Reversal is asymmetric**: C to A is a delete plus one specifier codemod; A to C needs the seam retrofitted into every composite; B to anything
   cannot find the edited files. Author composites against the seam from day one and both directions stay cheap.

## 1. What was built (same three parts, one source)

Single authored source in `$S/core` (183 lines): `ui/button.tsx` (Base UI Button + cva, `h-9 sm:h-8`, `icon-sm size-8 sm:size-6`), `ui/select.tsx`
(Base UI 1.9.0 Select: Root/Trigger/Value/Icon/Portal/Positioner/Popup/List/Item), `composites/stat-card.tsx` (icon+title+subtitle header, inset
panel with value, delta pill with tone from sign x `higherIsBetter`, sub line, SVG sparkline, x labels, 2-stat footer, menu = `Button`),
`lib/cn.ts` (clsx + `extendTailwindMerge` for the custom `text-md/display/nano/micro` scale), `css/tokens.css` (copy of the console's generated
basalt `--vx-*` file, 182 lines) and `css/theme.css` (`@theme inline` bridge: colors, radii, type scale, `shadow-card`; dark via `data-theme`).
StatCard depends on Button, which is what makes criterion 4 a real test.

| Shape                | Build                                                                                                                                | Consumer wiring                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| A `$S/lib-a`         | tsdown unbundled, `exports` per component, `dist/styles.css` = tokens + theme + `@source "./"`                                       | `@import '@scratch/basalt-a/styles.css'`, imports `@scratch/basalt-a/button` |
| B `$S/reg-b`         | `registry.json` (5 items, `registry:base` + `extends:"none"`), `shadcn build -o public/r`                                            | `components.json` `registries.@basalt`, `shadcn add @basalt/...`             |
| C `$S/lib-c`         | npm: StatCard (imports `@basalt/ui/button`), `cn`, CSS, Vite plugin; `seeds/ui/*.tsx` copied by `bin/basalt3.mjs` (ledger prototype) | `basalt()` plugin + tsconfig `paths`, `basalt3 add stat-card`                |
| D `$S/lib-d` (extra) | A plus `eject <name>`: copies source, alias via `.basalt/ejected.json`                                                               | npm default, copy on demand                                                  |

Consumers: one small Vite 8 + React 19.3 + Tailwind 4.3 app per shape, `full` (Button, Select, StatCard) and `stat` (StatCard only).

- **F** `tsdown` unbundled build: 0.7 s, 8 files, 10.0 kB (`$S/lib-a/build.sh`).
- **F** `isolatedDeclarations` (ext-toolchain's recommended gate) rejects two things a shadcn-style primitive does: `export const buttonVariants = cva(...)`
  and `export const Select = SelectPrimitive.Root` fail with `TS9010: Variable must have an explicit type annotation`. The first has no writable annotation
  (the variants type is inferred from the call). I built A with `dts: { oxc: false }` (tsc declarations). **J** primitives that are copied, not compiled (C),
  never hit this; only composites and logic need the isolated-declarations discipline.

## 2. Managed vs freely owned, and what lint exempts

Measured behaviour of the two policies on the same primitive file (`$S/apps/c-*`, `basalt3 doctor`):

| Policy                          | Mechanism (prototype)                                                                                                                                  | Drift result                                                                                   | Cost                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **managed** (recommended)       | manifest hash + `.basalt/base/<path>`; `doctor` exits 1 on `drifted` unless the first 3 lines carry `basalt:eject` (then the file leaves the manifest) | edit = `ERROR ... managed primitive drifted from 0.2.0 (revert, or run basalt3 eject ...)` (F) | every legitimate bend needs an explicit eject; the owner's "bend exactly" stays possible, never silent |
| **owned** (shadcn/coss default) | no manifest; `sync` never touches the file                                                                                                             | none detected, none merged (B result, section 1)                                               | "take what you want yields one look" is gone the first time anyone edits `button.tsx`                  |

Lint exemptions the managed policy implies (F where run, otherwise J):

- The managed directory is the _definition_ of the primitives: `shadcn/no-restyle` off there (the README's own monorepo recipe does the same, `overrides` -> `"off"`).
  Token rules (`no-raw-colors`) stay on there: they passed on my copies (F: 0 findings in `src/components/ui`). **J** shadcn's own base-nova Button carries
  `rounded-[min(var(--radius-md),10px)]` and `text-[0.8rem]` (ext-shadcn-state section 3), so `no-arbitrary-values` needs the managed dir exempt for seeds that keep such values; our seeds should not.
- An ejected file leaves the manifest: it stops being "framework" for provenance-keyed rules (it is app code, fully linted, F section 3) and `doctor` stops caring.
- App-owned composites in `src/components/` (not in the manifest) are free and fully linted.
- Shipped `*.guard.ts` type-guard files travel with the copy and are part of the managed set (F, section 2.1).

## 3. Criteria 1-7, measured

### 3.1 Criterion 1: can a consumer change internals, and what breaks at the next upgrade

Simulated upstream 0.2.0 in all shapes (same patch): default size line changed, `destructive` variant inserted, `type={props.type ?? 'button'}` added (3 hunks).
Consumer edits: E1 `outline` line (disjoint), E2 default-size line (overlaps), E3 `loading` prop + spinner (structure; overlaps the JSX line).

| Shape | Can bend?                                                                                                                                                                                                           | What happened at 0.2.0 (F)                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A     | className only. `Button className="h-11 px-4 sm:h-10 w-full"` renders `sm:px-2.5 h-11 px-4 sm:h-10 w-full` (twMerge cannot drop the baked `sm:px-2.5`). Structure (E3) impossible; `render` prop and wrappers exist | `bun patch @scratch/basalt-a` + `--commit` created `patches/*.patch`; `bun add ...0.2.0.tgz` printed `warn: ... no longer applies`, exit 0, `loading` count in dist went 1 -> 0. Silent loss                                                                                                                                                                                                                                                             |
| B     | full                                                                                                                                                                                                                | `shadcn add @basalt/button --yes` prints `The file button.tsx already exists. Would you like to overwrite? (y/N)`; non-TTY exits 0 with the file unchanged (silent no-op). `--overwrite`: updated, **E1/E2/E3 all destroyed** (0/3 survive, no warning). `--diff` is two-way and renders local lines with altered quotes and `px-3sm:h-8` (space dropped; display only, file intact). `--dry-run` prints `overwrite` for pristine-stale and edited alike |
| C     | full; also reaches into npm composites: after editing `icon-sm` to `size-10 sm:size-7` in the app copy, the npm StatCard's menu button rendered `size-10 sm:size-7` (F)                                             | `basalt3 sync`: pristine `updated`; E1 `merged (clean three-way merge, local edit kept)`; E2 `CONFLICT (1 hunk)` with diff3 markers labelled `local / installed(0.1.0) / shipped(0.2.0)`; E3 `CONFLICT (1 hunk)` (signature merged, JSX line conflicted). `doctor` exit 1 on drift and on markers. `sync --check` exit 1 with `merge would be clean` / `1 conflict(s)` and writes nothing                                                                |
| D     | after `eject`, yes                                                                                                                                                                                                  | alias follows in Vite and SSR; `tsc` still reads the npm `.d.ts`: `<Button loading>` fails `TS2322` while `vite build` succeeds (F) unless eject also writes tsconfig `paths`                                                                                                                                                                                                                                                                            |

- **F** the existing ledger is format-insensitive only for whitespace: trailing spaces on every line -> `doctor` ok; one `oxfmt` run with default style (double quotes, semicolons)
  -> `drifted` (`diff` shows 3 import lines changed). `oxfmt(seed) == oxfmt(consumer copy)` (cmp equal), so the fix is format-then-hash with the consumer's formatter, or ignore the managed dir in the formatter (`--ignore-path`).
- **J** the ledger needs the as-installed content for a three-way merge. Options: store it in `.basalt/base/` (what I did, +1 file per managed file) or re-fetch it from the npm tarball of `manifest.basaltVersion` (U, not built).

### 3.2 Criterion 2: which of the 48 `[type]` bullets survive

**F** counts: `grep` over `packages/basalt-ui/agent/rules/*.md`: 101 bullets, 48 carry only `[type X]` (53 carry a lint or check-theme id); 39 distinct symbols, all resolve to a source
file; by directory: charts 11, controls 5, shell 4, router-tanstack 4, tokens 2, table 2, state 2, provider 2, commands 2, theme/forms/dashboard/content/agent 1 each. **0 of 48 name a visual
primitive**: they are composites and logic. **F** 15 of 48 (first symbol's file imports `@mantine`): overlays, ViewTabs, RangeFilter, SyncButton, BarAction, SidebarBlock, useBasaltForm, BasaltProvider x2, BasaltShell x2, VX x2, groupTokens, createBasaltTheme; these die or are re-authored with Mantine regardless of delivery.

Survival rule I found: a `[type]` bullet survives iff its declaration is **not consumer-mutable** (npm `.d.ts`) or ships a guard file that fails on mutation. Sample of 18 (v3 home: L logic, K composite, M Mantine-bound):

| #   | Bullet (file:line) -> symbol site                                                                   | Mechanism                              | Home   | A    | B             | C    | Evidence                                                                                                                                                                                 |
| --- | --------------------------------------------------------------------------------------------------- | -------------------------------------- | ------ | ---- | ------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | basalt-batteries.md:21 createBasaltRouter (provider/create-router.tsx:148)                          | option typing                          | L      | yes  | copy, mutable | yes  | J                                                                                                                                                                                        |
| 2   | batteries:22 emit (commands/notifications/define-notifications.ts:184)                              | `Register` augmentation                | L      | yes  | yes           | yes  | **F** augmentation compiles for package, alias and relative specifiers                                                                                                                   |
| 3   | batteries:27 useBasaltForm (forms/create-form.ts:42)                                                | Standard Schema param                  | L (+M) | yes  | mutable       | yes  | J                                                                                                                                                                                        |
| 4   | batteries:35 Markdown contentTrust (content/markdown.tsx:616)                                       | required union prop                    | K      | yes  | mutable       | yes  | J (mechanism as row 18)                                                                                                                                                                  |
| 5   | batteries:41 AgentPart (agent/parts.ts:199)                                                         | `default: return part satisfies never` | L      | yes  | yes           | yes  | **F** adding `destructive` upstream made `tsc` fail `TS1360` in the consumer switch after upgrade                                                                                        |
| 6   | mantine.md:21 BasaltProvider (provider/index.tsx:488)                                               | forbid prop                            | M      | dies | dies          | dies | J (Mantine-only)                                                                                                                                                                         |
| 7   | mantine.md:27 BasaltShell data props (shell/index.tsx:307)                                          | never `ReactNode` slots                | K (+M) | yes  | mutable       | yes  | J                                                                                                                                                                                        |
| 8   | mantine.md:30 defineNav `mobile` (router-tanstack/nav.ts:165)                                       | closed union                           | L      | yes  | mutable       | yes  | **F** closed-union guard: widened in B copy -> `TS2578 Unused @ts-expect-error` only if the guard ships                                                                                  |
| 9   | controls.md:26 PageBar <=5 actions, Section <=3 (shell/page-bar.tsx:392, dashboard/section.tsx:235) | tuple budget                           | K      | yes  | mutable       | yes  | **F** analog: StatCard `footer` 2-tuple; widened in B copy -> guard fires (TS2578); cannot be widened in npm (A, C)                                                                      |
| 10  | controls.md:35 ViewTabs `field` only (controls/view-tabs.tsx:76)                                    | `never` slots                          | K (+M) | yes  | mutable       | yes  | J (same mechanism as 9)                                                                                                                                                                  |
| 11  | controls.md:36 FilterSet (controls/filter-set.tsx:61)                                               | child union                            | K      | yes  | mutable       | yes  | J                                                                                                                                                                                        |
| 12  | controls.md:45 PageAside required `title` (shell/page-aside.tsx:282)                                | required prop                          | K      | yes  | mutable       | yes  | J                                                                                                                                                                                        |
| 13  | controls.md:46 SidebarBlock (shell/nav-types.ts:176)                                                | typed data                             | K (+M) | yes  | mutable       | yes  | J                                                                                                                                                                                        |
| 14  | charts.md:21 ariaLabel required (charts/types.ts:311)                                               | required prop                          | K      | yes  | mutable       | yes  | J                                                                                                                                                                                        |
| 15  | charts.md:27 ChartState (charts/types.ts:247)                                                       | state object                           | K      | yes  | mutable       | yes  | J                                                                                                                                                                                        |
| 16  | state.md:20 createSearchStore (router-tanstack/search-store.ts:232)                                 | generics                               | L      | yes  | copy          | yes  | J                                                                                                                                                                                        |
| 17  | state.md:37 `interface Register { router }` / navTarget (router-tanstack/nav.ts:204)                | augmentation                           | L      | yes  | yes           | yes  | **F** as row 2                                                                                                                                                                           |
| 18  | tokens.md:25 VX.accentFill (tokens/core.ts:149)                                                     | typed token map                        | L (+M) | yes  | mutable       | yes  | **F** analog: `Button({ variant: 'neon' })` and `size: 'huge'` rejected in all three; widened `size` in a B or C copy -> TS2578 with the shipped guard, and in C `doctor` exits 1 anyway |

Totals (J, from the table): 33 of 48 are Mantine-free and survive as written in A and C; 15 need re-authoring (Mantine) in every shape; in B the survivors are mutable and
rely on shipped guards. A rule text citing an import specifier (`basalt-ui/...`) is fixed in A and C, alias-dependent in B (**J**: the skill cannot name `@/components/...`).

### 3.3 Criterion 3: `@shadcn/lint` `no-restyle` and a provenance-keyed rule

Test file `src/Lint.tsx` (`<Button className="p-4 w-48 bg-red-500">`, `<Button className="mt-2">`, `SelectTrigger h-12`, `<StatCard className="p-8">`, app-owned `<MyCard className="p-8 bg-red-500">`), `.oxlintrc.json` `jsPlugins: ["@shadcn/lint"]`, oxlint 1.92.0.

| Config                                           | A                                                                                                                   | B                                                                                                      | C                                |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------- |
| defaults (`no-restyle` allow layout)             | **0 findings** (only `no-raw-colors`)                                                                               | Button p-4, bg-red-500 flagged (variants listed from the file); StatCard not (outside `components/ui`) | Button flagged; npm StatCard not |
| `settings.shadcn.componentImports` set per shape | Button p-4, bg-red-500, StatCard p-8                                                                                | identical 3                                                                                            | identical 3                      |
| message quality                                  | "Use a variant: default, outline, ghost. Add a new variant to <Button>..." (variants read from the package d.ts/js) | same + "in src/components/ui/button.tsx"                                                               | same as B                        |

- **F** MyCard is never flagged by regex recognition in A/B/C as long as it lives outside the configured prefixes. **F** with `componentImports: ["^@/components/ui/"]` an app-owned `src/components/ui/own.tsx` IS flagged
  (`<Own className="p-8 bg-red-500">`): regex recognition cannot tell managed from app-owned in the same directory.
- **F** my 60-line oxlint JS plugin `basalt/no-restyle` (`$S/lint/basalt-provenance.js`) keys on provenance: import from the npm package, or a path listed in `.basalt/manifest.json`. On c-full it flagged
  Button (managed copy) and StatCard (npm) and **spared** `Own`. After `eject` (manifest entry removed) the file is no longer framework. B has no manifest, so B can only use the path heuristic. A uses the package specifier.
- **J** the provenance rule is the part `@shadcn/lint` cannot do; use `@shadcn/lint` for the class-grammar rules (`no-raw-colors`, `no-arbitrary-values`, `no-unknown-classes`, `require-static-classes`) and our plugin for provenance, structure and Router/Query/Chart boundaries. Alpha-API risk is already carried (`.oxlintrc.json:4` in the repo).

### 3.4 Criterion 4: a consumer who installs only StatCard

- **F** HTML identical across shapes: `cmp` of SSR output equal for a/b/c in both `stat` (md5 `91713d6f...`, 2673 B) and `full` (`099203e9...`, 4448 B). All 74 class tokens StatCard renders have a generated rule in each CSS.
- A: works with `stat-card.css` or `styles.css`. **F** Tailwind 4.3.4 `@source "./ui/button.js"` scans the whole `ui/` directory: a sibling file with `bg-fuchsia-500` was generated (3 hits) until `@source not "./ui/zz.js"` was added. So per-file scoping does not exist; StatCard-only gets Select's 13 extra rules (CSS 21094 B vs 20522 B, +2.8%). `@source not` restores 20522 B.
- B: `shadcn add @basalt/stat-card` on a cold app created 5 files (utils, tokens, theme, button, stat-card) and added `@base-ui/react@1.9.0`, `class-variance-authority ^0.7.1`, `clsx ^2.1.1`, `tailwind-merge ^3.7.0`. **F** without a `css` field on the base item the CSS file is placed but never imported (`index.css` unchanged -> unstyled); with `css: { "@import \"./basalt-theme.css\"": {} }` it is injected. **F** re-adding on an app that already had the single-quoted import appended a second double-quoted import (CSS 23113 B vs 21094 B: tokens twice; no trailing newline).
- C: `basalt3 add stat-card` resolves `REQUIRES` -> copies `button.tsx`, records it in the manifest. CSS byte-identical to B (20522 B).
- **F** `shadcn init <url-to-registry:base item> --yes` with `extends:"none"` works: it writes `components.json` from the item's `config` (including `registries.@basalt`), places tokens/theme, injects the import. **F** a base item whose `registryDependencies` uses `@basalt/utils` fails first run with `Unknown registry "@basalt"`; it must use an absolute URL (assistant-ui does the same). The stub `style` stays `new-york`.

### 3.5 Criterion 5: sizes, peers, bundle, Tailwind scan

| Metric (F)              | A                                                                                         | B                                                                           | C                                                        | baseline                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| tarball (`bun pm pack`) | 7219 B (dist + src)                                                                       | registry JSON 19884 B (5 items)                                             | 8880 B (dist + seeds + bin)                              | basalt 2.29.0: 8.64 MB unpacked, 1420 files, 36 peers (`npm view`) |
| consumer deps added     | 3 deps + 4 peers (`@base-ui/react`, react, react-dom, tailwindcss)                        | 4 deps written into the app, mostly `^`-ranged (only `name@ver` pins stick) | 2 deps + 4 peers (adds cva)                              |                                                                    |
| `full` JS raw / gzip    | 369530 / 118078                                                                           | 369465 / 118232                                                             | 369465 / 118232                                          | react-dom-only app 219466 / 67663                                  |
| `stat` JS raw / gzip    | 261036 / 81228                                                                            | 261021 / 81066                                                              | 261036 / 81228                                           |                                                                    |
| `full` CSS raw / gzip   | 21094 / 5048                                                                              | 23113 / 5166 (duplicate import)                                             | 21094 / 5048                                             | 4198 (preflight only)                                              |
| `stat` CSS raw          | 21094 (`stat-card.css`, dir-granular) or 20522 with `@source not`                         | 20522                                                                       | 20522 (byte-identical to B)                              |                                                                    |
| lib `@source` omitted   | **F** `base.css` only: CSS 12281 B, 0 `bg-good`/`sm:h-8` rules (library utilities absent) | n/a (consumer scans its own copies)                                         | n/a for copies; composites need `@source "./composites"` |                                                                    |

- **F** a consumer app with no `.gitignore` re-scans its own previous `dist/` and polluted my first measurements (scoped and full looked equal); with `dist` ignored they diverged. **J** real apps are git repos, but `check` scripts that run Tailwind in a clean checkout never see this.
- **J** the StatCard-only cost is a property of the component graph (StatCard -> Button -> Base UI Button + cva + twMerge = +41.5 KB raw, +13.5 KB gz over react-dom), not of the shape.
- **J** a 12-consumer SemVer story needs the ranges in B to be pinned (`dependencies` accept `name@1.2.3`) or Renovate on every app.

### 3.6 Criterion 6: SSR without hydration warning

`vite build --ssr src/entry-server.tsx`, `renderToString`, then `hydrateRoot` in jsdom with `console.error` and `onRecoverableError` captured (`$S/tool/ssr-check.mjs`, `$S/ssr.sh`).

| App                                                                   | result (F)                                                                                                                         |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| a-full, a-stat, b-full, b-stat                                        | `hydrationMessages: []`                                                                                                            |
| c-full, c-stat, **before** the plugin sets `ssr.noExternal`           | `ERR_MODULE_NOT_FOUND: Cannot find package '@basalt/ui' imported from node_modules/@scratch/basalt-c/dist/composites/stat-card.js` |
| c-full, c-stat, with `ssr: { noExternal: ['<pkg>'] }` from the plugin | `hydrationMessages: []`                                                                                                            |
| d-full pristine and ejected                                           | `[]`                                                                                                                               |
| positive control (`Math.random()` in the rendered value)              | `Hydration failed because the server rendered text didn't match the client` (the harness does detect mismatches)                   |

**J** jsdom is not a browser; Base UI's popup is closed on first render so the Select is hydrated closed only. The seam makes C Vite-shaped: other bundlers need their own alias plus an equivalent of `noExternal` (U: not tested; all current consumers are Vite).

### 3.7 Criterion 7: a bug or CVE fix reaches 12 apps

12 cloned consumers per shape (`$S/fleet`); in B and C apps 03,04 carry E1 (disjoint edit) and 05,06 carry E2 (overlapping), the rest pristine. A cannot hold such edits (they live in app code as className overrides).

| Path (F)                                             | Wall time | Fixed                                                 | Local edits kept | Needs a human                                              |
| ---------------------------------------------------- | --------- | ----------------------------------------------------- | ---------------- | ---------------------------------------------------------- |
| A: `bun add <tgz 0.2.0>` x12                         | 0.43 s    | 12/12                                                 | n/a              | 0                                                          |
| B: `shadcn add @basalt/button --yes --overwrite` x12 | 11.0 s    | 12/12                                                 | **0/4**          | 0, and nobody is told anything was lost                    |
| C: `bun add` + `basalt3 sync` x12                    | 2.9 s     | 12/12 files carry the fix (2 inside conflict markers) | **4/4**          | 2 conflicts (exit 1 on those two); 2 clean merges reported |

- **F** B can not enumerate stale apps: `add --dry-run` prints `overwrite` for both pristine-stale and edited copies and there is no `outdated` command. C: `sync --check` exits 1 per app and `doctor` lists `drifted` without network.
- **J** the C fleet loop is what a `basalt-ui` Renovate/bump PR would run in CI (`sync --check` as a gate); a CVE in a dependency (Base UI, cva) is a package.json bump in all three shapes, and in B the range is whatever the CLI wrote.

## 4. Decision matrix

| Criterion                                   | A compiled                                       | B registry copy-in                                        | C hybrid (managed)                                          | D compiled + eject                                                         |
| ------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1 bend internals                            | no (className lossy, patch silently dropped)     | yes, owned                                                | yes, managed by eject                                       | yes after eject; TS and Vite resolve differently unless `paths` is written |
| 1 upgrade conflict UX                       | none to resolve; loss is silent                  | y/N prompt; `--overwrite` destroys; two-way diff          | three-way merge, markers, `doctor` gate                     | as C for ejected files only                                                |
| 2 `[type]` bullets                          | all survive (immutable d.ts)                     | survive only with shipped guards + drift gate             | all Mantine-free survive (composites and logic stay in npm) | as A until eject                                                           |
| 3 lint recognition                          | needs `componentImports` (default 0 findings)    | default works for `components/ui` via components.json     | manifest provenance exact                                   | as A, plus manifest for ejected                                            |
| 4 StatCard only                             | works; dir-granular `@source`                    | works if base item has `css` import; duplicates on re-add | works; closure add                                          | works                                                                      |
| 5 bytes / peers                             | same bytes; 4 peers + 3 deps                     | same bytes; 0 peers, 4 unpinned deps                      | same bytes; 4 peers + 2 deps                                | as A                                                                       |
| 6 SSR                                       | pass                                             | pass                                                      | pass with `noExternal` (fails without)                      | pass with `noExternal`                                                     |
| 7 fleet fix                                 | 0.4 s, 12/12, 0 human                            | 11 s, 12/12, 4/4 edits lost, stale not detectable         | 2.9 s, 12/12, 4/4 kept, 2 human                             | A for 8, C for ejected                                                     |
| New machinery                               | `@source` CSS                                    | registry build + `css` field wiring                       | ledger base store, seam plugin, format-aware normalise      | eject + `paths` writer                                                     |
| Reversal cost                               | to C: retrofit seam in each composite (moderate) | to anything: high (no manifest, no base)                  | to A: low (delete + codemod)                                | low both ways                                                              |
| Agent can read primitive source in the repo | no (node_modules)                                | yes                                                       | yes                                                         | only if ejected                                                            |

## 5. Recommendation (single): C, managed

**Why C over D**: D matches C on size and fleet results for un-ejected apps, but the owner's reason for leaving Mantine is to own and bend the implementations, and coss states agents reading the code as a goal (ext-shadcn-state section 6.1). In D the code is in
`node_modules` until someone ejects, and the TS/Vite split (F) is a new failure class. C puts every primitive in the repo on day one; the churn argument is weak because primitives change rarely (visual), while the high-churn
modules (state, forms, table engine, charts, shell logic, composites, tokens) stay in npm. **J** that split is the whole design.

**Why not B**: 12 apps and ReUI's 416 KB `data-grid` (ext-shadcn-state section 6.2) say logic cannot be copied; B plus npm logic is C without a ledger, which is the failure measured above.

**Reversal cost if wrong (J, anchored in the F results above)**:

- C is wrong, A was right: `doctor` already lists every drifted or ejected file. Per app: delete the managed files, rewrite `@/components/ui/x` to `basalt-ui/x` (one regex codemod), drop the seam alias. Package side: move `src/ui` into the tsdown entry (the build already handles unbundled output, F) and fix the `isolatedDeclarations` TS9010 cases or use tsc declarations (F). Loss: ejected structural edits. Roughly 1-2 days package work, minutes per app.
- A is wrong, C was right (the path not taken): each composite's primitive imports must become seam specifiers and every app must adopt the ledger: moderate, and avoided if composites use the seam from day one (their import line is the only difference, F).
- B was chosen and is wrong: no base and no manifest exist, so edited and pristine copies are indistinguishable (F); highest cost.

### Layout it implies

```
packages/basalt-ui/                   # the only published package
  package.json                        # exports: ./index.css ./cn ./vite ./lint ./stat-card ... ; bin: basalt-ui
                                      # peers: react react-dom @base-ui/react class-variance-authority tailwindcss ; vite optional
  src/
    ui/                               # AUTHORED primitives; NOT compiled into dist; shipped as seeds
      button.tsx select.tsx ...       # import { cn } from 'basalt-ui/cn'; no arbitrary values
      button.guard.ts ...             # type-guard files (ts-expect-error) placed with the copy, managed too
    composites/                       # npm: StatCard, PageBar, FilterSet, ChartCard ... import the seam specifier @basalt/ui/<name>
    lib/ state/ query/ forms/ table/ charts/ shell/ format/   # logic, compiled (tsdown unbundled)
    css/ tokens.css theme.css utilities.css index.css         # index.css: imports + @source "../dist/composites" (dir-granular)
    lint/                             # typed-TS oxlint plugin: provenance-keyed rules (manifest) + structure/boundary rules
    cli/                              # init add sync doctor eject; ledger = src/cli/index.ts:471 MANIFEST_PATH, :1264 normalise, :1300 classify
    vite.ts                           # basalt(): alias seam -> src/components/ui, ssr.noExternal, tsconfig paths check
  seeds/ + registry.json              # GENERATED from src/ui: same files as shadcn registry:base extends:none items (optional second install path)
  agent/{rules,skills,agents,templates}
consumer app
  src/components/ui/*.tsx             # managed copies (ledger)       src/components/*  # app-owned, free, fully linted
  .basalt/manifest.json  .basalt/base/**                              # hashes + as-installed copies (3-way base)
  tsconfig paths "@basalt/ui/*" -> src/components/ui/*               vite.config: basalt()
  src/index.css: @import 'tailwindcss'; @import 'basalt-ui/index.css';
  .oxlintrc.json: jsPlugins [basalt-ui/lint, @shadcn/lint]; no-restyle off under src/components/ui/**
```

Concrete ledger changes (all J; prototype in `$S/lib-c/bin/basalt3.mjs`, 130 lines): (1) store a base copy per managed file; (2) `sync` resolves `drifted` by `git merge-file --diff3` instead of skip/`--force`, advances base and hash, exits 1 on conflict; (3) normalise by formatting with the consumer's formatter before hashing (F: needed); (4) `doctor` errors on `drifted` without eject marker and on `<<<<<<<`; (5) `eject <path>` writes the marker and drops the manifest entry; (6) `add <name>` copies the declared closure (StatCard -> Button).

## 6. The four questions for this decision

|                              | Implement                                                                   | Guarantee                                                                      | Teach                                                                                   | Leave open                                                           |
| ---------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Primitives (copied, managed) | Base UI + cva + tokens, mobile-first sizing in the primitive (`h-9 sm:h-8`) | ledger `doctor`, shipped `*.guard.ts`, `no-restyle` off inside, token rules on | per-primitive reference file generated from the same source; skill says "eject to bend" | eject (owned, fully linted); variants added by eject only            |
| Composites and logic (npm)   | StatCard, shell, table engine, state, charts                                | types (immutable d.ts), provenance-keyed lint                                  | skills + `[type]` rules with named imports                                              | props that are typed data, app-owned composites in `src/components/` |
| Tokens and CSS               | `tokens.css`, `@theme inline` bridge, status tokens                         | `no-raw-colors`, `no-arbitrary-values`, unknown classes                        | rule + skill                                                                            | retune via generated tokens (derive config)                          |
| Delivery                     | `basalt-ui add/sync/doctor/eject`, optional registry mirror                 | `sync --check` in CI, `doctor` in pre-commit                                   | AGENTS block says run `doctor`/`sync`                                                   | consumer formatter (managed dir ignored or format-normalised)        |

## 7. Not done, caveats, unverified

- Only three parts at toy scale (183 lines). Fleet times include only file operations plus `bun add`, not CI. Bundle numbers are for one route.
- No browser: "same look" is proven by byte-identical SSR HTML and the same generated rules for every used class (F), not by screenshots. jsdom hydration only.
- The ledger prototype is mine (`$S/lib-c/bin/basalt3.mjs`), not an edit of `src/cli/index.ts`; base-from-tarball (instead of `.basalt/base/`) is **U**.
- C's seam is Vite-only as built (**U** for Next, Astro, webpack); pnpm symlinked node_modules and Tailwind `@source` scanning of symlinks is **U** (bun copies).
- `@shadcn/lint` is 0.2.5 and oxlint JS plugins are alpha (ext-agent-guardrails); both ran together on oxlint 1.92.0 here (F), not on 1.93.
- B was measured through a static loopback HTTP registry; the CLI refuses `file://` registries (`Request to file://... failed, reason: not implemented... yet...`, F). GitHub-hosted registries (`add owner/repo/item#ref`, 4.10+) were not run (**U**), but they give pinning only by tag/SHA per item and still no base copy.
- Side note for the owner, not part of the finding: `~/.npmrc` contains a plaintext registry auth line; I printed it by accident while reading bun's config. It is not in this file. Consider rotating it.
