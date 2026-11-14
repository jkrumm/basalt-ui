---
name: basalt-app
description: Set up, verify, upgrade or migrate a basalt-ui app: pick the profile, run `init`, `doctor` and `sync`, and move a 2.x app to 3.x.
when_to_use: User is adding basalt-ui to an app, wiring the shell, router or the vite plugin, upgrading basalt-ui, refreshing the shipped rules, wiring a freshness check in CI, migrating a 2.x app, or asking how a page, a live query, a test or a recipe is done. Also when /basalt-design reports no DESIGN.md.
---

Procedure only. The law is `.claude/rules/basalt-*.md`; props live in `node_modules/basalt-ui/docs/<name>.md` and the shipped `.d.ts`. This file restates neither.

## The bin

Run the local bin, `./node_modules/.bin/basalt-ui` or a package script; in a workspace it is the app package's own `node_modules/.bin/basalt-ui`. Every verb reads its project from the cwd (`BASALT_CWD` overrides it), and `--help` never mutates.

| Verb                      | Use                                                                                                                                                                                    |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `init`                    | Place the manifest, the managed rules and skills, the AGENTS block and the `DESIGN.md` seed at the git or workspace root. `--no-install` writes files and prints the install commands. |
| `doctor`                  | Check this project; read to the last line. `SKIPPED` exits non-zero. `--from <x.y.z>` prints the `MIGRATING.md` changes since that version.                                            |
| `sync`                    | Refresh every managed file; `--check` writes nothing and exits 1 on a difference (the CI gate); `--force` overwrites a file you edited.                                                |
| `check-theme`             | Scan for hand-written colour; `--audit-allows` lists waivers that suppress nothing.                                                                                                    |
| `tokens:css`, `fonts:css` | Emit the `--vx-*` sheet and the font stacks as plain CSS; `--check` is the CI gate.                                                                                                    |
| `migrate`                 | Select the migration rows an app needs from a version; see [migrate](references/migrate.md).                                                                                           |
| `eject`                   | Take ownership of one primitive, with `--reason`; see [eject](docs/eject.md).                                                                                                          |
| `shot`                    | Render routes to an out dir for the reviewer; see `/basalt-design`.                                                                                                                    |

## Pick the profile

The profile is declared in `.basalt/manifest.json` and never inferred. Choose the lowest that covers what the app imports.

| Profile  | The app is                                 | It adds                                                                           |
| -------- | ------------------------------------------ | --------------------------------------------------------------------------------- |
| `tokens` | Not React (a static page, Astro, an email) | `--vx-*` and font CSS only                                                        |
| `bridge` | React with its own components              | Tailwind 4, `cn`, the lint preset, the rules                                      |
| `parts`  | React using shipped parts                  | `basalt-ui/ui/*` and the page, card, control, table, chart and content composites |
| `app`    | A multi-page app on the shipped frame      | `basalt-ui/shell` and the router                                                  |

## Set up a new app

1. `bun add basalt-ui`, then `./node_modules/.bin/basalt-ui init` at the repo root. Install the peers of each subpath you import: the generated doc of the export names its `peers`, and `llms.txt` lists them per subpath.
2. Confirm `profile` in `.basalt/manifest.json`, then run `doctor` and fix every finding it prints until it is clean.
3. Tokens: `./node_modules/.bin/basalt-ui tokens:css --out src/tokens.css` and `fonts:css --out src/fonts.css`; import them once, and commit the output as the app's own files. A `tokens` app stops here.
4. Vite apps (`bridge` and above): add `basalt()` from `basalt-ui/vite` to `plugins` and import the generated `.basalt/sources.css` after `@import 'tailwindcss'` ([vite](docs/vite.md), [basalt](docs/basalt.md)). Outside Vite the app lists its own Tailwind sources.
5. `app` profile: mount the frame once in the root route ([app-shell recipe](references/recipes.md)), declare `NAV` once with [defineNav](docs/define-nav.md), and gate an authenticated app in the root route's `beforeLoad` (the shell has no auth seam and loaders fire before any gate component renders).
6. Fill in `DESIGN.md` (identity, series dictionary, deviations); `/basalt-design` reads it before every page.
7. Run the repo gate (`make check` or the package's own), which runs lint, `check-theme` and typecheck. Fix findings at their source.

## Add what the app needs

- A page, a nav entry, a board, a timeline, persisted state, a transport or a markdown view: one line per recipe in [recipes](references/recipes.md), each with a file that compiles in the playground. When an export is missing, look for its recipe first.
- Live data, freshness, streams and the connection: [live](references/live.md).
- Tests, DOM shims and what only a browser can assert: [testing](references/testing.md).
- Route bars, the compiler check and DevTools: [performance](references/performance.md).
- A new screen or a chart: `/basalt-design`, `/basalt-charts`.

## Refresh after any upgrade

1. `./node_modules/.bin/basalt-ui sync`, then read its output: an edited file is skipped and reported, a retired file is deleted, the AGENTS block is rewritten.
2. `./node_modules/.bin/basalt-ui doctor`, read to the last line.
3. CI: `sync --check`, `doctor` and `tokens:css --out <file> --check` so a stale managed file or a stale token sheet fails the build.
4. An app with a board baseline builds the old version first (`vite build --outDir /tmp/before-dist`), bumps, then `shot /a /b --dist /tmp/before-dist --out <app-dir>/.shots/before` and the same with `--dist dist --out <app-dir>/.shots/after`. `--out` is inside the app dir; each route is its own argument. A locked or API-backed app shoots its lock screen on every route: serve fixtures on `127.0.0.1` and pass `--api /api=http://127.0.0.1:<port>` plus `--local-storage key=@env:NAME`.

## Upgrade within 3.x

A 3.x release never removes a public shape without a migration row and never changes a value silently: a change to a number is a `valueShifts` row. After the bump, run `sync`, then `doctor --from <old version>` and read what it prints, then `migrate` when a row names a symbol you import ([migrate](references/migrate.md)). A removed symbol that is still imported fails `migrate --check`.

## Migrate from 2.x

1. Pick the coexistence shape first: [migrate](references/migrate.md) holds the four shapes, their cost and who each fits. The default for an app with more than a few dozen importers is a sibling app; for a small app it is one cutover PR on a branch.
2. Be on the last 2.x release with its gate green, then run `migrate --from <version> --profile <profile>` and read the report: rows, token renames, `valueShifts`, storage and URL keys.
3. Work the report as a worklist until `migrate --from <version> --profile <profile> --check` exits 0. A codemod report is never an exemption: every flagged site is fixed in a commit or carries a waiver with a reason.
4. Regenerate the visual baselines in the same PR and name each image and its `valueShifts` reason in the commit body.

## Not a React app

`tokens:css --out src/tokens.css` and `fonts:css --out src/fonts.css`, then `"profile": "tokens"` in `.basalt/manifest.json`. A theme-color meta or an email takes `tokens:css --format json`.

## Where things live

| Question                                                         | File                                     |
| ---------------------------------------------------------------- | ---------------------------------------- |
| Which coexistence shape, what each costs, the `migrate` workflow | [migrate](references/migrate.md)         |
| A page, board, timeline, state, transport or markdown recipe     | [recipes](references/recipes.md)         |
| Live queries, channels, invalidation, the connection             | [live](references/live.md)               |
| Test kit and browser-only assertions                             | [testing](references/testing.md)         |
| Bars per route, the compiler check                               | [performance](references/performance.md) |
| Props and usage of one export                                    | `node_modules/basalt-ui/docs/<name>.md`  |

not guarded:

- Run `init` once, from the local bin after `bun add`; never run a verb through a download-and-run command.
- Read `references/migrate.md` before choosing a coexistence shape; never start a migration by editing imports.
