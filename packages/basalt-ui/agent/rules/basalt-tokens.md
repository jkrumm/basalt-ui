---
source: basalt-ui
description: Colour, scheme and spacing — every value is a token, never a literal.
paths:
  - '**/src/**'
---

# Basalt Tokens

Every value is a token and the palette is derived, never authored; each bullet names what holds it.

## Colour

- Write no hex, `rgb()`, `hsl()` or `oklch()` literal; use a `VX.*` token, `alpha(VX.x, n)` or the app's series file. [lint:colour-literal]
- Ink on a brand fill is `on-brand`; never `text-white` or `text-black`. [lint:fixed-colour]
- Never fork a colour with `dark:`; tokens switch per scheme, so add the token. [lint:dark-fork]
- A status colour is a fill or a tone prop, never text; text takes `text-good` or `text-brand`. [lint:status-fill-as-text]
- App code takes colour from the status components, never an arbitrary or raw colour class. [lint:tw-off-law]
- A series colour is a `{ light, dark }` pair, authored once in the series file. [type:SeriesColor]

## Spacing and classes

- Spacing is a step on the ladder: integers, and halves below four; never an off-ladder value. [lint:tw-off-law]
- Never force a style with the `!` modifier or build a class from an interpolated string; add a variant. [lint:tw-off-law]
- Space siblings with `gap-*` on the parent; margin and `space-*` are not app code. [lint:app-spacing]
- A surface recipe is owned by its component; do not rebuild border, radius or shadow on it. [lint:tw-off-law]
- A pre-mixed token already carries its alpha; use it as it is. [lint:tw-off-law]

## Waivers

- A waiver ends in `-- <why>`; a bare one is itself a finding. [lint:waiver-needs-reason]

## Scheme

- The scheme is set with `setScheme`, which owns the attribute and the stored choice. [type:setScheme]

not guarded:

- `auto` means the `data-theme` attribute is absent and the system scheme applies; an explicit choice sets the attribute and is stored under the `basalt:scheme` key. Never write either by hand.
- Radius, density and fonts change only through the `basalt()` configuration, never a local override.
- A token name you did not see in `basalt-ui/tokens` does not exist; read the generated token list before inventing one.
