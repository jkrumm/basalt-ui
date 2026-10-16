# Audit: cli-agent-dx (CLI, agent layer, vite preset, configs, docs)

Scope read: `packages/basalt-ui/src/cli/{index,init,sync,doctor,doctor-upgrade,router-wiring,guard-hook,help,config}.ts`,
`src/guard/guard-hook.ts`, `agent/{templates,rules,skills}/**`, `src/vite.ts`, `configs/{lefthook.yml,check.yml,...}`,
`README.md`, `AGENTS.md` (package), `MIGRATING.md`, `llms.txt`, plus the five consumers' `.claude/`, `AGENTS.md`,
`vite.config.ts`, `package.json#basalt`, `.github/workflows/check.yml`. Paths below are relative to `packages/basalt-ui/`
unless prefixed `~/`. Not repeated: what #285 and #286 already fix.

Headline: the agent layer is delivered correctly (managed files, ledger, sync) but is steered badly. The rules are
path-scoped by hardcoded globs that miss real consumer layouts, the strongest steering channel (PreToolUse hook) is
installed in 1 of 5 consumers, and 26 of 28 lint messages never name the doctrine. Underneath, the CLI carries a lot
of 1.x-era scaffolding, dead state and regex-based source analysis that produced a large share of the friction ledger.

Ranked by impact. Severity: blocker | major | minor.

---

## 1. [major] Rule `paths:` globs are hardcoded and miss real consumer layouts, so the rules often never load

Evidence:

- `agent/rules/basalt-{mantine,controls,state,batteries}.md:4-7` scope to `src/**`, `apps/**/src/**`; `basalt-tokens.md`
  adds `packages/**/src/**`; `basalt-charts.md:4-5` is `**/charts/**` only.
- `~/linewatch/web/src/**` (install root `web/`, manifest at `~/linewatch/web/.basalt/manifest.json`) matches none of
  `src/**` / `apps/**/src/**` when the agent starts at the repo root. The consumer compensated by hand-restating the
  doctrine in the root `~/linewatch/AGENTS.md:69-110` (one-card idiom, no shade pins, ...).
- `~/basalt-ui-obsidian/packages/basalt-ui-obsidian/src/**` matches only the tokens rule (the other four skip it).
- Chart code outside a `charts/` dir never loads the charts rule: `~/argo/apps/dashboard/src/routes` (7 files import
  `basalt-ui/charts`), `~/linewatch/web/src/{components,routes,lib}` (4 files).
- `basalt.roots` is already known to the CLI (`init.ts:99 reconcileRoots`) but never used to render `paths:`.
  Why it matters: a path-scoped rule only loads when the agent reads a matching file. This is the most plausible reason
  fresh trial agents "never opened the shipped rules": the rule was never injected where the app actually lives.
  Proposal:
- Render `paths:` at placement from `basalt.roots` (+ `basalt.app`), via a `{{ROOTS_PATHS}}` template var like
  `ROOTS_GLOBS` (`index.ts:530-541`). Rules become templates (`agent/rules/*.md.tpl`), still managed/hashed.
- Drop path scoping from the two smallest rules (tokens, mantine: 8 KB total) so they load unconditionally; scope
  charts by `basalt-ui/charts` usage is impossible, so use `**/*.tsx` under roots for it.
- Verify with `/research` how Claude Code resolves `paths:` (read-triggered vs write-triggered) before relying on it.
- Add a doctor check `agent-layer-paths`: every shipped rule's `paths` must match at least one scanned file.
  Breaking: no (sync rewrites managed files). Consumers: linewatch, basalt-ui-obsidian, argo (charts), all benefit.

## 2. [major] The PreToolUse guard hook is manual, installed in 1/5 consumers, and passes through with a blanket `allow`

Evidence:

- `src/cli/init.ts:230-242` only PRINTS a settings.json snippet; nothing writes or checks it. `sync`/`doctor` never
  mention it. Installed in `~/rb/.claude/settings.json` only (and it uses `bunx basalt-ui guard-hook`, contradicting the
  block's "never bunx" at `agent/templates/AGENTS-block.md.tpl:15`). Absent in argo, linewatch, obsidian, rollhook.
- `src/cli/guard-hook.ts:12,34,43,79` emits `permissionDecision: "allow"` for every non-violating Write/Edit and every
  parse failure. A PreToolUse `allow` is an explicit approval that skips the permission prompt; the hook should be
  silent on pass-through (exit 0, empty stdout). Verify against the hooks docs via `/research`, but as written the
  hook can auto-approve writes the user's settings would have asked about.
- The deny reason (`src/guard/guard-hook.ts:118-124`) ends in a generic "Fix: route colors through VX.*..." instead of
  the per-kind remedy `check-theme` prints (`guardKindRemedy`, `check-theme.ts:228`) and names no rule file.
- Scope logic is duplicated from check-theme (`guard-hook.ts:51-64`, comment "mirrors checkTheme").
  Proposal:
- `init`/`sync` own a managed entry in `.claude/settings.json` (merge, marker key, local-bin command from `BASALT_BIN`);
  `doctor` fails (not warns) when the hook is absent or uses `bunx`. This is the highest-leverage steering channel:
  it fires at the exact moment of the mistake.
- Pass-through writes nothing. Deny reason = per-kind remedy + `-> .claude/rules/basalt-<rule>.md` (finding 3).
- Extract the scope predicate into one `isScannable(rel, cfg)` shared by check-theme and the hook.
  Breaking: no. Consumers: all five (rb needs `bunx` -> local bin).

## 3. [major] Lint and guard messages do not point at the doctrine (2 of 28 oxlint messages name a rule file)

Evidence:

- 28 `*_MESSAGE` constants in `configs/oxlint-plugin.js`; only `CHART_HOST_MESSAGE` and `QUERY_FN_UNWRAP_MESSAGE`
  (`:3172`) cite a rules file, and the latter cites `agent/rules/basalt-batteries.md`, a path that does not exist in a
  consumer (it is `.claude/rules/basalt-batteries.md`).
- `src/cli/check-theme.ts:194-224`: findings print `line  kind  text`; remedies are one aggregated `Fix:` paragraph
  for all kinds, no rule link.
- Rule bullets point TO lint ids (`[basalt/control-outside-home]`), but nothing points back. `src/surfaces.ts` already
  maps every `PluginRuleId` and `GuardKind` to its rule (`check-coverage.ts` asserts it), so the reverse pointer is
  mechanical.
- Messages are 150-780 chars of prose (`BOUND_CONTROL_OUTSIDE_HOME_MESSAGE` 783, `IN_BODY_PAGE_TITLE_MESSAGE` 712).
  Proposal:
- One message shape: `<what is wrong> -> <fix in one line> (.claude/rules/basalt-controls.md "Homes") [basalt/<id>]`.
  The rule+section suffix is generated from `surfaces.ts` at plugin build, never hand-typed.
- check-theme prints the per-finding fix (`guardKindRemedy`) and rule path inline, not one merged paragraph.
- Test: every plugin message and guard kind has a rule pointer and is under ~250 chars (move rationale to the rule).
  This is the cheapest way to make agents that "learn from code + lint" land on the rule text.
  Breaking: no (message text). Consumers: all.

## 4. [major] The AGENTS block tells an agent to read `llms.txt` but never tells it which rule or skill to open for what

Evidence: `agent/templates/AGENTS-block.md.tpl:10-21`: states precedence and the "read llms.txt before guessing an
import" instruction. No task->rule/skill routing, no list of the six rule names, no "run `<bin> check-theme` before
you finish". The rules rely on `paths:` (finding 1) and skills on trigger text. Block is 1.4 KB; there is room.
Proposal: replace the prose with a 8-row routing table (touching X -> read `.claude/rules/basalt-Y.md`; scaffolding ->
`/basalt-app`; chart -> `/basalt-charts`; UI polish -> `/basalt-design`) plus one definition-of-done line
(`<BASALT_BIN> check` once finding 9 lands). Keep the restraint and chart overrides. Render the table from `RULE_NAMES`
/ `SKILL_NAMES` so it cannot drift.
Breaking: no.

## 5. [major] `basalt-app` skill is a 300-line grab bag whose description cannot trigger for most of its content

Evidence: `agent/skills/basalt-app/SKILL.md` (13.5 KB, 5x the other two skills combined) holds scaffold, add-a-table,
add-a-form-dialog, stream-a-section, add-a-chat, verify, refresh, "Upgrade 1.x to 2.x" and tokens-only. Its
`description`/`when_to_use` (lines 3-4) only cover scaffold/wire/upgrade/CI. "Add a table" or "add a chat" will not match,
and the recipes are exactly what the friction ledger shows agents fumbling (rows 40, 44, 54, 57).
Proposal: split by trigger: `basalt-app` (scaffold + verify + refresh, ~80 lines) and one `basalt-recipes` skill whose
description lists table, form dialog, streamed section, chat. Delete the 1.x upgrade section (finding 13). The
`// @check` compiled snippets stay (good practice; keep them compile-tested). Also fix the self-contradiction at
line 11 ("the only `bunx` call") vs line 299 (two more `bunx`).
Breaking: no (skill names: add one, keep `basalt-app`).

## 6. [major] `MIGRATING.md` is 4,951 lines / 613 KB, shipped in the tarball, and ~70% is the frozen 1.x line

Evidence: `MIGRATING.md` line count 4951; `## 2.0.0` at 84-1043; 2.x minors 1044-1446; 1.x sections 1447-4950 (about
3,500 lines, 1.0.0-1.41.0, a line that is "frozen at v1.41.0" per line 86). Lines 1-52 are process narrative (how the
Unreleased rename works, which defects shipped when, how many consumers complained); lines 54-83 are an index table with
a column per minor from 1.27.0 to 2.x (about 50 columns, mostly `-`). `package.json` `files` ships it
(`"MIGRATING.md"`), and every agent that follows the AGENTS.md instruction "read MIGRATING.md before jumping" pays for it.
Proposal:

- Ship only 2.x. Move 1.x to `docs/archive/MIGRATING-1.x.md` (not in `files`); the 2.0.0 "Upgrading from 1.x" step list
  stays as a pointer.
- Intro <= 10 lines. The release-script mechanics belong in `MAINTAINING.md` (one doctrine, one home).
- Replace the matrix with a transposed index: one row per 2.x minor -> one line per surface touched + anchor.
- Target: <= 600 lines for the shipped file; add a `scripts/check-budgets.ts` line budget so it cannot regrow.
  Breaking: no (docs). `release-migrating.ts` must keep working on the shorter file.

## 7. [major] `doctor`/`sync`/`init` infer app wiring by regex-parsing source; this produced a long run of friction rows

Evidence: `src/cli/router-wiring.ts` (189 lines: `registersRouterPlugin` regex over `vite.config.*`,
`callsIn` BFS import walk to depth 3, `isStartApp`, `isCodeRoutedApp`), `src/cli/source-text.ts` (tokenizer),
`src/cli/doctor-upgrade.ts:366-515` (`providerTags` brace-depth scanner, `startWiring`, `appWiringCheck`).
`docs/waves/argo-friction.md` rows 4, 5, 11, 20, 62, 71, 72, 82, 113, 115 are all false positives/negatives of this
class (code-routed router, Start, shell-less, pathless layout, `src/router.tsx` heuristic `queryClient` text match
at `doctor-upgrade.ts:446`). The CLI already says the right thing for two settings (`basalt.shell`, `profile`: "declared,
never inferred", `config.ts:36-40`) and then infers the rest.
Proposal (the architecture, beyond what #286 patches):

- Declare, don't infer: `basalt.app: { kind: 'file-routed' | 'code-routed' | 'start' }` (default file-routed). Seeds and
  checks read it; delete `isStartApp`/`isCodeRoutedApp`/`registersRouterPlugin`/`callsIn`.
- Move truth to runtime and types: `createBasaltRouter`/`BasaltProvider` dev-only assert the invariants they own (router
  present or `children` mode with `context.queryClient`, `Register` declared). `tsc` already enforces `Register`.
- doctor keeps file/dependency/config checks only. Expected deletion: ~350-450 lines plus their 1,400 lines of test.
  Breaking: no for runtime; `basalt.app.kind` is new config. Consumers: weatherorb (Start), rb (code-routed), linewatch.

## 8. [major] 19 of 24 `basalt` config keys have zero consumers; boolean toggles disable guards with no reason

Evidence: `src/cli/config.ts` declares 24 keys. Across all six `package.json#basalt` blocks the only keys in use are
`roots`, `exempt`, `shell`, `profile`, `aiMajorSkewReason` (argo, linewatch, rb, obsidian, rollhook). Unused:
`spacingSteps`, `forbiddenAccents`, `accentHue`, `include`, `severity`, `exemptRules`, `seriesModulePath` and the ~13
per-kind booleans (`rawRadius`, `rawSurface`, `cardWithBorder`, `offSystemSurfaceVar`, `mantineShadeIndex`,
`rawHtmlLayout`, `inlineSpacing`, `inlineDisplay`, `rawMotionValue`, `rawFormControl`, `sub16InputFont`, ...).
Three parallel mechanisms exist for "turn this guard down": the booleans, `severity`, and `exemptRules` (the only one
that demands a reason). Defaults are "argo's set" (`config.ts:27,56`, `index.ts:6`). Waiver use is already tiny
(10 `theme-allow` lines across all consumers), so the escape hatch that carries a reason is sufficient.
Proposal: adopt-or-delete. Keep `roots`, `exempt`, `app`, `shell`, `profile`. Replace the booleans/`severity`/
`exemptRules` by one `rules: { <kind>: 'warn' | { off: '<reason>' } }` (reason required, audited by `--audit-allows`).
Delete `spacingSteps`, `forbiddenAccents`, `accentHue` (see 19), `include` unless a consumer is named. `doctor`'s
`config-keys` check already turns removed keys into a clear failure.
Breaking: yes (config keys), no consumer affected. Net-negative.

## 9. [major] No single gate command: every consumer hand-assembles 3-5 steps, and the seeds disagree

Evidence: seeded `lint:basalt` = `oxlint . && <bin> check-theme` (`init.ts:107`); CI steps from `ciGateSteps`
(`index.ts:514-528`) = oxlint, doctor, check-theme, sync --check, oxfmt; `~/rb/.github/workflows/check.yml` runs oxlint,
check-theme, sync --check, format, typecheck, test but NOT doctor; `~/argo/.github/workflows/check.yml` runs
`sync --check` then `make check`, no doctor; linewatch runs `bun run lint` + sync --check, no doctor. The AGENTS block and
skill each describe the gate differently. `check-theme` (regex lane) and the oxlint plugin (AST lane) overlap on the same
laws (e.g. `in-body-page-title`, `raw-breakpoint`/`raw-media-query`: see rule bullets that cite both ids).
Proposal: `basalt-ui check` = doctor (fast checks) + `sync --check` + `oxlint` with the shipped preset + `check-theme`,
one combined report, one exit code, `--fix-hint` listing the rule file per failure. Seeds, lefthook, CI and the AGENTS
block all cite that single command. Longer term fold the regex guard kinds that have an AST equivalent into the plugin.
Breaking: no (additive).

## 10. [major] `doctor` is a 320-line imperative function with inconsistent ids, no machine output, a stale contract and no agent-layer checks

Evidence:

- `doctor.ts:124-443`: 14 checks inline; ids are inconsistent (`install-parity:` and `guard-scan:` prefixed, but
  `.oxlintrc.json extends ...`, `ai package major ...` and `basalt-ui resolves at ...` are not).
- Docstring `doctor.ts:102-122` is stale (lists checks 1-14 but omits `oxlint-floor`; says "8-13" in a header at `:377`);
  `help.ts:84-87` says doctor checks "the manifest exists, the oxlint preset is wired, the pre-commit hook, and the ai
  package major" (4 of ~14).
- No `--json`, no `doctor <check-id>`, so agents must parse prose. Output ends "N warning(s)" with exit 0, fine for CI
  but invisible for an agent.
- It never checks the agent layer's effectiveness: hook registered (finding 2), rule `paths` match (1), AGENTS block
  at a root the agent starts in (finding 15), `DESIGN.md` still the untouched seed (23).
  Proposal: `type Check = { id, run(ctx): {status:'pass'|'warn'|'fail'|'skip', message, fix?} }`, a registry array, the
  printer iterates it; `doctor --json`, `doctor --only <id>`; every line prefixed by id; derive `help.ts` text from the
  registry. Add an `agent-layer` group (hook, paths, block reachable, seed untouched).
  Breaking: no.

## 11. [major] Shipped rule files embed maintainer-only coverage comments that name argo and internal law ids

Evidence: `agent/rules/basalt-controls.md:9-16` ships `<!-- not guarded: hand-rolled section headings (argo writes
`<Text fw={600} size="sm">` ... -->`, `C1 as a cross-file law`, `C11`, `C12`; every rule has the 5-line GENERATED block
(`basalt-batteries.md:9-13`). Present in `~/argo/.claude/rules/basalt-controls.md:13`. The repo's own dogfooded copy
`.claude/rules/basalt-controls.md` has the block stripped, so the dogfood does not equal the shipped bytes (and the
"Dogfood" doctrine in AGENTS.md is untrue for rules). The block references `src/surfaces.ts` and
`bun scripts/check-coverage.ts`, neither of which exists in a consumer.
Proposal: render the coverage block into `docs/COVERAGE.md` (or a `--write` target outside `agent/`), strip it from the
shipped file at source, and make the dogfood copy a byte-identical symlink/copy checked by `check-coverage`. If the
"not guarded" facts help an agent, rewrite them as one consumer-meaningful sentence ("not enforced: X; review it").
Breaking: no.

## 12. [minor] Dead and legacy state in the manifest and ledger

Evidence:

- `manifest.spacingScale` is written by `init.ts:182` and `sync.ts:305` (always `deriveSpacing(0)`, ignoring the
  consumer's density), parsed in `index.ts:1004-1026`, and read by nothing (`grep spacingScale src` returns only those
  lines; the comment calls it "`doctor`'s second axis" but `doctor.ts` has no such axis). It sits in every consumer's
  `.basalt/manifest.json` (e.g. `~/argo/.basalt/manifest.json`).
- Seed files are hashed into `manifest.files` (DESIGN.md, lefthook.yml, check.yml, main/__root/nav) although seeds are
  "never reconciled, never reported" (`sync.ts:164`); only `tracked` uses it, to word "recreated".
- `classify` (`index.ts:1217-1229`) keeps the raw-hash path for "pre-1.0.2" manifests; `normalizeForLedger` plus three
  hash forms and a "same-version fallback" is a lot of machinery for markdown files that are "managed, do not edit".
  Proposal: delete `spacingScale`; record only managed files; drop the raw and legacy hash branches; manifest becomes
  `{ version, basaltVersion, files }`. `sync` rewrites the manifest on next run, so no migration is needed.
  Breaking: no. Net-negative (also deletes `template-ledger.test.ts` legacy cases).

## 13. [minor] The 1.x to 2.x upgrade scaffolding is permanent and shipped to every consumer

Evidence: `doctor-upgrade.ts:126-150` (`RETIRED_FIX`, with a stale comment "go live when #163 adds them"),
`:242-251` (`DROPPED_FIXES`), `config.ts:216` (`RETIRED_CONFIG_KEYS`); `agent/skills/basalt-app/SKILL.md` "Upgrade 1.x to
2.x" (about 25 lines, shipped into `.claude/skills` of every app); `MIGRATING.md` "Upgrading from 1.x". All five
migrated consumers are on 2.11.1; only weatherorb (Waves 37-45) is mid-migration.
Proposal: sunset marker. Keep the generic mechanism (`retired-lint-rules`, `config-keys`, `dropped-subpaths`) but empty
the 1.x tables and delete the skill section once weatherorb lands; add the date to MAINTAINING.md so it is deleted, not
forgotten.
Breaking: no.

## 14. [minor] `src/cli/index.ts` is a 1,782-line grab bag that the commands import back (circular)

Evidence: header at `index.ts:1-8` and the closing comment (`:1773`) claim "dispatch + shared helpers only (C2)". It
actually holds: JSONC parsing (`:1376-1412`), workspace glob expansion (`:1578-1695`), lefthook inspection (`:1445-1500`),
oxlint-extends merging (`:1510-1575`), the manifest engine (`:405-1260`), package.json patching, root detection, template
rendering. `init.ts:12-35`, `sync.ts:7-42`, `doctor.ts:9-36` import ~35 symbols each back from `./index`, which imports
them (cycle). Stale comment "argo's values are the defaults" (`:6`), "Its default (`bunx --no-install basalt-ui`)"
(`:883`, also `configs/lefthook.yml:90`: no longer true).
Proposal: `manifest.ts`, `placement.ts` (workspace/app/roots), `jsonc.ts`, `lefthook.ts`, `oxlint-config.ts`,
`template.ts`; `index.ts` = `run()` only. Then `cli/index.ts` budget in `check-budgets` can drop to <= 150 lines.
Breaking: no.

## 15. [minor] Package-scoped installs place the agent layer where the agent does not start

Evidence: linewatch's install root is `web/` (rules in `~/linewatch/web/.claude/rules`, block in
`~/linewatch/web/AGENTS.md`); its root `AGENTS.md:69-110` re-explains the doctrine by hand and says "`basalt-ui init` seeds
them into the package directory, which is a directory neither GitHub nor lefthook reads". Claude Code discovers
`.claude/rules` at the project root; whether a nested `web/.claude/rules` is loaded when the session starts at the repo
root needs verification (`/research`), and `init.ts` prints the placement notices (`placementNotices`) but does not warn
that the agent layer itself is unreachable.
Proposal: when the install root is not the git root, either place the agent layer at `findRepoRoot` (prefixing `paths:`
with the app dir, finding 1) or make `doctor` fail an `agent-layer-reachable` check. Prefer the former: one location
(repo root `.claude/`), `paths:` scoped to the app.
Breaking: no (placement move). Consumers: linewatch.

## 16. [minor] Vite preset leaves wiring to each consumer

Evidence:

- `colorScheme` must equal `BasaltProvider defaultColorScheme` by hand: `src/vite.ts:240-250` doc, and the same
  "mirrors BasaltProvider's defaultColorScheme" comment hand-copied in `~/argo/apps/dashboard/vite.config.ts:49` and
  `~/rb/apps/web/vite.config.ts` ("`colorScheme` mirrors <BasaltProvider defaultColorScheme>"). A mismatch is a visible
  flash, undetected by doctor.
- Version boilerplate (`readFileSync(package.json).version`) in argo and linewatch to feed `basaltViteConfig({ version })`
  (`vite.ts:107-110` could read it itself).
- Preset pre-bundle/dedupe list (`vite.ts:134,139-145`) omits `@mantine/spotlight` and `@tanstack/react-hotkeys` though
  both are peers `BasaltProvider`/`commands` import: argo adds them by hand (`vite.config.ts:70-90`, "Beyond the
  preset's ...").
- rb sets `optimizeDeps.exclude: ['basalt-ui']` with a 6-line essay; spread vs `mergeConfig` composition differs per app.
- `BasaltViteOptions`/`BasaltAppOptions` are not exported (`dist/vite.d.ts:3,60`), so apps cannot name them; `serviceWorker`
  is `boolean | Record<string, unknown>` (`vite.ts:324`); docs say "argo-tuned workbox defaults" and "argo already ships"
  (`vite.ts:193,294,319,332`); `basaltSrc`/`BASALT_LOCAL` is a basalt-maintainer feature in the public option type.
  Proposal: read `version` from the nearest package.json by default; add spotlight/hotkeys (and `@mantine/dates` when
  installed) to the preset lists; export the option types; type `serviceWorker` as `boolean | { workbox?: ..., ... }` or
  re-export vite-plugin-pwa's options type; make doctor compare `basaltAppPlugin({colorScheme})` with the Provider prop (or
  have the plugin's boot attribute be the one source and let the Provider default read it).
  Breaking: no. Consumers: argo, rb, linewatch, obsidian.

## 17. [minor] `bunx` inconsistencies undermine the "run the local bin" doctrine

Evidence: `configs/lefthook.yml` commands run `bunx oxlint ...` / `bunx oxfmt ...` (`:46,58`) while `check-theme` uses the
local bin; `ciGateSteps` seeds `- run: bunx oxlint .` and `bunx oxfmt ...` (`index.ts:520-525`); `~/rb/.claude/settings.json`
hook uses `bunx`; skill line 299 and README `:43,52,82`. The AGENTS block and README `:677-679` say bunx can run a
different version than pinned (the same stale-cache risk applies to oxlint).
Proposal: derive `./node_modules/.bin/oxlint|oxfmt` the same way `BASALT_BIN` is derived (`basaltBinCommand`); lefthook
preset reads `${OXLINT_BIN:-node_modules/.bin/oxlint}`. Keep `bunx` only for `init` and `tokens:css` pre-install.
Breaking: no.

## 18. [minor] `llms.txt` truncates exactly the signatures an agent needs, and contradicts itself on union props

Evidence: 22 lines end in `...` (`llms.txt:25,52,53,205,210,224,249,343`): `createBasaltRouter(options: {routeTree; context?;
query?: QueryClientConfi...)`, `createBasaltTheme(...)` and `useBasaltNav()` are cut mid-type. `BasaltProvider` prints
`one of: router | children` and then lists both `router: BasaltRouter` and `children: ReactNode` as plain required props
(`llms.txt:21-34`). Friction rows 43, 47, 50, 57, 78 were all llms.txt gaps; the AGENTS block tells agents to rely on it.
Overlap: the packaged `AGENTS.md` (26 KB), `README.md` (42 KB, 741 lines) and `llms.txt` (38 KB) all describe each
subpath; `AGENTS.md` still says "No majors ship here" (`:128`) and spends its "Hard rules" on repo-local enforcement
("repo-local ONLY", `AGENTS.md:50`) a consumer cannot act on. README's "canonical reference: apps/playground/src/main.tsx"
(`:82`) points at a path not in the tarball.
Proposal: emit full signatures (no width cap; multi-line is fine) and render discriminated unions as variants; one doc
per audience: `llms.txt` = machine surface, README = human quick start (<= 250 lines, no per-subpath prose), drop the
packaged `AGENTS.md` from `files` (or reduce to a 30-line pointer). Add a test that fails on `...` in llms.txt.
Breaking: no.

## 19. [minor] DESIGN.md seed: stale-by-design placeholders loaded into every session

Evidence: `agent/templates/DESIGN.md.tpl` (45 lines) is imported unconditionally via `@./DESIGN.md` in the AGENTS block
(`AGENTS-block.md.tpl:22`); seeded text includes an `_e.g. requests_` table row, a commented `defineSeries` example and
`Accent hue: {{ACCENT_HUE}}` fed by the unused `basalt.accentHue` config key (`config.ts:58`, `index.ts:535`), a second
source of truth next to `createBasaltTheme({ derive: { accent } })`.
Proposal: delete `accentHue` and the Identity bullet (record the derive seed in code, link it); shrink the seed to the
series dictionary + deviations, and have `doctor` warn while the seed is untouched (hash equals the manifest entry).
Breaking: no.

## 20. [minor] The lefthook preset is 119 lines (about 95 of comments) documenting why it cannot be overridden

Evidence: `configs/lefthook.yml:1-100`, "an `extends` target WINS over your own lefthook.yml on a colliding key ... NOT
overridable"; recipes for `root:`, `BASALT_CWD`, `BASALT_BIN`; the seed stub in `index.ts:866-892` repeats the caveat.
A preset whose first 30 lines explain its own limits is a design smell: the extends model buys auto-update at the price
of non-overridable `run:`/`glob:`.
Proposal: once finding 9 lands, the preset is one command: `pre-commit: commands: basalt: run: <bin> check --staged`,
nothing to override. Until then, shrink the comment block to the 6-line recipe and link MAINTAINING.md.
Breaking: no.

## 21. [minor] Tests pin console prose instead of a structured contract

Evidence: about 350 `toContain`/`toMatch` assertions over captured `console.log/error` in `src/cli/*.test.ts`
(`doctor-upgrade.test.ts` 138, `toolchain-wiring.test.ts` 132, `check-theme.test.ts` 106, `init-sync.test.ts` 59);
`template-ledger.test.ts:55-70` re-implements a console capture. Commands print and return a number, so the only
observable contract is wording; any message improvement (finding 3) rewrites tests.
Proposal: ports-and-adapters per the repo's own code-style rule: commands return `{ code, report: Finding[] }`; a
`ConsoleReporter` renders; tests assert ids/status/fix-kind, with one snapshot test per renderer.
Breaking: no.

## 22. [minor] tokens-only and bare consumers get no agent layer; the one rule that applies is not placed

Evidence: `~/rollhook/.claude` has no `rules/`, `skills/` or `DESIGN.md` (profile `tokens-only`, `sync.ts:95-102` returns
"n/a"), and `~/rollhook/AGENTS.md:82-95` re-states the token law by hand. `basalt-tokens.md` is about 70% profile-neutral
(color, surfaces, type) and is exactly what such a consumer needs.
Proposal: a `tokens-only` profile places `basalt-tokens.md` (split the Mantine-specific bullets into the mantine rule) and
the AGENTS block's token paragraph; `init --tokens-only` becomes meaningful instead of "NOT the fix" (`doctor.ts:150-156`).
Breaking: no.

## 23. [minor] Seeded CI is not repo-aware

Evidence: `configs/check.yml:34-40`: `runs-on: ubuntu-latest`, `bun-version: latest`, `actions/checkout@v4`. `~/rb` rewrote it
to `[self-hosted, vps]` (owner policy for private repos) and `timeout-minutes`; linewatch/argo still run hosted. `latest`
makes the gate non-reproducible and the same file asserts bin pinning elsewhere.
Proposal: pin bun via `bun-version-file: package.json` (or `.bun-version`) and render `runs-on` from one `basalt.ci.runsOn`
default; or document the two edits in the seed's first comment. Low cost, avoids a post-init edit in every app.
Breaking: no.

## 24. [minor] Unverified premise: "Claude Code loads a repo-root AGENTS.md directly"

Evidence: `index.ts:824-826` and `doctor.ts:303-308` justify putting the managed block in AGENTS.md and warn when a
CLAUDE.md shadows it. In stock Claude Code the memory file is `CLAUDE.md` (AGENTS.md needs an `@AGENTS.md` import). The
owner's environment may differ, and `~/basalt-ui-obsidian/AGENTS.md:8` still claims the block lives in `CLAUDE.md`.
Proposal: run `/research` once; if stock Claude Code does not load AGENTS.md, make `init` write a one-line `CLAUDE.md`
containing `@AGENTS.md` (and flip the doctor check to require that import). Cheap insurance for any non-owner consumer.
Breaking: no.

## 25. [minor] `init` output is an unprioritised wall; manual follow-ups are easy to miss

Evidence: `init.ts:185-267` prints counts, a Kept list, merge notices, tsconfig, build note, roots, lint script, placement
notes, the hook snippet, a lint-debt paragraph, "Activate the hooks: `lefthook install`" and a First-run paragraph, in
that order, all prose. `lefthook install` (a one-time step whose absence leaves the gate inert, per the code's own comment
at `:258-260`) is advice rather than an action; `bin/basalt-ui.mjs:10` has no `.catch` for the async `guard-hook`.
Proposal: end `init` with a numbered "Next" list (3-5 items, each a command), run `lefthook install` when a git repo and
lefthook resolve, write the settings.json hook (finding 2), and add `--json` for agents. Group the rest under "Details".
Breaking: no.

---

## Suggested sequencing (net-negative waves)

1. Steering wave (1, 2, 3, 4, 11): path globs from roots, hook installation and silent pass-through, message->rule
   pointers, AGENTS routing table, strip coverage comments. Smallest diff, biggest effect on the "agents never open the
   rules" problem.
2. Deletion wave (6, 8, 12, 13, 14, 19): MIGRATING trim, config keys, dead manifest state, 1.x scaffolding, index split.
3. Architecture wave (7, 9, 10, 21): declared app kind + runtime assertions, `basalt-ui check`, check registry/`--json`.
4. Polish (5, 15-18, 20, 22-25).
