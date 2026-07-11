/**
 * palette.ts — Basalt single source of truth for ALL framework color
 * (charts via VX tokens + chrome via the Mantine theme).
 *
 * Identity: modern zinc (2026-07 redesign, see `docs/DESIGN-SPEC.md`). Cool-neutral zinc surfaces
 * (Tailwind zinc family) — a low-contrast panel lift on a slightly darker page, depth via a
 * whisper `shadow-card` (never a hairline-only border), and ONE saturated sky-blue accent
 * (#0077bd light / #8ec5ff dark) used with intent (primary series, active-nav icon, links, primary
 * actions, focus rings, meter leaders) — chrome stays zinc-neutral otherwise. Status hues stay
 * UI-tuned (muted, not raw Material/AntD/Tailwind defaults).
 *
 * Design rules baked in (see `docs/DESIGN-SPEC.md`):
 *  - Neutral zinc greys carry ~90% of the surface — chrome is monochrome, accent only points.
 *  - Depth = `shadow-card` (a whisper shadow + a 1px ring baked into the SAME shadow value) —
 *    borders-as-borders remain only for genuine layout dividers (the `line` token).
 *  - Interactive neutral fills are INK color-mixes (`alpha(VX.ink, 0.06)` etc.), never grey hexes.
 *  - Each metric is ONE hue; multi-series only where data is genuinely categorical.
 *  - Series colors are per-theme PAIRS: a lighter shade on dark (no glow/bleed on dark
 *    backgrounds), a deeper shade on light (enough contrast). Hue identity stays constant.
 *
 * This module is pure data — no React, no Mantine, no browser APIs. It is consumed by
 * the token layer (emits the CSS custom properties) and by the Mantine theme.
 */

import type { ColorPair } from './index'

/**
 * Basalt palette. Each family is shade 1→5 (index 0 = darkest, 4 = lightest).
 * `darkGray` / `gray` / `lightGray` are the zinc identity (Tailwind zinc scale, blue channel a
 * whisper above red — cool, not warm) shared by the dark surface ramp, the mid-grey chart-line
 * ramp, and the light surfaces. `blue` is the single saturated sky accent family (built around the
 * `#0077bd` / `#8ec5ff` accent pair — see the `ramp10` pin in `theme/index.ts` for how the Mantine
 * tuple resolves the exact hexes at the fill and ink indices).
 *
 * These families are the RAW hues. What a filled control actually paints is `FILL` / `ACCENT`
 * below — the same hues placed in one shared luminance band, which is a hard constraint, not a
 * taste call. Read those two before touching any color here.
 */
export const BP = {
  black: '#18181b',
  white: '#ffffff',
  // Zinc dark-surface ramp: darkest (page bg extreme) → lightest (mid-tone border/text step).
  // Mirrors Tailwind zinc-900/800/700/600/500.
  darkGray: ['#18181b', '#27272a', '#3f3f46', '#52525c', '#71717a'],
  // Zinc mid greys for text / lines (cool-neutral, replaces the old warm-neutral ramp).
  // Mirrors Tailwind zinc-600/500/400/300/200.
  gray: ['#52525c', '#71717a', '#a1a1aa', '#d4d4d8', '#e4e4e7'],
  // Zinc light surfaces: darkest (line/border step) → lightest (panel-hover). Mirrors Tailwind
  // zinc-300/200, the literal `#e5e5e5` hairline, zinc-100 (panel), zinc-50 (panel-hover).
  lightGray: ['#d4d4d8', '#e4e4e7', '#e5e5e5', '#f4f4f5', '#fafafa'],

  // Saturated sky-blue accent family (darkest → lightest), built around the exact spec accent
  // hue. `ramp10` interpolates a 5-stop family across 10 fractional positions, which can't land on
  // an arbitrary target at an arbitrary index — so `theme/index.ts` pins the exact hexes onto the
  // two indices that matter (6 = the fill band, 4 = the dark INK accent) after building the ramp.
  // The family itself only has to read as one coherent hue.
  blue: ['#0c4a6e', '#0369a1', '#0284c7', '#38bdf8', '#7dd3fc'],
  green: ['#165a36', '#1c6e42', '#238551', '#32a467', '#72ca9b'],
  orange: ['#77450d', '#935610', '#c87619', '#ec9a3c', '#fbb360'],
  red: ['#8e292c', '#ac2f33', '#cd4246', '#e76a6e', '#fa999c'],
  vermilion: ['#96290d', '#b83211', '#d33d17', '#eb6847', '#ff9980'],
  rose: ['#a82255', '#c22762', '#db2c6f', '#f5498b', '#ff66a1'],
  violet: ['#5c255c', '#7c327c', '#9d3f9d', '#bd6bbd', '#d69fd6'],
  indigo: ['#5642a6', '#634dbf', '#7961db', '#9881f3', '#bdadff'],
  cerulean: ['#0c5174', '#0f6894', '#147eb3', '#3fa6da', '#68c1ee'],
  turquoise: ['#004d46', '#007067', '#00a396', '#13c9ba', '#7ae1d8'],
  forest: ['#1d7324', '#238c2c', '#29a634', '#43bf4d', '#62d96b'],
  lime: ['#43501b', '#5a701a', '#8eb125', '#b6d94c', '#d4f17e'],
  gold: ['#5c4405', '#866103', '#d1980b', '#f0b726', '#fbd065'],
  sepia: ['#5e4123', '#7a542e', '#946638', '#af855a', '#d0b090'],
} as const

/**
 * Pick a per-theme shade pair from a Basalt family.
 * Defaults: shade 3 (index 2) on light, shade 4 (index 3) on dark — the dark-mode lift
 * that stops saturated hues from glowing. Override indices for ordered/sibling cases.
 */
export const p = (fam: readonly string[], light = 2, dark = 3): ColorPair => ({
  light: fam[light]!,
  dark: fam[dark]!,
})

/** Spec status hues (`docs/DESIGN-SPEC.md` §2) — exact, shared by SEMANTIC + STATUS below. */
const SUCCESS: ColorPair = { light: '#2f7a4f', dark: '#56c07a' }
const WARNING: ColorPair = { light: '#b5750f', dark: '#e0a83a' }
const DANGER: ColorPair = { light: '#b53f3f', dark: '#e0685f' }

/** Semantic status hues — solids + the family they fill from (alpha applied in the token layer). */
export const SEMANTIC = {
  good: SUCCESS,
  bad: DANGER,
  warn: WARNING,
} as const

/**
 * Score / zone status scale (excellent → poor). `good`/`warn`/`bad` are the SAME spec
 * success/warning/danger pairs as `SEMANTIC` (also the direct source for Badge/Notification/delta
 * -badge status-tint idioms in the theme — one set of hexes, several consumers). `excellent`
 * (top-of-scale grade) and `neutral` keep their prior chart-only families (unchanged BP families).
 */
export const STATUS = {
  excellent: p(BP.forest),
  good: SUCCESS,
  warn: WARNING,
  bad: DANGER,
  neutral: p(BP.gray, 1, 2),
} as const

/**
 * Theme-resolved neutrals (line / axis / grid / tooltip chrome). Mirrors the old
 * useVxTheme() outputs, retuned to the zinc identity — the light-scheme opacity bases below use
 * the new `ink` rgb (38,38,38 = #262626) rather than the old warm near-black, so chart chrome
 * reads on the same cool-neutral ink as the rest of the chrome.
 */
export const NEUTRAL = {
  line: { light: BP.gray[0], dark: BP.gray[4] }, // primary line
  line2: { light: BP.gray[1], dark: BP.gray[2] }, // secondary line
  axis: { light: 'rgba(38,38,38,0.6)', dark: 'rgba(255,255,255,0.6)' },
  axisStroke: { light: 'rgba(38,38,38,0.12)', dark: 'rgba(255,255,255,0.12)' },
  grid: { light: 'rgba(38,38,38,0.07)', dark: 'rgba(255,255,255,0.06)' },
  crosshair: { light: 'rgba(38,38,38,0.32)', dark: 'rgba(255,255,255,0.42)' },
  dotStroke: { light: BP.white, dark: BP.darkGray[1] }, // matches chart-area bg
  tooltipBg: { light: BP.white, dark: 'rgba(39,39,42,0.96)' },
  tooltipText: { light: 'rgba(38,38,38,0.88)', dark: 'rgba(255,255,255,0.88)' },
  tooltipMuted: { light: 'rgba(38,38,38,0.5)', dark: 'rgba(255,255,255,0.5)' },
  tooltipBorder: { light: `1px solid ${BP.lightGray[1]}`, dark: 'none' },
  tooltipShadow: { light: '0 2px 8px rgba(38,38,38,0.1)', dark: '0 2px 8px rgba(0,0,0,0.35)' },
  // Base neutral for hairlines / muted / DIMMED text / overlays — apply opacity via alpha().
  // Binds to --mantine-color-dimmed, so it is THE dimmed-text lever. Equal to `INK.muted` (the
  // spec's "muted (secondary text)" row) — kept as its own pair for the pre-existing `--vx-neutral`
  // name (never renamed), while `INK.muted` below is the new explicit spec-named token.
  neutral: { light: '#525252', dark: '#d4d4d4' },
} as const

/** Ink text ramp (`docs/DESIGN-SPEC.md` §2) — primary/emphasis/secondary/tertiary body text. */
export const INK = {
  ink: { light: '#262626', dark: '#e5e5e5' }, // primary text
  ink2: { light: '#404040', dark: '#dddddd' }, // emphasis body
  muted: { light: '#525252', dark: '#d4d4d4' }, // secondary text (= NEUTRAL.neutral)
  faint: { light: '#737373', dark: '#a1a1a1' }, // tertiary text / micro-labels
} as const

/**
 * The one saturated sky-blue accent. It has TWO roles, and they are DIFFERENT COLORS — conflating
 * them is what made dark mode unfixable.
 *
 *  • `accent` — the accent as INK: link text, active-nav icon, chart lines, focus ring. It is read
 *    AGAINST THE PAGE, so it must be LIGHT on dark (`#8ec5ff`, 8.64:1 on the dark page) and DEEP on
 *    light (`#0077bd`, 4.60:1 on the light page). This pair inverts across schemes, as it must.
 *
 *  • `accentFill` — the accent as SURFACE: filled buttons, a checked Switch/Checkbox, the active
 *    Timeline bullet, the Composer send button. It CARRIES A LABEL, so it is squeezed from both
 *    sides at once: white text needs ≥4.5:1 against the fill, AND the control needs ≥3:1 against
 *    the page it sits on. On the dark page those two constraints leave one narrow window, and
 *    `#0077bd` is the value in it (white 4.80:1, fill-vs-dark-page 3.26:1). Deeper (`#0069a8`,
 *    `#04669b`) buys text contrast but drops the button to 2.5–2.7:1 against the page — the control
 *    fades into the background. Lighter breaks white text. So the fill is the SAME hex in both
 *    schemes, and `onAccent` is white in both.
 *
 * `onAccent` is THE foreground for any accent fill. `theme/index.ts` bridges Mantine's
 * `--mantine-color-<primary>-filled` onto `--vx-accentFill` and every filled foreground onto
 * `--vx-onAccent`, so ONE token drives the chrome — which is also what makes the theme lab able to
 * retune the accent live. Mantine's own `autoContrast` cannot express this (it resolves the
 * foreground scheme-blindly, in JS). Regression-locked by `theme/contrast.test.ts`.
 */
export const ACCENT = {
  accent: { light: '#0077bd', dark: '#8ec5ff' }, // accent as INK — inverts across schemes
  accentHover: { light: '#0069a8', dark: '#51a2ff' },
  accentFill: { light: '#0077bd', dark: '#0077bd' }, // accent as SURFACE — same hex in both schemes
  accentFillHover: { light: '#0069a8', dark: '#0069a8' }, // deeper on hover (white text 5.86:1)
  onAccent: { light: '#ffffff', dark: '#ffffff' }, // text on an accent fill — white in BOTH
} as const

/**
 * Filled-surface hexes for the Mantine accent families — THE FILL BAND.
 *
 * A filled control is constrained from both sides at once (the `ACCENT` note above derives this for
 * the accent): a white label needs ≥4.5:1 against the fill, and the control needs ≥3:1 against the
 * page behind it — on BOTH pages, since a fill does not invert across schemes. In WCAG terms that
 * pins the fill's relative luminance into one narrow band, ~0.150–0.183. There is no room for a
 * family to sit outside it: too light and the label dies, too dark and the button fades into the
 * dark page.
 *
 * So every family's fill is its own hue placed at the SAME luminance (0.165, the band's centre).
 * Each hex is the family's Mantine shade-6 scaled uniformly in LINEAR-light space — luminance is
 * linear in linear-RGB, so a uniform scale lands on the target exactly while preserving the hue and
 * saturation exactly. The result is a system law rather than a per-color judgement call: EVERY
 * filled surface reads white, on either page, at ~4.9:1 / ~3.2:1. Untuned, five families sat under
 * the 3:1 page floor (grape 2.17:1) and three needed black labels.
 *
 * `blue` is absent on purpose — it is the accent, and its fill lives in `ACCENT.accentFill` so the
 * accent keeps ONE source. `dark` is absent too: `color="dark"` is a deliberately near-black
 * surface, not a band member. Hover is DERIVED in CSS from the fill (see `tokens/index.ts`), so
 * retuning a fill moves its hover with it. Regression-locked by `theme/contrast.test.ts`.
 */
export const FILL = {
  gray: '#707078',
  red: '#cc3c41',
  pink: '#d22b6a',
  grape: '#ad47ad',
  violet: '#ad47ad',
  indigo: '#745cda',
  cyan: '#1378aa',
  teal: '#007f75',
  green: '#1f8228',
  lime: '#617a1a',
  yellow: '#936a05',
  orange: '#a56113',
} as const

/**
 * Card / control depth shadows (`docs/DESIGN-SPEC.md` §2) — depth is a whisper shadow + a 1px
 * ring baked into the SAME value (never a separate `border`). The ring embeds
 * `var(--vx-surface-hairline)` so it stays single-sourced against the hairline pair below.
 */
export const SHADOW = {
  card: {
    light: '0 1px 2px rgba(28,25,23,0.05), 0 0 0 1px var(--vx-surface-hairline)',
    dark: '0 1px 3px rgba(0,0,0,0.4), inset 0 0 0 1px color-mix(in srgb, #ffffff 4%, transparent)',
  },
  ctrl: {
    light: '0 1px 2px rgba(28,25,23,0.12)',
    dark: '0 1px 2px rgba(0,0,0,0.35)',
  },
  // Floating-layer elevation (menus, popovers, tooltips, modals, drawers) — a REAL drop shadow, a
  // step above `card`, so detached surfaces read as lifted off the page (`docs/DESIGN-SPEC.md` §5).
  // Unlike `card`, no embedded ring: floating surfaces carry a real 1px `--vx-surface-border` so
  // Mantine's rotated-square arrow inherits a proper edge.
  overlay: {
    light: '0 8px 24px rgba(28,25,23,0.10)',
    dark: '0 8px 24px rgba(0,0,0,0.5)',
  },
} as const

/**
 * App chrome surfaces — the zinc identity for the Mantine theme (`docs/DESIGN-SPEC.md` §2).
 *
 * `border` ("line") is the STRONG border used broadly for layout/control chrome (AppShell, Table,
 * Input, Divider, Tabs, Popover, Accordion — everything bound through `--mantine-color-default-
 * border` / `--mantine-color-gray-{2,3,4}` in the resolver below). `hairline` ("card ring") is a
 * DISTINCT, thinner pair used ONLY inside `shadow-card`'s embedded ring — cards carry no `border`
 * property at all, the ring lives in the shadow. Never conflate the two.
 */
/** Dark page-bg expression — shared by `bg` and the input `field` surface below. */
const DARK_PAGE = 'color-mix(in srgb, #27272a 70%, #18181b)'

export const SURFACE = {
  bg: {
    light: 'color-mix(in srgb, #f4f4f5 50%, #e4e4e7)',
    dark: DARK_PAGE,
  }, // page background
  panel: { light: '#f4f4f5', dark: '#27272a' }, // cards, controls
  panelHover: {
    light: '#fafafa',
    dark: 'color-mix(in srgb, #3f3f46 50%, #27272a)',
  },
  // Elevated surface (chart area, `--mantine-color-default-hover`) — same lift as panel-hover.
  elevated: {
    light: '#fafafa',
    dark: 'color-mix(in srgb, #3f3f46 50%, #27272a)',
  },
  border: {
    light: 'color-mix(in srgb, #e4e4e7 50%, #d4d4d8)',
    dark: '#3f3f46',
  }, // "line" — strong border (layout/control chrome, NOT the card ring)
  hairline: {
    light: '#e5e5e5',
    dark: 'color-mix(in srgb, #52525c 50%, #3f3f46)',
  }, // card ring only — consumed by `SHADOW.card`
  // Hover/striped/track fallback surface — a faint step between `panel` and `border`. Used by
  // Table hover/striped, Code, SegmentedControl track fallback, Tabs/Accordion/Menu hover.
  subtle: { light: '#eeeef0', dark: '#2d2d33' },
  // Floating-layer surface (menus, popovers, tooltips, modals, drawers). On light it reads pure
  // white — a clean lift above the zinc-100 panel; on dark it reuses the `panelHover` elevated step
  // (≈ #333338) so detached surfaces sit a shade above the panel. Paired with `SHADOW.overlay` +
  // a real `border` so Mantine's arrow renders a proper edge (`docs/DESIGN-SPEC.md` §5).
  overlay: {
    light: '#ffffff',
    dark: 'color-mix(in srgb, #3f3f46 50%, #27272a)',
  },
  // Input field surface (docs/DESIGN-SPEC.md §5 field idiom) — reads slightly inset ON a panel.
  // Light: pure white on the zinc-100 panel; dark: the page-bg step (one darker than panel).
  field: { light: '#ffffff', dark: DARK_PAGE },
  divider: {
    light: 'color-mix(in srgb, #e5e5e5 65%, transparent)',
    dark: 'color-mix(in srgb, #ffffff 6%, transparent)',
  }, // layout separators (header bottom rule, sidebar child indent)
} as const
