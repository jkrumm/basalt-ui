# Basalt UI v3: stock-take

Date 2026-11-21, master at `360110f1b`. A read-only audit: every claim was read in the tree, and section 10 lists
what was not run.

**Verdict.** The design holds and needs no second restructuring. One package with optional peers, primitives in npm
under one specifier, typed-data frames, ports, derived tokens and lint at error: none of these failed an audit.
What v3 lacks is proof from outside. All 447 finished plan rows looked inward, the playground that judged them is
not a basalt consumer, and the one loop still running stopped producing code two weeks ago. The path
to 3.0.0 (section 9): a trial app through the real install path, a freeze pass over names and leftovers, a first
port, a second freeze pass, the release.

**Three calls are the owner's.**

1. **How a consumer installs v3 before 3.0.0.** The first port depends on it. The 2026-11-09 decision was no
   prerelease channel and consumers held until the publish. Porting before the freeze needs one of three: a tarball
   URL from a GitHub prerelease (no npm publish, no gate change, works in a Docker build; recommended),
   `3.0.0-next.N` under the npm `next` tag (cleanest for consumers, reverses the decision and needs the release gate
   and a release branch changed), or `bun link` (local only).
2. **End the expression loop**, as section 7 proposes.
3. **Which app ports first.**

## 1. Where v3 stands

| Measure                  | Value                                                              |
| ------------------------ | ------------------------------------------------------------------ |
| Plan rows                | 447 done, 2 open, 1 waiting (expression cycle 19)                  |
| Commits since 2026-11-09 | 2,122 (660 `fix`, 388 `feat`)                                      |
| Source without tests     | about 105,000 lines; `charts` 17,900, `cli` 11,800, `lint` 11,300  |
| Surface                  | 23 JS subpaths, 40 primitives, 19 lint rule ids, 32 optional peers |
| Tarball                  | 2.8 MB packed, 10 MB unpacked, 2,752 files                         |
| Docs in git              | 1,213 files, 23 MB                                                 |
| npm                      | `latest` is 2.29.0 from 2026-10-24; nothing of v3 is published     |

## 2. What holds

Keep these; no audit slice found a reason to reopen one.

- **One package, zero required peers.** `tests/required-peers.test.ts` pins it, `scripts/surface-gates.ts` walks the
  built graph per subpath.
- **`basalt-ui/ui/<name>` as the only primitive specifier.** It resolves without an alias and keeps eject reversible.
- **Ports in `src/core/ports.ts`** in place of sideways imports between composites.
- **Typed data over nodes.** Apps can live under it: the playground and the marketing site carry three `basalt/*`
  waivers between them, the marketing site none.
- **Types.** Four `any` sites (all `FilterSpec<any>`, each with a reason), no `@ts-ignore`, 123 compile-time fixture
  files.
- **TanStack first, betas refused.** `docs/v3/verdicts/tanstack-map.md` binds Router, Query, Table, Virtual, Form and
  Charts and waits for Hotkeys and DB to leave beta.
- **Migration data.** 18 area files under `migrations/areas`, 7,200 lines of codemods in `tools/migrate-v3`,
  `MIGRATING.md` rendered at release.
- **The marketing site is a real `site` consumer.** Manifest, `sync` and `doctor` in CI, zero waivers.

## 3. The blind spot: no app goes through the `app` install path

The playground judged all 18 expression cycles. It is not an install.

| A consumer has                      | The playground has                                                 |
| ----------------------------------- | ------------------------------------------------------------------ |
| `.basalt/manifest.json` from `init` | none                                                               |
| `basalt()` in the Vite config       | `basaltViteConfig`, the 2.x preset; `basalt()` is in no app config |
| `basalt-ui` resolved from `dist`    | runtime aliased to `src/`, typecheck reading `dist`                |
| `.basalt/sources.css`               | 11 hand-written `@source` lines                                    |
| budget, hook, `sync`, `doctor`      | none                                                               |

So the peer gate, the seed gate, the eject alias and the sources file of `basalt()` run only in the harness under
`test/fixtures/vite`. `scripts/pack-test.sh` renders scratch consumers for charts, controls and forms, but no test
takes the tarball through `init --profile app`, a build and a render. ARCHITECTURE section 9 promised the fixtures
`linewatch`, `console` and `full`; the tree has `tokens`, `bridge` and `site`. Eject is about 1,700 lines that
no app has ever run.

**Decision.** The trial app the owner proposed is the next step, and it stays in the repo: created from the packed
tarball by `init --profile app`, committed, built and rendered in CI. After it, the playground moves to `basalt()`,
which is what lets `basaltViteConfig` and `src/vite.ts` go.

## 4. Freeze list: cheap now, a break after 3.0

Row 4 waits for the playground move of section 3; every other row stands alone.

**Exports and peers**

| #   | Finding                                                                                                                                              | Evidence                                                                                | Decision                                                                                                                                   | Status                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| 1   | `BasaltProvider` imports React alone but is published only from `basalt-ui/router`                                                                   | `src/core/provider.tsx:12`, `src/router/index.ts:13`                                    | Export it from `.`, where ARCHITECTURE section 3 allocated it                                                                              | Closed, PR #1294: `BasaltProvider`, `setScheme` and `setAppearance` export from `.`                 |
| 2   | `./page` needs TanStack Router, and the `parts` profile installs none. The cause is `InnerNav`, which calls `useRouter().buildLocation`              | `scripts/surface-gates.ts:128`, `src/page/parts/inner-nav.tsx:1`, `src/cli/peers.ts:13` | `./page` drops the peer: the handle that `field` returns in `./router` builds the href                                                     | Closed, PR #1300: `./page` needs no router; the field handle draws the href                         |
| 4   | The 2.x Vite preset is still exported and documented                                                                                                 | `src/vite/index.ts:40`, `llms.txt:326`                                                  | Delete once the playground is on `basalt()`                                                                                                | Closed, PR #1293: `basaltViteConfig` and `src/vite.ts` deleted                                      |
| 5   | `basalt-ui/core/*` publishes about 35 internal modules; apps already import `core/ports` and `core/provider-props` for types that have no other home | `package.json` exports, `apps/playground/src/routes/table.tsx:7`, `main.tsx:7`          | An explicit list of the 13 modules ejected seeds import; `IconComponent`, `DetailHost`, `DetailEntry` and `IntlScope` get a public subpath | Closed, PR #1294: `./core/*` is an explicit list of 25 modules; the types export from their entries |
| 12  | `astro` is in no `peerDependencies` entry                                                                                                            | `package.json`                                                                          | Add `astro` and `@astrojs/react` as optional peers with a range                                                                            | Closed, PR #1290: `astro` and `@astrojs/react` are optional peers                                   |

**Names**

| #   | Finding                                                                                                                                                                       | Evidence                                                           | Decision                                                                                                                                                                                                                                                                                                                                                                                                                 | Status                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| 3   | 23 `@deprecated … removed in the next minor` markers in a line that never shipped                                                                                             | `src/index.ts:31-39`, `src/charts/index.ts:93-107`, ten more files | Delete all of them                                                                                                                                                                                                                                                                                                                                                                                                       | Closed, PR #1304: the deprecated aliases are deleted                       |
| 6   | Rule ids are British (`colour-literal`, `fixed-colour`, `app-colour`), every type, prop and token is American                                                                 | `src/lint/rules`, `agent/rules/basalt-tokens.md`                   | Rename to `color-*`: the ids are written into waivers                                                                                                                                                                                                                                                                                                                                                                    | Closed, PR #1304: ids are `color-*`; the old ids map in `renamed-rules.ts` |
| 7   | One concept, several names across cards and charts: `StatCell label, qualifier` against `StatCard title, subtitle`; `xLabels` against `axisLabels`; three height vocabularies | `src/cards/contract.ts:55-127`, generated docs                     | One naming pass against the glossary in ARCHITECTURE section 6, held by a test over the generated prop lists                                                                                                                                                                                                                                                                                                             | Closed, PR #1304: one name per concept, held by the glossary test          |
| 11  | Generated doc paths are public (the rules say "read `node_modules/basalt-ui/docs/<name>.md`"), and `motion_spring.md` sits beside `motion-preset.md`                          | `packages/basalt-ui/docs`                                          | Kebab-case every file                                                                                                                                                                                                                                                                                                                                                                                                    | Closed, PR #1304: every doc file is kebab-case                             |
| 13  | Two form APIs: `FormField field={f}` and `FormFooter form={form}` from `./controls`, `f.FormField` and `form.Footer` from `./form`                                            | generated docs, `src/form`                                         | Teach one, `useAppForm`; the neutral parts stay as the port. `settings.tsx:87` builds a fake `FieldLike` over a synced field: check that `FormField control` takes one. **Closed (settings grammar):** `useAppForm` is the one form API the docs teach; `FormField field` and `FormFooter form` are the structural port it binds. `FormField control` now takes any handle with `use()`, so the fake `FieldLike` is gone | Closed, PR #1247: `useAppForm` is the one taught API                       |

**Types and on-disk formats**

| #   | Finding                                                                                                                             | Evidence                                                  | Decision                                                                                                                             | Status                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| 8   | `AppShell nav` accepts any object of the right shape with `to: string`; `navTarget` widens to `string` without `Register`           | `src/shell/contract.ts:47`, `src/router/nav-target.ts:37` | Brand the `defineNav` result; give `navTarget` the guard `defineNav` has                                                             | Closed, PR #1300: `AppShell` is typed by its `defineNav` result; `navTarget` has the guard |
| 9   | `.basalt/budget.json` seeds `waivers: 0`, so the first reasoned waiver fails `lint` until `lint --raise waivers --consumer "<who>"` | `src/cli/budget/index.ts:38`                              | In an app the ceiling follows the count and the diff shows it; `--consumer` stays a rule of this repo. The schema freezes after that | Closed, PR #1291: `waivers` follows the count                                              |
| 10  | Eject's on-disk format (header line, `<root>#<name>` key, seed digest as a hard build gate) freezes with zero app use               | `src/cli/eject`, `src/vite/index.ts:128`                  | Ship eject as experimental in 3.0, its format free to change in a minor; use it in the trial and the first port                      | Closed, PR #1291: eject is marked experimental in 3.x                                      |

## 5. Friction that is no freeze item

Loosening any of these later breaks nobody, but each costs time on every port.

**Peers.** Eleven optional peers are pinned exactly, `tailwindcss` and `@tailwindcss/vite` among them, and no document
gives the reason. `basalt()` checks presence only (`src/vite/index.ts:177`); `doctor` fails on the range and prints a
downgrade line. A consumer one Tailwind patch ahead keeps that red check until basalt releases a new pin.

| Class                                                | Peers                                                                                                                                                       | Range                       |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Stable majors, public API only                       | `tailwindcss`, `@tailwindcss/vite`, `d3-scale`, `react-day-picker`, `react-resizable-panels`, `stylelint`, `postcss-html`, `remend`, `@axe-core/playwright` | caret from the tested floor |
| Coupled to internals (data attributes, engine marks) | `@base-ui/react`, `@tanstack/react-table`, `@tanstack/charts`                                                                                               | tilde                       |
| 0.x and alpha tooling                                | `@shadcn/lint`, `oxlint`                                                                                                                                    | exact                       |

A CI job that installs the newest in-range peers and runs the suite can report a break without waiting for a
consumer to hit it.

- **oxlint.** 10,700 lines of rules sit on a plugin API its own schema calls "in alpha and not subject to semver"
  (`node_modules/oxlint/configuration_schema.json:60`). The pin, 1.93.0, lives in the generated preset and not in
  `package.json`. Accept the risk and declare the peer: the rules already run under ESLint's `RuleTester`, which is
  the way out.
- **The CLI runs under Bun only** (`#!/usr/bin/env bun`, `Bun.serve`, `Bun.spawnSync`), while `init` offers npm, pnpm
  and yarn installs and the edit hook runs the bin on every edit. Make the bin run under Node, or state the
  requirement in `engines`.
- **`sync` refreshes neither `.basalt/hook.mjs`, the hook entries nor the committed token sheets.** A hook fix cannot
  reach an existing install, and a changed derive shows up only as a red `doctor` check 10. `sync` should own all
  three.
- **The `src` and `dist` split of section 3.** A custom export condition for the workspace apps removes the first
  gotcha in `AGENTS.md`; the trial app stays on the tarball.
- **The managed `AGENTS.md` block** tells a consumer to file a factory Issue. That is this fleet's tooling and wrong
  in any other repo.
- **180 references to `docs/V2-SPEC.md`, `docs/CONTROLS-SPEC.md` and `docs/v3/`** sit in 160 shipped source files and
  show in IDE hovers. None of those documents ship.
- **`src/surfaces.ts` calls itself the one source** and types the rule names as `controls` and `batteries`, which have
  no file, while `page` is missing. `sync` places rules by scanning `agent/rules` and never reads it.
- **Build.** tsup, which is in maintenance mode, plus two scripts that rewrite the emitted specifiers. It works and
  the pack-test guards it; the move to tsdown is internal and can follow 3.0.

## 6. Astro and islands

The static half works: the `Site*` parts render with no client JavaScript, and the matrix measures 90 parts in five
render modes, 75 of them static-clean. The guards have four gaps.

| Gap                                                                                                                                                      | Evidence                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| No rule or check reads `client:*`; a React part without a directive renders static and silent                                                            | no hit in `src/lint`, `src/cli`                                                              |
| `doctor` maps only `shell`, `static`, `astro` and `ui` to a profile, so a site root importing `charts`, `cards`, `table` or `page` passes                | `src/cli/doctor/install.ts:32`; the marketing site does it in `src/islands/DeploysChart.tsx` |
| The restyle rules match `^basalt-ui/(?:ui\|static)/`; a site imports the bare `basalt-ui/static`                                                         | `configs/oxlint-site.json:234` (read, not run)                                               |
| 22 exports are outside the matrix, 13 of them `Site*` parts or `ThemeSwitch`, including the two with script behaviour, `ThemeSwitch` and `SiteCodeBlock` | `docs/v3/verdicts/astro-matrix.json`, `uncovered`                                            |

**Decision.** The matrix already classifies every part as `none`, `enhance` or `required`, but only inside
`apps/playground-astro`. Ship that table from the package. `basaltAstro()` then checks at `astro:build:done` that no
`required` part's `data-slot` sits outside an `astro-island`, and `doctor` reads its profile map from the same
table. That is the island guardrail; linting `.astro` files is not needed for it.

- `init --profile site` prints two lines where `init --profile app` writes the starter files. Write the layout and
  the config line for a stock Astro project.
- `SiteField` and `SiteSubmit` restate the class strings of `ui/input` and `ui/button`, and the two code blocks
  differ in ring and copy-button position. Share the recipes.
- `astro-matrix.json` is a 121 KB committed record with 11 commits in two days, and it conflicts on rebases. Commit
  the summary (the static-clean set and the byte ceilings); the full run is a CI artifact.

## 7. The agent layer and the expression loop

First-try median score per cycle, 1 to 18: 68, 66.5, 65.5, 65.5, 75, 75, 71.5, 80, 83.5, 85.5, 86.5, 84.5, 87.5,
91.5, 89, 91, 89, 88. X1 is the rubric item "word economy" (no fact stated twice), X2 is "one view" (the parts read
as one working surface). A referenced case is one scored against a reference shot.

- **Flat since cycle 14.** X1 scored 2 on at least five of six pages in every cycle from 10 to 18, X2 on at least
  four.
- **Text, not code.** Cycles 16 to 18 closed 128 findings: 70 through skill or rubric text, 52 through code.
- **It cannot converge by its own protocol.** No referenced case has run since cycle 6, and the question has waited
  for the owner since cycle 10.
- **The text piled up.** `basalt-design/SKILL.md` is 22 KB with sections titled "Lines from cycle 11" to "Lines from
  cycle 18"; the three skill bodies run 12 to 22 KB against a budget of 8; about 240 KB of skills land in every consumer.
- **Two owner remarks were closed by a sentence.** The stat strip and the settings page of owner review 2 ended as
  lines in `cards.md` and `forms.md`; neither page was shot again.

**Decision.** Land the two open kit rows (Issues 2784 and 2785, both code), cancel cycle 19 and stop the loop. X1
and X2 move to a deterministic check in `shot detect` or stay with the reviewer: a ninth paragraph will not move a
score that eight did not. Rewrite `basalt-design` to its budget after the first port, ordered by decision, without
the cycle history, with the port's friction as input.

The layer is Claude Code only beyond the `AGENTS.md` block. The managed-file mechanism in the manifest is
tool-neutral, so a second target is additive and no reason to wait.

## 8. Repo and docs

- **The binding contract is unreadable and partly wrong.** `ARCHITECTURE.md` is 178 KB, `DIRECTION.md` 200 KB, the 14
  concepts 1.5 MB. Against the tree: it names tsdown and `isolatedDeclarations` (the build is tsup and tsc), puts
  `BasaltProvider` in `.`, and `MAINTAINING.md` counts six rules and names `basalt-batteries.md` (five, and no such
  file). The root `AGENTS.md` still says `./data` was dropped in 1.29.0 and that the repo lints "on the 2.x config".
- **Code reads the prose.** The budget areas and gates parse tables out of `ARCHITECTURE.md`.
- **Decision at the freeze.** Write `docs/v3/CONTRACT.md` from the tree, under 25 KB: layers, subpaths, peers,
  glossary, consumer layout, enforcement. Generate its subpath and peer tables from `surfaces.ts`, once that file is
  repaired (section 5), never the reverse. Archive the direction, digest, concepts, cycles, spikes and panel. Delete `examples/react`, red since
  the rewrite.
- **Throughput is fine.** CI takes a median of 7.3 minutes and a PR merges in a median of 20 minutes. The factory
  lacked a signal from outside its own rubrics.

## 9. Path to 3.0.0

1. **Trial app.** A new project from the packed tarball, `init --profile app` and one `site`, three or four real
   pages, a friction ledger. It stays as the CI fixture of section 3.
2. **Freeze pass.** Section 4 as one wave, mostly deletions and renames, each a contract amendment with its
   migration row.
3. **First port.** The smallest app with a shell, a table, a chart and a form, then argo: its 234 friction rows
   wrote this contract, so it is the test that counts. Change the API freely in this phase.
4. **Second freeze pass** from the port ledger, the new contract document, the skill rewrite.
5. **`GA=1 make release`**, then the fleet with the codemods.

3.0 freezes what a consumer types: subpath and export names, prop names, token names, rule ids, the manifest and
budget schema, CLI verbs and flags, managed paths. It does not freeze rendering (`MAINTAINING.md` already says what
a minor may move), skill and rule text, the eject format or `./ai`.

## 10. Not verified

- Nothing was built or run: the results of `tsc`, `attw`, `publint` and the test suites are not from this audit, and
  the `dist` on disk is stale.
- The restyle-regex gap (section 6) and the `FormField control` gap (section 4, row 13) are read from source, not
  reproduced.
- The typed-nav gaps (section 4, row 8) are read from the types, not compiled against a failing case.
- The edit hook spawns oxlint and stylelint per edit; no document records its latency.
- Whether npm stops an install on an exact optional peer that is one patch off was not tested.

## 11. Status after the freeze wave (2026-11-24)

All 13 rows of section 4 are closed (the Status column); `docs/v3/CONTRACT.md` now states what 3.0 freezes and a test holds it to the tree. Still open:

- **Plan rows `ga-site-pages` and `ga-playground-tour`** (Issues 3266, 3231): site recipes on shipped parts, and the playground tour. Neither changes a frozen name.
- **The fresh-agent trial** of section 9 (app and site, from the packed tarball), then the first port and the second freeze pass. The release is the owner's timing.
- **tsup to tsdown**: accepted for after 3.0, no consumer-visible change.
- **Edit-hook latency**: no document records it.
- **Fixtures `linewatch`, `console` and `full`**, promised by the history in `ARCHITECTURE.md` section 9: not built; the trial app replaces them.
- **Archiving** `DIRECTION.md`, the digest, the concepts, cycles, spikes and panel: they stay in place as history; `CONTRACT.md` is the one document to read.
