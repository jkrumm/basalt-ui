# Framework-free token consumption

basalt-ui's token system does not need basalt-ui. No React, no Mantine, no
bundler — a static site can carry the same 197 `--vx-*` variables the framework's
own components read, and stay in sync with them.

This page is for that consumer: an Astro site, a Hugo theme, a plain
`index.html`, a design system in another stack that wants basalt's palette
underneath it.

## Three routes in

| Route | What it costs | Use when |
|-|-|-|
| `bunx basalt-ui tokens:css --out src/tokens.css` | nothing — no dependency at all | You want a file you own and commit. The default for a static site. |
| `import 'basalt-ui/tokens.css'` | one dependency, no peers | You already have a bundler and want the tokens to move with the version. |
| `import { buildPaletteCss } from 'basalt-ui/tokens'` | one dependency, no peers | You need consumer series, or you emit CSS at build time yourself. |

Every peer is optional, so `bun add basalt-ui` with no React installed brings the
package and its own dependencies (the nine `@visx/*`, `motion`, `remend`, three
font packages) — not the ~79 that come with the full framework.
`basalt-ui/tokens`, `basalt-ui/charts`, `basalt-ui/state` and
`basalt-ui/guard` resolve and run with no `@mantine/*` anywhere in the graph;
that is CI-enforced, not aspirational (`scripts/check-dist-layering.mjs` walks the
built graph, `scripts/pack-test.sh` installs the tarball into a scratch dir with
no Mantine and renders from it).

`basalt-ui/styles.css` is a different thing and you almost certainly do not want
it — it is the framework's base layer and assumes Mantine's own layered bundle
underneath.

## Retargeting the color-scheme selector

The default output keys per-scheme blocks off Mantine's toggle:

```css
:root { /* theme-independent scalars */ }
:root,
html[data-mantine-color-scheme='dark'] { /* dark primitives */ }
html[data-mantine-color-scheme='light'] { /* light primitives */ }
```

If your site toggles `data-theme` on `<html>`, or has no toggle at all and wants
the OS preference, pass options — from the CLI or the API, same emitter:

```bash
bunx basalt-ui tokens:css \
  --selector-attribute data-theme \
  --default-scheme light \
  --media-fallback \
  --only core \
  --out src/styles/tokens.css
```

```ts
import { buildPaletteCss } from 'basalt-ui/tokens'

buildPaletteCss({
  scheme: { attribute: 'data-theme' },   // also: darkValue, lightValue
  defaultScheme: 'light',                // which scheme rides the bare :root; or 'none'
  mediaFallback: true,                   // @media (prefers-color-scheme) for the others
  only: 'core',                          // see below
})
```

Passing any of the three switches the emitted selector from `html[…]` to
`:root[…]`. **This is the detail that quietly breaks dark mode if you write the
CSS yourself**, so it is worth the specificity arithmetic:

| Selector | Specificity | Against a light-default site's own `:root` block |
|-|-|-|
| `:root[data-theme='dark']` | 0-2-0 | wins |
| `html[data-theme='dark']` | 0-1-1 | wins |
| `[data-theme='dark']` | 0-1-0 | **tie — source order decides** |

The bare attribute selector is the natural thing to reach for and it is a trap.
It ties with `:root`, so whichever block your bundler emits last wins, and dark
mode does nothing on a site whose light `:root` happens to come after. `:root[…]`
sits above both forms and assumes nothing about which element carries the
attribute.

The `mediaFallback` block is a bare `:root` inside `@media`, so an explicit
attribute (0-2-0) outranks it on specificity rather than on order: the OS
preference is a fallback, never an override.

## `only: 'core'` — drop the component spacing

104 of the 197 variables are `--vx-space-*`, and 95 of those are named for a
basalt React component: `--vx-space-agent-transcript-inset`,
`--vx-space-toc-sub-indent`, `--vx-space-sidebar-child-row-indent`. Outside this
framework they are dead weight.

`--only core` keeps the 9 generic anchors — the `stack-xs`…`stack-xl` rhythm,
`control-height`, `input-height`, `row-inset-x`, `row-inset-y` — and takes the
emitted set from 197 variables to 102. It is a spacing filter only: color,
radius, shadow, type and status are identical in both modes.

## Opacity is `color-mix`, never `rgba()`

```css
/* wrong — freezes one scheme's hex */
border-color: rgba(228, 228, 231, 0.65);

/* right — the underlying token still resolves per scheme */
border-color: color-mix(in srgb, var(--vx-neutral) 65%, transparent);
```

Every `--vx-*` color is a variable that changes value across schemes. Writing
`rgba()` means reading one scheme's hex, baking it in, and losing the other. From
JS the `alpha(token, a)` helper does exactly the `color-mix` above:

```ts
import { alpha, VX } from 'basalt-ui/tokens'

alpha(VX.neutral, 0.65) // 'color-mix(in srgb, var(--vx-neutral) 65%, transparent)'
```

## Three line tokens, three roles

The most reliable way to get basalt's surfaces wrong is to map a single
`--hairline` variable onto the token whose name matches:

| Token | Role |
|-|-|
| `--vx-surface-border` | Structural border between regions — sidebar edge, header rule, a floating surface's real 1px edge. |
| `--vx-divider` | Soft rule *inside* a surface — rows in a list, sections in a card. |
| `--vx-surface-hairline` | The card ring baked into `--vx-shadow-card`. Never reference it directly. |

A single-hairline consumer maps it to **`--vx-divider`**. Reaching for
`--vx-surface-hairline` on the strength of the name gives you a line tuned to sit
*inside* a shadow: `#eaeaee` on the light page, which all but vanishes against
`#f2f2f5`. If you also apply `--vx-shadow-card`, you get that ring twice.

## Elevation is a shadow with the ring inside it

Depth in basalt is one whisper shadow that carries its own 1px ring — never a
`border` property alongside a `box-shadow`:

```css
--vx-shadow-card:
  /* light */ 0 1px 2px rgba(28, 25, 23, 0.05), 0 0 0 1px var(--vx-surface-hairline);
  /* dark  */ 0 1px 3px rgba(0, 0, 0, 0.4), inset 0 0 0 1px color-mix(in srgb, #ffffff 4%, transparent);
```

Light draws the ring outset in a hairline gray; dark flips it to `inset` and
draws it in 4% white. That is why the two schemes cannot share one expression —
on a dark page an outset gray ring reads as a seam, and the lift has to come from
a hint of light along the top edge instead. Use `var(--vx-shadow-card)` and let
the variable resolve; the floating tier (`--vx-shadow-overlay`) deliberately
carries no ring, because a popover needs a real `--vx-surface-border` for its
arrow to inherit an edge.

## What you don't get

- **Accent retuning.** `deriveRadius` and `deriveSpacing` are public, but the
  color derivation runs through `createBasaltTheme`, which is React and Mantine.
  A framework-free consumer takes the shipped palette as given. Tracked in
  `docs/STATUS.md`.
- **Prose styling.** `basalt-ui/content` is CSS-modules-scoped and reachable only
  through its React components. There is no plain-class `content.css` yet.
- **Component behavior.** Tokens are values. The shell, charts, forms and the
  agent layer are React.
