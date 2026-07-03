---
source: basalt-ui
description: Color, spacing, radius, and type discipline — route every value through the basalt-ui token system. Enforced by `basalt check-theme`.
paths:
  - 'src/**'
  - 'apps/**/src/**'
  - 'packages/**/src/**'
---

# Basalt Tokens — Color, Spacing, Radius, Type

basalt-ui ships one color/type/spacing/radius identity shared by the Mantine chrome and the visx
charts. The **identity is Basalt zinc-charcoal** (volcanic basalt) — the **dark surface ramp is a
lifted neutral/faint-cool zinc** (blue channel a whisper above red), while the **light canvas and the
chart mid-grey lines stay warm-neutral** (blue ≤ red — never cool/steel/blue-grey) — carrying a
**single muted slate-blue accent** (deliberately desaturated, calm Notion/Linear, not "Bootstrap
blue"). Neutrals do ~90% of the surface (60/30/10, pushed toward 90/10); the accent only points —
primary CTA, focus, links, small status pops — never floods. (Blueprint is the historical hue-tuning
ancestor; the identity is Basalt zinc-charcoal now.) This rule is the operational checklist; it is enforced
mechanically by **`basalt check-theme`**
(wire it into `lint`: `oxlint . && basalt check-theme`). A violation fails the build. Escape hatch: a
`theme-allow` line comment (diff-visible, deliberate).

`check-theme` reads its config from your `package.json` `"basalt"` key
(`{ roots?, exempt?, spacingSteps?, forbiddenAccents? }`); set `roots` to your source dirs and `exempt`
to the files that legitimately define palette values.

## Color — never a raw literal

- **No raw `#hex` / `rgb()` / `rgba()` / `hsl()`** in scanned source. Route every color through the
  palette: `VX.*` tokens (from `basalt-ui/tokens` or `basalt-ui/charts` — they are CSS vars, so they
  work in components AND non-component files), or the Mantine theme (`color`/`c`/`bg` props, `theme.colors`).
  Opacity via `alpha(token, a)` — never `rgba()` — so the hue keeps resolving per color scheme.
- **No off-identity Mantine accents.** `color`/`c`/`bg`/`backgroundColor` must not be
  `teal`/`violet`/`grape`/`indigo`/`pink`. `createBasaltTheme` reskins _every_ Mantine accent to the
  Basalt identity, so those names still render on-palette — but the guard rejects them because they
  signal off-identity intent. Allowed accents: **`blue`** (the one earned identity hue — the muted
  slate-blue accent), **`gray`** (neutral), and the status hues **`red`/`green`/`orange`/`yellow`**
  (muted/forest, never raw Material/AntD). Categorical/series color goes through series tokens
  (`defineSeries` → `seriesTokens`/`groupTokens`), never a Mantine accent prop. Success-button flips
  and positive deltas use `color="green"` (forest green), not `teal` (vivid turquoise).
- **"Ink earns its color"** — default to neutral. A hue is justified only for trend, signal/status,
  or genuine multi-series separation. A count badge is a signal → it may carry blue; a nav active-state
  is UI chrome → it stays neutral (`NavCountBadge` already encodes this). Active nav renders a
  **neutral surface fill** + plain text + a weight bump, never the accent — baked into the theme's
  NavLink `--nl-*` defaults across every render path (including a router `<Link>` via `renderNavLink`).
- **Accent restraint, mechanically.** The accent lands on exactly the single primary CTA per view
  (`variant="filled"`), focus rings, links, and small status pops — nowhere else. Routine/secondary
  buttons use `variant="default"` (neutral); don't reach for a colored `variant="light"` (it reads
  washed-out on the warm light canvas). Neutrals carry borders, large fills, and routine icons.

## Surfaces — one collapsed token set

The surface token set is **`bg` · `panel` · `elevated` · `subtle` · `border`**:

- `--vx-surface-bg` (`VX.surface.bg`) — the page background.
- `--vx-surface-panel` (`VX.surface.panel`) — the card/`Paper` background.
- `--vx-surface-elevated` (`VX.surface.elevated`) — a lifted surface (chart areas, tooltips).
- `--vx-surface-subtle` (`VX.surface.subtle`) — a faint hover/striped/track surface: a step
  **below white on light** (`#f2f2f1`), **above panel on dark** (`#323239`). Used for Table
  hover/striped rows, `Code`, the `SegmentedControl` track, and Tabs/Accordion/Menu hover.
- `--vx-surface-border` (`VX.surface.border`) — the single hairline border token.

The theme **collapses Mantine's raw ramp steps onto these tokens** (`cssVariablesResolver` plus
theme `styles`): light/dark border ramp steps → `--vx-surface-border`, light hover steps →
`--vx-surface-subtle`, card bg → `--vx-surface-panel`, `--app-shell-border-color` →
`--vx-surface-border`. So **every** Mantine component (AppShell, Table, Input, Divider, Tabs,
Popover, Accordion, cards) renders one border shade, one card background, and one radius
(`--vx-radius-card`). Never inline a surface color or reach for a raw ramp-step var
(`var(--mantine-color-gray-N)`) — the `off-system-surface-var` guard rejects it.

## Spacing & radius — prefer the scale token

- `baseTheme` owns the scales: `spacing` 10/12/16/20/32 → `xs…xl`, `radius` 2/4/8/16/32 → `xs…xl`.
  **Use the token**, not the raw number, when a value equals a step: `p="md"` not `p={16}`,
  `gap="sm"` not `gap={12}`, `radius="sm"` not `radius={4}`. The guard flags exact token-equals
  (`p={16}`, any numeric `radius`).
- **Card radius has one source: `--vx-radius-card` (8px) = `VX.radiusCard` = `radius.md`.** Every
  card corner — the Mantine chrome (`Card`/`Paper`, `radius="md"`) and the Mantine-free `ChartCard`
  (`var(--vx-radius-card)`) — resolves to this single token; cards must never diverge. Don't inline
  a `borderRadius` on a surface (the `raw-surface` guard rejects it).
- **Dense by default.** The framework targets compact (Linear/Notion) surfaces — prefer the tighter
  spacing step (`sm`/`xs`) for shell, nav, and card padding rather than `md`/`lg` air (see
  basalt-mantine.md for the shipped dense defaults).
- **Sub-scale micro-spacing is legitimate and allowed raw** — `gap={2}`, `pl={4}`, `mt={6}` have no
  token equivalent (the scale starts at 10). Use them freely for tight clusters; don't invent
  micro-tokens or pepper `theme-allow`. One-off layout dims (`h={36}`, `w={64}`) are also fine raw.
- **Icons** size via the icon's own `size` prop (`size={16}`), not spacing tokens — that's not spacing.

## Type

- Type is carried by Mantine's `fontSizes` + `headings` + the named `fontWeights` ladder
  (`fw="semibold"`, `fw="medium"`, …) and the mono `fontFamilyMonospace` for numbers. Don't hard-code
  `fontSize` in px on chrome; use `size`/`fz` tokens.

## When the guard fires

Fix the source, don't silence it — reach for the right token first. Only add `theme-allow` for a
genuine, documented exception (e.g. a third-party widget needing a literal). The palette-definition
files are listed in your `exempt` set so they don't self-trip.
