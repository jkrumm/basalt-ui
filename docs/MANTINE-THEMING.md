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

| Field                                 | Basalt value                                       | Rationale                                                       |
| ------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------- |
| `primaryColor`                        | the one earned identity hue                        | the single brand voltage (`DESIGN-CORE.md`)                     |
| `primaryShade`                        | `{ light: deeper, dark: lighter }`                 | deeper on light, lighter on dark (no glow)                      |
| `autoContrast` + `luminanceThreshold` | `true`, ~`0.45`                                    | auto black/white text on filled accents                         |
| `colors`                              | every Mantine accent overridden via a `ramp10()`   | `color="teal"` etc. become on-palette with zero call-site edits |
| `white` / `black`                     | match the palette endpoints                        | endpoints consistent with the palette                           |
| `defaultRadius`                       | tight (`sm`/4px), cards at `md`                     | v9 default changed `sm`→`md`; basalt leans tight (Linear)       |
| `fontFamilyMonospace`                 | mono stack                                          | numbers render mono (`DESIGN-CORE.md`)                          |
| `focusRing`                           | `'auto'` (keyboard-only)                            | restrained, accessible focus                                    |
| `fontWeights`                         | named weight ladder                                 | name the weight ladder once                                     |
| `components`                          | `Component.extend({...})`                           | centralised default props + Styles API                          |
| `other`                               | escape hatch                                        | typed bag for non-standard tokens (`theme.other.*`)             |

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

## 5. `variantColorResolver` — shadcn-flavoured variants (optional)

`variantColorResolver({ color, variant, gradient, theme }) => { background, hover, color, border, hoverColor? }`
customises how _every_ variant paints. The shadcn move is: a filled primary always uses a crisp
contrast text, and `default`/`subtle` lean on the neutral surface+hairline rather than a tinted
accent. Compose on top of the default resolver so only the deltas are specified:

```ts
import { defaultVariantColorsResolver, type VariantColorsResolver } from '@mantine/core'

export const variantColorResolver: VariantColorsResolver = (input) => {
  const out = defaultVariantColorsResolver(input)
  if (input.variant === 'filled') {
    return { ...out, color: 'var(--mantine-color-white)', hoverColor: 'var(--mantine-color-white)' }
  }
  return out
}
```

`autoContrast` already handles most filled-text contrast, so a custom resolver is a _refinement_,
not a requirement — adopt only if specific variants need shadcn-exact treatment. mantinehub instead
routes contrast through per-component `vars` (see §7).

---

## 6. Component theming — default props, Styles API, data attributes

Three escalating levers, cheapest first. **Always prefer the cheapest that does the job.**

1. **Default props** — set a prop once, globally:
   ```ts
   Card: Card.extend({ defaultProps: { withBorder: true, radius: 'md', shadow: undefined } }),
   Paper: Paper.extend({ defaultProps: { withBorder: true } }),
   Badge: Badge.extend({ defaultProps: { radius: 'sm', variant: 'light' } }),
   NavLink: NavLink.extend({ defaultProps: { variant: 'light' } }),
   ```
2. **`vars`** — compute CSS variables from `(theme, props)`; the mantinehub technique for routing a
   component's fill/text to `*-filled`/`*-contrast` per `color` prop (see §7). Surgical, no CSS file.
3. **`classNames` + CSS modules** — when structure/state styling is needed. Style by **data
   attributes**, never by deep selectors: `data-active`, `data-variant`, `data-disabled`,
   `data-hovered`, `data-checked`, … e.g. an active sidebar item is `&[data-active] { … }`.

Compound components drop the dot in the `components` key: `Menu.Item` → `MenuItem`.
`styles`/`classNames` may be **functions** receiving `(theme, props)`.

> **v9 gotchas:** `Text`/`Anchor` use `c` (not `color`) for text colour. `defaultRadius` default is
> now `md` (8px), not `sm`. `ColorSchemeScript`'s `defaultColorScheme` **must** match the provider's,
> or you get a flash of the wrong theme (FART) on load.

---

## 7. The mantinehub / shadcn technique, distilled

Source studied: `RubixCube-Innovations/mantine-theme-builder` (mantinehub.com). What it actually
does — and what basalt adopts vs rejects:

**The mechanism** (two moves, no per-component CSS files):

1. A **`cssVariablesResolver`** that redefines the _surface system_ — `--mantine-color-body`,
   `--mantine-color-default`, `--mantine-color-default-border`, `--mantine-color-dimmed`,
   `--mantine-color-text`, a neutral `secondary` ramp — to a chosen neutral palette (Zinc/Slate).
   This is 90% of why it "looks shadcn." **Basalt adopts this verbatim** (§4), binding to `--vx-*`.
2. Per-component **`vars`** that route fills/text to `--mantine-color-{color}-contrast` and
   `-filled`, so a filled control always gets crisp foreground text regardless of accent. Basalt
   gets most of this free via `autoContrast`; adopt the `vars` pattern only where a component
   misbehaves.

**Other settings it ships:** `focusRing: "never"` (basalt keeps `'auto'` — accessibility), custom
`radius`/`spacing`/`fontSizes`/`lineHeights` scales, `primaryShade {light:9,dark:0}` for a _neutral_
(near-black/near-white) primary, `Geist` font, soft shadow scale, `Card` `withBorder`.

**Adopt:** the surface-variable resolver; deliberate radius/spacing/type scales; `Card`/`Paper`
`withBorder` defaults; the `vars`-routing trick as needed.
**Reject:** their neutral-as-primary (`primaryShade {dark:0}`) — basalt's primary is a _hue_, not a
neutral; `focusRing:"never"`; importing their Zinc/Slate ramps — basalt's neutral is its own
gray/lightGray/darkGray ramps, already defined.

---

## 8. Chrome integration — the shell

The chrome advances in lockstep with `createBasaltTheme` and `DESIGN-CORE.md` so they never drift.

### 8.1 Unified token graph (theme)

- Add the `cssVariablesResolver` of §4 (surfaces/border/dimmed ← `--vx-*`). _Highest-value,
  lowest-risk step — do first._ `BasaltProvider` pre-wires it.
- Decide `defaultRadius`. The v9 default is `md`/8px; basalt leans tight/precise (Linear) →
  **`defaultRadius: 'sm'` (4px)** with cards at `md` (8px).
- Add `fontFamilyMonospace`, `fontWeights`, and `Card`/`Paper` `withBorder: true` + drop the card
  shadow on dark (depth = surface + hairline, not shadow — `DESIGN-CORE.md` Elevation).
- `variantColorResolver` (§5): **optional**, defer until a variant visibly needs it.

### 8.2 The shell: sidebar + breadcrumb

`BasaltShell` composes a full-height grouped sidebar, a slim breadcrumb top bar with page-header
slots, a collapsible desktop icon-rail, and a mobile bottom-nav + drawer. Router coupling (typed
navigation, active detection, badge counts) stays **consumer-side** — the shell is presentational
and router-agnostic.

- **App shell.** A full-height **grouped sidebar** (muted uppercase section labels; brand pinned
  top-left) + a slim **breadcrumb top bar** (`Section / Page`, hairline-separated). `AppShell
  layout="alt"` gives a full-height sidebar with the breadcrumb header scoped to the main area.
- **Top-bar slots own the page header.** The bar has two zones, not one. A **page slot**: the active
  route portals its full control row (window/range selectors, tabs, filters) into the bar via a
  `PageActions` outlet, so pages drop their in-body `<Title>` H1 — the breadcrumb names the page and
  the controls move up, reclaiming vertical density. A shell-owned **global slot**: persistent
  app-level widgets (timers, refresh, notifications, today's tasks, health). On mobile the bar wraps
  to two rows (lead + global on row 1, a single horizontally-scrollable page-action row on row 2).

  > **Why a portal, not route static data:** the controls are live — they close over the page's
  > search-param handlers, query data, and local state — so they must render inside the page's React
  > subtree while _appearing_ in the bar. A page contributes only its actions; the breadcrumb is
  > still nav-derived in the shell.

  > **Gotcha:** nested Mantine `Group`s default to `flex-wrap: wrap` and stack/clip in the slim bar
  > — force descendant `.mantine-Group-root { flex-wrap: nowrap }` (scoped to the outlet) so the row
  > stays one scrollable line.

- **Neutral nav active state** — _ink earns its colour applied to chrome:_ a nav selection is UI
  state, not a data signal, so the active item is a quiet neutral fill (a scheme-adaptive
  `color-mix` of `--vx-neutral`, with the NavLink colour forced to text colour), **never** the
  identity hue.
- **Collapsible sidebar (desktop icon-rail).** A persisted collapse flag (via `@mantine/hooks`
  `useLocalStorage`) drives the navbar to a 72px rail (responsive `width: { base: 240, sm: collapsed
  ? 72 : 240 }` so mobile stays a full drawer); rail styling — hide labels/section-headers/brand-text,
  center icons, tooltip each item — is **CSS gated behind `min-width: sm`**, so the persisted flag
  never collapses the mobile drawer. Toggle via the header chevron or **`Cmd/Ctrl+B`**
  (`useHotkeys`).
- **Sidebar header + footer.** Header = brand + a `visibleFrom="sm"` collapse chevron. Footer = a
  **theme select** `Menu` (System / Light / Dark via `setColorScheme`, active-checked, + the app
  version). On mobile a close (✕) sits **inline with the theme control** in the footer row
  (`hiddenFrom="sm"`), so the drawer header stays just the brand.
- **Mobile bottom nav** (an `AppShell.Footer` with `height {base:56,sm:0}` + `hiddenFrom="sm"`): a
  **curated** set of primaries as icon+short-label tabs with a neutral active fill, plus a trailing
  **Menu** tab that opens the full grouped drawer. There is no top burger on mobile; the drawer
  dismisses via the footer ✕ or by navigating.
- **Nav count badges.** A count is a data _signal_, so "ink earns its colour" lets it carry the **one
  spot of identity colour** in the otherwise-neutral nav (the active state stays neutral): a `Badge
  size="sm" variant="light"` in the NavLink right-section, rendered only when `> 0` and auto-hidden
  in the collapsed rail (the right-section is `display:none` there). Ship the count-badge pattern via
  `NavCountBadge`; the counts themselves are consumer-supplied (read-only queries that degrade to 0
  on error).

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

Every Mantine accent (`blue`/`red`/`teal`/…) is overridden with a designed family via `ramp10()`, so
`color="blue"`-style props are on-palette with zero call-site changes. `primaryColor: blue`;
`primaryShade { light: 6, dark: 4 }`; `autoContrast: true`. Mantine has **no** `gold`/`vermilion`
name — map to the nearest accent (`yellow`, `red`, `orange`, `green`, `blue`, `gray`). Off-identity
accent names that resolve to non-identity hues should be rejected by the guard (see `DESIGN-CORE.md`
guardrails) — use a status hue or a series token instead.

### 8.3 ShadCN sidebar anatomy → Mantine mapping

For reference, _not_ a 1:1 port:

| ShadCN                               | Mantine realization                                         |
| ------------------------------------ | ----------------------------------------------------------- |
| `SidebarProvider` / `useSidebar`     | `AppShell` + a persisted collapse flag                      |
| `Sidebar` / `SidebarContent`         | `AppShell.Navbar` + scroll area                             |
| `SidebarHeader` / `SidebarFooter`    | top `Group` / bottom-pinned `Group` (flex spacer)           |
| `SidebarGroup` + `SidebarGroupLabel` | `Stack` + a muted `Text` (uppercase caption)                |
| `SidebarMenuButton` (+ `isActive`)   | `NavLink` (+ `active` / `data-active`)                      |
| `SidebarMenuBadge`                   | `NavLink.rightSection` → `Badge` (`NavCountBadge`)          |
| `collapsible="icon"`                 | `AppShell` navbar width swap + icon-only items in `Tooltip` |
| mobile sheet                         | `AppShell.Navbar` `collapsed={{ mobile }}` (offcanvas)      |
| `Cmd/Ctrl+B` toggle                  | `@mantine/hooks` `useHotkeys([['mod+B', toggle]])`          |

---

## 9. Iteration loop

The theme-lab live-overrides `--vx-*` on `<html>`; because chrome binds to those vars, the lab
retunes **chrome and charts together**. Tune by eye in the running app → "Copy JSON" → bake into the
palette data.

Validate in **both schemes**: toggle dark/light, check the sidebar (expanded + icon rail), a content
page, and a mobile viewport. Diff against this doc's targets; iterate.

---

## 10. Pitfalls

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
