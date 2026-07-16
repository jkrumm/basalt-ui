<!-- basalt:begin {{BASALT_VERSION}} -->
## basalt-ui (managed — do not hand-edit)

Scaffolded by `bunx basalt init` and refreshed by `bunx basalt sync` (run it after a basalt-ui
upgrade; `basalt sync --check` gates drift in CI). This block is framework-owned — edit `DESIGN.md`
or the `basalt-*` rules instead; manual changes here are overwritten on the next sync.

**Stack:** React 19 + Mantine v9, themed by `basalt-ui` (`BasaltProvider` + `createBasaltTheme`).
Colors come from the three-tier `--vx-*` token system — read `VX.*` / a `defineSeries` token,
never a raw hex/`rgb()`/`hsl()`. Charts are visx via `basalt-ui/charts` (compose the primitives:
`ChartCard`, `ChartLegend`, the `ChartTooltip` family, `AxisLeftNumeric`/`AxisBottomDate`); add a
kind on the third repeat, don't loosen the primitives. `basalt-ui/charts` and `basalt-ui/tokens`
are Mantine-free — never import `@mantine/*` under `**/charts/**`, never import `@visx/*` outside
charts. Toolchain is oxlint + oxfmt (no ESLint/Biome/Prettier) and `basalt check-theme` guards the
palette. Runtime is Bun.

**Before guessing an import, check the installed package's machine docs**:
`node_modules/basalt-ui/llms.txt` (per-subpath import map), `node_modules/basalt-ui/AGENTS.md`, or
run `bunx basalt info --json`.

**DESIGN.md is law.** `./DESIGN.md` (imported below) records this app's palette identity and series
dictionary. Precedence: **DESIGN.md > `basalt-*` rules > skills.** When building or restyling any
UI, that law wins over habit, over library defaults, and over a skill's instinct. The design/charts
workflows are in the `basalt` plugin (`/basalt:design`, `/basalt:charts`) — they defer to DESIGN.md.

@./DESIGN.md

**Restraint override (supersedes `/frontend-design`).** This app is a calm, data-dense,
dark-first professional surface — not a showcase. Ignore `/frontend-design`'s push toward a "BOLD
aesthetic direction", gradient meshes, noise/grain, and dramatic motion. Here: the shipped
three-font system (Nunito Sans body, Hubot Sans condensed headings, JetBrains Mono for every
numeral/micro-label), depth via `shadow-card` (a whisper shadow + 1px ring, never a decorative drop
shadow), neutral zinc-by-default with the single saturated accent spent only when earned (trend /
signal / categorical separation). Restraint **is** the identity.
<!-- basalt:end -->
