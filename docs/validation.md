# Validation

The full gate, the layout suite and the browser and memory rules. Read this before running the layout suite or the package build, or when a `make check` failure is not explained by the root file.

`pre` runs the unit suite; the **layout** suite (real CSS geometry in Playwright's headless shell, 127 files and
~2300 tests, about half a second each, nearly all of it opening a page: 18 min measured on a loaded host) stays out of it and is reached by `make layout`, by `make check`, or
in part by `make layout-fast` (`scripts/layout-select.ts` picks the files by name: a changed layout test and fixture,
the tests named for a changed `src/` file, its folder or the fixture that imports it; a change no name places runs a
6-file smoke set; a change no page can see, such as docs, scripts or unit tests, runs none). The pick is a heuristic, so CI
holds the full suite. `make check` builds FIRST on
purpose — `pre`'s lint (it loads `basalt-ui/lint`) and the playground's typecheck both resolve through `dist`, so a
check that built last would grade the previous build.

**The dist-reads-not-src footgun spans two builds you have to trust in order:** the playground's
typecheck resolves `basalt-ui/*` through `node_modules` → `dist/**/*.d.ts` even though Vite aliases
it to `src/` for the running app, so a new/widened export is invisible to `bun run typecheck` until
`bun run build` runs. `packages/basalt-ui/MAINTAINING.md` names the third footgun (a CLI verb reading `dist`) in the
same family — build before trusting a typecheck or a lint run that spans both packages.

**Pack-test (the dist gate, runs in CI):** `bun pm pack` + scratch-install of the tarball. The
playground runs its scripts from `src/` (its styles and `basalt()`'s graph come from `dist/`) — the
pack-test is what proves the published artifact resolves. Its last step, `scripts/pack-consumers.sh`,
is the install path from an empty directory: a create-vite app through `init --profile app`, a build
with no further install, a server render of the start page, an eject round trip ending in `doctor`,
and a removed shell peer that fails `doctor` and the build gate until the gate's own line restores it, then an Astro project through `init --profile site` and `astro build` (no module script on
a static page, one island on the island page).

`make check` is the local equivalent of CI (`.github/workflows/ci.yml`): it runs the generation sync
checks, builds first, then `pre` (fmt:check + lint + typecheck + check-budgets + unit
tests), the layout suite, the coverage and agent-doc-drift gates, and the pack-test. CI runs the same gates as parallel jobs (checks, unit, the layout suite sharded four ways with
`bun test --shard`, `quality-matrix` (`make quality-matrix`, sampled, eight jobs: it is one file of cells, so `BASALT_MATRIX_SHARD=<i>/8` keeps every eighth cell, `tests/quality/matrix/shard.ts`; it was 19.4 min as one job on the hosted runner), `site` (builds basalt-ui.com, runs `basalt-ui sync` and `doctor` on apps/marketing, then `measure.ts --check --browser` against `apps/marketing/site-budgets.json`), and `gate`, which runs `make check CI_SPLIT=1` (= `make ci-gate`): only the steps of `make check` no other job runs, namely the
generated-file gates, the literal, recipe, README and playground-lint checks, guard-completeness and the test
ledger) behind one final `ci` job, so the run-level result `make merge-guard` reads still means
everything passed. Every step of `make check` runs once per head. The `ci` job also asserts that the four layout shards
ran, together, every `*.layout.test.ts` file (`scripts/check-layout-shards.ts` over the shard logs), and that the eight quality-matrix shards ran every cell of every matrix file (`scripts/check-matrix-shards.ts`: each shard's file count and its `matrix-shard <i>/8 ran=K total=T` line); a step added to `check`
belongs to `ci-gate` unless the `checks`, `unit` or `quality-matrix` job already runs it. `make check` runs them in sequence and is unchanged without `CI_SPLIT=1`; `make check-fast` is the same but for the layout
and the unit step, which run only the files the branch's changes reach (`make test-fast`, below), and the quality and Astro matrices, which run only the routes and parts the branch's changes reach (`make quality-matrix-fast`, `make astro-matrix-fast`, below; `make quality-matrix` and `make astro-matrix` always run them whole) (a lead's check, `project.yaml` `checks`; CI runs the full suite on the head). It exits
non-zero on the first failure and writes only gitignored output (`dist/`, `*.tgz`). `pre` alone is
the fast inner loop. Its last step, the unit suite, is `scripts/unit-test.ts`: consecutive `bun test` processes (the five
ts-program files alone, the rest in chunks of 40), peak ~2.2 GiB resident where one process held 6.1 GiB. It runs through
`make test` in a host test slot named `basalt-ui unit` (`factory slot run`, one name per project, never per worktree), like the layout suite; never run a bare whole-repo `bun test`
from a lead session, scope it to the files you touched (`bun test <path>`) and leave the full suite to `pre`.

**A failed run stops early.** A slot minute spent after the first failure is lost, so the steps that run in a slot stop at it:
`scripts/unit-test.ts` starts no further process and kills the running ones, and keeps the files of the failed process in
`node_modules/.cache/unit-test-failed.json`; the next run puts the processes holding them first (`scripts/unit-order.ts`), so a
fix is proven in one process before the rest runs, and a green run deletes the file. The layout, layout-fast and
quality-matrix steps pass `--bail` when `factory` is installed (the Makefile's `bail`), so they end at the first failing
test. A failed run therefore shows the first failure, not all of them: fix it and run again. CI runs its own steps, never
passes `--bail` and reports every failure. A passing run runs the same files either way.

The step may run off the mini (`project.yaml` `steps.unit`): the factory's step host builds `tools/step-image/Dockerfile`
(Ubuntu 24.04, bun, the `.nvmrc` Node, Chrome) and runs `make test` in it with the build output carried in. There the
host grants cores and memory (`FACTORY_STEP_CORES`, `FACTORY_STEP_MEM_MIB`) and `scripts/unit-test.ts` runs up to
`min(cores, memory / 1 GiB, 6)` processes at once, while the sum of their estimated peaks (`HEAVY_MIB`, measured per file) stays under 2 GiB, the step's peak budget (`UNIT_PEAK_MIB` overrides; the CI job sets 16384) (`scripts/unit-parallelism.ts`); unset, as on the mini and a bare `make test`, it
stays serial; the CI unit job sets 4 cores and 16 GiB and runs at width 4. Peak measured serially 2026-11-21: 1.78 GiB for the largest process (gen-llms); since 2026-11-22 `gen-llms` reads its signatures, option types and glossary from one shared TypeScript program (`packages/basalt-ui/scripts/llms-signatures.ts`; the program alone went from 1.5 to 0.95 GiB and 7 to 3 s with `llms.txt` byte-identical, and the `gen-llms.test.ts` process now peaks at 1.4 GiB, the `HEAVY_MIB` value), a process `bun run build`, `pack-test` and the doc-drift gate each start; six in parallel measured 3.9 GiB (2026-11-17), which the budget now bounds. Every process runs with `--timeout 30000`, because a host 1.7x slower under parallel load took 5 to 8 s
for tests that take under 3 s on the mini. `FACTORY_SLOT_HOST=vps make test` pins one run there.

## Unit tests the branch reaches (`make test-fast`)

`make check-fast` runs `pre:static` and then `make test-fast` instead of the whole unit suite: `scripts/unit-test.ts --changed`
(the same processes and the same bunfig). `scripts/unit-select.ts` picks the files in two parts: every file outside the
`always-on` set runs through `bun test --changed=<merge base>` (bun's own module graph: the tests that import, through any
chain, a changed file), and the always-on set runs whole. That set is the tests an import graph cannot see because they
read files or spawn tools: every test outside `apps/` and the `packages/basalt-ui/src/<folder>/` folders (`apps/` runs whole once a file of the package changed: it imports the package by name, which resolves to `dist`, never to the changed `src`) (the root `tests/`,
`scripts/`, `packages/basalt-ui/{scripts,tests}`, `tools/`, the files directly in `src/`), minus the `SLOW` list (8 to 90 s
each, covered by a script gate of `check-fast` or reached by the graph), plus any test whose text names a changed file by
its file name or its last two folders (`fixtures/hook`, `src/cli`), `SLOW` ones included: they read fixtures and spawn bins, which are not imports. A change to a `package.json`, `bun.lock`, `bunfig.toml`, a `tsconfig`, `tests/setup/` or the unit scripts
runs the whole suite. The price is stated in the script: a test that covers code the branch did not touch fails in CI,
not here; CI and `make check` run the whole suite (`scripts/unit-test.ts`, `make test`), so what ships is covered the same. Measured
2026-11-18 on the mini under load: the always-on set is 97 files, about 104 s of the ~330 s the 200 files outside `src/`
and `apps/` cost, against a whole suite of 412 s. `test-fast` takes the slot `unit-fast`, never `unit`: `project.yaml` may place
`unit` on the step host, whose copy of the tree has no working-tree diff, and `--changed` would see no change there.

## Matrices the branch reaches (`make quality-matrix-fast`, `make astro-matrix-fast`)

A lead never runs either matrix whole. The sampled quality matrix is 426 cells (2026-11-22: 55 routes at two cells, 158 pages at two hover cells), over 30 minutes at the 4.8 s a cell took under host load; CI runs every cell in eight shards on every head, and `make merge-guard` refuses a head without that run. `scripts/matrix-select.ts` picks the local share from the merge base with `BASE` (default `origin/master`) through the working tree, and prints why on stderr:

| Changed file                                                                                                                                                  | Quality matrix          | Astro matrix (`--astro`) |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------ |
| none of the matrix's inputs                                                                                                                                   | skip                    | skip                     |
| the matrix's own code (`tests/quality`, `tests/support`, `src/testing/quality.ts`; the Astro scripts, config, registry)                                       | all                     | the smoke set            |
| an additive registry, scenario-info or `demo/series.ts` diff                                                                                                  | the new scenario routes | (not an input)           |
| a module some pages import, through any chain                                                                                                                 | those routes            | those parts              |
| a module the app shell or the Astro layout reaches (a token sheet, `table.css`, a shared primitive), a manifest, a deleted file, a file the graph cannot read | the smoke set           | the smoke set            |
| a source no page imports (a test, a CLI module, a package gate)                                                                                               | nothing                 | nothing                  |

The graph is `scripts/import-graph.ts`: Bun's transpiler scans each module's imports (type-only ones dropped), `basalt-ui/<subpath>` resolves through the package's `exports` to the source the unbundled build mirrors, CSS `@import`s are followed; a route renders its own file and every layout above it, a scenario page the scenario route plus its registry entry's module. The matrix serves two apps, the playground and the expression app (`apps/expression`, the expression trial scenarios): each is bundled and served on its own port, `scripts/matrix-select.ts` models both, and the route names every scenario keeps (`/scenarios/expr-n87`) say which app serves them. A local import that resolves to no file fails `scripts/matrix-select.test.ts`, so a gap in the resolver cannot read as "no page reached". It follows modules, not symbols: an import from a barrel (`basalt-ui/page`) reaches everything the barrel re-exports, which is why most of the chart and card internals sit in the shell's reach and select the smoke set.

The smoke set is one route per part family, every sampled cell of each: `/cards`, `/charts`, `/kit/controls`, `/kit/forms/whole`, `/scenarios` (the expression app's index), `/scenarios/mdx`, `/table` (28 cells), and for the Astro matrix one part per family (7 parts). A reached set runs whole up to 48 cells (24 Astro parts); past that, the smoke set plus an even sample of the reached pages up to the cap; a reach of more than half the pages is the smoke set alone. `make astro-matrix-run ASTRO_PARTS=<id,id>` measures those parts and their families' pages, and `matrix.ts` judges only what it measured and refuses to record a partial run.

**A page that passed is not run again.** `scripts/green-cache.ts` fingerprints each page: the content of every file its render reaches (the same graph, shell and barrels included), the matrix's own code, the manifests, and for an Astro part the other parts of its family (the family page measures them together). `quality-matrix-fast` and `astro-matrix-fast` run only the selected pages whose fingerprint has no recorded pass, and record the pages of a run that exited 0, so the rerun after a fix to a ledger, a doc, a test or a gate script (the usual second `check-fast`) runs no browser, and a change to one page's file reruns that page and the shell's pages only. The record is `basalt-green/<matrix>` in the git common dir, shared by the checkout's worktrees. It is a lead's shortcut and nothing CI relies on: `make quality-matrix`, `make astro-matrix`, `make check` and CI never read it, and any error in it runs the selection as before.

**When CI's matrix fails:** the `quality-matrix` shard log names the failing cells; rerun only those routes locally, `make quality-matrix BASALT_MATRIX_ROUTES=/table,/scenarios/expr-n87` (the Astro one: `make astro-matrix-run ASTRO_PARTS=<id,id>`), fix, push, and let CI hold the whole again. Never run the whole matrix locally before a push.

## Layout suite

- **The layout suite needs the headless shell.** It runs in CI, `make check` and (in part) `make check-fast`, never in `pre`.
  The layout suite, the quality matrix and the print controls run on Playwright's chromium-headless-shell
  (`make browser-shell` installs it, a no-op when cached; CI caches it); `BASALT_TEST_BROWSER=chrome` runs them on
  installed Chrome instead (`tests/support/test-browser.ts`). Screenshots a person judges (`scripts/evidence`,
  `src/cli/shot`, the playground shots) stay on installed Chrome.
- **The spacing guard** (`tests/layout/spacing-guard.layout.test.ts`, measurements in `spacing-guard/geometry.ts`) opens every stop of the playground's tour (read from the nav model, so a new stop needs no edit) at 1800 and at 390 with classic 11 px scrollbars, which the headless shell and a trackpad Mac hide, and fails on real geometry, tolerance 1 px: a surface or a scroll region inside it with unequal insets left and right (scrollbar included), a node drawn over a scrollbar, a scrollbar for four pixels of overflow, siblings in a row on different top edges, a declared gap off the spacing ladder, and a framed child that starts 1 to 7 px off the plain sibling above it. It launches its own browser without Playwright's `--hide-scrollbars`. A scroller with inset content takes `[scrollbar-gutter:stable_both-edges]`; `ScrollArea` and `VirtualList` reserve the bar's room by default. Each rule has a seeded offender in the same file; a rule that finds nothing on a tour page is proved by that offender, not by the pages. A chart legend's gap is its hit-target arithmetic and is exempt.
- **The layout suite is a memory budget.** The harness closes each test's browser context in `afterEach`
  (a page from `beforeAll` lives until the file's browser closes); before that, one run held 13 GB of
  Chrome. Measured on the mini (2026-11-16, peak `footprint` phys_footprint of the browser tree, 2 s samples):
  layout suite 244 MiB on the shell (5 processes, 642 s) against 614 MiB on Chrome (11 processes, 768 s); quality
  matrix 447 MiB (5, 185 s) against 981 MiB (8, 505 s); pass sets identical. `make check` and `make layout` run it through `factory slot run` when `factory` is installed, so two
  leads' browser steps never overlap, and `project.yaml` declares a `browser` lane for rows that add browser work.
- **The quality matrix's `bun test` process is the other half of its peak.** Measured 2026-11-19 (summed resident size of the process tree, 1 s samples): 1872 MiB peak, about 850 MiB of it bun and 1000 MiB the Chrome tree. Three causes, all in the bun process: the playground was bundled by `Bun.build` in it (the two bundles' working set stayed resident; `tests/quality/matrix/build-playground.ts` now runs as a child that exits), every closed browser context stayed in the harness's list, and `quality.axe` ran axe's default partial-result protocol, which Playwright's connection holds at ~50x the payload (5 MB on `/table`, +300 MiB of resident memory per scan; `setLegacyMode(true)` returns the finished result in the page instead). Peak after: 1430 MiB. A matrix test that returns a large value from `page.evaluate` pays that factor again.
- **`make check-fast` peaked at 3 GiB (p90 3047 MiB, 2026-11-19) in two places, neither a browser.** Measured 2026-11-20 (`/usr/bin/time -l`, the largest process): `check-agent-doc-drift.ts` 2965 MiB, because `checkBSrc` held every source file as an array of one-character strings and compiled a `RegExp` per line and name on top of the 1.4 GiB checker program that `gen-llms` builds on import (now 1.6 GiB, 4 s); and `shell/commands/shortcut-overlay.test.tsx` 2.9 GiB in one test, because `waitFor(() => expect(overlay()).toBeNull())` printed the whole open overlay's DOM into the failure message on every poll (now 141 MiB, 0.4 s). Use `expect(x() === null).toBe(true)` inside a `waitFor` that polls a DOM element. The root `typecheck` runs its package typechecks (basalt-ui, playground, marketing) and the evidence `tsc` one after another (about 2.0 GiB summed in parallel, and no wall time saved by it).

## Astro matrix

`apps/playground-astro` is the Astro beside the Vite playground: Astro 7 with `@astrojs/react` and Tailwind 4 (`@tailwindcss/vite`), consuming the package's built `dist` the way an Astro site installs it. Every part has one demo module (`src/parts/<family>/<id>.tsx`, data from the Vite playground's fixtures) and an entry in its family's `index.ts` (what it covers, and whether it needs JavaScript: `none`, `enhance` or `required`). `scripts/gen-pages.ts` writes the pages before every build, because a client directive works only on a component imported by name: one page per part and mode (no directive, `client:visible`, `client:idle`, `client:load`, `client:only`), one per family and mode, and a baseline island.

**One command:** `make astro-matrix` builds the package, builds the playground (`bun --filter @basalt-ui/playground-astro build` alone builds the site), measures it and checks the result. `scripts/measure.ts` serves `dist` and loads every page in the headless shell inside the `astro-matrix` slot (about 5 minutes for 90 parts): whether the server rendered the part, the static section against the client:only section at 1440 and 390, light and dark (size, text and a pixel diff, side-by-side pictures in `.astro-matrix/shots`), console and hydration errors, the layout shift and LCP of each page, and the gzip bytes of its scripts (the inline island runtime included) and stylesheets. The baseline island's files are the framework runtime; a part's further-island cost is what its page loads beyond them. `scripts/matrix.ts` judges the run against `docs/v3/verdicts/astro-matrix.json` and renders `astro-matrix.md` from that JSON alone; causes read from the source and their plan rows are `src/parts/findings.ts`.

**The loop:** CI's `astro-matrix` job runs `make astro-matrix-run` on every head, `make check` runs it too, and `make check-fast` measures only the parts the branch's changes reach (`make astro-matrix-fast`, § Matrices the branch reaches: `ASTRO_INPUTS` in `scripts/matrix-select.ts` is the package, whose build the matrix measures, the Vite playground's demo fixtures, the app, the record, the root manifest and the lockfile). The record (`docs/v3/verdicts/astro-matrix.json`) holds what is judged, never a measured size: per part its verdicts and three gzip budgets (the most JavaScript any hydrating mode's page loads, the further-island share of it, and CSS), per family its JavaScript budget per mode, the island runtime's budget, and the reason of each raise. A budget is set at the measured size plus 1 KiB (`BYTE_SLACK` in `scripts/matrix.ts`) and never lowered, so a build that measures inside it rewrites nothing and two branches that change the package rebase over each other with no re-record. Every run writes the whole measured table (each size, LCP, CLS, pixel diffs, the side-by-side pictures in `shots/`, the exports no demo renders) to `apps/playground-astro/.astro-matrix/matrix.md`; CI keeps that directory as the job's `astro-matrix` artifact. The check fails when a part the record calls static-clean is not (more than 4 changed pixels in a view, `PIXEL_TOLERANCE`), when a page's JavaScript, further-island JavaScript or CSS is past its budget, when a page without an island loads any script, or when the `.md` is not the JSON's (a unit test in `scripts/matrix.test.ts` and `matrix.ts --check-render` check that too, with no browser). A part that grows past its budget on purpose raises it: `make astro-matrix-run ASTRO_PARTS=<id> UPDATE=1 REASON="<why>"` rewrites that part's line and the `.md`; the review sees the raise and its reason. `UPDATE=1` also records a new part and a flipped verdict; an improvement is reported, never failed, and never rewrites a budget. A fix row from the matrix proves itself the same way: its acceptance names the parts the record must show static-clean.
