/**
 * palette.ts — Basalt single source of truth for ALL framework color
 * (charts via VX tokens + chrome via the Mantine theme).
 *
 * Identity: lifted zinc-charcoal. The DARK surface ramp is a lifted neutral/faint-cool zinc
 * (blue channel a whisper ABOVE red) — light enough that cards/borders separate from the page,
 * grey enough that it never reads as a warm/brown near-black. The LIGHT canvas stays a warm-neutral
 * off-white and the chart mid-grey line ramp stays warm-neutral (both unchanged — the faint-cool
 * departure is the dark surfaces only). The accent is a single MUTED slate-blue used sparingly
 * (neutral-dominant: ~60/30/10) — never a saturated "Bootstrap blue" flooding the UI.
 * Semantic/status hues stay UI-tuned (muted, not raw Material/AntD/Tailwind defaults).
 *
 * Design rules baked in (see the basalt design doctrine):
 *  - Neutral zinc greys carry ~90% of the surface — chrome is monochrome, accent only points.
 *  - The accent (`blue`) is desaturated on purpose; it lives on the ONE primary action per view,
 *    focus rings, links, and small status pops ONLY — never on active nav (that's a neutral fill),
 *    borders, large fills, or every icon.
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
 * The dark surface ramp (`darkGray`) is a lifted neutral/faint-cool zinc (blue channel a whisper
 * above red); the mid-grey line ramp (`gray`) and the light surfaces (`lightGray`) stay warm-neutral
 * (blue channel <= red — no cool/steel cast). `blue` is the single muted slate accent (kept
 * low-saturation on purpose).
 */
export const BP = {
  black: '#121110',
  white: '#ffffff',
  // Lifted neutral/faint-cool zinc-charcoal: bg, panel, elevated, hairline, strong-hairline.
  // Blue channel sits a whisper ABOVE red (faint-cool zinc) and every step is lighter than the old
  // warm charcoal, so cards/borders lift off the page and the canvas reads clean grey, not near-black.
  darkGray: ['#212126', '#27272d', '#323239', '#3a3a42', '#4e4e57'],
  // Mid greys for text / lines (warm-neutral, not blue-grey).
  gray: ['#6e6b65', '#847f78', '#9b958d', '#b3ada4', '#cac4bb'],
  // Light surfaces: near-neutral off-whites + soft hairlines. Only a whisper of warmth (last
  // digit) so it reads clean/modern — NOT creamy/yellow — while never going cool/blue.
  lightGray: ['#dededc', '#ededec', '#f2f2f1', '#f6f6f5', '#fafafa'],

  // Muted slate-blue accent (~50% sat vs Blueprint's ~76%). Subtle, Notion/Linear-calm.
  blue: ['#324a66', '#3c5b7e', '#4f78a4', '#7099c4', '#a5c1dd'],
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

/** Semantic status hues — solids + the family they fill from (alpha applied in the token layer). */
export const SEMANTIC = {
  good: p(BP.forest),
  bad: p(BP.red),
  warn: p(BP.gold),
} as const

/**
 * Score / zone status scale (excellent → poor). Replaces the old Material traffic-light
 * ramp (#00c853…#ff3d00). Used by hero-card grades, zone bands, status badges.
 */
export const STATUS = {
  excellent: p(BP.forest),
  good: p(BP.lime, 2, 3),
  warn: p(BP.gold),
  bad: p(BP.vermilion),
  neutral: p(BP.gray, 1, 2),
} as const

/**
 * Theme-resolved neutrals (line / axis / grid / tooltip chrome). Mirrors the old
 * useVxTheme() outputs, sourced from the Basalt warm-neutral greys + warm near-black.
 */
export const NEUTRAL = {
  line: { light: BP.gray[0], dark: BP.gray[4] }, // primary line
  line2: { light: BP.gray[1], dark: BP.gray[2] }, // secondary line
  axis: { light: 'rgba(18,17,16,0.6)', dark: 'rgba(255,255,255,0.6)' },
  axisStroke: { light: 'rgba(18,17,16,0.12)', dark: 'rgba(255,255,255,0.12)' },
  grid: { light: 'rgba(18,17,16,0.07)', dark: 'rgba(255,255,255,0.06)' },
  crosshair: { light: 'rgba(18,17,16,0.32)', dark: 'rgba(255,255,255,0.42)' },
  dotStroke: { light: BP.white, dark: BP.darkGray[1] }, // matches chart-area bg
  tooltipBg: { light: BP.white, dark: 'rgba(31,31,29,0.96)' },
  tooltipText: { light: 'rgba(18,17,16,0.88)', dark: 'rgba(255,255,255,0.88)' },
  tooltipMuted: { light: 'rgba(18,17,16,0.5)', dark: 'rgba(255,255,255,0.5)' },
  tooltipBorder: { light: `1px solid ${BP.lightGray[1]}`, dark: 'none' },
  tooltipShadow: { light: '0 2px 8px rgba(18,17,16,0.1)', dark: '0 2px 8px rgba(0,0,0,0.35)' },
  // Base neutral for hairlines / muted / DIMMED text / overlays — apply opacity via alpha().
  // Binds to --mantine-color-dimmed, so it is THE dimmed-text lever: lighter on dark (lifts off the
  // lifted charcoal), darker on light (more contrast on the off-white). Neutral/faint-cool to match
  // the zinc surfaces — deliberately decoupled from BP.gray (the warm chart-line ramp).
  neutral: { light: '#5e5e64', dark: '#b6b6bc' },
} as const

/** App chrome surfaces — lifted zinc dark + warm-neutral off-white light ramps for the Mantine theme. */
export const SURFACE = {
  bg: { light: BP.lightGray[4], dark: BP.darkGray[0] }, // page background
  panel: { light: BP.white, dark: BP.darkGray[1] }, // cards
  elevated: { light: BP.white, dark: BP.darkGray[2] }, // chart area, lifted
  border: { light: BP.lightGray[1], dark: BP.darkGray[3] },
  // Subtle/hover/striped/track surface — distinct from `panel`: a faint step BELOW white on light
  // (panel is white, so hover must go darker) and ABOVE panel on dark (hover goes lighter). Used by
  // Table hover/striped, Code, SegmentedControl track, Tabs/Accordion/Menu hover.
  subtle: { light: BP.lightGray[2], dark: BP.darkGray[2] }, // #f2f2f1 / #323239
} as const
