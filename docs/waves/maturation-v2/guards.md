# v2 audit - guards (misuse-protection layer)

Scope: `configs/oxlint-plugin.js`, `configs/oxlint*.json`, `src/guard/**`, `src/surfaces.ts`, `scripts/check-*.ts`, type-guard tests, lefthook/check.yml presets. Evidence is file:line actually read, plus probes run read-only (`/tmp/probe*.ts` against `checkSource`, `/tmp/gp2` fixtures against the real plugin with oxlint 1.87). Paths below are relative to `packages/basalt-ui` unless prefixed.

State in one paragraph: there are two enforcement engines (26 regex "kinds" in `src/guard/index.ts` run by `check-theme` and the Claude hook, 22 shipped AST rules in a 4203-line untyped JS plugin) that resolve provenance differently, keep five hand-synced id registries, and have separate waiver dialects (`theme-allow`, `basalt-agent-allow`, `oxlint-disable`). The rules files promise more than the guards check in at least eight places (below), the consumers carry 15 `basalt` waivers that each point at a framework gap rather than a consumer mistake, and the waiver-liveness audit that would keep them honest is wired into exactly one of six apps.

## Findings (ranked)

### guards-01 [major] Two engines, divergent provenance: alias/namespace imports bypass the regex lane and half the AST lane

- Evidence: probe `import { Card as C } from '@mantine/core'; <C withBorder />` -> no finding (`card-with-border`, `src/guard/index.ts` text scan); `<M.Card p="md" />` and `<C2 padding="lg" />` -> no `basalt/card-inset` (`configs/oxlint-plugin.js:604-640` matches `node.name?.name` in `{Card, Paper}` - a JSXMemberExpression has no `.name`); `import { Title as T }` / `<M.Title order={2}>` -> no `basalt/in-body-page-title` (`:2835-2865`, `jsxTagName` on the local name). Meanwhile `hand-rolled-filter`, `control-outside-home`, `raw-breakpoint` use `collectMantineImports`/`resolveMantineTag` (`:1973-2000`). Same repo, three provenance policies: resolved (control rules), bare-name (card-inset, in-body-page-title, chart-in-raw-surface), text regex (check-theme).
- Proposal: one shared `resolveMantineTag/resolveBasaltTag` helper applied by EVERY JSX rule (lint-test: a rule that reads `node.name.name` directly fails a meta-test). Then retire the regex kinds that target JSX/TS (`card-with-border`, `raw-form-control`, `raw-html-layout`, `hidden-inline-style`, `inline-display`, `raw-selection-control`, `in-body-page-title`, `raw-motion-value`...) into the plugin, leaving `check-theme` as the CSS/HTML/JSON/astro scanner only. That removes `WAIVER_ID_ALIASES` (`:207`, guard `:1121`) - the "one law, two ids" shim exists only because two engines carry the same law.
- Breaking: yes (kinds become `basalt/*` ids; waiver ids change, MIGRATING entry). Consumers: all; rb/argo/linewatch waivers use guard ids.

### guards-02 [major] Rule prose claims more than the guards check (silent violations)

Probed with `checkSource`/oxlint; every row is a documented "never" that passes clean:

- "`localStorage['theme']` never" (`agent/rules/basalt-state.md`, tag `[check-theme localstorage-theme]`): regex is `getItem('theme')` only (`src/guard/index.ts:54`). `localStorage.setItem('theme', ..)`, `localStorage['theme']`, `getItem('mantine-color-scheme-value')`, `matchMedia('(prefers-color-scheme: dark)')` -> no finding.
- "Never a raw `@media` width" ([check-theme raw-media-query]): `.css` only; `'(max-width: 600px)'`/`window.matchMedia('(min-width:600px)')` in TSX pass the text lane (the AST lane catches `matchMedia` calls, not strings handed to `useMediaQuery` wrappers).
- "Animation timing never literal" ([raw-motion-value]): only JSX `transition={{...}}`; CSS `transition: all 200ms ease`, `animation-duration: 300ms` -> clean; `{ type: 'spring', stiffness: 200 }` outside a `transition=` prop -> clean.
- "A scroll region is a ScrollArea" ([basalt/raw-scroll-container]): inline style objects only; `.module.css` `overflow-y: auto` -> clean (argo `diagram.module.css:9` has one).
- "Write no #hex, rgb(), hsl()": `oklch()`, `color-mix()` with literals, `hwb/lab/lch`, and keyword colors (`color: white`, `background: red`) -> clean (`FUNC` at `src/guard/index.ts:53` is `rgba?|hsla?` only).
- "Spacing props take xs..xl" ([raw-spacing]): flags only numbers EQUAL to a scale step (`DEFAULT_SPACING_STEPS = [11,13,18,20,26]`, `:826`; regex at `:2031`); `mt={7}`, `gap="13px"`, `gap={7}` pass.
- "Link store-backed route with `search: store.linkSearch`; never inline `{ range: '30d' }`" ([basalt/search-literal-link]): fires only when `linkOptions` is lexically inside `defineNav/navGroup` (`:2965-3005`); `<Link search={{ range: '30d' }}/>` and `navigate({ search: {...} })` pass - the pinning bug the message describes is exactly the one outside nav. `useSearch({ from: \`/a\` })` (template literal) also passes.
- "`default: return part satisfies never` on every AgentPart switch" (batteries.md, tag `[type AgentPart]`): prose-only; nothing checks it.
- Proposal: for each row either extend the guard (cheap: add the missing token to the regex / AST visitor) or delete the sentence from the rule. Add a meta-test, `rule-claims.test.ts`, with one violating fixture per rule bullet that names a `never`, asserting a finding - the missing piece between Check F ("tag resolves") and "tag fires". See guards-12.
- Breaking: tightening is a new-error event -> ship as 2.x minor, no grace needed (greenfield, see guards-14).

### guards-03 [major] `as never` is the de-facto nav escape and nothing guards or replaces it

- Evidence: rule text "never silence a nav type error with `as never`" is prose ([type defineNav], `agent/rules/basalt-state.md`). Consumers: `argo/apps/dashboard/src/routes/login.tsx:19` (`redirect({...} as never)` for a runtime path), `basalt-ui-obsidian/apps/demo/src/routes/__root.tsx:56` and `lib/vault-search-spotlight.tsx:150` (`to={href as never}`). Runtime-string navigation is a real need (post-login redirect, vault wikilinks, Spotlight results) with no typed seam.
- Proposal: ship the seam and ban the escape: `navigateToHref(href: string)` / `<HrefLink href>` / `redirectTo(href)` that validate against the route tree at runtime (same-origin, known path) and return the typed target; add `basalt/no-as-never` (flag `as never` on arguments of `Link`, `navigate`, `redirect`, `redirect(...)`, `linkOptions`). Cost: ~1 export (budget: adopt-or-delete satisfied by argo+obsidian).
- Breaking: no (additive + lint). Consumers: argo, obsidian.

### guards-04 [major] The plugin is a 4203-line untyped JS file that duplicates package constants by hand

- Evidence: `configs/oxlint-plugin.js` (4203 lines, 26 rules + ~120 helpers) is not in tsconfig `include` (`tsconfig.json`: `["src","tests"]`), so no tsc ever reads it; header says it "must not import from the package" so `KNOWN_RULE_IDS` (`:127`), `WAIVER_ID_ALIASES` (`:207`), `majorOf`, `CHART_ENGINE_ALLOWED_*` are copies, each held in sync by a test. Rule 604-640 vs 2835 show copy-pasted idioms (`hasThemeAllow` / `hasAgentAllow` are literal copies, `:392`).
- Proposal: author the plugin as `src/oxlint-plugin/*.ts` (one file per rule family: tokens, controls, charts, state, agent, boundaries; shared `provenance.ts`, `waiver.ts`), bundle with tsup to a single dependency-free `configs/oxlint-plugin.js` (the standalone constraint is a build-output property, not a source property). Registries then import from `surfaces.ts` directly. Net effect: tsc covers it, 5 hand-synced registries collapse (guards-15), the 4270-line test can import rule metadata.
- Breaking: no. Cost: one wave; net-negative if combined with guards-14/15.

### guards-05 [major] `no-restricted-imports` in the preset is silently replaced by consumer overrides (argo copy-pasted it)

- Evidence: plugin header (`:67-76`) documents the clobber: a consumer `no-restricted-imports` override on an overlapping glob REPLACES basalt's `antd`/`framer-motion` bans. `argo/.oxlintrc.json` lines 20-47 re-declares `antd` and the verbatim `framer-motion` message from `configs/oxlint.json` - the consumer paid the footgun. `basalt-ui-obsidian/.oxlintrc.json` re-declares the whole preset instead of extending it (plugins/categories/rules copied).
- Proposal: move every ban into one plugin rule `basalt/banned-import` (ids per ban, message from `SURFACES.forbiddenImports`), config-driven by `settings.basalt.bannedImports` additive to the shipped list. The chart/token boundaries already follow this pattern (header `:60-75`); the generated `no-restricted-imports` override in `configs/oxlint.json` goes away, as does `scripts/gen-oxlint.ts`'s override emission.
- Breaking: yes (rule ids) but mechanical. Consumers: argo, obsidian.

### guards-06 [major] `basalt/ai-sdk-major` is a package-level check implemented per-import; it caused 8 waivers and a third waiver dialect

- Evidence: `configs/oxlint-plugin.js:1322-1350`; the same fact is `doctor`'s `ai-major-parity` with a mandatory `basalt.aiMajorSkewReason`. `argo/package.json:48` already carries that reason, yet `argo/apps/api` has `basalt-agent-allow` on ~8 files (finish-reason-transform.ts:1, hermes-chunks.ts:1, hermes.ts:5, db/schema.ts:14, hermes-upstream.ts:30, + 3 tests). The plugin does not read `aiMajorSkewReason` although it already walks `package.json` (`isBasaltScopedFile` `:1290`). Also `isBasaltScopedFile` scopes argo's `apps/api` in because the ROOT manifest depends on basalt-ui, though the api "imports no basalt-ui" (hermes.ts:5) - a monorepo scoping false positive.
- Proposal: delete `basalt/ai-sdk-major` and the `basalt-agent-allow` token (doctor owns skew, with its reason); if a per-file signal is still wanted, make the plugin honour `aiMajorSkewReason` instead. Removes one rule, one waiver grammar, `hasAgentAllow`, a filesystem-reading rule (the only impure one) and a KNOWN id.
- Breaking: yes (rule removed - waivers become dead; `--audit-allows` already reports them). Consumers: argo.

### guards-07 [major] The waiver-liveness audit exists but only rollhook runs it

- Evidence: `src/cli/audit-allows.ts` (re-runs oxlint with each waiver neutralised - good). Grep of consumers' package.json/Makefile/workflows: only `rollhook/apps/*/package.json:15-16` (`check-theme && check-theme --audit-allows`). argo/rb/linewatch/obsidian lint scripts are `oxlint . && basalt-ui check-theme`. The seeded `configs/lefthook.yml` and `configs/check.yml` never call it; `doctor` does not either. Consequence: waiver rot is unbounded (rb's three `in-body-page-title` waivers, guards-11, are only discoverable by reading).
- Proposal: `check-theme` runs the audit by default and exits 1 on a dead waiver (flag `--no-audit` for the fast hook); seed the CI step; `doctor` prints the live-waiver count and fails on dead ones. Add a `basalt.maxWaivers` budget (per kind) so a consumer cannot accumulate silently - the repo's own doctrine is "budgets are numbers".
- Breaking: behavioural, mild.

### guards-08 [major] The preset's warn tier never gates, and one rule is double-reported

- Evidence: `configs/oxlint.json:5-7,13-27`: `suspicious: warn`, `no-console: warn`, `no-underscore-dangle: warn`, `react/no-unstable-nested-components: warn`, `react/only-export-components: warn`. Consumers' lint is `oxlint .` (no `--deny-warnings`; `rb/package.json:10`), so warnings exit 0 - yet `rb` carries ~30 `oxlint-disable-next-line no-console` comments and `argo` 17 `/* eslint-disable no-console */` files, i.e. they pay noise cost for a tier that enforces nothing. `src/guard/types.ts` states warn is a landing tier, not permanent; the preset treats it as permanent. Probe `useEffect(() => {...a}, [])` yields BOTH `react(exhaustive-effect-dependencies)` [warn] and `react-hooks(exhaustive-deps)` [error]; consumers disable the latter 15 times (`argo` 8 files, `rb` 2, weatherorb 4, obsidian 1).
- Proposal: every preset rule is `error` or `off` (a test asserts no `warn` in `configs/oxlint*.json`). Turn off `no-console` (consumers' CLIs/servers legitimately log) or scope it to `**/src/**/*.tsx`. Pick ONE exhaustive-deps rule and remove the other; evaluate whether the React-Compiler-era `react/*` set makes `exhaustive-deps` redundant (15 disables say the owner already decided it is). Seed `--deny-warnings` in the lint script `init` writes.
- Breaking: lint severity change.

### guards-09 [major] Panel-local controls have no home; the rule's own home primitive is unexported

- Evidence: weatherorb `w37-basalt-2` waives `raw-selection-control` five times (`apps/web/src/map/chrome/stack-editor.tsx:301,325,340`, `map/point/forecast-tab.tsx:163`, `map/chrome/display-controls.tsx:258`) with the reason "panel-local chrome ... the control panel has no PageBar/Section host". The plugin treats a basalt-provenance `PanelRow` as a home (`configs/oxlint-plugin.js:1895` `BASALT_HOST_TAGS`, guard `src/guard/index.ts:696`), but `src/controls/panel-row.tsx:79` is not exported from `src/controls/index.ts` and absent from `scripts/export-surface.json` (0 hits). The doctrine names a home a consumer cannot import.
- Proposal: either export `PanelRow` (+ `PanelChoice`) from `basalt-ui/controls` as the documented panel home and mention it in basalt-controls.md, or ban the concept and give panels a `Panel`/`PageAside` variant usable outside the shell. Also: the `field`-less case ("state owned by the map URL codec via onChange") is `externalField` (state.md) - the waiver reasons show consumers did not find it; link it from the rule message.
- Breaking: no (additive). Consumers: weatherorb.

### guards-10 [minor] Circle/pill radius: CSS lane exempts it, TSX lane does not -> duplicated waivers and duplicated helper

- Evidence: `src/guard/index.ts:242` `SHAPE_RADIUS_VALUES = {'50%','9999px','999px','100%'}` applied only to `css-raw-surface` (`:2433-2437`); the camelCase `raw-surface` (`:2430-2431`) has no such exemption (probe: `style={{ borderRadius: '50%' }}` -> `raw-surface`). rb waived it twice with the same reason (`rb/apps/web/src/features/course/page.tsx:82`, `library/page.tsx:150`) and copy-pasted the whole `DifficultyPips` component into both pages; linewatch `components/live-chip.tsx:99` waives it a third time ("no radius token is 50%").
- Proposal: apply `isAllowedCssRadius` to the inline lane (one function, both lanes) AND ship the idiom: `VX.radiusPill` exists (`src/tokens/core.ts:174`) - make `raw-surface` message name it, and consider `<Dot size>`/Mantine `ColorSwatch` for pips.
- Breaking: no (loosening). Consumers: rb (2), linewatch (1).

### guards-11 [minor] `in-body-page-title` has no sanctioned shape for "Not found" / detail titles

- Evidence: `rb/apps/web/src/features/course/page.tsx:223` and `knot-detail/page.tsx:2577` (`<Title order={2}>Not found</Title>`, reason "detail route; the breadcrumb names the parent list"), `components/lock-screen.tsx:229` (shell-less). The rule comment (`configs/oxlint-plugin.js:2790-2815`) claims the narrowing "made C8 satisfiable"; static-text error states still fall through. `EmptyState` is exported (`src/index.ts:45`) but the message (`:2768-2776`) never names it.
- Proposal: message points to `EmptyState title=` for not-found/error, `PageTitle` for shell-less; exempt `EmptyState` children by ancestry (like `PAGE_TITLE_HOST_TAGS`, `:2766`); a detail route supplies its title through `staticData`/a `PageBar title` for the loader value so the breadcrumb is the page name.
- Breaking: no.

### guards-12 [major] Check F proves a `[type X]` tag resolves, not that the type makes the mistake an error

- Evidence: `scripts/check-agent-doc-drift.ts` header (Check F) - tag must "resolve" against exports. 42 distinct `[type X]` tags in `agent/rules/*.md`; a name-match heuristic against the 36 test files containing `@ts-expect-error` finds no negative test for 17: BasaltDataTable, CartesianChartProps (the "ariaLabel is required" claim), ChartCardProps, ChartMarks, ChartSeries, ChartState, ChartTooltipConfig, Markdown (`contentTrust`), PlotContext, ResponsiveChartHeight, SyncButton, ThreadRunState, VX (`VX.accentFill` vs `VX.accent` is lint-less), ZoneSpec, chartCursor, createPersistedState, navTarget. Only 7 files use the `*.type-guard.test.*` convention; the rest are scattered (`props-contract.test.tsx`, `index.test.tsx`).
- Proposal: require, per `[type X]` tag, a `// guards: X` marker adjacent to an `@ts-expect-error` in a `*.type-guard.test.ts(x)` file (Check F2), and move the scattered ones to that convention. For claims that are not expressible as a type (`VX.accent` as fill, `default: return part satisfies never`) either add a lint rule or retag the bullet as advisory so it stops reading as enforced.
- Breaking: no; adds ~17 small type tests.

### guards-13 [minor] Rule prose and JSDoc contradict each other / understate enforcement

- Evidence: `agent/rules/basalt-mantine.md` last bullet of "Scroll and breakpoints" says "chrome follows `useSizeClass()`"; `src/shell/use-size-class.ts:1-6` says "Shell-only - components size by container" AND lists "portal targets" as its use; the `raw-breakpoint` message says "`useSizeClass()` is for shell chrome only". rb waived `raw-breakpoint` on the `@mantine/hooks` import for a Drawer position (`rb/apps/web/src/features/knot-detail/page.tsx:36`, "a JS prop on a body-portalled overlay") - that is the portal-target case the JSDoc says `useSizeClass` serves. The rule file also never mentions that `useMediaQuery`/`useMatches`/`useViewportSize`, `window.innerWidth` and `{base, sm}` responsive objects are all errors (`configs/oxlint-plugin.js:3715-3730`), so an agent learns them from a failing lint.
- Proposal: one sentence in basalt-mantine.md listing the banned forms, `useSizeClass` JSDoc stating "overlays/portal targets allowed", message updated. Delete one of the three variants.

### guards-14 [minor] Retired-id and grace machinery is dead weight in a greenfield repo

- Evidence: `RETIRED_RULE_IDS` (`configs/oxlint-plugin.js:97`, 14 ids) and `KNOWN_RULE_IDS` (`:127`; `query-dual-import` is listed twice - in the set and via `...RETIRED_RULE_IDS`); no consumer waiver names a retired id (full consumer grep: only `raw-surface`, `in-body-page-title`, `raw-breakpoint`, `raw-hex`, `raw-selection-control`, `raw-form-control`). `GRACE_PERIOD_KINDS = {}` (`src/guard/index.ts:899`), `PLUGIN_RULE_GRACE = {}` (`:4169`), deprecation half "dormant until the first 2.x deprecation" - yet `scripts/check-grace.ts` (144), `check-grace.test.ts` (91), `src/guard/grace.test.ts` (171), plugin `describe` blocks and `GraceEntry` types are maintained. The owner's mandate is "break freely".
- Proposal: delete the retired-id list (an unknown id already reads as "waives nothing" + audit flags it), delete the empty grace ledgers and `check-grace.ts`, keep the one-line policy in MAINTAINING.md and restore the tooling from git the day a warn-landing is wanted. ~400 lines net negative.
- Breaking: no consumer impact.

### guards-15 [minor] Rule-id registries hand-synced in five places

- Evidence: `src/surfaces.ts:41-68` `PLUGIN_RULE_ID_LIST`; `configs/oxlint-plugin.js:127` `KNOWN_RULE_IDS`; `src/guard/index.ts:1034` `PLUGIN_RULE_IDS`; `configs/oxlint-basalt.json` (22 hand-listed rules; 4 repo-local ones deliberately absent); the beforeEach config in `configs/oxlint-plugin.test.ts:42-68`. Each is test-checked against the others - five tests to keep five lists equal.
- Proposal: with guards-04, define each rule once (`id`, `ships: 'error'|'repo'`, `lane`), generate `oxlint-basalt.json` and the id sets; the test config reads the generated JSON.

### guards-16 [minor] AST lane honours a reason-less scoped waiver; the text lane flags it

- Evidence: fixture `{/* theme-allow card-inset */}<Card p="md"/>` -> oxlint silent; `checkSource` of `// theme-allow raw-hex\nconst b='#fff'` -> `theme-allow-unscoped` on the annotation. So the "missing why is itself a finding" law (basalt-tokens.md) only holds where check-theme also runs. Bare `theme-allow` correctly waives nothing in both.
- Proposal: plugin `parseAllowBody` rejects a scoped waiver without a reason (waives nothing + report), same as the guard; or fold both lanes onto one parser (guards-04).

### guards-17 [major] `query-fn-unwrap` is a text heuristic that fires on nothing real

- Evidence: `configs/oxlint-plugin.js:3199-3235`: regex `fetch(` inside the `queryFn` source span, file must import `basalt-ui`. Its own doc admits it misses `queryFn: fetchThing` references, Eden/Treaty calls and `unwrap(` applied to anything. Consumers: argo has 74 `queryFn` lines, 46 with `unwrap`; the other 28 (`queryFn: fetchSnapshot`, `async () => {...}` bodies) are invisible to the rule. rb/linewatch/obsidian use a hand-written `api.get<T>()` client (0 unwrap, `rb/apps/web/src/features/journal/page.tsx:180`) and pass because there is no `fetch(`. The doctrine sentence in batteries.md ("wrap every API-client queryFn response") is therefore enforced for nobody.
- Proposal: replace the lint with a type: export `apiQuery(key, () => result)` (or make `queryOptions` from `createBasaltRouter` accept only `Promise<T>` produced by `unwrap`, via a branded `Unwrapped<T>`), so a raw Eden result is a tsc error; delete the rule. If `unwrap` has no brand-able contract, delete the sentence.
- Breaking: yes (rule removed / new helper); argo benefits.

### guards-18 [minor] `raw-hex` reports hex-looking anchors and URL fragments

- Evidence: probe: `<a href="#add">`, `#feed`, `#bad`, `'https://x.com/#abc'` -> `raw-hex`; known and documented in the comment above `HEX` (`src/guard/index.ts:41`, "theme-allow is the escape").
- Proposal: skip when preceded by `href=`/`to=`/`hash:`/`url(`/`/`; a regex tweak, zero real colors lost. Add fixtures.

### guards-19 [minor] The lefthook preset contradicts its own `bunx` doctrine; monorepos copy the commands

- Evidence: `configs/lefthook.yml:45,62` runs `bunx oxlint` / `bunx oxfmt`, while the same file (lines 70-85) explains `bunx` can fetch a different version than pinned and uses the local bin for `check-theme`. `linewatch/lefthook.yml` copied the commands with `root: web/` because `extends` cannot carry `root` (the file's own header says so); `linewatch` therefore does not track preset updates (and `bunx oxlint` on a JS-plugin API that is alpha). `configs/check.yml:28` seeds `runs-on: ubuntu-latest`, which the owner's private-repo rule forbids (self-hosted).
- Proposal: ship one `basalt-ui lint` subcommand (local oxlint bin + check-theme + sync --check; `--staged` for the hook) and make the preset a three-line call to it; consumers' `lint` scripts (all identical: `oxlint . && basalt-ui check-theme`) become `basalt-ui lint`. Seed `runs-on` from `basalt.ci.runner`.

### guards-20 [minor] The plugin test suite costs 51s per run (one oxlint process per fixture)

- Evidence: `bun test configs/oxlint-plugin.test.ts` -> 610 tests, 51.2s; `run()` (`configs/oxlint-plugin.test.ts:~72-93`) writes one file and spawns oxlint each time. `pre` runs it.
- Proposal: batch - write all fixtures of a `describe` to a temp dir keyed by case id and run oxlint once with `--format=json`, then assert per file; expect 8-10x. Or call rules through a minimal in-process visitor harness once the plugin is TS (guards-04).

### guards-21 [minor] Density/radius knobs do not feed the guard defaults

- Evidence: `src/guard/index.ts:810-826` - `DEFAULT_SPACING_STEPS` is a literal copy of `SPACE_SCALE` at level 0; a consumer using `createBasaltTheme({ density })` must hand-set `basalt.spacingSteps` or `raw-spacing` flags/permits the wrong numbers. The claim "contrast guaranteed by derivation" is not mirrored for the guard.
- Proposal: `check-theme` reads the consumer's theme options from the same `basalt` config key used to build the theme (or imports `spacingSteps(density)` from `basalt-ui/tokens`) - and see guards-02 on the semantics of this rule.

### guards-22 [minor] Rule messages are essays; 8 error-level rules still say "Warn on"

- Evidence: `inBodyPageTitle` message `:2768` (~700 chars), `raw-breakpoint` message (~900 chars, probe output); `meta.docs.description` strings such as "Warn on a queryFn that fetches..." (`:3203`), "Warn on `search:` object literal inside defineNav/navGroup" (`:2998`), "Warn on useSearch({ from })" - 8 occurrences - on rules that ship `error`.
- Proposal: message = one sentence + the fix + a docs anchor (`basalt-ui docs <rule>`); move the rationale to the rule file. Normalise descriptions.

### guards-23 [minor] The PreToolUse hook scans edit fragments, so context rules cannot fire there

- Evidence: `src/guard/guard-hook.ts:20-60` checks `new_string` (Edit) / concatenated edits in isolation; multi-line constructs (JSX attribute on a later line, a `theme-allow` above) lose their anchor, and none of the 22 AST rules (aliases, ancestry homes) run in the hook.
- Proposal: have the hook shell the plugin over the post-edit file (single-file oxlint run, ~100ms) instead of regex-scanning fragments; keeps one engine (guards-01).

### guards-24 [minor] ESLint consumer gets half the guard

- Evidence: `rollhook/package.json:19` lints with ESLint (antfu config, `eslint.config.mjs`); the 22 AST rules never run there, only `check-theme`. The plugin exports an ESLint-v9-shaped `create(context)` (header) but no flat-config export.
- Proposal: either state in `doctor` that an ESLint app is "partially guarded" with the missing rule list, or ship `basalt-ui/eslint` (flat config exporting the same plugin). Given the greenfield mandate and one affected app, the cheaper answer is migrating rollhook to oxlint.

### guards-25 [minor] Budget ceilings are loose where they are cheapest to hold

- Evidence: `scripts/check-budgets.ts:40-55`: `ruleLines: 277` landed vs spec 450 (173 lines of headroom = +62%); `nonChartSymbols` ceiling 94 > target 92, raised twice by consumer rows. Nothing budgets the guard layer itself (`oxlint-plugin.js` 4203 lines, `src/guard/index.ts` 2832, tests 4270+3708).
- Proposal: set ceilings to landed values (ratchet down only), add `guardLines` (plugin + guard) so the engine merge in guards-01/04 shows as a measured reduction.

## Consumer waiver ledger (what they reveal)

- rb: 3x `in-body-page-title` (guards-11), 2x `raw-surface` 50% (guards-10), 1x `raw-breakpoint` (guards-13), 1x `raw-hex` css + 1 historic `theme-allow-file` in vite.config comment; ~30 `oxlint-disable no-console` (guards-08).
- weatherorb: 5x `raw-selection-control` (guards-09).
- linewatch: 1x `raw-surface` 50% (guards-10).
- argo: ~8x `basalt-agent-allow` (guards-06); `as never` in login.tsx (guards-03); 8 `exhaustive-deps` disables (guards-08); copied `no-restricted-imports` (guards-05); 33 hand-written `color-mix(in srgb, var(--vx-*) N%, transparent)` in CSS/TS because `alpha()` is TS-only and the guard neither forbids nor blesses the CSS form (extend guards-02: ship `--vx-*-a{N}` steps or document color-mix as the CSS spelling and have the guard check it contains no literal).
- obsidian: `theme-allow raw-form-control` (vault-authored markup - legitimate, but should be `theme-allow-file` for the renderer); 3x `as never` (guards-03).
- rollhook: `basalt:theme-allow-file raw-hex` in `site.webmanifest` - reveals `basaltAppPlugin` cannot emit the manifest for Astro; the only app running the audit.

## Suggested order

1. guards-14 + guards-15 + guards-06 (pure deletions, net-negative) 2. guards-04 then guards-01 (the engine merge) 3. guards-02/03/17 (close the silent holes, ship the typed seams) 4. guards-07/08/19 (make the existing guards actually gate) 5. the rest as cleanups.
