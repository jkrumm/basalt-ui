---
source: basalt-ui
description: Color, spacing, radius and type — route every value through the --vx-* token system.
paths:
  - 'src/**'
  - 'apps/**/src/**'
  - 'packages/**/src/**'
---

<!-- basalt:coverage -->
<!-- GENERATED from src/surfaces.ts — `bun scripts/check-coverage.ts --write`. Do not hand-edit. -->
<!-- backed by: guard kinds — css-raw-surface, inline-font-size, off-identity-accent, off-system-surface-var, raw-color-fn, raw-font-family, raw-hex, raw-radius, raw-surface, surface-shadow-override, theme-allow-unscoped, unknown-vx-token · oxlint rules — basalt/no-raw-font-size, basalt/raw-size-literal, basalt/token-layer-boundary -->
<!-- not guarded: — -->
<!-- /basalt:coverage -->

# Basalt Tokens

Every value is a `VX.*` reference or a theme prop; the palette is derived, never authored.

## Color

- Write no `#hex`, `rgb()` or `hsl()`; use `VX.*` (`basalt-ui/tokens`) or Mantine `c`/`bg`. [check-theme raw-hex] [check-theme raw-color-fn]
- Opacity is `alpha(token, a)`, never `rgba()`. [check-theme raw-color-fn]
- Mantine hues are `blue`, `gray`, `red`, `green`, `orange`, `yellow` only; a positive delta is `green`, not `teal`. [check-theme off-identity-accent]
- Never pin a shade (`c="yellow.7"`, `var(--mantine-color-red-6)`); use `VX.status.*` or the bare hue. [check-theme mantine-shade-index]
- Never read a raw ramp var (`--mantine-color-gray-N`); use `VX.surface.*`. [check-theme off-system-surface-var]
- Fill a control with `VX.accentFill` labelled `VX.onAccent`, never `VX.accent` (that is ink). [type VX]
- Name only `--vx-*` vars that basalt emits. [check-theme unknown-vx-token]
- Series color is app data: `defineSeries` → `seriesTokens`/`groupTokens`, each entry a `{ light, dark }` pair, in one file that `check-theme` exempts. [type defineSeries]
- `groupTokens` returns the group to pass to `buildPaletteCss` or `BasaltProvider` `paletteOptions`; never retype its key. [type groupTokens]

## Surfaces, radius, depth

- Surfaces are `VX.surface.{bg,panel,panelHover,elevated,subtle,overlay,field,border,hairline}`; the seam between shell regions is `VX.divider`. [type VX]
- Never set border, radius or shadow on a card; the theme owns them (`VX.shadowCard`, `VX.radiusCard`). [check-theme raw-surface]
- Never replace a surface's shadow with your own `boxShadow`; compose with the depth token. [check-theme surface-shadow-override]
- In CSS, corners and depth are `var(--vx-radius-card|--vx-radius-md)` and `var(--vx-shadow-card)`. [check-theme css-raw-surface]
- Radius is a token (`radius="md"`), never a number. [check-theme raw-radius]
- Never build a component named like a basalt export (`StatCard`, `Section`); import it. [basalt/shadow-basalt-export]

## Type

- Font size is `VX.text.*`, `--vx-text-*` or Mantine `fz`; never a literal. [check-theme inline-font-size] [basalt/no-raw-font-size]
- Size props take theme tokens, never a CSS length string. [basalt/raw-size-literal]
- Fonts change only through `createBasaltTheme(_, { fonts })`; never write `fontFamily`. [check-theme raw-font-family]

## Theme config

- Retune the identity with `createBasaltTheme(overrides?, { derive, fonts, radius, density })`; `radius` is -5..5 and `density` is -3..3. [type createBasaltTheme]

## Escape hatch

- `theme-allow <id> — <why>` waives one rule on its line; bare `theme-allow` or a missing why is itself a finding. [check-theme theme-allow-unscoped]
- `theme-allow-file <id> — <why>` waives a whole file; the annotation must start its comment. [check-theme theme-allow-unscoped]
- `basalt-ui check-theme --audit-allows` exits 1 on a waiver that suppresses nothing. [check-theme theme-allow-unscoped]
