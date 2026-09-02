# Basalt UI — Design Spec (2026-07 overhaul)

Canonical distillation of the Claude Design handoff ("Dashboard redesign for modern aesthetics").
This file is the single source of truth for the visual system. Where this spec contradicts older
doctrine comments in the codebase, **this spec wins** (see "Doctrine inversions" at the bottom).

Values are exact — taken from the handoff prototype's token block. `color-mix()` expressions may
be kept as-is in emitted CSS or precomputed to the hex given in parentheses; the resolved color
must match.

> **Post-derive-engine note.** The hexes below were this spec's hand-tuned calibration TARGET. The
> shipped defaults are now COMPUTED by `tokens/derive.ts` from one seed + five bounded knobs (see
> `docs/STATUS.md`'s "Derive engine" section) and approximate this table rather than reproduce it
> byte-for-byte — the generator's actual output at `DEFAULT_DERIVE_CONFIG` is the new ground truth
> (e.g. `accentFill` is `#4374a6`, page `bg` is `#f2f2f5`/`#27272a`), not the literals below. Never
> hand-edit a color hex in `palette.ts` or here to "fix" a drift — retune `DEFAULT_DERIVE_CONFIG` or
> the calibrated constants in `derive.ts` instead; a handful of small gaps (e.g. `accentHover`'s
> dark-mode hue, ΔE≈5.9 off this table) are tracked as known limitations, not bugs.

## 1. Identity

Modern zinc. Cool-neutral zinc surfaces (Tailwind zinc family), low-contrast panel lift on a
slightly darker page, depth via a whisper shadow + 1px ring ("card shadow"), one saturated sky-blue
accent, and a three-font typographic system (Nunito Sans body / Hubot Sans condensed headings /
JetBrains Mono for everything numeric or micro-labeled). Chrome stays quiet; data and headings
carry the character.

## 2. Color tokens

| Token                                                                                 | Light                                                | Dark                                                 |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| bg (page)                                                                             | `color-mix(in srgb, #f4f4f5 50%, #e4e4e7)` (#ececee) | `color-mix(in srgb, #27272a 70%, #18181b)` (#232326) |
| panel (cards, controls)                                                               | `#f4f4f5`                                            | `#27272a`                                            |
| panel-hover                                                                           | `#fafafa`                                            | `color-mix(in srgb, #3f3f46 50%, #27272a)` (#333338) |
| line (strong border)                                                                  | `color-mix(in srgb, #e4e4e7 50%, #d4d4d8)` (#dcdce0) | `#3f3f46`                                            |
| hairline (card ring)                                                                  | `#e5e5e5`                                            | `color-mix(in srgb, #52525c 50%, #3f3f46)` (#494951) |
| divider (the seam / between-rows line)                                                | `rgba(<derived ink>, 0.09)`                          | `rgba(255, 255, 255, 0.08)`                          |
| ink (primary text)                                                                    | `#262626`                                            | `#e5e5e5`                                            |
| ink-2 (emphasis body)                                                                 | `#404040`                                            | `color-mix(in srgb, #e5e5e5 50%, #d4d4d4)` (#dddddd) |
| muted (secondary text)                                                                | `#525252`                                            | `#d4d4d4`                                            |
| faint (tertiary/labels)                                                               | `#737373`                                            | `#a1a1a1`                                            |
| accent — INK (links, active-nav icon, chart lines, focus ring; read against the page) | `#0077bd`                                            | `#8ec5ff`                                            |
| accent-hover (ink)                                                                    | `#0069a8`                                            | `#51a2ff`                                            |
| accent-fill — SURFACE (filled button/switch/checkbox/bullet; carries a label)         | `#0077bd`                                            | `#0077bd`                                            |
| accent-fill-hover                                                                     | `#0069a8`                                            | `#0069a8`                                            |
| on-accent (text on an accent fill)                                                    | `#ffffff`                                            | `#ffffff`                                            |
| status-success                                                                        | `#2f7a4f`                                            | `#56c07a`                                            |
| status-warning                                                                        | `#b5750f`                                            | `#e0a83a`                                            |
| status-danger (derived, same tonality)                                                | `#b53f3f`                                            | `#e0685f`                                            |

**Divider is a relative alpha over the derived ink (light) / white (dark), not a fixed hex** — the
same law `NEUTRAL.grid` uses, so it survives every derive knob and neutral seed instead of flipping
polarity on a dark page (`tokens/palette.ts`'s `SURFACE.divider`, `divider-contrast.test.ts` pins the
floor).

**The accent has two roles, and they are different colors.** As **ink** it is read against the page,
so it inverts across schemes (light on dark, deep on light). As a **surface** it carries a label, so
it is squeezed from both sides at once — white text needs to clear a floor against the fill, and the
control needs ≥3:1 against the page behind it. On the dark page those two constraints leave one
narrow window, so the fill is the _same_ hex in both schemes and its label is white in both.
Darkening the fill further (`#0069a8`, `#04669b`) buys text contrast but drops the button below the
page floor — it fades into the background. Never fill with the ink token.

**THE FILL BAND — this generalizes to every family, and is now a derivation LAW, not a hand-picked
hex.** `tokens/derive.ts` places every filled surface's relative luminance at exactly **Y=0.165**
(`FILL_LUMINANCE`) — hue varies, luminance does not — and picks the label (`onAccent`) by measuring
contrast: white wins whenever it clears a **3.0:1** floor against the fill (`ON_ACCENT_WHITE_CONTRAST_MIN`
— the WCAG 1.4.11 UI-component/large-text level; the originally-targeted 4.5:1 proved too strict, since
it flipped several fills to a dark-ink label even though white still read fine there), a near-black
ink otherwise. The 12 categorical fills' saturation is additionally scaled by the `vibrancy` knob,
centered at **×0.72** of calibrated chroma (`VIBRANCY_CENTER_CHROMA_MULT`) — one step above the
original muted ×0.6 center — so the shipped hexes are this law's OUTPUT at the default knobs, not
independent hand picks (see the post-derive-engine note above: the table below is the calibration
target the law approximates, not necessarily byte-identical to the generator's live output).
Untuned, five families sat below the 3:1 page floor (grape 2.17:1) and three needed black labels;
the law fixes all twelve at once.

| Family         | Fill (both schemes) |     | Family | Fill (both schemes) |
| -------------- | ------------------- | --- | ------ | ------------------- |
| blue (accent)  | `#0077bd`           |     | teal   | `#007f75`           |
| gray           | `#707078`           |     | green  | `#1f8228`           |
| red            | `#cc3c41`           |     | lime   | `#617a1a`           |
| pink           | `#d22b6a`           |     | yellow | `#936a05`           |
| grape / violet | `#ad47ad`           |     | orange | `#a56113`           |
| indigo         | `#745cda`           |     | cyan   | `#1378aa`           |

Hover is derived in CSS (`88%` of the fill over black), so retuning a fill carries its hover along.
`dark` is not a band member — `color="dark"` is a deliberately near-black surface. Mantine's
`--mantine-color-{family}-filled` is **bridged** onto these tokens, so the chrome is single-sourced
with the charts and the theme lab retunes it live. All of it is enforced by `theme/contrast.test.ts`.

Shadows (tokens, not ad hoc):

| Token         | Light                                                 | Dark                                                                                      |
| ------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| shadow-card   | `0 1px 2px rgba(28,25,23,0.05), 0 0 0 1px <hairline>` | `0 1px 3px rgba(0,0,0,0.4), inset 0 0 0 1px color-mix(in srgb, #ffffff 4%, transparent)`  |
| shadow-ctrl   | `0 1px 2px rgba(28,25,23,0.12)`                       | `0 1px 2px rgba(0,0,0,0.35)`                                                              |
| shadow-raised | `0 1px 2px rgba(28,25,23,0.10)`                       | `0 1px 2px rgba(0,0,0,0.35), inset 0 0 0 1px color-mix(in srgb, #ffffff 8%, transparent)` |

`shadow-raised` is the depth for every INTERACTIVE CONTROL — buttons, action icons, inputs, the
search trigger, chips, selection cards, the composer — and the only one whose ring is **inset**.
The dividing line is control-vs-panel, not component-by-component: anything you click or type into
takes `shadow-raised`; anything that is a surface holding content (Card, Paper, Notification,
ChartCard, SettingsSection) keeps `shadow-card`. Detached FLOATING surfaces are a third tier and
keep `shadow-overlay` — Tooltip, Popover, Menu, Combobox, Modal and Drawer all resolve it in
`theme/index.ts`; they sit above the page rather than on it. Two controls that sit beside each
other — a `size="md"` Input and a `size="md"` Button, pinned to the same height by
`--vx-space-control-height`; the sidebar's search trigger and any adjacent icon button — must never
end up on different tokens; that split is exactly what this token was introduced to close. That is what lets one value cover a saturated fill, a 13% tint and a neutral panel alike:
an outset ring paints in the color of whatever it is drawn over, so `shadow-card`'s pale hairline
would read as a grey outline around a colored button, while an inset edge is drawn over the
control's own background. Its edge is a pure luminance shift — darkening on light, lightening on
dark — never a hue, so it never tints the fill it rides on.

**The two schemes are shaped differently, deliberately — don't tidy them into one.** Dark is drop +
a full inset rim: its edge is a _lightening_, so it can't collide with the dark drop below, and a
uniform lightening on a dark surface reads as rim light wrapping a raised object. Light is **drop
only, no edge**. A light-mode edge would have to be a _darkening_, and every position for one fails:
uniform reads as a **border** (it made `default` and `light` look like outlined buttons and every
form field look boxed), and bottom-only puts a dark inner line directly above the dark drop — a
visible **double bottom border**. There is no third position, because a light-mode raised object's
only honest cue is the shadow it casts. Both shapes were tried on screen and rejected.

The cost, light only: a `default` control nested in a Card (both `--vx-surface-panel`) has no
boundary but the drop. Accepted — a wrong-looking border on every control beats a soft edge in one
nesting case. If it ever needs more, raise the **drop**; do not reintroduce an edge.

Tint idiom — interactive neutral fills are **ink mixes**, never grey hexes:

- ghost hover: `color-mix(in srgb, <ink> 6%, transparent)`
- segmented-control track / count-badge bg: ink 6–8%
- progress track: ink 8%
- avatar/initials block: ink 10%
- info dot bg: ink 7%
- status tint bg (delta badges): `color-mix(in srgb, <status> 13%, transparent)` with the status
  color itself as text.

## 3. Typography

| Role | Font                        | Usage                                                                                           |
| ---- | --------------------------- | ----------------------------------------------------------------------------------------------- |
| body | `'Nunito Sans Variable'`    | all UI copy; the `md` step (15px) is the default density                                        |
| head | `'Hubot Sans Variable'`     | headings, brand, card titles, breadcrumb current page — always `font-stretch: 88%`, weight ~550 |
| mono | `'JetBrains Mono Variable'` | ALL numerals/data, micro-labels, kbd/badges, axis ticks                                         |

Loaded via exact-pinned `@fontsource-variable/*` deps, `@import`ed in `styles.css`; the
`--basalt-font-{sans,head,mono}` CSS vars stay the override seam (system-font fallback chains
preserved).

### The type scale (the ONE ladder)

Type is a token axis, exactly like color / spacing / radius / motion: **there are no font-size
literals at call sites.** The ladder is defined once, in `src/tokens/index.ts`, and reaches code in
two derived forms that cannot drift — `VX.text.*` (px numbers, for inline styles and visx SVG
props, which can't resolve `var()`) and `--vx-text-*` (CSS vars, for CSS modules and the Mantine
theme). The Mantine theme re-expresses xs–xl through Mantine's `rem()`, so the component surface
also honors the user's browser font-size and `--mantine-scale`.

| Step      | Size   | Used for                                                                                                               |
| --------- | ------ | ---------------------------------------------------------------------------------------------------------------------- |
| `nano`    | 10px   | a label engraved INSIDE a drawn object — a plate face, a dial, a chip. Never UI copy or prose (1.21.0)                 |
| `micro`   | 11px   | mono uppercase micro-labels — sidebar/section headers, table headers, axis ticks                                       |
| `xs`      | 12.5px | delta badges, tooltip meta, dense chrome, **StatCard labels** (density pass moved these 11px → 12.5px)                 |
| `sm`      | 13.5px | stat/table numerals, chart tooltip, chart legend                                                                       |
| `md`      | 15px   | **body** — nav rows, menu items, timeline, labels, prose; **chart card titles** (density pass moved these 16px → 15px) |
| `lg`      | 16px   | breadcrumb current page — **also the iOS input floor**                                                                 |
| `xl`      | 18px   | section titles, brand                                                                                                  |
| `h2`      | 21px   | article-density Prose h2 (`docs/CONTENT-SPEC.md` §5)                                                                   |
| `kpi`     | 24px   | the StatCard hero numeral (weight 600, letter-spacing −0.02em; density pass 31 → 24)                                   |
| `h1`      | 26px   | article-density Prose h1 (`docs/CONTENT-SPEC.md` §5)                                                                   |
| `display` | 30px   | a numeral read at arm's length — a keypad readout, a timer, a kiosk figure. Not a heading (1.21.0)                     |

**Every adjacent pair sits between 1.06× and 1.17×, and a new rung must too** — hand-tuned per role,
but not arbitrary, and `tokens/text-scale.test.ts` holds the ladder to it. Below that band two rungs
are visually the same size and the guard reports a value for which two tokens are equally right;
above it the jump reads as a different type system. That test is what admitted `nano` (11/10 = 1.10)
and `display` (30/26 = 1.154) and what **rejected** a 20px rung between `xl` and `h2`: 21/20 = 1.05
is below the floor, and `h2` is already 1px away. A size the ladder declines to grow a rung for
should snap to its nearest step, not reach for a `theme-allow` — with one standing, pre-existing
exception: §5's numeric segment labels (1D/7D/30D) at 11.5px, between `micro` (11) and `xs` (12.5),
which predates this ladder-gap rule and ships behind its own `theme-allow` rather than snapping.
It is not a precedent for new gaps. Both new rungs are named for a ROLE, not a
position, because a bare `xxs`/`xxl` becomes the escape hatch for every size the ladder exists to
prevent.

Weights and fonts stay as above: card titles and section titles take the head font at 88% stretch,
weight ~550; every numeral and micro-label takes mono.

An optical ratio is not a scale step — a glyph sized _relative_ to its own label (the delta badge's
▲/▼, inline `<code>`) uses an `em` value so it tracks whatever step its parent lands on.

### iOS input floor (non-negotiable)

**Inputs never compute below 16px.** Safari zooms the viewport whenever a focused input is under
16px and never zooms back out on blur. This is enforced as a CSS _floor_ in `styles.css` —
`font-size: max(16px, var(--input-fz, 1rem))` — not as per-component `defaultProps`, so it reaches
every Mantine input (Autocomplete, MultiSelect, TagsInput, PinInput, …) and survives a consumer
passing `size="xs"`. Inputs keep `size: 'md'` for _geometry_ (42px height); only the font-size is
floored, so a 16px font sits in a normally-proportioned control.

The floor lives in `@layer basalt`, which means **the consumer must import
`@mantine/core/styles.layer.css`, never the plain `@mantine/core/styles.css`.** Mantine's default
bundle is entirely unlayered, and unlayered author styles outrank every layered rule regardless of
specificity — with the plain bundle the floor (and the rest of `@layer basalt`) silently loses.

16px is the only clean fix: `maximum-scale=1` / `user-scalable=no` block pinch-zoom on Android
(WCAG 1.4.4), `text-size-adjust` governs text _inflation_ rather than focus-zoom, and Safari does
not support `interactive-widget`.

The floor is `!important` — the one deliberate use of it in the framework. An inline `style`
attribute outranks every stylesheet rule, so without it a consumer's `style={{ fontSize: 13 }}` on
a raw `<input>` silently re-opens the zoom bug. Two `check-theme` guard kinds back this at build
time: `raw-form-control` flags any raw `<input>`/`<select>`/`<textarea>` (which also bypasses the
rest of the theme entirely), and `sub-16-input-font` flags a sub-16 `fontSize` on a form control as
dead code against the `!important` floor.

## 4. Radii & shape

| Surface                                                                 | Radius                                                                                                  |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| cards / panels                                                          | **7px** (`--vx-radius-card`; the 2026-07 density pass moves 10px → 7px for a sharper, data-driven edge) |
| controls (inputs, search, buttons, segmented track, icon buttons ≥28px) | **6px** (`radius.md` = 0.375rem, mirrored by `--vx-radius-ctrl`; density pass moves 8px → 6px)          |
| segmented active thumb, small ghost buttons, kbd badges, nav rows       | 5–6px                                                                                                   |
| progress bars                                                           | 4px (6px height)                                                                                        |
| avatar block                                                            | 7px                                                                                                     |
| chart bar tops                                                          | rx ≈ 1.4                                                                                                |

## 5. Component idioms

- **Control-tier height ladder** (`docs/CONTROLS-SPEC.md` §5): four density-tracking rungs below
  the forms-only `controlHeight` (`size="md"`, 42px, unchanged) — `controlHeightTag` 20px (inline
  chip / table-cell count tag), `controlHeightWidget` 24px (`size="icon"` ActionIcon,
  `WidgetHeader tier="widget"` actions), `controlHeightCtl` 30px (`size="ctl"` — `PageBar`,
  `Section`, table toolbar, sidebar blocks), and `touchControlHeight` 36px (the mobile hit-area
  floor below `sm`, C15 — not a visible box). Every rung floors independently under the density
  knob (18/22/28/30 at level −3) rather than collapsing toward the others. A raw control dropped
  into a home slot (`PageBar.actions`, `Section.actions`, …) with no `size` prop renders `ctl` —
  see `CtlSlot`/`CTL_THEME` (`theme/ctl-theme.tsx`).
- **The ring lives IN the shadow — apply it to the box that carries the surface's `border-radius`.**
  `shadow-card`/`shadow-raised` bakes a 1px ring into the shadow value itself; the ring follows the
  shadowed box's OWN corners, so it only renders correctly there — never on a bare layout wrapper
  whose radius doesn't match the rounded surface it wraps. Background usually sits on the same box
  too, but it's the radius the ring is bound to, not the background (a shadowed box with a separate,
  identically-rounded background box, like `ChartCard`, is legal). Mechanically enforced by
  `src/theme/shadow-surfaces.test.ts`.
- **Card**: panel bg + `shadow-card` (ring lives IN the shadow — no `border` property), radius
  7px, padding `xs`/`sm` (11px/13px). Cards lift subtly off a slightly darker page.
- **Button / ActionIcon**: **depth says "this is a control surface"; it is not the emphasis axis.**
  Emphasis is carried entirely by fill weight (`filled` > `light`/`outline` > `subtle`) — the same
  way Material 3, Radix and Primer rank their variants, none of which rank by z-height. So every
  variant that owns a box carries the **same** resting depth — one value, `shadow-raised`, not a
  tier list:
  - `default` / `filled` / `light` → `shadow-raised`, unmodified. The sharedness is the point. These
    were briefly split (`default` on `shadow-card`, the rest on `shadow-ctrl`) and `default` read a
    visible step more three-dimensional, because it was the only one with a **defined edge** — a
    soft drop alone reads as "something is under this", a crisp boundary is what reads as an object.
    One value fixed it from both sides: `default` came down (no 3px/0.4 dark blur, no outset ring),
    `filled`/`light` came up (they gained an edge at all).
  - The edge being **inset** is what makes one value possible across a fill, a tint and a panel —
    see §2. It also keeps `default` legible inside a Card, where button and card share
    `--vx-surface-panel` and that edge is the only thing separating them.
  - `outline` → `shadow-ctrl`, ring-free. Its real 1px accent border already is its edge, and an
    inset ring tucked just inside a border is muddy. Same token, same reason, as the segmented
    control's active segment.
  - `subtle` → **flat in both states**. It is a text affordance, not an object; its hover is a
    background tint and nothing more — and that tint is the **neutral ink-6%** of the ghost idiom
    below, not Mantine's saturated accent tint, which made a hovered subtle Button read as a filled
    control appearing under the cursor. Resolved in `basaltVariantColorResolver` so Button and
    ActionIcon agree; an explicitly-colored subtle control (`color="red"`) keeps its own hue, since
    there the colour is the whole signal. Giving it `shadow-raised` on hover was tried and reverted —
    that token's inset rim made a hovered ghost button read as an `outline` button. If depth is ever
    wanted there, use ring-free `shadow-ctrl`: the drop reads as lift, the rim read as wrong.
    Button's `subtle` and the ghost icon button below now behave identically.

  **Depth is static — no variant moves or changes depth on hover or press, without exception.**
  Everything raised already gets hover feedback from its background change, so anything layered on
  top restates a signal that is already there. Two additions were tried and both reverted: a 1px
  hover lift (a `transform` also shifts anchored Tooltips/Popovers, since Floating UI measures a
  transformed rect) and `subtle` gaining depth on hover. Don't reintroduce either.

  Disabled is flat and grounded — a raised control reads as pressable. Reduced motion drops the
  transition, never the resting depth (a static shadow is not motion).

  Do **not** "fix" a flat-looking button row by flattening `default` to match. That inverts nothing
  and breaks something: doctrine inversion #1 already raised Card/Paper/Input/Chip/CheckboxCard, so
  a flat Button becomes the only flat control in the row — most visibly next to a `size="md"`
  TextInput, pinned to the identical height by `--vx-space-control-height`.

- **Main is the scrollport, and it is the only scrolling box.** `AppShell.Main` turns Mantine's
  region PADDING offsets into margins (`app-main.module.css`), so the document does not scroll and
  the scrollbar sits on the content's own right edge — between Main and the aside, not at the far
  edge of the window past both regions. It is in normal flow (never `position: fixed`), carries
  `data-basalt-scrollport` and TanStack Router's `data-scroll-restoration-id`, and its `overflow-x`
  is `auto` rather than `hidden`: hiding a sideways overflow makes it invisible, not absent, and the
  phone guard (`tests/layout/no-horizontal-overflow.layout.test.ts`) reads exactly that box.
- **The page-bar band is a REGION, not a row in the page.** The AppShell root is a column flex whose
  only in-flow children are the band and Main (every other region is `position: fixed`), so the band
  takes the height it needs and Main takes the rest — no measurement, no `--basalt-page-bar-h`
  arithmetic. `PageBar` row 2 portals into it, exactly as row 1 portals into the header. It spans
  Main's width (navbar\|aside offsets), draws the single `--vx-divider` seam under itself, and is a
  zero-height, seam-less box on a route with no `PageBar` (law C14, `.band:not(:empty)`). Because it
  is outside the scrollport, nothing inside Main has any chrome to clear: a sticky table head, a
  `.tocRail` and an `#anchor` all resolve against Main's own top edge.
- **Sidebar**: transparent (page bg, no panel); no internal rules; its trailing edge is the shell's
  region seam (below). It starts directly with `SidebarSearch` — **the brand row moved into the
  header** (below): under a full-width header an `appShellHeaderHeight` brand band here painted as a
  second 48px row beneath the header seam. Section headers are micro-labels. Active item = **accent-12% tint** (NO panel fill,
  NO shadow — a selected row, not a raised control) + **accent-colored icon** + weight 600 ink
  text, hovering to accent-16%; inactive = muted text, faint icon; hover = ink-5% tint. `data-active`
  is the only style hook (`aria-current` stays on the DOM for a11y, not a CSS selector) — it was an
  ink-9%/ink-6% pairing until the two tints read as the same row highlight under a pointer, which is
  why active moved to the accent family entirely. Child items indent with a 1px `divider` left
  border; active child = the same accent-12%/16% fill plus accent text, weight 600. Count badges:
  mono micro (11px), ink-8% bg, radius 5. Footer: initials block (ink-10%, radius 7, mono) + name
  (15px semibold) + mono micro (11px) uppercase faint meta line.
- **Header**: transparent; its bottom edge is the region seam, and it spans the FULL viewport width
  — Mantine's default `AppShell` layout, not `alt`. The header sits above the sidebar and the aside,
  both of which start under it at `--app-shell-header-offset`; the body scrolls under it, so the
  surfaces are not continuous. Inset `sm`, the
  same as `AppShell padding`, so the breadcrumb's left edge and the global actions' right edge sit
  on the card column's edges. Its row is `[brand ⌄ | collapse] [breadcrumb] ··· [page bar row 1] |
[global actions]`: the **leading zone** (`app-brand.tsx`) is exactly `--app-shell-navbar-offset`
  wide, so it tracks the rail collapse with no React state, its trailing edge lands on the
  sidebar\|main seam, and the breadcrumb after it starts on Main's own content edge. Collapsed, the
  zone narrows to the rail and shows the toggle alone, centred on the rail's icon column. Below `sm`
  there is no navbar to align with and the zone is absent — the breadcrumb owns the phone lead. Breadcrumb 13.5px: parents faint, separator
  line-colored, current page in head font ~14.5px/550. The search trigger moved to the sidebar
  (`SidebarSearch`, below the brand) — it is not header chrome. The header's own right side is the
  page-actions slot and the global-actions slot; any control dropped there (icon button, segmented
  range) shares the header's depth tokens (`shadow-raised` for the control, never `shadow-card`).
- **Region seams** (2026-08-30): every `AppShell` region ends in a 1px `--vx-divider` line on its
  Main-facing edge — header\|body (the FULL viewport width, so it owns the top corners and both the
  sidebar and the aside seams start under it), sidebar\|main (from the header seam down),
  main\|aside (same, absent when unclaimed), main\|mobile-nav (< sm), plus the page-bar band's own
  bottom seam (`app-main.module.css`, painted only when a `PageBar` claims the band). Mantine draws all four through its own
  `[data-with-border]` rules; the colour is ONE theme var,
  `AppShell.extend({ vars: () => ({ root: { '--app-shell-border-color': 'var(--vx-divider)' } }) })`.
  No shell module declares a region edge, no section ever takes `withBorder`, **except the aside
  itself** — `AppShell.Aside` takes `withBorder={aside.claimed}` (`shell/index.tsx`), because a
  collapsed aside is zero-wide and must not draw the seam it has no content to bound; the claim
  gates the border the same way it gates the width. A consumer never sets either. Chrome INSIDE a
  region stays line-free: sidebar brand/sections/footer, card and section headers — the one
  exception is the aside's own header, which carries `border-bottom: 1px solid --vx-divider`
  (`shell/page-aside.module.css`) so its seam closes across the aside the same way the header and
  sidebar-brand bands do, even though the aside's `AppShell.Aside` box itself stays line-free above
  that header. The header's own height tracks `--basalt-page-bar-h` (the shell's page-bar band,
  `PageBar` row 2) first and falls back to the ordinary 48px `appShellHeaderHeight` band only where
  there is no `PageBar` claiming one — so the two seams read as ONE line rather than two, whichever
  height the band actually renders at (2026-09-02). Between-rows rules (aside groups, panel rows, settings rows)
  keep `--vx-divider` and drop their last line. `--vx-divider` is the only layout-line token — a
  relative ink-alpha on light and white-alpha on dark, so the seam holds ≥1.15:1 over page and panel
  under every derive knob and neutral seed (test-pinned). `--vx-surface-hairline` is the card ring
  only; `--vx-surface-border` is the control/overlay line and the chart axis, never a seam. The
  three top bands — sidebar brand row, header, aside header — are one `appShellHeaderHeight` band,
  each carrying one 550-weight head-font name (brand, current crumb, aside title), so their
  centrelines meet across the seams; header and cards share the `sm` inset. Sticky page-bar row 2
  carries no line at rest; whether it gets one is decided from screenshots, not doctrine — if it
  lands it is inset to the content column, `--vx-divider`, and ledgered in `divider-law.test.ts` as
  `region-boundary`, never a JS stuck-state.
- **Mobile bottom bar / More sheet** (2026-09-02): the bottom-sheet ("More") rows share ONE row
  vocabulary with the desktop sidebar's `.link` instead of a bespoke touch geometry — the theme's
  `NavLink.extend` already forces `--vx-space-row-inset-y`/`-x` padding, `VX.text.md` font-size and
  `--vx-space-row-line-height` line-height on every NavLink root, so the sheet's own CSS module adds
  only what the theme does not: a touch-target `min-height` floor
  (`--vx-space-mobile-nav-row-height`, 40px — WCAG 2.5.5 AA, not the AAA 44pt figure the bar's own
  `mobileNavBarHeight` still holds to). Nested (child) rows carry the sidebar's own child indent — a
  1px `--vx-divider` left guide plus `--vx-space-sidebar-child-list-indent`/
  `--vx-space-sidebar-child-row-indent` — drawn per row rather than on a wrapper, since the flat
  sheet has none of the sidebar's `.childList` grouping. Row-to-row gap is 1 (the sidebar's own nav
  Stack gap), section-label-to-rows gap and between-group gap reuse
  `--vx-space-sidebar-section-label-gap`/`--vx-space-sidebar-section-gap`. The sheet's
  `ScrollArea.Autosize` reserves its own scrollbar gutter (`offsetScrollbars="present"`) instead of
  floating the overlay bar over the rows' trailing edge.
- **Segmented control**: track = ink-6% tint, radius 7, 2px padding, 2px gap; active segment =
  panel bg + `shadow-ctrl`, radius 5, ink text weight 600; inactive = muted, transparent. Numeric
  segment labels (1D/7D/30D) are mono `VX.text.xs` (12.5px) via a bare `data-numeric` attribute on
  the control (`docs/CONTROLS-SPEC.md` §3, C7 — retires the per-consumer `theme-allow` inline-style
  hack); word labels are sans 12px.
- **Ghost icon button**: transparent, faint icon, hover ink-6% + ink icon, radius 6. Flat at rest
  AND on hover. Button's `subtle` behaves identically — neither takes depth in either state.
- **Delta/status badge**: mono 12.5px weight 600, status-color text on status-13% tint, radius 6,
  2px 7px padding, optional ▲/▼ glyph at 9px, optional comparison-period suffix (`MoM`/`WoW`/`YTD`)
  in a dimmer shade of the same tone directly after the value. Tone is polarity-resolved, not
  sign-resolved: `'up-good'` (default) / `'up-bad'` / `'neutral'`, the prop spelled `polarity` on
  `DeltaBadge` itself and `deltaPolarity` on the three composers that forward it —
  `WidgetHeader`, `StatCard`, `ChartCard`; the ▲/▼ glyph is direction and never changes with
  polarity; zero is always faint.
- **Stat card**: card-radius panel, spacing xs/sm inset, mono xs uppercase label + mono ~24px hero
  numeral + delta badge; optional sparkline runs full-bleed to the card's L/R/bottom edges (card
  clips to the corner radius; the shadow ring is unaffected).
- **Threshold rail** (the stat card's `tone`): a 3px full-height bar overlaying the card's leading
  edge in `--vx-status-{good,warn,bad}`, plus a `VisuallyHidden` verdict string — colour never
  carries a threshold alone. Three values, and the fourth state is the absence of the prop: **no
  tone means "fine, or nothing measured", and is never tinted.** `good` is therefore an assertion a
  consumer opts into for a value that earned it (`0 min` downtime over the window), not what a card
  falls back to — a card with no reading must not be able to render green by omission. The rail is
  the largest mark available without touching the numeral's own colour: it overlays the edge rather
  than adding to it, so layout is identical with and without it, and it stays a rail — tinting the
  card body would make a routine dashboard a traffic-light board. Contrast against
  `--vx-surface-panel` is measured in both schemes (`theme/contrast.test.ts`), not eyeballed, since
  the status solids are derived.
- **Settings section**: card-radius panel + shadow-card, spacing xs/sm inset, head-font 15px title
  - 13px muted description, rows split by a 1px `--vx-divider` rule; the `DangerZone` variant adds
    a mono danger eyebrow + a danger-tinted ring layered over the shadow.
- **Alert**: Mantine `Alert` on the card tint idiom — title in head font (88% stretch, ~550);
  color tint comes from the variant color resolver; control-tier radius.
- **Progress/meter row**: 13px label (ink-2) + mono 12px faint value; 6px track (ink-8%, radius
  4); leader fill = accent, others = faint at 80/55/40% mix.
- **Stat list row**: 13px muted label / mono 12.5px weight 500 ink value, ~9px vertical padding.
- **Charts**: horizontal grid = hairline only (no vertical grid), baseline axis = line color;
  ticks mono 10.5px faint; primary series = accent, secondary = faint, tertiary/line overlay =
  status-warning at 1.9px stroke; bar pairs 6.4px wide, rx 1.4; legend centered below — 11px
  radius-3 square swatches (16×3px radius-2 pill for line series), 13.5px muted labels, 22px gap.
- **Sparklines**: single 1.6px faint line, no fill, no axes.
- **Tooltip/popover/menu**: panel bg + `shadow-overlay` (the detached floating tier, a step above
  `shadow-card` — see §2), radius 7–8px (cards 7px; floating surfaces 8px).
  The chart info-tooltip (`ChartCard`'s `i`) is a Mantine-free hover/focus/tap bubble in the same
  idiom; it dismisses on Escape, blur, or an outside click. Its trigger lives in the card header,
  which sits OUTSIDE the chart body's clip box, so the bubble can overhang the card edge and is never
  clipped.
- **Scrollbars**: 9px, radius 6, transparent track; thumb = `--vx-ink` at 25% (40% on hover), via the
  `--basalt-scrollbar-thumb{,-hover}` pair. ONE treatment drives both the native page bar and
  Mantine's ScrollArea overlay bar, so a page and a sidebar never read as two scrollbar languages —
  Mantine's own thumb (hardcoded `rgba(0,0,0,.4)`) and its gray-0 track hover are both overridden in
  `styles.css`. The thumb is an ink %-mix, NOT `--vx-surface-hairline`: hairline is the card-ring
  token (`#e5e5e5`), which scores 1.07:1 on the light page — invisible. Ink inverts across schemes,
  so one expression stays visible on both. A scroll region
  in app chrome is a Mantine `ScrollArea` (`type="hover"`, `scrollbarSize={9}`), never a raw
  `overflow: auto` box — its bar floats over the content instead of reserving gutter width and
  reflowing the column. Exactly ONE bar shows: `styles.css` re-hides the native bar on
  `.mantine-ScrollArea-viewport`, which the global `*::-webkit-scrollbar` theming would otherwise
  re-expose on top of Mantine's overlay. `AppSidebar`'s nav is the reference pattern; raw
  `overflow: auto` stays correct only where a library owns the scroll node (`BasaltStickToBottom`,
  `BasaltVirtualList`). `basalt/raw-scroll-container` steers this at **warning** level (vertical axis
  only) with the usual `theme-allow` escape — a warning, not an error, because whether a raw scroll
  box is wrong depends on who owns the scroll node, which no AST check can see.

## 6. Accent discipline (updated)

The accent is the saturated sky blue above — no longer the muted slate. It appears on: the primary
data series, active-nav **icons** and active **child** labels, links, primary buttons, focus
rings, and the leader bar in meters. Chrome (borders, inactive states, backgrounds, general
icons) stays zinc-neutral. Status colors stay reserved for status. One accent, used with intent —
the discipline is unchanged even though the hue is louder.

## 7. Package integration requirements

- All values above land in the `--vx-*` token layer (tier 1 palette data → tier 2 CSS vars →
  tier 3 `VX.*` refs); Mantine binds to them via `cssVariablesResolver`. No raw hex at component
  call sites — `basalt check-theme` must stay green.
- New tokens required: ink/ink-2/muted/faint text ramp, accent/accent-hover/on-accent,
  shadow-card/shadow-ctrl, panel-hover, divider, status-danger, radius updates. Keep existing
  `--vx-*` names stable where semantics match (bg/panel/border/…): retune values, don't rename.
- Fonts ship as exact-pinned `@fontsource-variable/*` dependencies of `basalt-ui`, imported at
  the top of `styles.css` (bare `@import` specifiers — consumer bundlers resolve them).
- Mantine-free boundary unchanged: `src/charts/**` and `src/tokens/**` never import `@mantine/*`.
- The Mantine theme must make a consumer app look like this spec **by default** — zero call-site
  work: Card/Paper, Button, ActionIcon, CheckboxCard, RadioCard, Chip, PillsInput, NavLink,
  SegmentedControl, Badge, Progress, Table, Tooltip, Menu, Modal, Notification, Kbd, Code,
  Breadcrumbs all themed centrally.
- A dedicated test (`src/theme/border-coverage.test.ts`) mechanically enumerates every
  `@mantine/core` component whose shipped CSS declares a border and asserts each one is either a
  themed `baseTheme.components` key or a reasoned `BORDER_ALLOWLIST` entry — closing the gap a
  regex-based consumer-source guard can never see (a theme block that was never written).
- The shipped **`basalt` oxlint plugin** (`configs/oxlint-plugin.js`, inherited via `extends`)
  enforces three idioms the regex `check-theme` guard cannot see from raw text: `no-raw-font-size`
  (numeric `fz`/`fontSize` → `VX.text.*`), `card-inset` (Card/Paper off the `py="xs" px="sm"` inset
  or carrying an explicit `radius`), and `chart-in-raw-surface` (a chart kind in a raw Card/Paper →
  `ChartCard`). Each honors the same `theme-allow` line-comment escape, reserved for genuinely
  bespoke optical values.

## 8. Doctrine inversions (this spec supersedes)

Older comments/docs in the codebase state doctrine this redesign **replaces** — update them where
encountered; never "correct" code back toward them. `app-header.module.css`, `app-sidebar.module.css`
and `docs/MANTINE-THEMING.md` no longer assert the pre-#12 borderless-header claim inversion #12
struck.

1. ~~"Depth = surface change + 1px hairline, NEVER a drop shadow"~~ → depth = a whisper shadow with
   a 1px ring baked in: `shadow-card` for panels, `shadow-raised` for controls. Borders-as-borders
   remain only for layout dividers.
2. ~~Warm-neutral greys (blue channel ≤ red)~~ → cool zinc neutrals.
3. ~~Muted slate-blue accent (~50% sat)~~ → saturated sky accent (#0077bd / #8ec5ff).
4. ~~Panels are white on light~~ → panels are zinc-100 (#f4f4f5) on a slightly darker page.
5. ~~Cards at 8px radius~~ → ~~10px~~ → **7px** (2026-07 density pass: sharper, more data-driven;
   controls likewise 8px → 6px).
6. ~~System-font stack only~~ → shipped three-font system (Nunito Sans / Hubot Sans / JetBrains
   Mono).
7. Active nav stays a quiet fill (unchanged) and the active **icon** is accent-colored.
   ~~The row carries `shadow-card`~~ → the row is an ink-9% tint with no panel fill and no depth:
   panel + shadow made the current location read as a _button_ parked in the nav. Selection is
   the same tint idiom as hover, one step stronger, plus ink text, weight 600 and the accent icon.
8. ~~"The accent uses its lighter shade on dark (no glow)"~~ → true of the accent as **ink** only.
   A filled **surface** keeps the deep `#0077bd` and a white label in BOTH schemes: a light fill
   cannot carry white text, and a darker one drops below 3:1 against the dark page. See §2, "the
   accent has two roles".
9. ~~One `primaryShade` per scheme (`{ light: 6, dark: 4 }`)~~ → `primaryShade: 6`, one shade for
   both. A fill does not invert, so there is nothing to switch.
10. ~~Trust Mantine's `autoContrast` for the label on a filled control~~ → never. It resolves the
    foreground once, in JS, scheme-blindly, via a brightness heuristic that does not track WCAG
    contrast. The label is a token (`--vx-on-*`), resolved in CSS, per scheme.
11. ~~Each Mantine family's fill is just its shade 6~~ → every fill is placed in the shared
    **fill band** (§2), so a white label always works. Hue varies; luminance does not.
12. ~~"Header: transparent, no bottom border; Sidebar: no border — a line would cross a continuous
    surface"~~ → the surfaces are not continuous: one is fixed, the other scrolls under it. A LINE
    marks a SEAM between two surfaces that move independently; a RING marks an OBJECT that can be
    picked up whole (`shadow-card`); a CONTROL edge is transparent by law. A surface gets exactly
    one of the three, never two, and a chrome line is always directional (`border-<side>`) — a
    closed rectangle is a card.
