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
playground only exercises `src/`, never `dist/` — the pack-test is what proves the published
artifact resolves.

`make check` is the local equivalent of CI (`.github/workflows/ci.yml`): it runs the generation sync
checks, builds first, then `pre` (fmt:check + lint + typecheck + check-budgets + unit
tests), the layout suite, the coverage and agent-doc-drift gates, and the pack-test. CI runs the same gates as parallel jobs (checks, unit, the layout suite sharded four ways with
`bun test --shard`) behind one final `ci` job, so the run-level result `make merge-guard` reads still means
everything passed. `make check` runs them in sequence and is unchanged; `make check-fast` is the same but for the layout
step, which runs only the files the branch's changes reach (a lead's check, `project.yaml` `checks`; CI runs the full suite on the head). It exits
non-zero on the first failure and writes only gitignored output (`dist/`, `*.tgz`). `pre` alone is
the fast inner loop. Its last step, the unit suite, is `scripts/unit-test.ts`: consecutive `bun test` processes (the five
ts-program files alone, the rest in chunks of 40), peak ~2.2 GiB resident where one process held 6.1 GiB. It runs through
`make test` in a host test slot named `basalt-ui unit` (`factory slot run`, one name per project, never per worktree), like the layout suite; never run a bare whole-repo `bun test`
from a lead session, scope it to the files you touched (`bun test <path>`) and leave the full suite to `pre`.

## Layout suite

- **The layout suite needs the headless shell.** It runs in CI, `make check` and (in part) `make check-fast`, never in `pre`.
  The layout suite, the quality matrix and the print controls run on Playwright's chromium-headless-shell
  (`make browser-shell` installs it, a no-op when cached; CI caches it); `BASALT_TEST_BROWSER=chrome` runs them on
  installed Chrome instead (`tests/support/test-browser.ts`). Screenshots a person judges (`scripts/evidence`,
  `src/cli/shot`, the playground shots) stay on installed Chrome.
- **The layout suite is a memory budget.** The harness closes each test's browser context in `afterEach`
  (a page from `beforeAll` lives until the file's browser closes); before that, one run held 13 GB of
  Chrome. Measured on the mini (2026-11-16, peak `footprint` phys_footprint of the browser tree, 2 s samples):
  layout suite 244 MiB on the shell (5 processes, 642 s) against 614 MiB on Chrome (11 processes, 768 s); quality
  matrix 447 MiB (5, 185 s) against 981 MiB (8, 505 s); pass sets identical. `make check` and `make layout` run it through `factory slot run` when `factory` is installed, so two
  leads' browser steps never overlap, and `project.yaml` declares a `browser` lane for rows that add browser work.
