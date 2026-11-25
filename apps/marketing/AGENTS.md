# apps/marketing — basalt-ui.com

basalt's own site, and the proof of the `site` profile: Astro 7 pages built from `basalt-ui/static`
parts, rendered to HTML with no client JavaScript. FPP and the owner's other content sites copy what
works here, so a shortcut taken on this site becomes theirs. Root `AGENTS.md` holds the repo rules
(Bun, oxlint, oxfmt, commits); this file adds what only this app needs.

## How it is wired

The Astro integration, the layout, the Starlight overrides, the guides and the landing blocks are wired in
`src/AGENTS.md` (section How it is wired): read it before changing `astro.config.mjs`, a layout or a guide.

## Rules for a page

Before changing a page, component, island, layout or guide under `src/`, Read `src/AGENTS.md`: client directives, provider scope, slots and the prefetch rule.

## Validate

```bash
bun run build                                  # astro build (needs packages/basalt-ui built first)
bun run typecheck                              # astro check, also part of the root typecheck
bun run measure -- --check [--browser]         # site-budgets.json: zero JS on static pages, island cost, CSS, LCP, CLS
bun scripts/docs-palette.ts                    # every Starlight / Expressive Code color variable in dist resolves to --basalt-*
```

`site-budgets.json` records the measured numbers as budgets; raise one only with the reason in the
commit. CI runs the check on every pull request. The image builds `packages/basalt-ui` before the
site (`Dockerfile`), so a workspace change carries its `COPY` edit.

This is a sibling install (`basalt.sibling` in `package.json`): its presets and manifest follow the
shipped rules. `make sync-self` resyncs it with the shipped sources the root links point to; CI fails when `basalt-ui sync` would
rewrite a committed file here. The tokens are the stock ones inside `basalt-ui/static.css`.

<!-- basalt:begin 2.29.0 -->

## basalt-ui (managed — do not hand-edit)

Placed by `basalt-ui init`, refreshed by `basalt-ui sync` (`--check` gates drift in CI); edit `DESIGN.md`, not this block.

**Stack** (profile `site`): a content site on Astro. `basalt-ui/static` parts render to HTML with no client JavaScript, wired by `basaltAstro()` from `basalt-ui/astro`; a part that needs JavaScript runs in an island the site writes. Color is a `--basalt-*` token, never a literal.

**Precedence** (highest wins): consumer `DESIGN.md` > the two `basalt-v3-*` rules in `.claude/rules/` > the `basalt-v3-site` skill > global skills (`frontend-design`). Each rule bullet ends in the lint id, type or build check that holds it, or sits under `not guarded:`; the skill is procedure, not law.

**Before guessing an import**, read `node_modules/basalt-ui/docs/astro.md`, then `node_modules/basalt-ui/docs/<name>.md` (`basalt-ui doctor` prints where it is installed).

**Skill** (installed in `.claude/skills/`; invoke by name):

- `/basalt-v3-site`: set up the site, pick a page type (landing, guide or article, docs), add an island, verify a static page ships no script.

**Run the local bin** (`./node_modules/.bin/basalt-ui` or a package script), never `bunx`, `init` included: install `basalt-ui` first, then run `init` once from the local bin. In a workspace: the app package's `node_modules/.bin/basalt-ui`. Run the repo gate before reporting done.

**Agents other than Claude Code.** The skill and the edit hook run in Claude Code only. Any other agent reads `.claude/rules/*.md` as plain markdown, opens the `SKILL.md` by hand, and runs `basalt-ui lint --changed` before reporting done, since no hook lints its edits.

**A gap in basalt-ui** (a missing export, a part that cannot express the screen, a rule that refuses a legitimate shape) is filed in the package's issue tracker (`bugs.url` in `node_modules/basalt-ui/package.json`) with a minimal reproduction (the smallest file, the command and what it printed). Never patch it locally: no edit under `node_modules`, no local copy of a part, no waiver standing in for the fix.

**Overrides.** Restraint over "bold aesthetic direction" (`frontend-design`): neutral by default, the single accent spent only when earned.

<!-- basalt:end -->
