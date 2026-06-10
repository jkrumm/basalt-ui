/**
 * palette.ts — Blueprint-derived single source of truth for ALL framework color
 * (charts via VX tokens + chrome via the Mantine theme).
 *
 * Design rules baked in (see the dataviz rule):
 *  - Muted, UI-tuned hues only (Blueprint v6) — never raw Material/AntD/Tailwind defaults.
 *  - Limited, harmonious hue range reused across every page → tabs feel like one app.
 *  - Each metric is ONE hue; multi-series only where data is genuinely categorical.
 *  - Series colors are per-theme PAIRS: a lighter shade on dark (no glow/bleed on dark
 *    backgrounds), a deeper shade on light (enough contrast). Hue identity stays constant.
 *
 * This module is pure data — no React, no Mantine, no browser APIs. It is consumed by
 * the token layer (emits the CSS custom properties) and by the Mantine theme.
 */

import type { ColorPair } from './index'

/** Blueprint v6 palette. Each family is shade 1→5 (index 0 = darkest, 4 = lightest). */
export const BP = {
  black: '#111418',
  white: '#ffffff',
  darkGray: ['#1c2127', '#252a31', '#2f343c', '#383e47', '#404854'],
  gray: ['#5f6b7c', '#738091', '#8f99a8', '#abb3bf', '#c5cbd3'],
  lightGray: ['#d3d8de', '#dce0e5', '#e5e8eb', '#edeff2', '#f6f7f9'],

  blue: ['#184a90', '#215db0', '#2d72d2', '#4c90f0', '#8abbff'],
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
 * Pick a per-theme shade pair from a Blueprint family.
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
 * useVxTheme() outputs, now sourced from Blueprint grays.
 */
export const NEUTRAL = {
  line: { light: BP.gray[0], dark: BP.gray[4] }, // primary line
  line2: { light: BP.gray[1], dark: BP.gray[2] }, // secondary line
  axis: { light: 'rgba(17,20,24,0.6)', dark: 'rgba(255,255,255,0.6)' },
  axisStroke: { light: 'rgba(17,20,24,0.12)', dark: 'rgba(255,255,255,0.12)' },
  grid: { light: 'rgba(17,20,24,0.07)', dark: 'rgba(255,255,255,0.06)' },
  crosshair: { light: 'rgba(17,20,24,0.32)', dark: 'rgba(255,255,255,0.42)' },
  dotStroke: { light: BP.white, dark: BP.darkGray[1] }, // matches chart-area bg
  tooltipBg: { light: BP.white, dark: 'rgba(28,33,39,0.96)' },
  tooltipText: { light: 'rgba(17,20,24,0.88)', dark: 'rgba(255,255,255,0.88)' },
  tooltipMuted: { light: 'rgba(17,20,24,0.5)', dark: 'rgba(255,255,255,0.5)' },
  tooltipBorder: { light: `1px solid ${BP.lightGray[1]}`, dark: 'none' },
  tooltipShadow: { light: '0 2px 8px rgba(17,20,24,0.1)', dark: '0 2px 8px rgba(0,0,0,0.35)' },
  // Base neutral for hairlines / muted text / overlays — apply opacity via alpha().
  neutral: { light: BP.gray[0], dark: BP.gray[2] },
} as const

/** App chrome surfaces — Blueprint dark/light neutral ramps for the Mantine theme. */
export const SURFACE = {
  bg: { light: BP.lightGray[4], dark: BP.darkGray[0] }, // page background
  panel: { light: BP.white, dark: BP.darkGray[1] }, // cards
  elevated: { light: BP.white, dark: BP.darkGray[2] }, // chart area, lifted
  border: { light: BP.lightGray[1], dark: BP.darkGray[3] },
} as const
