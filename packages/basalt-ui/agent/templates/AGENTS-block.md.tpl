<!-- basalt:begin {{BASALT_VERSION}} -->

## basalt-ui (managed — do not hand-edit)

Placed by `basalt-ui init`, refreshed by `basalt-ui sync` (`--check` gates drift in CI); edit `DESIGN.md`, not this block.

**Stack** (profile `{{PROFILE}}`): `tokens` is CSS only; `bridge` adds Tailwind 4, `cn`, the lint preset and these rules; `parts` adds `basalt-ui/ui/*` and the page, card, control, table, chart and content composites; `app` adds `basalt-ui/shell` and the router. Colour is a `VX.*` token or a series colour, never a literal.

**Precedence** (highest wins): consumer `DESIGN.md` > the five `basalt-*` rules in `.claude/rules/` > the `basalt-*` skills > the shadcn skill > global skills (`frontend-design`, `dataviz`). Each rule bullet ends in the lint id or type that holds it, or sits under `not guarded:`; skills are procedure, not law.

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

- `/basalt-design`: build or restyle a screen: question first, then the form, then the marks, then a look at 1800 and 390 wide. Reads `DESIGN.md`; its Direction is never yours to write.
- `/basalt-app`: set up, upgrade or migrate the app (`init`, `doctor`, `sync`).
- `basalt-design-reviewer` (subagent): scores a `basalt-ui shot` out dir per component; run it after every round, never on your own work. Without it, say "reviewer not run".

**Run the local bin** (`./node_modules/.bin/basalt-ui` or a package script), never `bunx`; `init` is the one exception. In a workspace: the app package's `node_modules/.bin/basalt-ui`. Run the repo gate before reporting done.

**Never `shadcn add` a primitive basalt ships.** Eject it (`basalt-ui eject <name> --reason`) to change it.

**Overrides.** Restraint over "bold aesthetic direction" (`frontend-design`): neutral by default, the single accent spent only when earned. Basalt charts over `dataviz`: compose `CartesianChart` or a shipped kind.

<!-- basalt:end -->
