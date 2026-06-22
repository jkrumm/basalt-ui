---
name: basalt-design
description: Design and restyle data visualizations and analytics UIs in a basalt-ui app (Mantine v9 + visx). The dataviz successor — restraint doctrine plus the live theme-lab tuning loop and the centralized, lint-enforced --vx-* token system. Use when building or restyling charts/dashboards, choosing a palette, tuning dark/light, or when charts look childish / inconsistent / over-colored.
when_to_use: User is building or restyling charts, dashboards, or metric UIs in a basalt-ui consumer; picking or tuning a palette; deciding on dark/light shades; or complaining that charts look "AI default", inconsistent across tabs, or over-saturated. Also the entry point for any "make this look professional" dataviz request in a Mantine + visx app.
---

`/basalt:design` is the design authority for a basalt-ui app. It is the **method**; the project's
doctrine is the **law**. Professional dataviz is restraint, not decoration — this skill encodes
that restraint and the concrete, lint-enforced way basalt-ui makes it impossible to bypass.

## Read the law first (strict precedence)

Before applying any generic guidance, load the doctrine in this exact order and obey the highest
one that exists. Lower layers fill gaps; they never override a higher layer.

1. **Consumer `DESIGN.md`** (repo root) — the thin, app-specific instantiation. Identity
   confirmation, the series dictionary, app deviations. **This wins on every conflict.** It is the
   Google-spec convention (YAML token front matter + Markdown prose, sibling to `CLAUDE.md`).
2. **Shipped `basalt-*` rules** (`.claude/rules/basalt-{tokens,charts,mantine,state}.md`) — the
   universal law AND its enforcement: the Basalt warm-neutral palette + single muted slate accent,
   one-hue-per-metric, neutral structure, gradient defaults, the three-tier token contract, the
   elevation/density doctrine.
3. **This skill** — only the loop and the judgment, where the above are silent.

If a consumer `DESIGN.md` does not exist yet, the app has not been scaffolded — run `/basalt:app`
(it wraps `basalt init`, which writes the thin `DESIGN.md` and the `basalt-*` rules). Do not invent
a palette ad hoc.

## Restraint doctrine (decide before touching code)

This is the same restraint `frontend-design` calls for, applied to data: intentionality over
intensity. The `basalt init` CLAUDE block sets a restraint override for exactly this reason — in a
dashboard the bold move is calm.

- **One muted hue family, reused everywhere.** The Basalt warm-neutral identity (below), never raw
  Material / AntD / Tailwind primaries (they read childish and clash). A small harmonious subset
  across every page so tabs feel like one app.
- **Single hue per metric.** Each metric owns ONE color, stable across all views (HRV always
  violet, bench always amber). Series colors are app-side and distinct from the UI accent — don't
  reuse the slate accent as a metric hue. Multiple colors only for genuinely categorical data
  (sleep stages, source breakdown). A line chart almost never needs more than one hue plus neutrals.
- **Neutral structure, colored signal.** Lines/axes/grids in muted neutrals; color is the data and
  status (good/warn/bad). A single neutral line with a soft tinted area reads more premium than a
  rainbow.
- **Gradients on areas, not everything.** A soft single-hue vertical gradient under a line is the
  canonical "modern" move (`AreaGradient`). Keep stacked-area bands opaque — transparency leaks
  lower bands.
- **Quiet chrome.** Hairline grids (~6–8% neutral), thin crosshairs, restrained tooltips with a
  card surface and one accent swatch per row. Generous whitespace.

## Color identity & accent restraint (the #1 lever)

The Basalt identity is **warm-neutral volcanic charcoal + a single muted slate accent** — not a
cool/blue/steel "Blueprint" identity (that framing is obsolete). Restraint on the accent is the
single biggest difference between premium and AI-default.

**Neutrals carry the surface (~90/10, not 60/30/10).** Warm-neutral means **only a whisper of
warmth** (blue channel ≤ red, last-digit) — **not** a creamy/yellow cast. Dark is warm charcoal;
light is a clean near-neutral off-white:

- **Dark:** bg `#191917`, panel `#1f1f1d`, elevated `#262624`, subtle `#262624` (hover/striped,
  above panel), hairline `#33322f`. Warm charcoal, never blue-tinted, never pure black. Small warm
  elevation steps for depth.
- **Light:** page `#fafafa` (near-neutral off-white, no yellow), cards `#ffffff` lifting above it,
  subtle `#f2f2f1` (hover/striped, a step below white), soft low-contrast hairline `#ededec`.
  Near-black text `#121110` — never pure `#000` on pure `#fff`.

The surface token set is `bg` (page) · `panel` (card) · `elevated` (lifted) · `subtle`
(hover/striped/track) · `border` (hairline). `--vx-surface-subtle` backs Table hover/striped, `Code`,
the `SegmentedControl` track, and Tabs/Accordion/Menu hover.

**One accent, muted slate-blue** (~50% saturation, Notion/Linear-calm — NOT a saturated Bootstrap
blue): family `['#324a66','#3c5b7e','#4f78a4','#7099c4','#a5c1dd']`.

The accent appears **only** on: the single primary CTA per view, focus rings, links, small status
pops. It appears **never** on: active nav, borders, large fills, every icon, secondary buttons.
"Ink earns its color" — neutral does the structure, the accent only points.

- **Active nav = neutral surface fill + plain text + a weight bump, never the accent.** The theme
  bakes this into `NavLink` for every render path — don't re-color it.
- **Buttons:** exactly one filled-accent primary CTA per view; every other action is
  `variant="default"` (neutral). Avoid colored `variant="light"` for routine actions — washed-out,
  especially on the warm light canvas.
- **Status:** positive deltas `color="green"` (forest), never `teal`/turquoise/saturated emerald.
- **Dark done right:** warm charcoal, not blue-tinted, not pure black; keep the accent muted so it
  doesn't glow/bleed.
- **Light done right:** near-neutral off-white page (`#fafafa`, no yellow) + white cards that lift;
  soft low-contrast hairline (`#ededec`); shadows only for genuinely floating elements.

### Density & surface consistency

- **Dense by default** (Linear/Notion): compact nav rows, `sm` (12px) gaps and card padding, a
  48px shell header. Separate by surface + hairline, not by large air — default to the tighter step.
- **All cards render identically:** Mantine `Card`/`Paper` **and** the Mantine-free `ChartCard`
  resolve to **one border token** + **one radius token** (`--vx-radius-card` = `radius.md` = 8px),
  **flat** (no drop shadow — depth is the 1px hairline). Never inline-override a surface's
  `border`/`borderRadius`/`boxShadow`/`backgroundColor` — use `withBorder` + the radius token +
  `VX.surface.*`. Mechanically enforced by `basalt check-theme`'s `raw-surface` guard.
- **Strict surfaces & primitives.** The theme runs a strict surface system: Mantine components read
  raw ramp steps directly, so `cssVariablesResolver` **collapses the ramp steps onto the
  `--vx-surface-*` tokens** — one border, one card bg, one radius across every component (AppShell,
  Table, Input, Divider, Tabs, Popover, Accordion, cards). Consumer code must **use Mantine layout
  primitives** (`Box`/`Flex`/`Grid`/`SimpleGrid`/`Stack`/`Group`/`Paper`/`Card`), not raw
  `<div>`/`<span>` with inline `style`. `check-theme` adds four guard kinds to enforce this
  (default ON, `theme-allow` escape): `off-system-surface-var` (raw ramp-step vars),
  `raw-html-layout`, `inline-spacing`, `inline-display`. Only the Mantine-free `src/charts/**` may
  use raw `<div>` (still with `VX.*` tokens).

**Anti-slop checklist:** no pure `#000`/`#fff`; one accent locked page-wide; neutral does the
structure, accent only points; don't flood blue; hierarchy via scale/weight/contrast/space, not
color; depth = surface + hairline, not drop-shadow.

## The three-tier token system (centralize + enforce)

Aesthetics only survive if they cannot be bypassed. basalt-ui ships this as the `./tokens` and
`./charts` surfaces:

1. **Palette data** — the Basalt warm-neutral ramps + the single muted slate accent family, plus
   every semantic/status/neutral/surface entry as a per-theme `{ light, dark }` pair. Pure data: no
   React, no `@mantine/*`, no browser API.
2. **CSS variables** — `buildPaletteCss(opts)` emits the pairs as `--vx-*` custom properties under
   the light/dark color-scheme selector. Theme resolution is **pure CSS** — no JS branching, works
   in non-component files.
3. **Token refs** — `VX.*` are just `var(--vx-*)` strings (colors) plus non-color sizing constants.
   Opacity via `alpha(token, a)` (= `color-mix`), **never** `rgba()` — the hue must keep resolving
   per scheme.

Hard rules (the guard enforces these, not just prose):

- **Never a raw hex / `rgb()` / `hsl()` in chart or app source.** Route every color through
  `VX.*` / the palette. `basalt check-theme` fails the build on a literal; a `theme-allow` comment
  is the only deliberate exception.
- **Never `localStorage.getItem('theme')`.** The scheme resolves via Mantine's color scheme + the
  `--vx-*` vars. The guard bans this read.
- New colors go into the palette as `{ light, dark }` pairs — never inline, never two
  `fooLight`/`fooDark` keys.

```ts
import { VX, alpha } from 'basalt-ui/tokens'

const stroke = VX.series.hrv          // app-side series ref (consumer-defined — see /basalt:charts)
const fill = alpha(VX.series.hrv, 0.12) // theme-aware soft area, NOT rgba()
const grid = VX.grid                   // framework neutral
```

## Drive the theme-lab loop (tune by eye, then bake)

Static HTML POCs do not translate 1:1 to visx/Mantine. Tune in the **real app** with the shipped
theme lab (`basalt-ui/theme-lab`), then bake the values into the palette. The lab writes overrides
as inline `--vx-*` styles on `<html>`, which beat the stylesheet's per-scheme rules — so everything
restyles **instantly with no React re-render**.

Wire it (DEV-only) inside a dev dock popover:

```tsx
import { ThemeLabControls, applyOverrides, loadOverrides } from 'basalt-ui/theme-lab'

// At boot — re-apply a persisted tuning session (the control body does NOT do the initial apply):
applyOverrides(loadOverrides())

// In the dev dock — pass the consumer's own series groups so they're tunable too:
<ThemeLabControls
  groups={[
    ...COLOR_GROUPS,                       // framework: Semantic / Status / Neutral / Surface
    { title: 'Health', items: [{ var: '--vx-hrv', label: 'HRV' }, /* ... */] },
  ]}
  onCopy={(json) => notifications.show({ message: 'Overrides copied' })}
  copyIcon={<IconCopy size={16} />}        // framework ships no icon/notification dep
  resetIcon={<IconRefresh size={16} />}
/>
```

The loop:

1. Open the lab, adjust `--vx-*` colors and the area-gradient strength (`--vx-area-top` /
   `--vx-area-bottom`) by eye, in both schemes.
2. Toggle the Mantine color scheme and re-check: saturated mid-tones **glow/bleed on dark** — step
   one shade lighter and slightly desaturated; on light go one shade deeper for contrast. Same hue,
   different shade — **never the same hex in both**.
3. **Copy JSON** → hand the values back into the palette data as `{ light, dark }` pairs.
4. Remove the override (or "Reset to palette defaults") and confirm the baked palette matches.

The lab is a tuning sandbox, not a prod theme editor: inline overrides apply to whatever scheme is
on screen and win over both light and dark rules. It is the closing step of design, not a shipped
feature.

## Primitives + kind discipline (don't loosen, extend)

Every chart composes the shipped primitives — never hand-rolled equivalents:

- **`ChartCard`** wrapper (title + info-tooltip + extra slot, consistent margin).
- **`ChartLegend`** (`line | bar | split | splitLine` shapes) — never hand-rolled legend markup.
- **`ChartTooltip`** + `TooltipHeader` / `TooltipRow` / `TooltipBody` — never import `@visx/tooltip`
  directly (oxlint bans it in chart files).
- **`AxisBottomDate`** / **`AxisLeftNumeric`** / **`AxisRightNumeric`** — never raw
  `<AxisLeft>`/`<AxisBottom>` (they miss theme tokens + smart ticks). Now lint-enforced:
  `basalt check-theme`'s `raw-visx-axis` guard fails the build on a raw axis inside a `/charts/`
  file (escape via `theme-allow`).
- **`HoverOverlay`** + `HoverContext` + `useChartTooltip` for hover/crosshair. Wrap a group of
  date-aligned charts in **`ChartHoverSync`** to cast a ghost crosshair across all siblings on hover
  (without it, `useHoverSync` runs per-chart only and warns in dev).
- **`AreaGradient`** / `areaFillUrl` for the soft single-hue fill.

Shipped kinds beyond `ZonedLine` / `Bars` / `StackedArea` / `Donut`: **`MultiLine`** (N series on a
shared y-axis, legend-hover dimming, dashed MA companions, per-point markers, zones/refLines, fixed
or auto domain — also z-score/σ via a symmetric domain + zero refLine), **`DualPanel`** (line pane
+ signed-histogram pane on one x-scale and cursor, optional fill-between), **`Heatmap`**
(category×category intensity grid with per-cell tooltip + optional gradient legend strip).

> If the new chart does not fit the primitives, **add a kind — don't loosen the primitives.**
> Recurring shape → extract a kind via the Rule of Three. Genuinely unique → stay bespoke,
> composing primitives directly. New color → a `{ light, dark }` pair in the palette, wired through
> `--vx-*`, exposed as a `VX.*` ref — never an inline hex. The mechanics of all three live in
> **`/basalt:charts`** — defer to it for the "how".

The Mantine-free boundary holds here too: `./charts` and `./tokens` import zero `@mantine/*`, and
`@visx/*` is only allowed under chart files. Both are oxlint-enforced in the shipped consumer
preset.

## Checklist before declaring a chart "done"

- Every color comes from a token (`VX.*` / palette) — `basalt check-theme` green, zero raw hex.
- One hue per metric; categorical multi-color only where the data is genuinely categorical.
- Neutral line/axis/grid; soft `AreaGradient` on plain metric lines, opaque stacked-area bands.
- Tooltip = `ChartCard` / `ChartTooltip` primitives, one swatch per row — no hand-rolled markup.
- Looks right in BOTH schemes (toggled and checked: glow on dark, contrast on light).
- New colors landed as `{ light, dark }` pairs in the palette, not inline.
- Nothing reads `localStorage.getItem('theme')`.
