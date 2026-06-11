# Basalt Design Core — The Design Source (internal)

This is basalt-ui's **internal design rationale** — the universal law in full, with the influences
and reasoning behind it. It governs the chart system, the token architecture, and the
colour/elevation discipline that make a basalt app read as a calm, professional terminal.

**It is NOT shipped to consumers.** The consumer-facing, enforceable subset is distilled into the
shipped `basalt-*` agent rules (which `basalt init` writes into each repo) and the `/basalt:design`
skill. This file is the source those are kept in sync with — a developer reference for building
basalt-ui, not a file an agent loads in a consumer.

It is deliberately **identity-agnostic**. It declares the _rules_ — what earns a colour, how tokens
flow, how depth is built, what every chart composes — not the concrete hues. A consumer's own
`DESIGN.md` instantiates the palette (the brand voltage, the per-series data dictionary) on top of
the shipped rules.

## Precedence

In a **consumer repo** (where this file does not exist) the law resolves highest-wins:

```
consumer DESIGN.md deltas  >  shipped basalt-* rules  >  skills / habit
```

A consumer `DESIGN.md` may **override** any instantiation choice (its palette, its accent families,
its per-metric assignments) — but it **extends**, never contradicts, the rules. **This file** is the
source those rules are distilled from: when it and a shipped rule disagree, fix the rule to match
(or update both deliberately).

> **This file governs the system, not the data.** It declares the rules, the tiers, and the
> contract. The **per-metric colour assignments** — which series gets which hue — are a data
> dictionary that lives only in the consumer's palette source (the executable `{light,dark}` source
> of truth), never here.

## Five principles (priority order)

These are settled doctrine, drawn from studied systems and stated to be promotable as-is.

1. **Ink earns its colour.** Colour is a _signal_, never decoration. A mark is coloured only for a
   **trend** (up/down), a **signal/status** (good/warn/bad), or **categorical separation**
   (genuinely distinct series in one frame). Everything else is neutral. — IBM Carbon: _"every
   colour should have a reason"_; Datawrapper: _"grey is the most important colour in data
   visualization."_
2. **Neutral by default.** A single value, a single-series sparkline, one stat tile → neutral
   (`VX.line`: grey on light, near-white on dark). The label says what it is; the colour says
   nothing, on purpose.
3. **One identity, reused everywhere.** A small, harmonious accent palette from one designed source,
   reused across every page. Accents are spent sparingly. Never raw Material/AntD/Tailwind
   primaries.
4. **Tokens only — no raw values.** Every colour comes from a token. No `hex`/`rgb()`/`hsl()` in
   component or chart source; opacity via `alpha(token, a)`, never `rgba()`. Enforced, not requested.
5. **Theme is data, not branching.** Light/dark differ by _shade_, not code path. Each token is a
   `{light,dark}` pair resolved in pure CSS off the colour-scheme selector. Never branch on scheme
   in JS; never read `localStorage.getItem('theme')`.

### Influences

The system is a combination of three studied design systems — the best of each:

- **IBM Carbon** → _discipline_: one scarce accent, a defined spacing/type scale, hairline-not-shadow
  elevation, "every colour has a reason." The restraint backbone.
- **Linear** → _dark-first craft_: a deep surface ramp (`canvas → surface-1/2` + layered hairlines)
  with light as the flip, and tight radii that read precise/technical.
- **Coinbase** → _signal-only colour_: up/down deltas as text colour (never a fill) and numbers in
  mono — "ink earns its colour" applied to a finance dashboard.

## Token architecture (three tiers)

Three tiers, matching the W3C Design Tokens model. The structure is the law; basalt's `--vx-*`
prefix is the framework instantiation.

| Tier          | What                 | Where (basalt)                                  | Example                            |
| ------------- | -------------------- | ----------------------------------------------- | ---------------------------------- |
| **Primitive** | Raw designed hues    | palette data (`BP`, `p()`)                      | a designed hue stop                |
| **Semantic**  | Intent-bearing pairs | `STATUS`/`SEMANTIC`/`NEUTRAL`/`SURFACE` → `--vx-*` → `VX.*` | `VX.status.good`, `VX.line`, `VX.surface.panel` |
| **Component** | Element-specific     | Mantine theme + chart primitives                | `ChartCard`, Mantine `color="blue"` |

**Flow** — three layers, strictly separated:

```
palette data        pure {light,dark} pairs — no React, no @mantine/*, no browser API
      │
      ▼  buildPaletteCss()
--vx-* CSS vars     emitted under each colour-scheme selector — resolution is pure CSS
      │
      ▼
VX.* token refs     thin var(--vx-*) strings (colours) + non-colour sizing constants
```

Because the tokens are CSS variables, `VX.*` works identically in components **and** non-component
files (constants, formulas) — no hook required. The UI-chrome theme (Mantine) is reskinned from the
**same** palette data via a `cssVariablesResolver` that binds Mantine's surface/border/dimmed
variables to the same `--vx-*` the charts use, so chrome and charts share one scheme-reactive
identity. See `MANTINE-THEMING.md` for that wiring.

## When a hue is earned

Spend a colour only for one of these. Otherwise the mark is neutral (`VX.line`).

| Reason                     | Example                                            | Treatment                                              |
| -------------------------- | -------------------------------------------------- | ------------------------------------------------------ |
| **Trend**                  | Hero-card up/down, momentum arrow                  | trend-up / trend-down (direction, not metric), as text |
| **Signal / status**        | Zone bands, thresholds, good/warn/bad              | `VX.status.*` / semantic fills                         |
| **Categorical separation** | Stages, intensity ramp, multi-toggle (2+ series)   | per-series accent (from the consumer's series map)     |
| _none of the above_        | Single sparkline, one stat tile, single-metric bar | **neutral** `VX.line`                                  |

Worked rule: a multi-toggle bar chart colours bars `isMulti ? series.x : VX.line` — neutral when one
metric is selected, distinct colours only when 2+ are compared. Copy it.

## Light / dark, opacity, and reactivity

- **Same hue, different shade** — never the same hex in both. On dark, step **one shade lighter**
  (less glow); on light, **one shade deeper** (contrast). Encoded as the `{light,dark}` pair in the
  palette data.
- **Opacity is always `alpha(token, a)`** = `color-mix(in srgb, token a%, transparent)` — never
  `rgba()`. `rgba()` freezes a literal colour and breaks per-scheme resolution.
- **Reactivity is pure CSS.** The `--vx-*` variables are redeclared under the light/dark selector,
  so toggling the colour scheme restyles every chart and surface with **no React re-render**. Read
  `VX.*` (var refs) directly. Never branch on colour scheme in JS; never read `localStorage` theme.

## Layout, elevation, shapes

- **Density is the point.** This is a terminal, not a marketing page — sections separate by surface
  change and hairlines, not by large air. Card interior padding defaults to the `md` spacing step.
- **Depth = surface + hairline, never drop shadows** (Linear/Carbon discipline). Elevation tiers:

  | Level        | Treatment                                  | Use                                |
  | ------------ | ------------------------------------------ | ---------------------------------- |
  | 0 (flat)     | No border, no shadow                       | Body text, page background         |
  | 1 (surface)  | `surface-1` on `canvas`                     | Cards, panels                      |
  | 2 (elevated) | `surface-2` + 1px hairline                  | Chart area, tooltips, lifted cards |
  | 3 (focus)    | 2px primary outline                         | Focused input / control            |

  `Card`/`Paper` default to `withBorder` and no shadow. `VX.shadowCard` is the one soft card shadow
  (`none` on dark) — use it deliberately, not as a default.
- **Tight radii.** Small radii read precise/technical (Linear), not soft/consumer: default `sm` for
  controls, cards at `md`, pills/badges at `pill`. Owned in the theme, not inherited.
- **Type carried by size + weight.** System-sans, no display/body family split. Numbers render in a
  mono, tabular stack (a Coinbase pattern that keeps metric columns aligned).

## Data visualization — the visx primitives contract

The signature surface. The discipline is structural: a small set of primitives, always composed; a
kind-registry for recurring shapes; never loosen the primitives to fit a one-off.

### The primitive contract (every non-sparkline chart composes ALL of these)

1. **ChartCard** — the wrapper; never a raw `<Card>`. Gives title + info-tooltip + extra slot,
   consistent margin.
2. **ChartLegend** — never hand-rolled legend markup. Supports `line | bar | split | splitLine`
   shapes and optional highlight state.
3. **ChartTooltip** + `TooltipHeader` + `TooltipRow` + `TooltipBody` — never import `@visx/tooltip`
   directly.
4. **AxisLeftNumeric** + **AxisBottomDate** — never raw `<AxisLeft>`/`<AxisBottom>` (they miss theme
   tokens + smart ticks).
5. **HoverOverlay** for mouse capture + **HoverContext** / hover-sync for cross-chart crosshair sync;
   **useChartTooltip** for tip state.
6. **Theme-aware colours** via `VX.*` tokens. **Never** raw hex literals in chart files. **Never**
   `localStorage.getItem('theme')`.

> **Sparkline exemption.** Tiny inline charts (under `charts/sparklines/`) without legend/tooltip are
> exempt from the `ChartCard`/`ChartLegend`/`ChartTooltip` contract — but still must use `VX` tokens
> and stay scheme-reactive.

### Kinds vs bespoke (Rule of Three)

A **kind** is a recurring chart shape reusable across datasets (`ZonedLine`, `Bars`, `StackedArea`,
`Donut`). Props are declarative — `data`, `width`, `height`, `chartId`, `getX`/`getY` accessors,
zones/thresholds/refLines as plain arrays, `seriesLabel`/`formatValue` — config-first, no
god-object `config` prop.

1. **Second instance of an existing pattern?** Extract a kind and migrate both call sites. (Rule of
   Three: don't extract on the first, don't wait past the third.)
2. **Genuinely unique** (e.g. a dual-panel MACD)? Stay bespoke — compose the primitives directly in
   the page's chart file, not in `charts/kinds/`.
3. **Adds a new colour?** Add a `{light,dark}` pair in the palette data, wire the `--vx-*` var,
   expose the `VX.*` ref — never inline a hex.

**The rule of thumb:** _if the new chart doesn't fit the primitives, add a kind — don't loosen the
primitives._ The anti-pattern is a single `<Chart type="..." config={...} />` that switches by kind;
prefer N small kinds.

### Design rules for the marks

- **Restraint over decoration.** Neutral structure (hairline grids ~6–8% neutral, thin crosshairs,
  restrained tooltips), coloured data. Structure-first chart selection (FT Visual Vocabulary): pick
  the chart for the data relationship, then apply the minimum colour.
- **Area gradients.** A soft single-hue vertical gradient under a line — one `AreaGradient`
  primitive emitting a `<linearGradient>` whose stops are `color-mix` of a CSS-var colour, with
  global strength knobs (`--vx-area-top` / `--vx-area-bottom`). Default the fill **on** for plain
  metric lines and **off** when the chart already carries zone/threshold fills (avoid double-fill
  haze). Keep stacked-area bands **opaque** — fading them leaks lower bands and hurts readability.
- **Signal-only colour, mono numbers** (Coinbase): up/down deltas are text colour only, never a fill;
  metric values render in the mono/tabular number style.

### The consumer-series boundary

Series colours are **domain data**, not framework identity — so they live **app-side**, not in
basalt. The framework ships the primitives; the consumer defines its own series and wires them in:

```ts
import { defineSeries, seriesTokens, groupTokens, buildPaletteCss } from 'basalt-ui/tokens'

// Domain series colours: a {light,dark} pair per series, in ONE app-side file.
const series = defineSeries({
  /* metricA: { light, dark }, metricB: { light, dark }, ... */
})

// Read stable, exact-keyed token refs (a stale key fails tsc).
const tokens = seriesTokens(series) // → { metricA: 'var(--vx-metricA)', ... }

// Embed the series into the emitted CSS (BasaltProvider does this via paletteOptions).
buildPaletteCss({ series })
```

`buildPaletteCss()` with no options already emits **every framework var** (status scale, semantic
solids, neutral line/axis/grid/tooltip chrome, legend text, surface ramp). There is **no built-in
`VX.series`** — the framework deliberately doesn't ship a domain dictionary. A consumer rebuilds its
series map in one guard-exempt file and feeds it through `defineSeries` / `groupTokens` /
`paletteOptions`.

## Do's and don'ts

### Do

- Default to neutral; spend a hue only for trend, signal, or categorical separation.
- Pull every colour from a token (`VX.*` / palette primitive / Mantine reskinned accent).
- Add new colours as `{light,dark}` pairs in the palette data → wire the `--vx-*` var → expose the
  `VX.*` ref. Use `alpha(token, a)` for opacity.
- Define domain series app-side via `defineSeries` / `seriesTokens`, fed through `paletteOptions`.
- Render numeric values in the mono/tabular number style.
- Compose the chart primitives; add a kind on the third repeat.

### Don't

- Don't inline `hex`/`rgb()`/`hsl()`/`rgba()` in component or chart source.
- Don't reach for raw library-default primaries for identity.
- Don't colour a single-series chart or a lone stat "to make it pop."
- Don't spend the identity hue on UI selection state (active nav item, selected tab) — that's not a
  data signal; keep it a neutral fill.
- Don't branch on colour scheme in JS or read the theme from `localStorage`.
- Don't carry depth with drop shadows; use surface change + hairlines.
- Don't enumerate per-metric colours in this file or in a consumer's `DESIGN.md` prose — that's the
  palette data's job.

## Guardrails (mechanical enforcement)

The teeth that keep the law from drifting:

- **`basalt check-theme`** — fails on colours bypassing the central palette: raw `hex`/`rgb()`/`hsl()`
  in component/chart source, off-identity accent props, and raw spacing/radius equal to a scale step.
  Configurable per consumer via the package.json `"basalt"` key
  (`{ roots?, exempt?, spacingSteps?, forbiddenAccents? }`). Exempts the palette/token-definition
  files; escape hatch is a `theme-allow` line comment.
- **oxlint `no-restricted-imports`** — bans `@visx/tooltip` in chart files (use `ChartTooltip`);
  keeps `src/charts/**` and `src/tokens/**` Mantine-free and `@visx/*` confined to charts.
- **The `ChartCard`/`ChartLegend`/`ChartTooltip` contract is social** — it's easier to compose the
  primitives than to work around them. A markdown rule alone drifts; the colour/spacing guard is the
  failing build that makes the rest stick.
