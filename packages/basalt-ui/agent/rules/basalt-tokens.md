---
source: basalt-ui
description: Colour, scheme and spacing — every value is a token, never a literal.
paths:
  - '**/src/**'
---

# Basalt Tokens

Every value is a token and the palette is derived, never authored; each bullet names what holds it.

## Colour

- Write no hex, `rgb()`, `hsl()` or `oklch()` literal; use a `BASALT.*` token, `alpha(BASALT.x, n)` or the app's series file. [lint:colour-literal]
- A brand fill and its ink come from `Button` variant primary or `Status` in app code; `on-brand` is bridge-only. Never `text-white` or `text-black`. [lint:fixed-colour]
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
- Time motion from the scale: `MOTION_DURATION`, `MOTION_EASE_*`, `MOTION_SPRING` and `staggerDelay` from `basalt-ui/tokens`, `useMotionPreset` from `basalt-ui/motion`, the `duration-fast|base|slow` and `ease-standard|enter|exit` classes or `var(--basalt-dur-*)`; never a number, a `duration-300` or an `ease-in-out`. [lint:motion-literal] [lint:motion-off-scale]

## Waivers

- A waiver ends in `-- <why>`; a bare one is itself a finding. [lint:waiver-needs-reason]

## Scheme

- The scheme is set with `setScheme`, which owns the attribute and the stored choice. [type:setScheme]

not guarded:

- `auto` means the `data-theme` attribute is absent and the system scheme applies; an explicit choice sets the attribute and is stored under the `basalt:scheme` key. Never write either by hand.
- Secondary text is `text-muted-foreground`; `text-muted` is a surface and paints the card colour.
- Radius has no knob in 3.0 (four fixed values, `tokens/table.ts`): never override it locally. Density is the `data-density` attribute (`dense`, `normal`, `comfortable`) on `<html>` or a subtree; never set `--basalt-ctl-h` or `--basalt-row-h` by hand. `basalt()` takes no radius, density or fonts option; the three faces ship in `fonts.css`.
- The reader's density, frame and accent are `data-density`, `data-frame` and `data-accent` on `<html>`, written by `setAppearance` (`basalt-ui`) and offered by `AppearanceSwitcher`; never write them or `basalt:appearance` by hand. An accent works only if the app ships it: a `tokens` output in `.basalt/manifest.json` with the flags `--accents violet,teal`, written by `basalt-ui tokens:css --accents violet,teal --out src/accents.css` and imported after `tokens.css`.
- A token name you did not see in `basalt-ui/tokens` does not exist; read the generated token list before inventing one.
