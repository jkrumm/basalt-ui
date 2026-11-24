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

## The playground

This app is the repo's own `init --profile app` install and the page set the owner judges v3 by, so
a page here is a page a consumer could build from the shipped skills. Place a new page by what it is
for:

| Kind         | Where                                                                                                                                                                                                                       | What holds it                                                                                                                                                                                 |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tour         | the nav's `tour` section (`src/demo/nav-model.tsx`), the landing `src/routes/index.tsx`, one line per stop in `src/demo/tour.ts`                                                                                            | shipped parts only, no lint waiver, no `c.custom` column; a matrix waiver only for a package defect that owns it; the whole nav stays at 40 entries or fewer (`src/demo/kit-routes.test.tsx`) |
| Reference    | `src/routes/ref/`, rendered from `packages/basalt-ui/blocks/`                                                                                                                                                               | one archetype each, on the inventory domain                                                                                                                                                   |
| Kit          | `src/routes/kit/` (one capability per page), `src/routes/recipes/`                                                                                                                                                          | recipe regions under `src/recipes/` compile into the package docs (`packages/basalt-ui/scripts/gen-recipes.ts`); keep a `#region recipe:<name>` when you edit one                             |
| Test fixture | `/cards` (print test, matrix smoke), `/settings` (consumers.json), `/peek/$id`, `/scenarios/$name` (`mdx` stays first in `src/scenarios/scenario-info.ts`), `src/routes/cycle/` with `src/cycle/` (the latest cycle builds) | no nav entry; delete one only together with the test or record that names it                                                                                                                  |

A new trial build goes to `apps/expression` (the scenarios) or a new folder under `src/cycle/`; a
page to copy goes to `ref/` or `kit/` and, if it is the best page of its kind, replaces the tour
stop. A superseded cycle build is deleted, not kept beside its successor.

Before deleting or renaming a route, look up who names it, since each of these fails on a dangling name:

- matrix waivers: `packages/basalt-ui/tests/quality/matrix/known.ts` and a cycle's own
  `src/cycle/<name>/known.ts`; in the full run a waiver that matches nothing fails, so it goes with
  its route;
- the hover guard's `TRIAL_PAGES` and `REBUILT_PAGES` (`tests/quality/matrix/hover-shift.ts`) and
  the page-top bands (`tests/layout/page-top.layout.test.ts`), both in `packages/basalt-ui`;
- a public symbol's named consumer in `packages/basalt-ui/scripts/consumers.json`;
- the route budgets, `src/budget.test.ts` and `packages/basalt-ui/scripts/check-budgets/areas/playground.ts`,
  which leave out `routes/{cycle,kit,recipes,ref}`.

Stylesheets and the graph `basalt()` reads come from `packages/basalt-ui/dist`: run `bun run build`
there before a build or a shot of this app after a package change. `basalt-ui sync` refreshes the
managed block above and `.basalt/`.
