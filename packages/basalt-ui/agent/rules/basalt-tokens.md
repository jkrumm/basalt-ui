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
charts. This rule is the operational checklist; it is enforced mechanically by **`basalt check-theme`**
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
  `teal`/`violet`/`grape`/`indigo`/`pink`. `createBasaltTheme` reskins _every_ Mantine accent to a
  Blueprint family, so those names still render on-palette — but the guard rejects them because they
  signal off-identity intent. Allowed accents: **`blue`** (the one earned identity hue), **`gray`**
  (neutral), and the status hues **`red`/`green`/`orange`/`yellow`**. Categorical/series color goes
  through series tokens (`defineSeries` → `seriesTokens`/`groupTokens`), never a Mantine accent prop.
  Success-button flips use `color="green"`, not `teal`.
- **"Ink earns its color"** — default to neutral. A hue is justified only for trend, signal/status,
  or genuine multi-series separation. A count badge is a signal → it may carry blue; a nav active-state
  is UI chrome → it stays neutral (`NavCountBadge` already encodes this).

## Spacing & radius — prefer the scale token

- `baseTheme` owns the scales: `spacing` 10/12/16/20/32 → `xs…xl`, `radius` 2/4/8/16/32 → `xs…xl`.
  **Use the token**, not the raw number, when a value equals a step: `p="md"` not `p={16}`,
  `gap="sm"` not `gap={12}`, `radius="sm"` not `radius={4}`. The guard flags exact token-equals
  (`p={16}`, any numeric `radius`).
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
