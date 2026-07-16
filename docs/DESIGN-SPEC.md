# Basalt UI — Design Spec (2026-07 overhaul)

Canonical distillation of the Claude Design handoff ("Dashboard redesign for modern aesthetics").
This file is the single source of truth for the visual system. Where this spec contradicts older
doctrine comments in the codebase, **this spec wins** (see "Doctrine inversions" at the bottom).

Values are exact — taken from the handoff prototype's token block. `color-mix()` expressions may
be kept as-is in emitted CSS or precomputed to the hex given in parentheses; the resolved color
must match.

## 1. Identity

Modern zinc. Cool-neutral zinc surfaces (Tailwind zinc family), low-contrast panel lift on a
slightly darker page, depth via a whisper shadow + 1px ring ("card shadow"), one saturated sky-blue
accent, and a three-font typographic system (Nunito Sans body / Hubot Sans condensed headings /
JetBrains Mono for everything numeric or micro-labeled). Chrome stays quiet; data and headings
carry the character.

## 2. Color tokens

| Token | Light | Dark |
|-|-|-|
| bg (page) | `color-mix(in srgb, #f4f4f5 50%, #e4e4e7)` (#ececee) | `color-mix(in srgb, #27272a 70%, #18181b)` (#232326) |
| panel (cards, controls) | `#f4f4f5` | `#27272a` |
| panel-hover | `#fafafa` | `color-mix(in srgb, #3f3f46 50%, #27272a)` (#333338) |
| line (strong border) | `color-mix(in srgb, #e4e4e7 50%, #d4d4d8)` (#dcdce0) | `#3f3f46` |
| hairline (card ring) | `#e5e5e5` | `color-mix(in srgb, #52525c 50%, #3f3f46)` (#494951) |
| divider (layout separators) | `color-mix(in srgb, #e5e5e5 65%, transparent)` | `color-mix(in srgb, #ffffff 6%, transparent)` |
| ink (primary text) | `#262626` | `#e5e5e5` |
| ink-2 (emphasis body) | `#404040` | `color-mix(in srgb, #e5e5e5 50%, #d4d4d4)` (#dddddd) |
| muted (secondary text) | `#525252` | `#d4d4d4` |
| faint (tertiary/labels) | `#737373` | `#a1a1a1` |
| accent — INK (links, active-nav icon, chart lines, focus ring; read against the page) | `#0077bd` | `#8ec5ff` |
| accent-hover (ink) | `#0069a8` | `#51a2ff` |
| accent-fill — SURFACE (filled button/switch/checkbox/bullet; carries a label) | `#0077bd` | `#0077bd` |
| accent-fill-hover | `#0069a8` | `#0069a8` |
| on-accent (text on an accent fill) | `#ffffff` | `#ffffff` |
| status-success | `#2f7a4f` | `#56c07a` |
| status-warning | `#b5750f` | `#e0a83a` |
| status-danger (derived, same tonality) | `#b53f3f` | `#e0685f` |

**The accent has two roles, and they are different colors.** As **ink** it is read against the page,
so it inverts across schemes (light on dark, deep on light). As a **surface** it carries a label, so
it is squeezed from both sides at once — white text needs ≥4.5:1 against the fill, and the control
needs ≥3:1 against the page behind it. On the dark page those two constraints leave one narrow
window, so the fill is the *same* hex in both schemes and its label is white in both. Darkening the
fill further (`#0069a8`, `#04669b`) buys text contrast but drops the button to 2.5–2.7:1 against the
dark page — it fades into the background. Never fill with the ink token.

**THE FILL BAND — this generalizes to every family.** The constraint above has nothing to do with
blue: any filled surface faces it. So every Mantine family's fill is its own hue placed at the *same
luminance* (~0.165, the band's centre) — hue varies, luminance does not. Each is its shade-6 scaled
uniformly in linear-light space, which lands on the target luminance exactly while preserving hue and
saturation exactly. The result: **every filled surface reads white, on either page, at ~4.9:1 / ~3.2:1.**
Untuned, five families sat below the 3:1 page floor (grape 2.17:1) and three needed black labels.

| Family | Fill (both schemes) | | Family | Fill (both schemes) |
|-|-|-|-|-|
| blue (accent) | `#0077bd` | | teal | `#007f75` |
| gray | `#707078` | | green | `#1f8228` |
| red | `#cc3c41` | | lime | `#617a1a` |
| pink | `#d22b6a` | | yellow | `#936a05` |
| grape / violet | `#ad47ad` | | orange | `#a56113` |
| indigo | `#745cda` | | cyan | `#1378aa` |

Hover is derived in CSS (`88%` of the fill over black), so retuning a fill carries its hover along.
`dark` is not a band member — `color="dark"` is a deliberately near-black surface. Mantine's
`--mantine-color-{family}-filled` is **bridged** onto these tokens, so the chrome is single-sourced
with the charts and the theme lab retunes it live. All of it is enforced by `theme/contrast.test.ts`.

Shadows (tokens, not ad hoc):

| Token | Light | Dark |
|-|-|-|
| shadow-card | `0 1px 2px rgba(28,25,23,0.05), 0 0 0 1px <hairline>` | `0 1px 3px rgba(0,0,0,0.4), inset 0 0 0 1px color-mix(in srgb, #ffffff 4%, transparent)` |
| shadow-ctrl | `0 1px 2px rgba(28,25,23,0.12)` | `0 1px 2px rgba(0,0,0,0.35)` |

Tint idiom — interactive neutral fills are **ink mixes**, never grey hexes:
- ghost hover: `color-mix(in srgb, <ink> 6%, transparent)`
- segmented-control track / count-badge bg: ink 6–8%
- progress track: ink 8%
- avatar/initials block: ink 10%
- info dot bg: ink 7%
- status tint bg (delta badges): `color-mix(in srgb, <status> 13%, transparent)` with the status
  color itself as text.

## 3. Typography

| Role | Font | Usage |
|-|-|-|
| body | `'Nunito Sans Variable'` | all UI copy; the `md` step (15px) is the default density |
| head | `'Hubot Sans Variable'` | headings, brand, card titles, breadcrumb current page — always `font-stretch: 88%`, weight ~550 |
| mono | `'JetBrains Mono Variable'` | ALL numerals/data, micro-labels, kbd/badges, axis ticks |

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

| Step | Size | Used for |
|-|-|-|
| `micro` | 11px | mono uppercase micro-labels — sidebar/section headers, table headers, axis ticks |
| `xs` | 12.5px | delta badges, tooltip meta, dense chrome, **StatCard labels** (density pass moved these 11px → 12.5px) |
| `sm` | 13.5px | stat/table numerals, chart tooltip, chart legend |
| `md` | 15px | **body** — nav rows, menu items, timeline, labels, prose; **chart card titles** (density pass moved these 16px → 15px) |
| `lg` | 16px | breadcrumb current page — **also the iOS input floor** |
| `xl` | 18px | section titles, brand |
| `kpi` | 24px | the StatCard hero numeral (weight 600, letter-spacing −0.02em; density pass 31 → 24) |

Weights and fonts stay as above: card titles and section titles take the head font at 88% stretch,
weight ~550; every numeral and micro-label takes mono.

An optical ratio is not a scale step — a glyph sized *relative* to its own label (the delta badge's
▲/▼, inline `<code>`) uses an `em` value so it tracks whatever step its parent lands on.

### iOS input floor (non-negotiable)

**Inputs never compute below 16px.** Safari zooms the viewport whenever a focused input is under
16px and never zooms back out on blur. This is enforced as a CSS *floor* in `styles.css` —
`font-size: max(16px, var(--input-fz, 1rem))` — not as per-component `defaultProps`, so it reaches
every Mantine input (Autocomplete, MultiSelect, TagsInput, PinInput, …) and survives a consumer
passing `size="xs"`. Inputs keep `size: 'md'` for *geometry* (42px height); only the font-size is
floored, so a 16px font sits in a normally-proportioned control.

The floor lives in `@layer basalt`, which means **the consumer must import
`@mantine/core/styles.layer.css`, never the plain `@mantine/core/styles.css`.** Mantine's default
bundle is entirely unlayered, and unlayered author styles outrank every layered rule regardless of
specificity — with the plain bundle the floor (and the rest of `@layer basalt`) silently loses.

16px is the only clean fix: `maximum-scale=1` / `user-scalable=no` block pinch-zoom on Android
(WCAG 1.4.4), `text-size-adjust` governs text *inflation* rather than focus-zoom, and Safari does
not support `interactive-widget`.

The floor is `!important` — the one deliberate use of it in the framework. An inline `style`
attribute outranks every stylesheet rule, so without it a consumer's `style={{ fontSize: 13 }}` on
a raw `<input>` silently re-opens the zoom bug. Two `check-theme` guard kinds back this at build
time: `raw-form-control` flags any raw `<input>`/`<select>`/`<textarea>` (which also bypasses the
rest of the theme entirely), and `sub-16-input-font` flags a sub-16 `fontSize` on a form control as
dead code against the `!important` floor.

## 4. Radii & shape

| Surface | Radius |
|-|-|
| cards / panels | **7px** (`--vx-radius-card`; the 2026-07 density pass moves 10px → 7px for a sharper, data-driven edge) |
| controls (inputs, search, buttons, segmented track, icon buttons ≥28px) | **6px** (`radius.md` = 0.375rem, mirrored by `--vx-radius-ctrl`; density pass moves 8px → 6px) |
| segmented active thumb, small ghost buttons, kbd badges, nav rows | 5–6px |
| progress bars | 4px (6px height) |
| avatar block | 7px |
| chart bar tops | rx ≈ 1.4 |

## 5. Component idioms

- **The ring lives IN the shadow — apply it to the box that carries the surface's `border-radius`.**
  `shadow-card`/`shadow-ctrl` bakes a 1px ring into the shadow value itself; the ring follows the
  shadowed box's OWN corners, so it only renders correctly there — never on a bare layout wrapper
  whose radius doesn't match the rounded surface it wraps. Background usually sits on the same box
  too, but it's the radius the ring is bound to, not the background (a shadowed box with a separate,
  identically-rounded background box, like `ChartCard`, is legal). Mechanically enforced by
  `src/theme/shadow-surfaces.test.ts`.
- **Card**: panel bg + `shadow-card` (ring lives IN the shadow — no `border` property), radius
  7px, padding ~14–16px. Cards lift subtly off a slightly darker page.
- **Sidebar**: transparent (page bg, no panel, no border), ~216px. Section headers are
  micro-labels. Active item = panel bg + `shadow-card` + **accent-colored icon** + weight 600 ink
  text; inactive = muted text, faint icon; hover = ink-6% tint. Child items indent with a 1px
  `divider` left border; active child = accent text, weight 600. Count badges: mono 10.5px,
  ink-8% bg, radius 5. Footer: initials block (ink-10%, radius 7, mono) + name (13px semibold) +
  mono 9.5px uppercase faint meta line.
- **Header**: transparent, no bottom rule — it shares the page background with the body, so a
  separator would only draw a line across a continuous surface. Breadcrumb 13.5px: parents faint, separator
  line-colored, current page in head font ~14.5px/550. Right side: search trigger (panel +
  shadow-card, radius 8, faint text, mono ⌘K badge), icon button (31px, panel + shadow-card),
  segmented range control.
- **Segmented control**: track = ink-6% tint, radius 7, 2px padding, 2px gap; active segment =
  panel bg + `shadow-ctrl`, radius 5, ink text weight 600; inactive = muted, transparent. Numeric
  segment labels (1D/7D/30D) are mono 11.5px; word labels are sans 12px.
- **Ghost icon button**: transparent, faint icon, hover ink-6% + ink icon, radius 6.
- **Delta/status badge**: mono 11.5px weight 600, status-color text on status-13% tint, radius 6,
  2px 7px padding, optional ▲/▼ glyph at 9px, optional comparison-period suffix (`MoM`/`WoW`/`YTD`)
  in a dimmer shade of the same tone directly after the value.
- **Stat card**: card-radius panel, spacing xs/sm inset, mono xs uppercase label + mono ~24px hero
  numeral + delta badge; optional sparkline runs full-bleed to the card's L/R/bottom edges (card
  clips to the corner radius; the shadow ring is unaffected).
- **Settings section**: card-radius panel + shadow-card, spacing xs/sm inset, head-font 15px title
  + 13px muted description, rows split by a 1px `--vx-divider` rule; the `DangerZone` variant adds
  a mono danger eyebrow + a danger-tinted ring layered over the shadow.
- **Alert**: Mantine `Alert` on the card tint idiom — title in head font (88% stretch, ~550);
  color tint comes from the variant color resolver; control-tier radius.
- **Progress/meter row**: 13px label (ink-2) + mono 12px faint value; 6px track (ink-8%, radius
  4); leader fill = accent, others = faint at 80/55/40% mix.
- **Stat list row**: 13px muted label / mono 12.5px weight 500 ink value, ~9px vertical padding.
- **Charts**: horizontal grid = hairline only (no vertical grid), baseline axis = line color;
  ticks mono 10.5px faint; primary series = accent, secondary = faint, tertiary/line overlay =
  status-warning at 1.9px stroke; bar pairs 6.4px wide, rx 1.4; legend centered below — 11px
  radius-3 square swatches (16×3px radius-2 pill for line series), 12.5px muted labels, 22px gap.
- **Sparklines**: single 1.6px faint line, no fill, no axes.
- **Tooltip/popover/menu**: panel bg + shadow-card, radius 7–8px (cards 7px; floating surfaces 8px).
  The chart info-tooltip (`ChartCard`'s `i`) is a Mantine-free hover/focus/tap bubble in the same
  idiom; it dismisses on Escape, blur, or an outside click. Its trigger lives in the card header,
  which sits OUTSIDE the chart body's clip box, so the bubble can overhang the card edge and is never
  clipped.
- **Scrollbars**: 9px, hairline thumb (line on hover), radius 6, transparent track. A scroll region
  in app chrome is a Mantine `ScrollArea` (`type="hover"`, `scrollbarSize={9}`), never a raw
  `overflow: auto` box — its bar floats over the content instead of reserving gutter width and
  reflowing the column. Exactly ONE bar shows: `styles.css` re-hides the native bar on
  `.mantine-ScrollArea-viewport`, which the global `*::-webkit-scrollbar` theming would otherwise
  re-expose on top of Mantine's overlay. `AppSidebar`'s nav is the reference pattern; raw
  `overflow: auto` stays correct only where a library owns the scroll node (`BasaltStickToBottom`,
  `BasaltVirtualList`). Documented, not lint-enforced — the exceptions are context-dependent.

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
encountered; never "correct" code back toward them:

1. ~~"Depth = surface change + 1px hairline, NEVER a drop shadow"~~ → depth = `shadow-card`
   (whisper shadow + ring). Borders-as-borders remain only for layout dividers.
2. ~~Warm-neutral greys (blue channel ≤ red)~~ → cool zinc neutrals.
3. ~~Muted slate-blue accent (~50% sat)~~ → saturated sky accent (#0077bd / #8ec5ff).
4. ~~Panels are white on light~~ → panels are zinc-100 (#f4f4f5) on a slightly darker page.
5. ~~Cards at 8px radius~~ → ~~10px~~ → **7px** (2026-07 density pass: sharper, more data-driven;
   controls likewise 8px → 6px).
6. ~~System-font stack only~~ → shipped three-font system (Nunito Sans / Hubot Sans / JetBrains
   Mono).
7. Active nav stays a quiet fill (unchanged), but the active **icon** is now accent-colored and
   the row carries `shadow-card`.
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
