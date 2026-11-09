# Gap: token to Tailwind 4 render proof (v3)

Date 2026-11-09. Legend: **F** fact (run or read, cited), **J** my judgement, **U** unverified.
Scratch (outside the repo, not tracked): `/tmp/bv3-render` (Tailwind 4.3.4, Chrome 157 via playwright-core, files opened from `file://`, no dev server). Tailwind 4.3.5 is current but bun's minimum-release-age blocked it **F**; 4.3.4 is what the console runs.
PNGs: `.claude/plans/v3/evidence/assets/gap-token-render/`.

## 0. What was built

- **F** Emitter: `deriveTokens()` from `packages/basalt-ui/src/tokens/derive.ts` (unmodified, imported by path) supplies accent family, fills, onAccent with proposed knobs (`vibrancy` 0/1/2, accent seed `#0077bd`). `hct.ts` supplies `hctToHex`. Status uses `statusHexAtStep` with the stock stops.
- **J/F** The four surface roles (canvas, inset, shell, raised), three inks and ring are NOT in the engine yet. A 60-line scratch layer applies the tone table of `ext-visual-language.md` 4.2/4.3 (warm hue 70, chroma 2.6 dark / 1.9 light; dark T12.5/15/19/24, light T96.5/99.2/92.5/100; inks T93/72/62 and T14/38/44) through the same `hctToHex`. No hex was typed. Output of the default tenant matches the evidence doc (`#23201d #282522 #312e2b #3c3835`, `#f8f4f1 #fefcfb #ece9e6 #ffffff`).
- **F** Page: StatCard in console anatomy (header band with tile, inset, two-stat footer; flush inset, evidence 4.1), four dense rows (id chip, two-line name, dot + label status, delta badge, number), sidebar rail with active item (md and up), tab bar (below md), primary ink / primary blue / secondary / ghost buttons, input plain and focused, type specimen, three accent candidates.
- Fonts are system sans: the Nunito/Hubot pairing was not loaded **U** (type judgement is for the owner's eye).

| PNG                                                      | What                                                  |
| -------------------------------------------------------- | ----------------------------------------------------- |
| `page-1800x1200-dark.png`, `page-1800x1200-light.png`    | whole page, viewport 1800x1200                        |
| `page-390x844-dark.png`, `...-light.png`, `...-full.png` | phone, dpr 2, touch (pointer: coarse); full page also |
| `tenant-t0                                               | t1                                                    | t2-dark | light.png` | same bundle, three tenants, top 700 px |

## 1. `--spacing: calc(0.25rem * var(--vx-density))` (non-inline `@theme`)

**F** It compiles: output is `--spacing:calc(.25rem * var(--vx-density))` at `:root`, every utility stays `calc(var(--spacing) * N)`. It does move every utility. Measured in Chrome (dpr 1), density level L gives multiplier 1+0.1L:

| L   | unit raw | h-8 tile / button | h-13 header | m=0.5 | m=1.5 | unit `round(,1px)` | h-8 then | m=1.5 then |
| --- | -------- | ----------------- | ----------- | ----- | ----- | ------------------ | -------- | ---------- |
| -3  | 2.797    | 22.4              | 36.4        | 1.39  | 4.19  | 3                  | 24       | 4.5        |
| -2  | 3.188    | 25.6              | 41.6        | 1.59  | 4.80  | 3                  | 24       | 4.5        |
| -1  | 3.594    | 28.8              | 46.8        | 1.80  | 5.39  | 4                  | 32       | 6          |
| 0   | 4        | 32                | 52          | 2     | 6     | 4                  | 32       | 6          |
| +1  | 4.391    | 35.2              | 57.2        | 2.19  | 6.59  | 4                  | 32       | 6          |
| +2  | 4.797    | 38.4              | 62.4        | 2.39  | 7.19  | 5                  | 40       | 7.5        |
| +3  | 5.188    | 41.6              | 67.6        | 2.59  | 7.80  | 5                  | 40       | 7.5        |

- **F** Sub-pixel: raw gives 9 of 11 sampled multiples (0.5 to 13) fractional at every non-zero level. `round(,0.5px)` leaves 7 of 11 fractional at +1/-1, `round(,0.25px)` 7 to 9. `round(,1px)` (Chrome 125+, Firefox 118+, Safari 15.4+/17.2 mixed types, caniuse-class source: MDN/BCD via `agw research`) gives integer units 3/4/5, only three distinct densities (levels -3/-2 equal, -1/0/+1 equal, +2/+3 equal), and half-steps land on .5 px at units 3 and 5.
- **F** size-8 tiles scale with the unit (22.4 to 41.6 raw; 24/32/40 rounded). `size-4` icons scale too (11.2 to 20.8 raw). Hairlines do not: `border-t` stays 1px at every level; `h-px` stays 1px (borders and `px` utilities are not spacing). The `h-13` header goes 36 to 68.
- **F** Scope trap: with a non-inline theme `--spacing` resolves at `:root`. A descendant that sets `--vx-density: 0.7` does not change `size-6` (stays 24 px). The inline form (`calc(calc(0.25rem * var(--vx-density)) * 6)`) honours it (16.8 px). Density must therefore live on `<html>` or the theme must be inline, which repeats the calc in every utility.
- **F** The console's `--vx-hit` never reached Tailwind (`shadcn-factory-console.md` 3); at density 0.7 an `h-8` control is 22.4 px, below the 24 px WCAG 2.5.8 floor, so any density that scales `--spacing` needs a `min-h` coarse floor too.
- **J/decision** Do NOT scale `--spacing`. Keep `--spacing: 0.25rem` (rem, so user font size still scales). Density = `--vx-ctl-h` and `--vx-row-h` (28/32/40 and 32/40/48) consumed by owned `h-ctl`/`min-h-row` utilities; icons use a fixed `size-icon`. Reasons: zero sub-pixel states, tiles/icons/hairlines stay crisp, no scope trap, no 3-notch collapse, and the fleet uses no density knob today (`self-tokens-theme.md` 3.4). If the owner wants spacing density, the only safe form is `round(,1px)` with three presets, set on `<html>`.
- Guarantee: lint `control-size-literal` (exists in 2.x) becomes "no `h-<n>` on a control, use `h-ctl`". Teach: "density moves controls and rows, not gaps". Leave open: default density per app.

## 2. Breakpoints and containers

**F** (design-system probe `candidatesToCss`, then `tailwindcss` CLI):

| Option                                                            | `md:` | `sm:`/`lg:`/`2xl:` | `medium:` | stock shadcn paste                   |
| ----------------------------------------------------------------- | ----- | ------------------ | --------- | ------------------------------------ |
| A `--breakpoint-*: initial` + `medium`/`expanded`                 | DEAD  | DEAD               | ok        | `md:` dead                           |
| B keep Tailwind scale (640/768/1024/1280/1536)                    | 768   | live               | DEAD      | works, 4 off-law steps               |
| C `initial` + `--breakpoint-md: 840px`, `--breakpoint-xl: 1200px` | 840   | DEAD               | DEAD      | `md:`/`xl:` land on the size classes |

- **F** A dead class is silent: CLI exit 0, no warning, no CSS (`.sm\:p-4` absent, `.md\:p-1` present, grep of the output). Docs agree: unknown tokens are thrown away (tailwindcss.com/docs/detecting-classes-in-source-files via `agw research`).
- **F** Lint catches it. `eslint-plugin-better-tailwindcss` 4.10.0 `no-unknown-classes` with `entryPoint: page/app.css` reported `sm:p-4`, `lg:flex`, `medium:p-2`, `bg-blue-500` (palette reset) and passed `md:p-4`, `xl:grid`, `bg-primary`. `oxlint-tailwindcss` 1.17.1 (oxlint 1.92 `jsPlugins`, repo's own linter) reports the same four with the reason ("sm is not a variant this design system knows"). Both call `__unstable__loadDesignSystem`, which Tailwind has not promised to keep stable (discussion #20500, proposal only) **F via research**: pin `tailwindcss`.
- **F** Containers: `--container-*: initial` kills `max-w-lg`, `max-w-sm`, `max-w-3xl` (DEAD), which stock dialogs use. Extending instead (`--container-compact: 240px; regular: 480px; wide: 800px`) keeps `max-w-*` and gives `@compact:`, `@regular:`, `@wide:`, `@max-compact:` (compiled to `@container (width >= 240px)` etc., 240/480/800 exact). Cost: `@sm:` etc. stay live.
- **J/decision: C for the viewport, extend for containers.** md=840 and xl=1200 are exactly the size-class boundaries (compact below 840, medium 840-1199, expanded 1200+); agents' trained `md:` keeps working and `xl:` is the expanded switch; everything else is dead and caught. Measured on the page: `(min-width: 840px)` true at 1800, false at 390; sidebar rail shows at 1800, tab bar at 390. A is self-documenting but turns every stock `md:` into the silent kill epos hit (`shadcn-epos-teamchat.md` pain table); switching C to A is a 3-line theme edit with the identical lint.
- **Lints (named):** (1) `tailwindcss/no-unknown-classes` (oxlint-tailwindcss, `entryPoint` = the generated theme) catches dead variants and utilities; (2) basalt rule `tw-off-law` for live-but-banned: numeric container variants (`@sm:` to `@7xl:`), off-ladder spacing (section 4), arbitrary values `[...]` for colour/size/radius/shadow, `text-[Npx]`, `dark:` colour variants, `max-md:`/`max-lg:`; (3) hand `@media (min-width)` keeps `raw-media-query` and the literal-pin test (`breakpoint-literals.test.ts`), because `@media` cannot read the theme var.
- **F** Order trap in the bridge: `--radius-*: initial` or `--shadow-*: initial` placed AFTER definitions wipes them. First render had square corners and no rings for exactly that reason. The generated bridge must put all resets in the first `@theme` block.

## 3. One type scale and the iOS floor

**F** Rungs as compiled (computed in Chrome): micro 11/16, xs 12/16, sm 13/20, md 15/20, base 16/24, lg 18/24, display 30/1. Redefining `--text-sm` to 13px ends the split at its root: stock shadcn `text-sm` now IS 13px, so the console's 84 `text-sm` (14) vs 27 `text-[length:var(--vx-text-sm)]` (13) collapses to one class with one value. The 14px specimen row stays in the render as the old state.

- Rungs (all adjacent ratios 1.06-1.17 except display/lg, same law as `core.ts:92-141`): micro 11 (mono ids, machine strings), xs 12 (axis, meta, badge), sm 13 (rows, controls), md 15 (card/section title, body), base 16 (iOS floor, forms on coarse), lg 18 (rare), display 30 (hero figure). Dropped from today's ladder: nano 10, h2 21, kpi 22, h1 26; article sizes belong to the content layer **J**.
- **F** Floor: `@layer base { @media (pointer: coarse) { input, select, textarea { font-size: max(16px, 1em) !important } } }`. Measured: fine pointer 1800 wide: `text-sm` input 13px, stock `text-base md:text-sm` 13px, inline `font-size:13px` 13px. Coarse 390 wide: `text-sm` 16, stock `text-base md:text-sm` 16, inline 13px style 16, `text-lg` 16. `!important` in a layer beats utilities and non-important inline style (important inverts layer order); this keeps the one legitimate `!important` of `styles.css:150`.
- **F/J** Behaviour change to decide: today the floor is unconditional (`styles.css:150-153`), so desktop inputs are 16px next to 13px rows. The coarse-only form makes desktop inputs 13px (dense, matches rows) and iOS Safari (primary pointer is always coarse) keeps 16. Side effect: `max(16px, 1em)` caps a deliberately larger coarse input at 16 (1em is the parent size) **J**, acceptable.
- **J** Touch: `h-8` controls are 32px on the phone (not measured, from the class); the `--vx-hit` floor (24 fine, 44 coarse) must be a `pointer-coarse:min-h-11` on the owned `Button`/`Input`, as `styles.css:300-330` does today. **U** not rendered.
- Guarantee: ban `text-[...]` (`tw-off-law`); the `sm-input-font` check becomes a test over the built CSS (coarse input = 16). Teach: "pick a rung; text-sm is 13". Leave open: nothing (fonts are open, sizes are not).

## 4. Sub-xs spacing step (weatherorb)

**F** Weatherorb's `gap|padding|margin` literals (grep of `apps`, 187 hits): 0 x27, 1 x3, 2 x12, 3 x9, 4 x21, 5 x3, 6 x45, 7 x6, 8 x15, 9 x3, 10 x6, 12 x21, then 14/16/18/56. Its 35-37 permanent `inline-spacing` warns come from the 1-9px range (`consumer-weatherorb.md:141,174`).
**F** Tailwind needs no new token: spacing is a multiplier, so `gap-0.5`=2px, `gap-1.5`=6, `gap-2.5`=10 all compile (`p-1.25` too, which is the problem). Of weatherorb's 1-12px values, 2/4/6/8/10/12 (120 hits) land on half-unit steps; 1/3/5/7/9 (24 hits) do not.

- **J/decision** Ladder = integer multipliers plus `.5` below 4 (2, 4, 6, 8, 10, 12, 14 px, then 16...). Off-ladder odd px snap to the even neighbour or use `border`/`ring`/`h-px` (1px). Prototype lint (run, all 11 candidates compile, 5 flagged): flag a spacing utility whose number is non-integer and not in {0.5, 1.5, 2.5, 3.5}. Name: `tw-off-law` sub-check `spacing-off-ladder`. This ends the permanent warn because the ladder is wider than Mantine's `xs`=8 floor.
- Teach: ladder table in `basalt-tokens.md` (px next to class). Leave open: nothing below the ladder; weatherorb migrates 24 odd sites once.

## 5. Fill on shell (2.76:1) and the primary button

**F** Contrast, accent B (`#2e75b1`, vibrancy +1), warm ramp:

|                  | dark canvas | dark inset | dark shell | dark raised | light canvas | light inset | light shell | light raised |
| ---------------- | ----------- | ---------- | ---------- | ----------- | ------------ | ----------- | ----------- | ------------ |
| fill A `#4374a6` | 3.31        | 3.11       | **2.75**   | 2.37        | 4.48         | 4.79        | 4.05        | 4.90         |
| fill B `#2e75b1` | 3.31        | 3.12       | **2.76**   | 2.37        | 4.47         | 4.78        | 4.04        | 4.89         |
| fill C `#0076bf` | 3.35        | 3.15       | **2.79**   | 2.40        | 4.42         | 4.73        | 4.00        | 4.84         |

White label on fill: A 4.90, B 4.89, C 4.84. Accent as ink (dark `#99c4fa`): 8.98/8.44/7.47/6.43 on canvas/inset/shell/raised; light ink = fill, as above.
**F** Why it fails and why it cannot be tuned away at T19: dark shell Y=0.0278. Fill needs Y>=0.1834 for 3:1; white label needs Y<=0.1833 for 4.5:1. They touch with zero slack, and 8-bit hex lands just off: best fills `#367bb7` 4.493/3.003, `#357ab6` 4.555/2.962. Moving the dark shell to T18 (`#2f2b29`) gives `#357ab6` 4.555 label / 3.08 shell: both pass. Knob result: `accentBrightness` +1 `#4082bf` label 4.07, shell 3.32; +2 `#4f8ecd` 3.45, 3.91 (label falls under the 4.5 AA text bar, still over the engine's 3.0 floor); -1/-2/-3 all clamp to `#2c74b0` (tone 47.2, shell 2.72), so the negative side is dead because `clampFillTone` walks back to 3:1 on the dark page.
**F** Primary button options, B:

| Option                                                | Dark                                              | Light                                        |
| ----------------------------------------------------- | ------------------------------------------------- | -------------------------------------------- |
| Ink-inverted: label canvas on ink fill                | 13.57; fill vs shell 11.30, vs inset 12.76        | 14.28; vs shell 12.91, vs inset 15.27        |
| Blue, white label                                     | 4.89; fill vs shell 2.76, inset 3.12, canvas 3.31 | 4.89; vs shell 4.04, inset 4.78, canvas 4.47 |
| Scheme-aware (dark uses accent ink, near-black label) | label 9.50; fill vs shell 7.47                    | label **3.51** (fails 4.5)                   |

- **J/decision: ink-inverted primary.** It has no surface constraint (11-15:1 everywhere), frees blue for data, and removes the only failing fill pairing (blue never sits on a shell as a button). Blue fill stays available for chips/progress on insets where it measures 3.12 to 4.78. Reverses `DESIGN-CORE.md:36` (already flagged in `ext-visual-language.md` 14).
- Guarantee: fill-floor test must cover every surface a fill may occupy (today `clampFillTone` checks page backgrounds only, `derive.ts:154-178`): fill >= 3.0 on inset in both schemes; on shell only if the dark shell is T18 or the fill tone is raised to ~49.5. Lint: `bg-brand-fill` only inside `Inset`, never as a button on a shell (type: Button variant `primary` is ink).
- Secondary on shell: raised vs shell is 1.16 (dark) / 1.21 (light); the 9%/12% ring over shell is 1.29/1.26. Without the ring the control disappears (visible in the render): `bg-secondary` must carry `shadow-ring`, enforce in the owned Button.

## 6. Which accent is authoritative

Rendered side by side (`page-1800x1200-*.png`, bottom row: button, link, active nav, lit bar, on-shell button), all from the real engine, seed `#0077bd`:

|                      | Fill both schemes | OKLCH         | Dark ink  | Light ink | HCT (hue/chroma/tone) |
| -------------------- | ----------------- | ------------- | --------- | --------- | --------------------- |
| A today (vibrancy 0) | `#4374a6`         | .547 .095 250 | `#a2c3f0` | = fill    | 268/31.8/47.5         |
| B v3 target (+1)     | `#2e75b1`         | .547 .117 248 | `#99c4fa` | = fill    | 268/38.2/47.6         |
| C ceiling (+2)       | `#0076bf`         | .549 .143 247 | `#92c5ff` | = fill    | 270/45.8/47.9         |

- **F** The seed contributes hue only (`derive.ts:16-30`); the shipped hex is a function of hue + vibrancy, not an authored value. So the authoritative object is the config (`accent` seed hue 268, `vibrancy`), never a hex; `#0077bd` (HCT 268/44/48.1) and jkrumm.com's `#0084d1` (268/48/53.1) are inputs/legacy, `#4374a6` is merely today's output.
- **J** B: A reads as muted steel next to a warm ramp, C starts to read as a link blue; the difference is visible at the lit bar and the primary-blue chip. This is an eye call (section 9).
- Teach: "colour is configured by hue + vibrancy, never typed". Guarantee: `raw-hex` plus the generated-name check stay. Leave open: seed and vibrancy per app.

## 7. The shadcn `accent` collision: name map

**F** shadcn `accent`/`accent-foreground` = hover surface; basalt `--vx-accent` = brand ink; epos hit this and did a repo-wide `accent -> primary` rename (`shadcn-epos-teamchat.md:83`). With an ink-inverted primary the collision resolves cleanly: shadcn `primary` becomes the main-action colour (ink), and basalt's blue gets its own non-shadcn names.

| shadcn name                                | basalt token                                       | Role                                               |
| ------------------------------------------ | -------------------------------------------------- | -------------------------------------------------- |
| `background` / `foreground`                | canvas / ink                                       | page                                               |
| `card`                                     | shell                                              | the ringed frame; new `inset` utility = inset      |
| `popover`                                  | raised                                             | overlays                                           |
| `primary` / `primary-foreground`           | ink / canvas                                       | main action (ink-inverted)                         |
| `secondary`                                | raised (+ ring)                                    | default action                                     |
| `muted` / `muted-foreground`               | shell / ink-muted                                  | quiet surface and text                             |
| `accent` / `accent-foreground`             | row-hover / ink                                    | hover surface only (unchanged shadcn meaning)      |
| `destructive`                              | bad                                                | text/tint, never a solid                           |
| `border` / `input`                         | ring                                               | ring colour, ink-mixed                             |
| `ring`                                     | brand (accent ink)                                 | focus ring                                         |
| NEW `brand`                                | `--vx-brand`                                       | accent as ink: links, now-mark, active icon, focus |
| NEW `brand-fill` / `on-brand`              | `--vx-brand-fill` / `--vx-on-brand`                | blue chip/progress on insets                       |
| NEW `good`/`warn`/`bad` + `-tint`          | status solids; tint = color-mix at `--vx-tint-pct` | delta, status                                      |
| NEW `selected`, `chip`, `faint`, `dim-bar` | row-selected, raised, ink-faint, ink 34%/38%       | rows, chips, bars                                  |
| `chart-1..5`                               | brand-fill, teal, orange, indigo, red fills        | categorical                                        |

**J** The word `accent` in basalt docs/rules/skills must be retired for the blue (`brand`), or agents will keep writing `bg-accent` for a blue fill. Guarantee: `--color-accent` never aliases the blue (test over the generated bridge) and `bg-accent` on a button is flagged. Teach: one line in `basalt-tokens.md`.

## 8. Per-tenant theming

**F** Yes. One built bundle (`dist/app.css`, 20,859 bytes, 4,961 gz, sha256 prefix 029bed4e, identical for all pages) plus a tenant block. Selector `:root[data-tenant="t1"][data-theme="dark"]` (specificity 0-3-0) beats the default `:root[data-theme]` (0-2-0), so order does not matter. Colour utilities are inline-theme, so they read the re-pointed `--vx-*` directly.

| Tenant | Config                                 | Fill      | Block size       | Gates                                   |
| ------ | -------------------------------------- | --------- | ---------------- | --------------------------------------- |
| t0     | warm, seed `#0077bd`, vibrancy 1       | `#2e75b1` | 1,768 B (551 gz) | all pass except dark fill on shell 2.76 |
| t1     | cool zinc neutral, navy seed `#22476d` | `#4174ab` | 1,768 B (552 gz) | same                                    |
| t2     | slate neutral, teal seed `#0f8a7e`     | `#008074` | 1,768 B (550 gz) | same                                    |

Gates run per tenant (all engine-computed): inks >=4.5 on canvas/inset/shell, status text >=4.5 on four surfaces and on its own 16%/12% tint, label on fill >=4.5, brand ink >=3 on inset, fill >=3 on inset, ink-inverted label >=4.5. The tint-aware solver is needed: stock stops fail on the shell tint (dark bad 4.05, light good 3.87, warn 3.91, bad 3.92 on shell); the walked values (`#ff8d84`, `#226b40`, `#855400`, `#a83434`) pass at 4.51-4.55.

- **F** FOUC: tenant `<style>` inlined in `<head>` (as SSR would): colour read at the first `requestAnimationFrame` = tenant fill (`#4174ab`). Same CSS appended by script 150 ms later: first frame `#2e75b1` (default), then `#4174ab` = a visible flash. So tenant CSS must be in the server HTML (or a render-blocking `<link>`), never effect-applied; the `data-theme` pre-paint script pattern already exists (`index.html` head, epos `theme-init.js`). **U** CSP: epos bans inline scripts; whether inline `<style>` needs a nonce/hash there was not checked.
- **F** Which derive inputs must be precomputed (they are the whole config): accent seed hue (chroma normalised, tone pinned), `vibrancy`, `accentBrightness`, neutral `{hue, chroma per scheme}`, tone table. Outputs, 1.8 KB: every colour that depends on them, including status text (it depends on the neutral via the solver) and ink. Nothing can be derived in CSS (HCT is not CSS), so a tenant block is a build-or-save-time product. The engine plus emitter bundles to 9.8 KB minified, 4.4 KB gz, no dependencies, so it can also run in a browser theme picker or at tenant save; the request path only serves a stored string.
- **F** Hard limit of the engine for epos: the navy fill cannot be produced. epos hand-set light fill tone 29.3 (white 9.59) and dark fill tone 39.0, which is 2.64:1 on its own dark page (HCT of its tokens, hex omitted). basalt pins the fill band at tone 47.6 and `clampFillTone` refuses darker. A "navy" tenant renders as mid-blue (t1: hue only). The 3.0 floor is a basalt law (the WCAG label need is 4.5 and is met at 6.7 to 9.6), so epos already breaks the engine's guarantee by hand, which is the doctrine violation `self-tokens-theme.md` flags (hand-edited hexes).
- **Survey (who needs it):** argo, rb, weatherorb, image-gateway call `createBasaltTheme` bare, no knobs (`self-tokens-theme.md` 3.4) **F**. epos needs a different accent from the default (navy), build-time, one product; whether it serves several runtime tenants is **U** (nothing in its tokens or DESIGN.md says so). jkrumm.com hand-ports an accent that drifted (`#0084d1`, `consumer-jkrumm-com.md:27`). shutterflow hand-copies hex for SSR/email (`consumer-shutterflow.md:66`). No consumer needs runtime multi-tenant today; the need is a delivered emitter with a derive CLI (`--accent --neutral --vibrancy`, `self-tokens-theme.md` 3.5).
- Implement: `emitCss({ config, scope })` where scope is `:root` or `:root[data-tenant=x]`; same `--check` contract. Guarantee: the gates above run in the emitter and refuse to emit a failing tenant; tenant block is generated, never authored (raw-hex law). Teach: skill page "retune or add a tenant: config only". Leave open: tenant set, seed, neutral, vibrancy, and (needs owner decision) per-scheme fill tone for brands darker than tone 47.6.

## 9. Final `@theme` bridge (generated, resets first)

Tested text is `/tmp/bv3-render/page/app.css`; the two edits below are decisions from sections 1 and 5, not yet rendered (**U**: `h-ctl`/`min-h-row`/`size-icon` utilities compile trivially but were not exercised).

```css
@import 'tailwindcss';
@import './tokens.generated.css'; /* :root scalars + :root[data-theme=dark|light] pairs, from derive */
@custom-variant dark (&:where([data-theme='dark'], [data-theme='dark'] *));

@theme {
  /* 1. RESETS FIRST: a reset after a definition wipes it */
  --color-*: initial;
  --shadow-*: initial;
  --radius-*: initial;
  --text-*: initial;
  --breakpoint-*: initial;
}
@theme inline {
  /* 2. colours: inline so descendants/tenants that re-point --vx-* win */
  --color-transparent: transparent;
  --color-current: currentColor;
  --color-background: var(--vx-canvas);
  --color-foreground: var(--vx-ink);
  --color-card: var(--vx-shell);
  --color-card-foreground: var(--vx-ink);
  --color-inset: var(--vx-inset);
  --color-popover: var(--vx-raised);
  --color-popover-foreground: var(--vx-ink);
  --color-primary: var(--vx-ink);
  --color-primary-foreground: var(--vx-canvas);
  --color-secondary: var(--vx-raised);
  --color-secondary-foreground: var(--vx-ink);
  --color-muted: var(--vx-shell);
  --color-muted-foreground: var(--vx-ink-muted);
  --color-faint: var(--vx-ink-faint);
  --color-accent: var(--vx-row-hover);
  --color-accent-foreground: var(--vx-ink); /* shadcn meaning: hover surface */
  --color-selected: var(--vx-row-selected);
  --color-destructive: var(--vx-bad);
  --color-border: var(--vx-ring);
  --color-input: var(--vx-ring);
  --color-ring: var(--vx-brand);
  --color-brand: var(--vx-brand);
  --color-brand-fill: var(--vx-brand-fill);
  --color-brand-fill-hover: var(--vx-brand-fill-hover);
  --color-on-brand: var(--vx-on-brand);
  --color-good: var(--vx-good);
  --color-warn: var(--vx-warn);
  --color-bad: var(--vx-bad);
  --color-good-tint: color-mix(in srgb, var(--vx-good) var(--vx-tint-pct), transparent);
  --color-warn-tint: color-mix(in srgb, var(--vx-warn) var(--vx-tint-pct), transparent);
  --color-bad-tint: color-mix(in srgb, var(--vx-bad) var(--vx-tint-pct), transparent);
  --color-chip: var(--vx-raised);
  --color-dim-bar: var(--vx-dim-bar);
  --color-chart-1: var(--vx-brand-fill);
  --color-chart-2: var(--vx-fill-teal);
  --color-chart-3: var(--vx-fill-orange);
  --color-chart-4: var(--vx-fill-indigo);
  --color-chart-5: var(--vx-fill-red);
  --shadow-ring: inset 0 0 0 1px var(--vx-ring);
  --shadow-shell: inset 0 0 0 1px var(--vx-ring), var(--vx-shadow-shell);
  --radius-shell: var(--vx-radius-shell);
  --radius-inset: var(--vx-radius-inset);
  --radius-ctrl: var(--vx-radius-ctrl);
  --radius-chip: var(--vx-radius-chip);
  --font-sans: var(--vx-font-sans);
  --font-mono: var(--vx-font-mono);
}
@theme {
  /* 3. scalars, non-inline (resolve at :root) */
  --spacing: 0.25rem; /* DECISION (section 1): fixed; density moves --vx-ctl-h/--vx-row-h */
  --breakpoint-md: 840px; /* medium  : size-class boundary */
  --breakpoint-xl: 1200px; /* expanded: size-class boundary */
  --container-compact: 240px;
  --container-regular: 480px;
  --container-wide: 800px; /* extend, do not reset (max-w-*) */
  --text-micro: 11px;
  --text-micro--line-height: 16px;
  --text-xs: 12px;
  --text-xs--line-height: 16px;
  --text-sm: 13px;
  --text-sm--line-height: 20px;
  --text-md: 15px;
  --text-md--line-height: 20px;
  --text-base: 16px;
  --text-base--line-height: 24px;
  --text-lg: 18px;
  --text-lg--line-height: 24px;
  --text-display: 30px;
  --text-display--line-height: 1;
}
@utility h-ctl {
  height: var(--vx-ctl-h);
} /* 28/32/40 by density; not rendered (U) */
@utility min-h-row {
  min-height: var(--vx-row-h);
}
@utility size-icon {
  width: var(--vx-icon, 16px);
  height: var(--vx-icon, 16px);
}
@layer base {
  html {
    background: var(--vx-canvas);
    color: var(--vx-ink);
    font-family: var(--vx-font-sans);
  }
  @media (pointer: coarse) {
    input,
    select,
    textarea {
      font-size: max(16px, 1em) !important;
    }
  } /* iOS floor */
}
```

Drift tests to ship with it: every `@theme inline` target is an emitted var; `--color-accent` never aliases the blue; reset blocks precede definitions; coarse input computes 16.

## 10. Four questions, per gap

|                 | Implement                                                          | Guarantee                                                                                       | Teach                             | Leave open                               |
| --------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | --------------------------------- | ---------------------------------------- |
| Spacing/density | fixed `--spacing`; `--vx-ctl-h`/`--vx-row-h`; `h-ctl`, `size-icon` | `control-size-literal`: no `h-<n>` on controls; coarse `min-h-11`                               | "density moves controls and rows" | default density                          |
| Breakpoints     | md=840, xl=1200, containers 240/480/800                            | `no-unknown-classes` (oxlint-tailwindcss, pinned tailwindcss), `tw-off-law` (`@sm:`, `max-md:`) | size-class table, "md is medium"  | none                                     |
| Type            | 7 rungs, `text-sm`=13                                              | no `text-[..]`; coarse-input test                                                               | "pick a rung"                     | none                                     |
| Sub-xs          | half-unit ladder                                                   | `spacing-off-ladder`                                                                            | px-to-class table                 | none                                     |
| Fill/button     | ink-inverted primary; fill tests over every surface                | fill-on-surface gate; `bg-brand-fill` only in `Inset`; secondary must carry ring                | "blue is data, ink is action"     | seed, vibrancy                           |
| Names           | bridge generated with `brand` family                               | `--color-accent` never the blue                                                                 | one `basalt-tokens.md` line       | extra semantic colours via inline bridge |
| Tenants         | `emitCss({config, scope})` + derive CLI                            | emitter refuses failing tenant; no authored hex                                                 | "config only"                     | tenant set, per-scheme fill tone         |

## 11. Questions only the owner's eye can settle

1. Accent: A steel, B (v3 target), or C more saturated. Compare bottom row of `page-1800x1200-dark.png` / `-light.png`. My tendency B.
2. Primary button: ink-inverted (my tendency, section 5) vs blue; see the Controls panel in both schemes.
3. Dark shell T19 (current, step to inset .037 L, but blue on shell 2.76) vs T18 (blue fill passes 3:1 on shell at tone 49.5): does T18 still read "not too dark" and keep the shell/inset step?
4. Flush inset (drawn, evidence 4.1) vs the console's 4 px gutter: one token; which looks right at 1800x1200?
5. Desktop inputs at 13px (coarse-only floor) vs today's unconditional 16px.
6. Warm ramp at chroma 2.6/1.9: warm enough, or brown? (never seen by the owner; system font used, not Nunito/Hubot).
7. epos-style navy: accept that tenants get hue-only mid-blue, or allow a per-scheme fill tone and relax the fill-on-page 3:1 for that tenant (owner/employer decision, not mine).
8. Does epos serve several runtime tenants, or one navy product? (decides whether tenant blocks are build-time only.)

## 12. Reproduce

`/tmp/bv3-render`: `bun src/run-emit.ts` (tokens.css, accent-candidates.css) then `node_modules/.bin/tailwindcss -i page/app.css -o page/dist/app.css --minify`, `node src/shots.mjs`; measurements `src/m1-spacing.mjs`, `m2-scope-type.mjs`, `m3-contrast.ts`, `m3b.ts`, `m4-epos.ts`, `m5-tenants.ts`, `m5-run.mjs`; probes `exp/bp.mjs`, `bp2.mjs`, `ladder.mjs`; lint probes `lintprobe/probe.tsx` with `eslint.config.mjs` and `.oxlintrc.json`. Sources: tailwindcss 4.3.4 (installed `node_modules`), eslint-plugin-better-tailwindcss 4.10.0, oxlint-tailwindcss 1.17.1, `agw research` run 01a1c089 (MDN/BCD `round()`, Tailwind source `compile.ts`/`candidate.ts`, discussion #20500).
