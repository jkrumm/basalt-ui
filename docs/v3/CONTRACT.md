# Basalt UI 3.0: the contract

What 3.0.0 freezes, as of 2026-11-24. After 3.0.0 a change to anything this file states needs a major release; an
addition does not. Everything else in the repo can move in a minor. `docs/v3/ARCHITECTURE.md` and
`docs/v3/DIRECTION.md` are the history of how this was decided and bind nothing: where they differ from this file,
this file wins and the history is wrong.

Two kinds of section hold it to the tree. A **generated** section sits between `<!-- generated:<name> -->` markers;
`bun packages/basalt-ui/scripts/gen-contract.ts` rewrites it and `scripts/gen-contract.test.ts` fails on any
difference. A **checked** section is prose a person writes; the same test parses the lines marked below and fails when
the tree disagrees. The file stays under 25 KB, and no script or source reads `ARCHITECTURE.md`.

## 1. Layers

Imports point down only. `import-boundary` and `scripts/check-dist-layering.mjs` hold it; a violation is an error,
never a waiver.

| L   | Layer      | Where                                                         | May import                                                                |
| --- | ---------- | ------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 0   | tokens     | `src/tokens`, `src/css`                                       | nothing at runtime                                                        |
| 1   | core       | `src/core`, `basalt-ui`                                       | react                                                                     |
| 2   | logic      | `src/router`, `src/data`                                      | L0, L1, its own peer                                                      |
| 3   | primitives | `src/ui`, `basalt-ui/ui/*`                                    | `cn`, `useFormat`, `@base-ui/react`, cva, sibling primitives by specifier |
| 4   | composites | the directories on the next line                              | L0 to L3, the declared edges, primitives only as `basalt-ui/ui/<name>`    |
| 5   | tooling    | `src/vite`, `src/lint`, `src/testing`, `src/cli`, `src/astro` | L0 and build-time dependencies                                            |

Composites: page, shell, cards, controls, table, charts, content, ai
Declared L4 edges: shell -> page, router; table -> controls, cards, page; ai -> content

A subpath is one `src/` top-level directory, one peer class and one Tailwind `@source` unit. A composite importing
another composite that is not on the line above fails `gen-contract.test.ts`, which scans the imports of every
composite directory. **Declared L1 exception:** `src/core/list` (the option model behind `Select`, `Combobox` and the command palette) imports
`@base-ui/react`, cva and `ui/avatar`, because an ejected `select` or `combobox` seed may import only `../core/<path>`,
`../tokens` and `./<sibling>`. No other `src/core` module imports a peer but react. `charts` and `tokens` import no UI library; `src/charts/host.tsx` is the only importer of
`@tanstack/charts/react`. Ports (`src/core/ports.ts`) replace sideways imports between composites.

## 2. Subpaths and peers

Every published subpath, its layer and its optional peers, from `src/surfaces.ts`. No peer is required: a consumer
installs the peers of the subpaths it imports, and `basalt()` and `doctor` name the missing one. A public type is
importable from a published entry; `basalt-ui/core/*` is the explicit list an ejected primitive imports, never a
home for a consumer's type. One import path per symbol. The generated docs under `node_modules/basalt-ui/docs/` and
`llms.txt` carry each export.

<!-- generated:subpaths -->
| Subpath | Layer | Optional peers |
|-|-|-|
| `basalt-ui` | ui | none |
| `basalt-ui/charts` | headless | `@tanstack/charts`, `d3-scale` |
| `basalt-ui/tokens` | headless | none |
| `basalt-ui/vite` | build-tooling | `vite`, `vite-plugin-pwa` |
| `basalt-ui/table` | ui | `@tanstack/react-table`, `@base-ui/react` |
| `basalt-ui/content` | ui | `@base-ui/react`, `shiki`, `@shikijs/langs`, `@shikijs/themes`, `pele`, `react-markdown`, `remark-gfm`, `rehype-sanitize`, `remend` |
| `basalt-ui/controls` | ui | `@base-ui/react` |
| `basalt-ui/router` | headless | `@tanstack/react-router` |
| `basalt-ui/data` | headless | `@tanstack/react-query` |
| `basalt-ui/form` | ui | `@base-ui/react`, `@tanstack/react-form` |
| `basalt-ui/page` | ui | `@base-ui/react` |
| `basalt-ui/cards` | ui | `@base-ui/react` |
| `basalt-ui/motion` | ui | `motion` |
| `basalt-ui/ai` | ui | `@base-ui/react`, `shiki`, `@shikijs/langs`, `@shikijs/themes`, `pele`, `react-markdown`, `remark-gfm`, `rehype-sanitize`, `remend` |
| `basalt-ui/ui/*` | ui | `@base-ui/react`, `@atlaskit/pragmatic-drag-and-drop`, `@tanstack/react-virtual`, `react-day-picker`, `react-resizable-panels` |
| `basalt-ui/core/*` | ui | none |
| `basalt-ui/shell` | ui | `@base-ui/react`, `@tanstack/react-router`, `@tanstack/react-hotkeys`, `@atlaskit/pragmatic-drag-and-drop` |
| `basalt-ui/lint` | build-tooling | none |
| `basalt-ui/stylelint` | build-tooling | none |
| `basalt-ui/testing` | build-tooling | `@axe-core/playwright` |
| `basalt-ui/theme-script` | build-tooling | none |
| `basalt-ui/static` | ui | `react` |
| `basalt-ui/astro` | build-tooling | `@astrojs/react`, `@tailwindcss/vite`, `astro`, `tailwindcss` |
| `basalt-ui/tokens.css` | non-js-asset | none |
| `basalt-ui/typography.css` | non-js-asset | none |
| `basalt-ui/prose.css` | non-js-asset | none |
| `basalt-ui/static.css` | non-js-asset | `tailwindcss` |
| `basalt-ui/starlight.css` | non-js-asset | none |
| `basalt-ui/astro/BasaltFonts.astro` | non-js-asset | none |
| `basalt-ui/astro/mdx/Chart.astro` | non-js-asset | `@tanstack/charts`, `d3-scale` |
| `basalt-ui/astro/mdx/DataTable.astro` | non-js-asset | `@tanstack/react-table`, `@base-ui/react` |
| `basalt-ui/fonts.css` | non-js-asset | none |
| `basalt-ui/archify.css` | non-js-asset | none |
| `basalt-ui/table.css` | non-js-asset | none |
| `basalt-ui/tailwind.css` | non-js-asset | `tailwindcss` |
| `basalt-ui/styles.css` | non-js-asset | none |
| `basalt-ui/configs/*` | non-js-asset | none |
<!-- /generated -->

Peer versions follow their class: caret from the tested floor for stable majors with a public API, tilde for peers
coupled to internals (`@base-ui/react`, `@tanstack/react-table`, `@tanstack/charts`), exact for 0.x and alpha tooling.

## 3. Tokens

Every token is `--basalt-<name>`; nothing else carries the prefix, and no name from the 2.x token layer survives. Spelling is
American in every identifier, rule id, file name and shipped word. The palette is derived, never authored. Names are
added in a minor and never renamed or removed without a major.

<!-- generated:tokens -->
291 names in 57 families, each `--basalt-<family>-…` (name count):

accent 4, area 2, axis 2, bad 3, brand 2, canvas 1, card 1, chart 5, contract 1, crosshair 1, ctl 1, dim 1, divider 1, dot 1, dur 3, ease 3, faint 1, fill 24, font 5, ghost 1, good 4, grid 1, hairline 1, hit 3, hover 1, icon 1, info 1, ink 4, input 1, inset 1, legend 1, line 2, measure 1, muted 1, neutral 1, on 2, prose 1, radius 8, raised 1, rhythm 3, route 1, row 1, scrim 2, scrollbar 2, selected 1, seq 5, shadow 4, space 121, spring 2, stagger 1, status 5, surface 12, text 19, tint 1, tooltip 6, warn 3, weight 3
<!-- /generated -->

## 4. Rule ids

The ids `basalt-ui/lint` reports, and the profiles that enable each. A waiver is
`// oxlint-disable-next-line basalt/<id> -- <why>`; a bare one is a `waiver-needs-reason` finding, and a file-level
waiver exists only for the deep-render paths the manifest declares. An id is never reused for another law.

<!-- generated:rules -->
19 ids, reported as `basalt/<id>`:

| Id | Family | Profiles |
|-|-|-|
| `viewport-keyed` | class | bridge, parts, app, repo, site |
| `dark-fork` | class | bridge, parts, app, repo, site |
| `fixed-color` | class | bridge, parts, app, repo, site |
| `status-fill-as-text` | class | bridge, parts, app, repo, site |
| `raw-scroll` | class | parts, app, repo |
| `tw-off-law` | class | bridge, parts, app, repo, site |
| `app-spacing` | class | parts, app, repo |
| `motion-off-scale` | class | bridge, parts, app, repo, site |
| `logical-properties` | class | site |
| `import-boundary` | import | parts, app |
| `primitive-bypass` | structure | parts, app |
| `color-literal` | structure | bridge, parts, app, site |
| `motion-literal` | structure | bridge, parts, app, site |
| `waiver-needs-reason` | structure | bridge, parts, app, site |
| `data-primitive` | structure | parts, app |
| `router-search` | structure | parts, app |
| `control-home` | structure | parts, app |
| `untrusted-markdown` | structure | parts, app |
| `page-root` | structure | app |
<!-- /generated -->

## 5. Manifest and budget

What `init` writes into a consumer's repo. A file of a newer format than the CLI reads is refused; an older one is
rewritten by `sync`. Unknown keys survive. The CLI owns the keys named below and the pre-edit guard refuses a hand
edit of them; every other key is the consumer's.

<!-- generated:formats -->
| File | Format | Keys |
|-|-|-|
| `.basalt/manifest.json` | 1 | CLI-owned: `format`, `version`, `managed`, `ejected`, `sibling`; profiles: `tokens`, `site`, `bridge`, `parts`, `app` |
| `.basalt/budget.json` | 1 | `format`, `ejects`, `adopted`, `waivers`, `escapes`, `profileFloor`, `raises` |
<!-- /generated -->

## 6. CLI

`basalt-ui` runs under Node 22.18 or newer (`engines`) with no Bun API on any path; `init` offers npm, pnpm and yarn. An unknown
flag exits 1 naming the flag, and the editor hook (`lint --hook`) answers its own bad flags with 2. The flags of each
verb, from `COMMAND_OPTIONS` and the two help texts:

<!-- generated:cli -->
- `init`: `--profile`, `--root`, `--tokens-out`, `--tokens-json-out`, `--extra`, `--accent`, `--neutral`, `--vibrancy`, `--selector`, `--no-install`, `--start`
- `sync`: `--force`, `--check`
- `doctor`: no flags
- `migrate`: `--from`, `--profile`, `--json`, `--check`
- `lint`: `--file`, `--agent`, `--changed`, `--stats`, `--write-budget`, `--raise`, `--consumer`, `--hook`
- `tokens:css`: `--out`, `--check`, `--accent`, `--neutral`, `--vibrancy`, `--selector`, `--accents`, `--extra`, `--format`, `--only`, `--selector-attribute`, `--selector-class`, `--light-class`, `--dark-value`, `--light-value`, `--default-scheme`, `--media-fallback`
- `fonts:css`: `--out`, `--check`
- `shot`: `--base`, `--dist`, `--out`, `--states`, `--local-storage`, `--api`, `--header`, `--wait`, `--auto-anchors`, `--api-allow-writes`, `--lint`
- `eject` and `add` parse their own flags; their usage lines:

```text
basalt-ui eject <name> --reason "<why>" [--app <root>] [--raise "<named consumer>"]
basalt-ui eject --all --reason "<why>" --raise "<named consumer>" [--app <root>]
basalt-ui eject --adopt <path> --reason "<why>" [--raise "<named consumer>"]
basalt-ui eject <name> --undo [--app <root>]
basalt-ui add <block>… [--dir <path>] [--app <root>]
basalt-ui add --list
```
<!-- /generated -->

## 7. Managed paths

What `init` writes, `sync` refreshes and `doctor` checks. A managed file is digest-guarded: `sync` never
overwrites a file the consumer edited without `--force`, and a path retired by a release is removed.

<!-- generated:managed -->
| Shipped | Placed by init and sync at | Names |
|-|-|-|
| `agent/rules` | `.claude/rules/` | `basalt-charts`, `basalt-page`, `basalt-site`, `basalt-state`, `basalt-tokens`, `basalt-ui` |
| `agent/skills` | `.claude/skills/` | `basalt-app`, `basalt-charts`, `basalt-design`, `basalt-site` |
| `agent/reviewer` | `.claude/agents/` | `basalt-design-reviewer` |
| `agent/templates` | the AGENTS.md block, `.basalt/hook.mjs`, the hook entries of `.claude/settings.json` | - |
<!-- /generated -->

Also managed: the `.basalt/` files of section 5 and the committed token sheets listed in `manifest.tokens`.
`.basalt/sources.css` is written by `basalt()` and `basaltAstro()` at build time and is not managed.

## 8. What 3.0 does not freeze

Free to change in a minor:

- **Rendering.** How a part looks (color, spacing, density, motion, chart marks) is not frozen. A defect fix is a patch.
- **Skill and rule text.** The words of `agent/skills` and `agent/rules`, and the AGENTS block, are rewritten as agents
  need. The ids, tags and file names in sections 4 and 7 are frozen; the prose is not.
- **The eject format.** The header line, the `<root>#<name>` key and the seed digest are experimental in 3.x
  (`eject --help` says so).
- **`basalt-ui/ai`.** The message-part and block surface follows the model APIs it wraps and may change in a minor.
- **Internals.** Any module no section above names, `src/core` outside the exports list, generated file layouts.

## 9. Checks

| Fact                                               | Held by                                                                     |
| -------------------------------------------------- | --------------------------------------------------------------------------- |
| Generated sections, size, no reader of the history | `scripts/gen-contract.test.ts`                                              |
| Layers, composites, declared edges                 | the same test, against `src/vite/allotment.ts` and a scan of composite imports |
| Subpath peers                                      | `src/vite/allotment.test.ts`, `scripts/surface-gates.ts` and `pack-test.sh` |
| Rule ids and their fixtures                        | `src/lint/rule-table.test.ts`, `scripts/check-rule-tags.ts`                 |
| One path per symbol, public names                  | `scripts/check-budgets.ts`, `scripts/export-surface/`                       |
| Contract files are pinned                          | `scripts/check-contract-frozen.ts`                                          |
