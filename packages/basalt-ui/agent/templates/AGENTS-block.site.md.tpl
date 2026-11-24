<!-- basalt:begin {{BASALT_VERSION}} -->

## basalt-ui (managed — do not hand-edit)

Placed by `basalt-ui init`, refreshed by `basalt-ui sync` (`--check` gates drift in CI); edit `DESIGN.md`, not this block.

**Stack** (profile `site`): a content site on Astro. `basalt-ui/static` parts render to HTML with no client JavaScript, wired by `basaltAstro()` from `basalt-ui/astro`; a part that needs JavaScript runs in an island the site writes. Color is a `--basalt-*` token, never a literal.

**Precedence** (highest wins): consumer `DESIGN.md` > the two `basalt-*` rules in `.claude/rules/` > the `basalt-site` skill > global skills (`frontend-design`). Each rule bullet ends in the lint id, type or build check that holds it, or sits under `not guarded:`; the skill is procedure, not law.

**Before guessing an import**, read `node_modules/basalt-ui/docs/astro.md`, then `node_modules/basalt-ui/docs/<name>.md` (`basalt-ui doctor` prints where it is installed).

**Skill** (installed in `.claude/skills/`; invoke by name):

- `/basalt-site`: set up the site, pick a page type (landing, guide or article, docs), add an island, verify a static page ships no script.

**Run the local bin** (`./node_modules/.bin/basalt-ui` or a package script), never `bunx`, `init` included: install `basalt-ui` first, then run `init` once from the local bin. In a workspace: the app package's `node_modules/.bin/basalt-ui`. Run the repo gate before reporting done.

**Agents other than Claude Code.** The skill and the edit hook run in Claude Code only. Any other agent reads `.claude/rules/*.md` as plain markdown, opens the `SKILL.md` by hand, and runs `basalt-ui lint --changed` before reporting done, since no hook lints its edits.

**A gap in basalt-ui** (a missing export, a part that cannot express the screen, a rule that refuses a legitimate shape) is filed in the package's issue tracker (`bugs.url` in `node_modules/basalt-ui/package.json`) with a minimal reproduction (the smallest file, the command and what it printed). Never patch it locally: no edit under `node_modules`, no local copy of a part, no waiver standing in for the fix.

**Overrides.** Restraint over "bold aesthetic direction" (`frontend-design`): neutral by default, the single accent spent only when earned.

<!-- basalt:end -->
