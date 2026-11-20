# apps/marketing — basalt-ui.com

basalt's own site, and the proof of the `site` profile: Astro 7 pages built from `basalt-ui/static`
parts, rendered to HTML with no client JavaScript. FPP and the owner's other content sites copy what
works here, so a shortcut taken on this site becomes theirs. Root `AGENTS.md` holds the repo rules
(Bun, oxlint, oxfmt, commits); this file adds what only this app needs.

## How it is wired

- `astro.config.mjs`: `integrations: [react(), basaltAstro(), starlight(...)]`. `basaltAstro()` from
  `basalt-ui/astro` adds `@tailwindcss/vite`, injects `basalt-ui/static.css` on every page, registers
  the three faces with the Astro Fonts API and inlines the scheme script and the parts' listeners in the head.
  Never add `tailwindcss()` to `vite.plugins` by hand: the integration adds it once.
- `src/layouts/Layout.astro` is the one layout for non-docs pages: `<BasaltFonts />` in the head,
  `SiteHeader`, `SiteFooter`, `ThemeSwitch`. Links and every visible word live in `src/lib/site.ts`;
  a part takes its words as props, never from basalt.
- `/docs/*` is Starlight (`src/content/docs/docs/`), themed by `basalt-ui/starlight.css` in
  `customCss`. `src/components/starlight/` overrides `Head` (fonts), `ThemeProvider` (basalt's scheme
  script) and `ThemeSelect` (basalt's `ThemeSwitch`), so docs and site share one stored scheme.
- `/guides/*` are MDX files under `src/guides/` rendered in `SiteArticle` with
  `siteMdxComponents(...)` as their components; raw Markdown is styled by element through
  `.basalt-prose`, and `<SiteCallout>`, `<Steps>` and `<Figure>` need no import.
- `/charts` holds the site's one island (`src/islands/`). `src/styles/site.css` adds the `@source`
  lines for the chart and card classes it uses.

## Rules for a page

- Render a basalt part with no `client:` directive. A part that needs one belongs in `src/islands/`:
  `client:visible` below the fold, `client:idle` above it when not urgent, `client:load` only for
  the first tap, `client:only="react"` only for a part that measures its box (a chart), with a
  fallback of the same height.
- One `BasaltProvider` per island, never around the page; parts that share state share an island.
- A node passed to a part is a named slot (`<Fragment slot="meta">`), never JSX inside an object
  prop: Astro hands that over as an Astro template and the build fails.
- Keep every URL: the site is linked from npm, GitHub and search results.
- `prefetch` stays off: Starlight would turn it on and put a module script on every page.

## Validate

```bash
bun run build                                  # astro build (needs packages/basalt-ui built first)
bun run typecheck                              # astro check, also part of the root typecheck
bun run measure -- --check [--browser]         # site-budgets.json: zero JS on static pages, island cost, CSS, LCP, CLS
```

`site-budgets.json` records the measured numbers as budgets; raise one only with the reason in the
commit. CI runs the check on every pull request. The image builds `packages/basalt-ui` before the
site (`Dockerfile`), so a workspace change carries its `COPY` edit.

This is a sibling install (`basalt.sibling` in `package.json`): its presets and manifest follow the
shipped rules. `make sync-self` resyncs it with the root copies; CI fails when `basalt-ui sync` would
rewrite a committed file here. The tokens are the stock ones inside `basalt-ui/static.css`.

<!-- basalt:begin 2.29.0 -->

## basalt-ui (managed — do not hand-edit)

Placed by `basalt-ui init`, refreshed by `basalt-ui sync` (`--check` gates drift in CI); edit `DESIGN.md`, not this block.

**Stack** (profile `site`): `tokens` is CSS only; `site` is `basalt-ui/static` parts rendered to static HTML with no client JavaScript, wired by `basalt-ui/astro`, with the lint preset and these rules; `bridge` adds Tailwind 4, `cn`, the lint preset and these rules; `parts` adds `basalt-ui/ui/*` and the page, card, control, table, chart and content composites; `app` adds `basalt-ui/shell` and the router. Colour is a `BASALT.*` token or a series colour, never a literal.

**Precedence** (highest wins): consumer `DESIGN.md` > the five `basalt-v3-*` rules in `.claude/rules/` > the `basalt-v3-*` skills > the shadcn skill > global skills (`frontend-design`, `dataviz`). Each rule bullet ends in the lint id or type that holds it, or sits under `not guarded:`; skills are procedure, not law.

**Before guessing an import**, read `node_modules/basalt-ui/docs/<name>.md` (`basalt-ui doctor` prints where it is installed). Primitives are `node_modules/basalt-ui/src/ui/<name>.tsx`, or `src/components/ui` once ejected. A missing export is a recipe in `docs/recipes/`.

**Which form answers the question** (the shipped surface; compose it, never rebuild it):

| Question                    | Form                                  |
| --------------------------- | ------------------------------------- |
| One number and how it moves | `StatCard`, `StatGroup`               |
| A value over time           | `Lines`, `Sparkline` in a `ChartCard` |
| Compare or rank categories  | `Bars`, `BarList`                     |
| Many records with columns   | `DataTable`                           |
| One record's detail         | `PageAside`, `SplitPage`              |
| Narrow the data             | `FilterSet`, `ViewTabs`               |
| Stages of work              | `KanbanCard`                          |
| Prose, markdown, code       | `Markdown`, `CodeBlock`               |

**Skills and subagent** (installed in `.claude/`; invoke by name):

- `/basalt-v3-design`: build or restyle a screen: question first, then the form, then the marks, then a look at 1800 and 390 wide. Reads `DESIGN.md`; its Direction is never yours to write.
- `/basalt-v3-app`: set up, upgrade or migrate the app (`init`, `doctor`, `sync`).
- `basalt-design-reviewer` (subagent): scores a `basalt-ui shot` out dir per component; run it after every round, never on your own work. Without it, say "reviewer not run".

**Run the local bin** (`./node_modules/.bin/basalt-ui` or a package script), never `bunx`, `init` included: install `basalt-ui` first, then run `init` once from the local bin. In a workspace: the app package's `node_modules/.bin/basalt-ui`. Run the repo gate before reporting done.

**Never `shadcn add` a primitive basalt ships.** Eject it (`basalt-ui eject <name> --reason`) to change it.

**A gap in basalt-ui** (a missing export, a part that cannot express the screen, a rule that refuses a legitimate shape) is filed as a factory Issue in `basalt-ui` with a minimal reproduction (the smallest file, the command and what it printed): `factory issue new --repo basalt-ui`, or `factory signal file --repo basalt-ui` from a factory lead. Never patch it locally: no edit under `node_modules`, no local copy of a part, no waiver standing in for the fix.

**Overrides.** Restraint over "bold aesthetic direction" (`frontend-design`): neutral by default, the single accent spent only when earned. Basalt charts over `dataviz`: compose `CartesianChart` or a shipped kind.

<!-- basalt:end -->
