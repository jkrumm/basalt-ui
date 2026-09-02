# Mantine Theming — Engineering Reference

> **Role.** This is the **method** for the Mantine _chrome_ layer (the app shell: shell, sidebar,
> cards, inputs, buttons, badges, navigation). It is subordinate to **`DESIGN-CORE.md`** — the
> _law_. Where this doc and `DESIGN-CORE.md` disagree, `DESIGN-CORE.md` wins. It is the chrome-side
> sibling of the charts-layer method. Both layers must resolve to **one** identity, and this doc
> explains the wiring that makes that true.
>
> Target: **Mantine v9** (`@mantine/core` `^9.3`), React 19, the `@mantine/*` v9 family. The live
> theme is `createBasaltTheme` / `baseTheme` / `cssVariablesResolver` from basalt-ui.

---

## 0. The one big idea

Mantine v9 is a **CSS-variable theming system**, not a runtime style engine. `createTheme()` is
mostly a _generator of CSS custom properties_ (`--mantine-*`). Components read those variables in
their own CSS modules. So theming is: **decide the variables, let CSS resolve them per scheme.**

Basalt already runs a parallel CSS-variable system for charts: `--vx-*` (palette data →
`buildPaletteCss` → `VX.*` refs). The whole game of this retheme is to **make the two variable
systems agree** — bind Mantine's surface/border/text variables to the _same_ `--vx-*` values the
charts use, so chrome and charts are literally drawing from one set of variables, scheme-reactive in
pure CSS with zero JS branching.

```
              palette data  (designed hues + {light,dark} pairs — the single source)
                   │
        ┌──────────┴───────────┐
   buildPaletteCss          createBasaltTheme
   emits --vx-*            createTheme() + cssVariablesResolver
   (charts)                emits/overrides --mantine-*  ←──binds to──  --vx-*
        │                       │
   visx charts             Mantine components
        └──────────┬───────────┘
              one identity, one set of surfaces
```

This is the same architecture mantinehub/shadcn uses to make Mantine "look like shadcn"; the
difference is basalt binds to its _own_ `--vx-*` tokens instead of inventing shadcn `--background`
/`--foreground` names.

---

## 1. Mental model: CSS variables, not props

- Every theme token becomes a CSS variable: `--mantine-color-blue-6`, `--mantine-spacing-md`,
  `--mantine-radius-md`, `--mantine-font-size-sm`, etc. Components consume them.
- **Colour scheme** is an attribute on `<html>`: `data-mantine-color-scheme="dark|light"`. Any
  variable that differs by scheme is redeclared under that selector. **Never branch on scheme in
  JS** — emit two values and let CSS choose. (Same rule as the charts; see `DESIGN-CORE.md`
  principle 5.)
- The handful of variables that carry the _surface system_ are the ones that define "the look":

| Variable                         | Meaning                               | Mantine default (light / dark) |
| -------------------------------- | ------------------------------------- | ------------------------------ |
| `--mantine-color-body`           | page background                       | `#fff` / `dark-7`              |
| `--mantine-color-text`           | primary text                          | `#000`-ish / `dark-0`          |
| `--mantine-color-dimmed`         | secondary/muted text                  | `gray-6` / `dark-2`            |
| `--mantine-color-default`        | default control/surface bg            | `#fff` / `dark-6`              |
| `--mantine-color-default-hover`  | default hover bg                      | `gray-0` / `dark-5`            |
| `--mantine-color-default-border` | **the hairline** — borders/dividers   | `gray-4` / `dark-4`            |
| `--mantine-color-default-color`  | text on default surface               | `#000` / `#fff`                |
| `--mantine-color-dark-*`         | the `dark` tuple (drives dark chrome) | reskinned to the dark ramp     |

> **Why the resolver matters.** In **dark** mode the surfaces can look right by coincidence if the
> `dark` tuple is hand-aligned so `dark-7/6/4/0` = `bg/panel/hairline/ink`. In **light** mode
> Mantine derives surfaces from the `gray` tuple (_mid_ grays), which does **not** match the lighter
> surface ramp the charts use. The `cssVariablesResolver` below fixes this for both schemes and
> removes the reliance on that dark-tuple coincidence.

---

## 2. The theme object (`createTheme`)

What basalt sets, and why. Full surface: <https://mantine.dev/theming/theme-object>.

| Field                                 | Basalt value                                                      | Rationale                                                                                                                                                    |
| ------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `primaryColor`                        | the one earned identity hue                                       | the single brand voltage (`DESIGN-CORE.md`)                                                                                                                  |
| `primaryShade`                        | `6` (one shade, both schemes)                                     | a fill is a SURFACE — it does not invert; see the fill band below                                                                                            |
| `autoContrast` + `luminanceThreshold` | `true`, ~`0.45`                                                   | left on for Mantine internals, but NOT trusted — the foreground is decided in CSS (`--vx-on-*`), because Mantine's pick is scheme-blind AND brightness-based |
| `colors`                              | every Mantine accent overridden via a `ramp10()`                  | `color="teal"` etc. become on-palette with zero call-site edits                                                                                              |
| `white` / `black`                     | match the palette endpoints                                       | endpoints consistent with the palette                                                                                                                        |
| `defaultRadius`                       | `md` (6px, controls), a separate 7px `--vx-radius-card` for cards | v9 default changed `sm`→`md`; basalt leans tight (Linear)                                                                                                    |
| `fontFamilyMonospace`                 | mono stack                                                        | numbers render mono (`DESIGN-CORE.md`)                                                                                                                       |
| `focusRing`                           | `'auto'` (keyboard-only)                                          | restrained, accessible focus                                                                                                                                 |
| `fontWeights`                         | named weight ladder                                               | name the weight ladder once                                                                                                                                  |
| `components`                          | `Component.extend({...})`                                         | centralised default props + Styles API                                                                                                                       |
| `other`                               | escape hatch                                                      | typed bag for non-standard tokens (`theme.other.*`)                                                                                                          |

**`MantineColorsTuple`** is always **10 shades, light→dark** (index 0 lightest, 9 darkest). A
designed family with fewer stops is interpolated up to 10 by a `ramp10()` helper. `dark` is a
special tuple: Mantine reads `dark-7`=body, `dark-6`=surface, `dark-4`=border, `dark-0`=text — so
the dark family is hand-tuned to those slots.

Helpers worth knowing (v9): `virtualColor({name, light, dark})` (a colour that _is_ a different real
colour per scheme — useful for a `primary` alias), `colorsTuple('#hex')` (expand one hex to a
tuple), `darken()/lighten()/alpha()` from `@mantine/core`.

---

## 3. The CSS-variable system in detail

### Variant variables

For each colour `name` and variant, Mantine emits a fixed set. These are what components actually
paint with:

```
--mantine-color-{name}-filled            --mantine-color-{name}-light
--mantine-color-{name}-filled-hover      --mantine-color-{name}-light-hover
--mantine-color-{name}-outline           --mantine-color-{name}-light-color
--mantine-color-{name}-outline-hover     --mantine-color-{name}-text
--mantine-primary-color-{filled,light,...}   // alias to the primaryColor's set
--mantine-primary-color-contrast          // text colour on a filled primary
```

> **v9 change:** the `light` variant is now a **solid** colour (v8 was translucent). If a surface
> looked translucent-tinted before, that's why. `v8CssVariablesResolver` exists only as a migration
> shim — don't adopt it.

### Scheme resolution

The `light-dark(a, b)` CSS function and the `[data-mantine-color-scheme]` selectors do the work. A
variable that differs by scheme is declared twice; CSS picks based on the `<html>` attribute. This
is identical in spirit to the `--vx-*` palette CSS, which declares its vars under the same attribute
— which is _why_ the two systems compose cleanly.

---

## 4. `cssVariablesResolver` — the lever (the core binding)

`cssVariablesResolver(theme) => { variables, light, dark }` injects/overrides CSS variables.
`variables` is scheme-independent (lands on `:root`); `light`/`dark` are auto-scoped under the
`[data-mantine-color-scheme]` selector. This is the single most important hook for the retheme:
**bind Mantine's surface system to `--vx-*`.**

> **Specificity gotcha (verified the hard way).** The bindings **must go in `light`/`dark`, not
> `variables`.** Mantine declares the surface vars (`--mantine-color-body`, `-default`,
> `-default-border`, …) under the `[data-mantine-color-scheme]` selector. A `variables` binding
> lands on `:root`, which that selector **outranks** — so your binding silently loses to Mantine's
> per-scheme default. The `light`/`dark` blocks inject under the _same_ scheme selector, at matching
> specificity, after Mantine's — so they win. (The `--vx-*` refs are themselves scheme-resolved, so
> the same ref works in both blocks; the per-scheme hex fallbacks just cover the brief window before
> the palette CSS injects.)

```ts
import type { CSSVariablesResolver } from '@mantine/core'

export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  // Surfaces + hairline: chrome draws from the SAME vars as the charts. In BOTH blocks (specificity).
  light: {
    '--mantine-color-body': 'var(--vx-surface-bg, #f6f7f9)', // page background
    '--mantine-color-default': 'var(--vx-surface-panel, #ffffff)', // cards / default controls
    '--mantine-color-default-hover': 'var(--vx-surface-elevated, #ffffff)',
    '--mantine-color-default-border': 'var(--vx-surface-border, #dce0e5)', // the hairline
    '--mantine-color-dimmed': 'var(--vx-neutral, #5f6b7c)', // secondary/muted text
  },
  dark: {
    '--mantine-color-body': 'var(--vx-surface-bg, #1c2127)',
    '--mantine-color-default': 'var(--vx-surface-panel, #252a31)',
    '--mantine-color-default-hover': 'var(--vx-surface-elevated, #2f343c)',
    '--mantine-color-default-border': 'var(--vx-surface-border, #383e47)',
    '--mantine-color-dimmed': 'var(--vx-neutral, #8f99a8)',
  },
  // --mantine-color-text left to Mantine (near-black/near-white already correct); do NOT bind it
  // to --vx-line (that's a mid-gray chart stroke, too weak for body copy).
})
```

`BasaltProvider` pre-wires this alongside the theme:

```tsx
<MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} defaultColorScheme="dark">
```

> **Ordering caveat.** The `--vx-*` vars are injected by `BasaltProvider` via a `<style>` block
> _inside_ the React tree; Mantine injects its variables at the provider root. Both target the
> document, both key off `[data-mantine-color-scheme]`, and CSS `var()` resolves lazily at paint —
> so the reference works regardless of injection order. If a binding ever resolves empty, provide a
> fallback: `var(--vx-surface-bg, #1c2127)`.

This binding is the "wire everything up nicely" win: one edit, and **light-mode chrome stops using
the muddy mid-gray ramp** and adopts the lighter surface ramp the charts already use.

---

## 5. Component theming — default props, Styles API, data attributes

Three escalating levers, cheapest first. **Always prefer the cheapest that does the job.**

1. **Default props** — set a prop once, globally:
   ```ts
   Badge: Badge.extend({ defaultProps: { radius: 'sm', variant: 'light' } }),
   NavLink: NavLink.extend({ defaultProps: { variant: 'light' } }),
   ```
   > `Card`/`Paper` are **not** themed via `defaultProps` — depth comes from `styles.root` forcing
   > `boxShadow: 'var(--vx-shadow-card)'` + `borderRadius: 'var(--vx-radius-card)'`, no `withBorder`
   > (see `DESIGN-CORE.md` § Layout, elevation, shapes — this is the generic example, not the shape
   > basalt ships).
2. **`vars`** — compute CSS variables from `(theme, props)`, routing a component's fill/text to
   `*-filled`/`*-contrast` per `color` prop. Surgical, no CSS file.
3. **`classNames` + CSS modules** — when structure/state styling is needed. Style by **data
   attributes**, never by deep selectors: `data-active`, `data-variant`, `data-disabled`,
   `data-hovered`, `data-checked`, … e.g. an active sidebar item is `&[data-active] { … }`.

Compound components drop the dot in the `components` key: `Menu.Item` → `MenuItem`.
`styles`/`classNames` may be **functions** receiving `(theme, props)`.

> **v9 gotchas:** `Text`/`Anchor` use `c` (not `color`) for text colour. `defaultRadius` default is
> now `md` (8px), not `sm`. `ColorSchemeScript`'s `defaultColorScheme` **must** match the provider's,
> or you get a flash of the wrong theme (FART) on load.

---

## 6. Chrome integration — the shell

The chrome advances in lockstep with `createBasaltTheme` and `DESIGN-CORE.md` so they never drift.

### 6.1 Unified token graph (theme)

- Add the `cssVariablesResolver` of §4 (surfaces/border/dimmed ← `--vx-*`). _Highest-value,
  lowest-risk step — do first._ `BasaltProvider` pre-wires it.
- `defaultRadius`/`--vx-radius-card` values: see §2's table (the derive engine is ground truth, not
  this doc — see `DESIGN-CORE.md`).
- Add `fontFamilyMonospace`, `fontWeights`, and force `Card`/`Paper` `styles.root` to
  `boxShadow: 'var(--vx-shadow-card)'` (no `withBorder`) — depth is a whisper shadow + ring baked
  into that one token, not a bare hairline (`DESIGN-CORE.md` § Layout, elevation, shapes).

### 6.2 The shell: sidebar + breadcrumb

`BasaltShell` composes a full-height grouped sidebar (desktop only), a slim breadcrumb top bar with
page-header slots, a collapsible desktop icon-rail, and a mobile bottom tab bar (no drawer — the
full-height mobile sidebar drawer was deleted in 1.19.0). Router coupling (typed navigation, active
detection, badge counts) stays **consumer-side** — the shell is presentational and router-agnostic.

- **App shell.** A full-width top bar (brand zone, breadcrumb, `PageBar` row 1, global actions)
  over a grouped sidebar, transparent, region seam on the bar's bottom edge. `withBorder` still
  gates each region's edge as Mantine ships it; the theme changes only the COLOUR every gated edge
  paints, once, via `AppShell.extend({ vars: () => ({ root: { '--app-shell-border-color':
'var(--vx-divider)' } }) })` — no module sets that var or `withBorder` directly except the aside
  (`withBorder={aside.claimed}`, gated on the claim). Runs Mantine's DEFAULT layout, not `alt`: the
  header spans the full viewport width, sidebar/aside seams start under it.
- **`AppShell.Main` is the scrollport.** Mantine offsets Main with `padding-*`, which puts the
  scrollbar at the far window edge, outside the aside. `shell/app-main.module.css` restates those
  offsets as MARGINS instead, so Main is the one scrolling element — it wins with no `!important`
  because Mantine's own rules sit inside `@layer mantine` (layered import required).
- **The AppShell ROOT is a column flex.** Its only in-flow children are the page-bar band and Main
  (every other region is `position: fixed`), so `band { flex: 0 0 auto }` + `main { flex: 1 1 auto;
min-height: 0 }` sizes Main to whatever the band leaves — no height arithmetic, nothing to go
  stale between a route change and a ResizeObserver.
- **Top-bar slots own the page header** — a page slot (the active route portals its control row in
  via `PageActions`, dropping the in-body `<Title>`) and a shell-owned global slot (persistent
  app-level widgets). Mobile wraps to two rows. Portal, not route static data: the controls close
  over the page's search-param handlers and local state, so they must render inside the page's own
  React subtree while appearing in the bar.
- **Neutral nav active state** — a nav selection is UI state, not a data signal: a quiet neutral
  fill, never the identity hue.
- **Collapsible sidebar** — a persisted flag drives the navbar to a 48px rail; the sidebar doesn't
  render below `sm` at all (no mobile drawer, so no CSS gate needed). Toggle via the header chevron,
  no `Cmd/Ctrl+B` hotkey.
- **Sidebar header + footer** — header is brand + a collapse chevron; footer is an opt-in
  consumer-supplied settings `Menu` then an `account` row. basalt ships no built-in theme-select.
- **Mobile bottom nav** — a curated set of primaries as icon+label tabs, neutral active fill, plus
  a trailing Menu/Drawer "More" surface (inferred from row count) holding the rest.
- **Nav count badges** — a count is a data signal, so it carries the ONE spot of identity colour in
  the otherwise-neutral nav: `Badge size="sm" variant="light"` in the right-section, `> 0` only,
  auto-hidden in the collapsed rail. Ship via `NavCountBadge`; counts are consumer-supplied.

#### Chrome ↔ charts share one surface system

The `cssVariablesResolver` binds Mantine's surface variables to the same `--vx-*` the charts use —
so cards, borders and muted text draw from one scheme-reactive source (in particular, light mode
uses the lighter surface ramp instead of the muddy mid-gray default):

| Mantine variable                 | ← bound to              | Role                     |
| -------------------------------- | ----------------------- | ------------------------ |
| `--mantine-color-body`           | `--vx-surface-bg`       | page background          |
| `--mantine-color-default`        | `--vx-surface-panel`    | cards / default controls |
| `--mantine-color-default-hover`  | `--vx-surface-elevated` | hover surface            |
| `--mantine-color-default-border` | `--vx-surface-border`   | the hairline             |
| `--mantine-color-dimmed`         | `--vx-neutral`          | secondary / muted text   |

#### Mantine accent name map

Every Mantine accent (`blue`/`red`/`teal`/…) is overridden with a designed family via `ramp10()`,
so `color="blue"`-style props are on-palette with zero call-site changes. `primaryShade: 6` — one
shade in BOTH schemes, because a filled surface does not invert: squeezed between its white label
(≥4.5:1) and the page (≥3:1), only one luminance band satisfies both. Shade 6 is pinned to that
band (`FILL`/`ACCENT` in `tokens/palette.ts`); `--mantine-color-{family}-filled` bridges onto
`--vx-*`. Mantine has no `gold`/`vermilion` — map to the nearest accent. Off-identity accent names
are guard-rejected (`DESIGN-CORE.md` guardrails) — use a status hue or series token instead.

---

## 7. Iteration loop

The theme-lab live-overrides `--vx-*` on `<html>`; because chrome binds to those vars, the lab
retunes **chrome and charts together**. Tune by eye in the running app → "Copy JSON" → bake into the
palette data.

Validate in **both schemes**: toggle dark/light, check the sidebar (expanded + icon rail), a content
page, and a mobile viewport. Diff against this doc's targets; iterate.

---

## 8. Pitfalls

- **FART (flash of wrong theme):** `ColorSchemeScript defaultColorScheme` must equal the provider's
  — keep them in sync.
- **`light` variant is solid in v9** — don't expect translucency; if you want a tint, use `alpha()`.
- **`c` not `color`** for `Text`/`Anchor` text colour in v9.
- **Don't bind `--mantine-color-text` to `--vx-line`** — that's a mid-gray chart stroke, too weak
  for body copy. Surfaces/borders/dimmed: bind. Primary text: leave to Mantine.
- **Surface bindings go in `light`/`dark`, never `variables`** (§4 specificity gotcha) — a `:root`
  binding loses to Mantine's `[data-mantine-color-scheme]` default and silently no-ops.
- **Don't branch on colour scheme in JS** and **don't read `localStorage` theme** — emit two values,
  let CSS resolve (`DESIGN-CORE.md` principle 5).
- **No raw hex/`rgb()`/`rgba()`** in chrome source either — the `basalt check-theme` guard fails on
  it; use Mantine tokens / `--vx-*` / `alpha(token, a)`.

---

## References

- Mantine theme object — <https://mantine.dev/theming/theme-object>
- CSS variables + list — <https://mantine.dev/styles/css-variables> · <https://mantine.dev/styles/css-variables-list>
- Colours + `variantColorResolver` — <https://mantine.dev/theming/colors>
- Default props / Styles API / data attributes — <https://mantine.dev/theming/default-props> · <https://mantine.dev/styles/styles-api> · <https://mantine.dev/styles/data-attributes>
- Colour schemes / provider — <https://mantine.dev/theming/color-schemes> · <https://mantine.dev/theming/mantine-provider>
- v8→v9 migration — <https://mantine.dev/guides/8x-to-9x>
- mantinehub (shadcn-for-Mantine) — <https://mantinehub.com> · `github.com/RubixCube-Innovations/mantine-theme-builder`
- ShadCN sidebar anatomy — <https://ui.shadcn.com/docs/components/base/sidebar>
- The law + layers — `DESIGN-CORE.md`
