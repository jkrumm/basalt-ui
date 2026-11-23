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
| `doctor`                  | Check this project; read to the last line. `SKIPPED` exits non-zero. Every failure names the command that fixes it.                                                                    |
| `sync`                    | Refresh every managed file; `--check` writes nothing and exits 1 on a difference (the CI gate); `--force` overwrites a file you edited.                                                |
| `tokens:css`, `fonts:css` | Emit the `--basalt-*` sheet and the font stacks as plain CSS; `--check` is the CI gate.                                                                                                |
| `migrate`                 | Select the migration rows an app needs from a version; see [migrate](references/migrate.md).                                                                                           |
| `eject`                   | Take ownership of one primitive, with `--reason`; see [eject](node_modules/basalt-ui/docs/eject.md).                                                                                   |
| `shot`                    | Render routes to an out dir for the reviewer; see `/basalt-design`.                                                                                                                    |

## Pick the profile

The profile is declared in `.basalt/manifest.json` and never inferred. Choose the lowest that covers what the app imports.

| Profile  | The app is                                             | It adds                                                                                                                                                                                                                                                                  |
| -------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tokens` | Not React (an email, a plain HTML page)                | `--basalt-*` and font CSS only                                                                                                                                                                                                                                           |
| `site`   | A static content site on Astro (pages, articles, docs) | `basalt-ui/static` and `basalt-ui/astro` parts (article frame and the landing blocks: hero, bento, comparison, questions, call to action) rendered to HTML with no client JavaScript, `static.css`, `prose.css`; Tailwind 4 and the lint preset; no router, no app shell |
| `bridge` | React with its own components                          | Tailwind 4, `cn`, the lint preset, the rules                                                                                                                                                                                                                             |
| `parts`  | React using shipped parts                              | `basalt-ui/ui/*` and the page, card, control, table, chart and content composites                                                                                                                                                                                        |
| `app`    | A multi-page app on the shipped frame                  | `basalt-ui/shell` and the router                                                                                                                                                                                                                                         |

## Set up a new app

1. `bun add basalt-ui`, then `./node_modules/.bin/basalt-ui init --profile <profile>` at the repo root (install `basalt-ui` first, then run `init` once from the local bin, never `bunx`, `init` included). `init` installs the profile's peers (`app`: `tailwindcss`, `@tailwindcss/vite`, `@base-ui/react`, `@tanstack/react-query`, `@tanstack/react-router`, `@tanstack/router-plugin`, `@tanstack/react-hotkeys` and `@atlaskit/pragmatic-drag-and-drop` for the shell, plus the lint tools and `oxfmt`). Install the peers of each further subpath you import: the generated doc of the export names its `peers`, and `llms.txt` lists them per subpath. A submit form is `basalt-ui/form`, which takes `@tanstack/react-form`.
2. Confirm `profile` in `.basalt/manifest.json`, then run `doctor` and fix every finding it prints until it is clean.
3. Tokens: `init` generates `tokens.css` (`tokens:css --out`, in the first `--root`), the app's own file, committed. A `tokens` app imports it and stops here. Re-run `tokens:css` with `--accent` or `--neutral` to retune; `fonts:css --out` beside it to change the stacks, imported after `tokens.css`.
4. Vite apps (`bridge` and above): one stylesheet entry and one plugin order, both written by `init` into a stock `index.css` and `vite.config.ts` ([vite](node_modules/basalt-ui/docs/vite.md), [basalt](node_modules/basalt-ui/docs/basalt.md)). `plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss(), basalt()]` (`tanstackRouter` first, only at `app`; below it the list is `[react(), tailwindcss(), basalt()]`), and the entry:

   ```css
   @import 'basalt-ui/tailwind.css';
   @import './tokens.css';
   @import './basalt.tokens.css';
   @import '../.basalt/sources.css';
   ```

   `tailwind.css` already brings `tailwindcss`, the shipped tokens and fonts; import none again. Edit a config `init` printed; never patch to match. Outside Vite, list your own Tailwind sources.

5. `app` profile: the entry `init` writes mounts `BasaltProvider` from `basalt-ui/router` once ([basalt-provider](node_modules/basalt-ui/docs/basalt-provider.md)); mount the frame once in the `_app` layout route ([app-shell recipe](references/recipes.md)), declare `NAV` once with [defineNav](node_modules/basalt-ui/docs/define-nav.md), and gate an authenticated app in the `_app` layout route's `beforeLoad`, never the root's (`login` sits outside `_app`) (the shell has no auth seam and loaders fire before any gate component renders).
   A TanStack Start host is `init --profile app --start`: it puts `tanstackStart()` before the React plugin, writes `src/router.tsx` (`getRouter()`), a root route whose `shellComponent` is the document and runs `themeScript()` through `ScriptOnce`, and no `main.tsx`; the app owns `@tanstack/react-start` (`bun add` it) and reads `window` and storage only in effects or behind `ClientOnly`.
6. Fill in `DESIGN.md` (identity, series dictionary, deviations); `/basalt-design` reads it before every page.
7. Run the repo gate (`make check` or the package's own), which runs lint and typecheck. Fix findings at their source.

## Add what the app needs

- A page, a nav entry, a board, a timeline, persisted state, a transport or a markdown view: one line per recipe in [recipes](references/recipes.md), each a compiled example with its imports. When an export is missing, look for its recipe first.
- Live data, freshness, streams and the connection: [live](references/live.md).
- Tests, DOM shims and what only a browser can assert: [testing](references/testing.md).
- Route bars, the compiler check and DevTools: [performance](references/performance.md).
- A new screen or a chart: `/basalt-design`, `/basalt-charts`.
- App shortcuts: `defineCommands`; any other key is `useHotkey` (`@tanstack/react-hotkeys`, the exact version `basalt-ui` pins).
- Icons: `init` installs `lucide-react` (any `IconComponent` works) and its root templates wrap the React root once in `<LucideProvider size={16} strokeWidth={1.5} absoluteStrokeWidth>`: 16 px icons with the shipped 1.5 px stroke. A hand-built root adds both.
- A surface drawn from state (a game table, a seating plan): list its directory under `bespoke` in `.basalt/manifest.json`, run `sync`, and keep to what `basalt-ui.md` allows there.

## Refresh after any upgrade

1. `./node_modules/.bin/basalt-ui sync`, then read its output: an edited file is skipped, a retired one deleted, AGENTS block rewritten. A session note: a running session may lack the new files; tell the user, finish in-flight work, start a new session.
2. `./node_modules/.bin/basalt-ui doctor`, read to its end.
3. CI: `sync --check`, `doctor` and `tokens:css --out <file> --check`: a stale file fails the build.
4. An app with a board baseline builds the old version first (`vite build --outDir /tmp/before-dist`), bumps, then `shot /a /b --dist /tmp/before-dist --out <app-dir>/.shots/before` and the same with `--dist dist --out <app-dir>/.shots/after`. Each route is its own argument. A locked or API app shoots its lock screen: serve fixtures on `127.0.0.1`, pass `--api /api=http://127.0.0.1:<port>` plus `--local-storage key=@env:NAME`.

## Upgrade within 3.x

A 3.x release never removes a public shape without a migration row and never changes a value silently: a change to a number is a `valueShifts` row. After the bump, run `sync`, then read `migrate --from <old version> --profile <profile>` beside the `MIGRATING.md` rows ([migrate](references/migrate.md)). A removed symbol that is still imported fails `migrate --check`.

## Migrate from 2.x

1. Pick the coexistence shape first: [migrate](references/migrate.md) holds the four shapes, their cost and who each fits. The default for an app with more than a few dozen importers is a sibling app; for a small app it is one cutover PR on a branch.
2. Be on the last 2.x release with its gate green, then run `migrate --from <version> --profile <profile>` and read the report: rows, token renames, `valueShifts`, storage and URL keys.
3. Work the report as a worklist until `migrate --from <version> --profile <profile> --check` exits 0. A codemod report is never an exemption: every flagged site is fixed in a commit or carries a waiver with a reason.
4. Regenerate the visual baselines in the same PR and name each image and its `valueShifts` reason in the commit body.

## Not a React app

`tokens:css --out tokens.css` and `fonts:css --out fonts.css`, then `"profile": "tokens"` in `.basalt/manifest.json`. A theme-color meta or an email takes `tokens:css --format json`.

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

- Read `references/migrate.md` before choosing a coexistence shape; never start a migration by editing imports.
