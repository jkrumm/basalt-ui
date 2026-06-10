<!-- basalt:begin {{BASALT_VERSION}} -->
## basalt-ui (managed — do not hand-edit)

This block is owned by `basalt sync`. Edit `DESIGN.md` or the `basalt-*` rules instead; manual
changes here are overwritten on the next sync.

**Stack:** React 19 + Mantine v9, themed by `basalt-ui` (`BasaltProvider` + `createBasaltTheme`).
Colors come from the three-tier `--vx-*` token system — read `VX.*` / a `defineSeries` token,
never a raw hex/`rgb()`/`hsl()`. Charts are visx via `basalt-ui/charts` (compose the primitives:
`ChartCard`, `ChartLegend`, the `ChartTooltip` family, `AxisLeftNumeric`/`AxisBottomDate`); add a
kind on the third repeat, don't loosen the primitives. `basalt-ui/charts` and `basalt-ui/tokens`
are Mantine-free — never import `@mantine/*` under `**/charts/**`, never import `@visx/*` outside
charts. Toolchain is oxlint + oxfmt (no ESLint/Biome/Prettier) and `basalt check-theme` guards the
palette. Runtime is Bun.

**DESIGN.md is law.** `./DESIGN.md` (thin) extends basalt-ui's `DESIGN-CORE.md`. Precedence:
DESIGN.md deltas > DESIGN-CORE > `basalt-*` rules > skills. When building or restyling any UI,
that law wins over habit, over library defaults, and over a skill's instinct. Use `/basalt:design`
and `/basalt:charts` here — they defer to DESIGN.md.

**Restraint override (supersedes `/frontend-design`).** This app is a calm, data-dense,
dark-first professional surface — not a showcase. Ignore `/frontend-design`'s push toward a "BOLD
aesthetic direction", distinctive display fonts, gradient meshes, noise/grain, decorative
shadows, and dramatic motion. Here: system-sans by size+weight, mono numbers, hairline elevation
(no drop shadows), neutral-by-default with color spent only when earned (trend / signal /
categorical separation). Restraint **is** the identity.
<!-- basalt:end -->
