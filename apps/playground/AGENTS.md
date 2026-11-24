<!-- basalt:begin 2.29.0 -->

## basalt-ui (managed — do not hand-edit)

Placed by `basalt-ui init`, refreshed by `basalt-ui sync` (`--check` gates drift in CI); edit `DESIGN.md`, not this block.

**Stack** (profile `app`): `tokens` is CSS only; `site` is `basalt-ui/static` parts rendered to static HTML with no client JavaScript, wired by `basalt-ui/astro`, with the lint preset and these rules; `bridge` adds Tailwind 4, `cn`, the lint preset and these rules; `parts` adds `basalt-ui/ui/*` and the page, card, control, table, chart and content composites; `app` adds `basalt-ui/shell` and the router. Color is a `BASALT.*` token or a series color, never a literal.

**Precedence** (highest wins): consumer `DESIGN.md` > the five `basalt-v3-playground-*` rules in `.claude/rules/` > the `basalt-v3-playground-*` skills > the shadcn skill > global skills (`frontend-design`, `dataviz`). Each rule bullet ends in the lint id or type that holds it, or sits under `not guarded:`; skills are procedure, not law.

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
| Stages of work              | `Board` of `KanbanCard`s              |
| Prose, markdown, code       | `Markdown`, `CodeBlock`               |
| A record opened from a list | `Peek`, `Dock`, `PageAside`           |
| A record created in steps   | `WizardDialog`                        |
| Dated events over a period  | `Schedule`, `Calendar`                |
| Mail beside a reader        | `MailList`, `MailThread`              |
| A workflow of stages        | `FlowCanvas`                          |

Every other part is one line in `.claude/skills/basalt-v3-playground-design/references/parts.md`, grouped by the question it answers.

**Skills and subagent** (installed in `.claude/`; invoke by name):

- `/basalt-v3-playground-design`: build or restyle a screen: question first, then the form, then the marks, then a look at 1800 and 390 wide. Reads `DESIGN.md`; its Direction is never yours to write.
- `/basalt-v3-playground-charts`: any chart, sparkline, heat grid or data mark, and a list that follows a chart's focus; load it together with `/basalt-v3-playground-design`.
- `/basalt-v3-playground-app`: set up, upgrade or migrate the app (`init`, `doctor`, `sync`), wire the shell, the router or a live query.
- `basalt-design-reviewer` (subagent): scores a `basalt-ui shot` out dir per component; run it after every round, never on your own work. Without it, say "reviewer not run".

**Run the local bin** (`./node_modules/.bin/basalt-ui` or a package script), never `bunx`, `init` included: install `basalt-ui` first, then run `init` once from the local bin. In a workspace: the app package's `node_modules/.bin/basalt-ui`. Run the repo gate before reporting done.

**Agents other than Claude Code.** The skills, the reviewer subagent and the edit hook run in Claude Code only. Any other agent reads `.claude/rules/*.md` as plain markdown, opens the `SKILL.md` a task needs by hand, and runs `basalt-ui lint --changed` before reporting done, since no hook lints its edits.

**Never `shadcn add` a primitive basalt ships.** Eject it (`basalt-ui eject <name> --reason`) to change it.

**A gap in basalt-ui** (a missing export, a part that cannot express the screen, a rule that refuses a legitimate shape) is filed in the package's issue tracker (`bugs.url` in `node_modules/basalt-ui/package.json`) with a minimal reproduction (the smallest file, the command and what it printed). Never patch it locally: no edit under `node_modules`, no local copy of a part, no waiver standing in for the fix.

**Overrides.** Restraint over "bold aesthetic direction" (`frontend-design`): neutral by default, the single accent spent only when earned. Basalt charts over `dataviz`: compose `CartesianChart` or a shipped kind.

<!-- basalt:end -->
