/**
 * palette.ts — Basalt single source of truth for ALL framework color
 * (charts via VX tokens + chrome via the Mantine theme).
 *
 * Identity: modern zinc (2026-07 redesign, see `docs/DESIGN-SPEC.md`). Cool-neutral zinc surfaces
 * (Tailwind zinc family) — a low-contrast panel lift on a slightly darker page, depth via a
 * whisper `shadow-card` (never a hairline-only border), and ONE saturated sky-blue accent used
 * with intent (primary series, active-nav icon, links, primary actions, focus rings, meter
 * leaders) — chrome stays zinc-neutral otherwise. Status hues stay UI-tuned (muted, not raw
 * Material/AntD/Tailwind defaults).
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
 *
 * GENERATED vs hand-authored: the accent family, the 12 categorical fills, the surface stops
 * (bg/panel/panelHover/elevated/subtle/field/border/hairline), the ink ramp, and the status
 * solids are COMPUTED at module load from `deriveTokens(DEFAULT_DERIVE_CONFIG)` (`./derive.ts`) —
 * never hand-edit a hex for one of those; retune the derive config or its calibrated constants
 * instead. Everything else here (shadows, dividers, tooltip chrome, the raw `BP` hue ramps,
 * `STATUS.excellent`/`STATUS.neutral`) stays hand-authored, unchanged.
 */

import { DEFAULT_DERIVE_CONFIG, deriveTokens, isDefaultDeriveConfig } from './derive'
import type { DeriveConfig } from './derive'
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

/**
 * Card / control depth shadows (`docs/DESIGN-SPEC.md` §2) — depth is a whisper shadow + a 1px
 * ring baked into the SAME value (never a separate `border`). The ring embeds
 * `var(--vx-surface-hairline)` so it stays single-sourced against the hairline pair below.
 * Structural — independent of the derive config, unlike everything `buildPaletteData` below emits.
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
 * The resolved shape {@link deriveRadius} returns — the two anchors plus every offset that tracks
 * one of them. The independent Mantine-scale stops (`scaleXs`/`scaleLg`/`scaleXl`) are NOT part of
 * this shape — they never move with the knob (see `RADIUS_STEP` below).
 */
export type RadiusValues = {
  card: number
  ctrl: number
  floating: number
  tight: number
  fine: number
}

/** Clamp a derived radius number at zero — a corner radius can't go negative. */
function clampRadius(n: number): number {
  return Math.max(0, n)
}

/** `deriveRadius`'s accepted level range — exported (not through the `./tokens` barrel, same
 * precedent as {@link scaleSpace}) so a cross-level test can derive the levels it loops over from
 * the SAME bound `deriveRadius` enforces, instead of a hardcoded literal that silently stops
 * covering the real range if the range ever changes again. */
export const RADIUS_LEVEL_RANGE = { min: -5, max: 5 } as const

/**
 * Derive the two radius anchors (`card`/`ctrl`) and their dependent offsets from a single integer
 * `level` (`docs/DESIGN-SPEC.md` §4) — the radius analog of `deriveTokens`'s color knobs. `level: 0`
 * reproduces the shipped identity exactly (`card: 7, ctrl: 6, floating: 8, tight: 5, fine: 4`,
 * locked by `theme/radius.test.ts`).
 *
 * The law: `card = 7 + level`, `ctrl = 6 + level`, both clamped to `≥ 0`; every offset then follows
 * its anchor — `floating = card + 1`, `tight = ctrl - 1`, `fine = ctrl - 2` — each ALSO clamped to
 * `≥ 0` (so an aggressive negative level flattens the smaller tiers to square before the larger
 * ones). The three independent Mantine-scale stops (`RADIUS_STEP.scaleXs/scaleLg/scaleXl`) are not
 * part of this law — they stay fixed regardless of `level`.
 *
 * Throws on a non-integer or out-of-range (`[-5, 5]`) level — same throw-and-propagate discipline
 * as `deriveTokens`'s accent-seed validation.
 */
export function deriveRadius(level: number): RadiusValues {
  if (
    !Number.isInteger(level) ||
    level < RADIUS_LEVEL_RANGE.min ||
    level > RADIUS_LEVEL_RANGE.max
  ) {
    throw new Error(
      `deriveRadius: level must be an integer in [${RADIUS_LEVEL_RANGE.min}, ${RADIUS_LEVEL_RANGE.max}], got ${level}`,
    )
  }
  const card = clampRadius(7 + level)
  const ctrl = clampRadius(6 + level)
  return {
    card,
    ctrl,
    floating: card + 1,
    tight: clampRadius(ctrl - 1),
    fine: clampRadius(ctrl - 2),
  }
}

/** `deriveRadius(0)` — the shipped identity's radius values, computed once. `RADIUS`/`RADIUS_STEP`
 * below are defined FROM this so the two can never drift apart. */
const DEFAULT_RADIUS_VALUES = deriveRadius(0)

/**
 * Corner-radius anchors (`docs/DESIGN-SPEC.md` §4) — the two independent tiers the Mantine theme
 * (`theme/index.ts`) resolves every component radius to. `card` mirrors the `--vx-radius-card` CSS
 * var, `ctrl` mirrors `--vx-radius-ctrl` (`tokens/index.ts`'s `frameworkDerived` emits both from
 * these SAME numbers), so the var and every JS `defaultProps.radius` in the theme read one source
 * instead of two that can drift apart. `deriveRadius(0)`'s output — structural, independent of the
 * derive config. Values are UNCHANGED from the shipped identity (locked by `theme/radius.test.ts`).
 */
export const RADIUS = {
  /** Card / Paper / `ChartCard` (Mantine-free chart chrome shares this token too). */
  card: DEFAULT_RADIUS_VALUES.card,
  /** Inputs, buttons, segmented-control track — also `defaultRadius: 'md'` in the Mantine `radius`
   * size-scale below. */
  ctrl: DEFAULT_RADIUS_VALUES.ctrl,
} as const

/**
 * Every OTHER radius number the Mantine theme resolves to a literal, named instead of bare. Each
 * key is either an explicit offset from a `RADIUS` anchor (named for what tier it belongs to — see
 * `deriveRadius` for the law that carries a retune along) or, where no such relation exists, its own
 * independent constant (the Mantine `radius` scale predates the card/ctrl split). `deriveRadius(0)`'s
 * output for the anchor-derived keys — UNCHANGED from the shipped identity (locked by
 * `theme/radius.test.ts`).
 */
export const RADIUS_STEP = {
  /** Tooltip / Popover / Modal / Notification (`docs/DESIGN-SPEC.md` §5 floating tier) — one step
   * above the card radius. */
  floating: DEFAULT_RADIUS_VALUES.floating, // 8
  /** SegmentedControl's active indicator, Kbd, Code — one step below the control radius. */
  tight: DEFAULT_RADIUS_VALUES.tight, // 5
  /** Progress bar, and the Mantine scale's `sm` step — two steps below the control radius. */
  fine: DEFAULT_RADIUS_VALUES.fine, // 4
  /** The Mantine `radius` scale's `xs` step — independent of both anchors. */
  scaleXs: 2,
  /** The Mantine `radius` scale's `lg` step — independent of both anchors. */
  scaleLg: 16,
  /** The Mantine `radius` scale's `xl` step — independent of both anchors. */
  scaleXl: 32,
  /** Fully-rounded pill affordance (scroll-to-bottom button, chips). Fixed — a pill reads round at
   * any radius level, so it does not track the knob (like the scale stops above). */
  pill: 9999,
} as const

/**
 * The shared level-0 control-height number — Mantine's own `--input-height-md`/`--button-height-md`
 * both resolve to `2.625rem` (42px at the 16px root), and `--ai-size-input-md` matches too. `SPACE_
 * ANCHORS_BASE.controlHeight`/`.inputHeight` below both read THIS one constant (not two independent
 * literals) so a control paired with a `size="md"` Input can never drift from it, no matter how
 * either key is retuned later — see `controlHeight`'s doc for the anchor this fixes.
 */
const CONTROL_HEIGHT_BASE = 42

/**
 * Density-tracking semantic spacing anchors — the values {@link deriveSpacing}'s `level` knob
 * retunes together, the spacing analog of `RADIUS` above. Frequency-audited from the component
 * sweep: `rowInsetX`/`rowInsetY` are the `6px 10px` row inset that appears verbatim in 4 places
 * (NavLink root, Menu item), `stackXs`..`stackXl` are the 4px vertical rhythm (rebuilt from ONE
 * scaled unit at non-zero levels — see {@link deriveSpacing}'s doc for why), and `inputHeight`/
 * `controlHeight` are a `size: 'md'` Mantine Input's/Button's/ActionIcon's resolved height
 * (Mantine's own default: `2.625rem` = 42px at the 16px root) — re-pointed onto `--vx-space-input-
 * height`/`--vx-space-control-height` by `theme/index.ts`'s `Input.extend`/`Button.extend`/
 * `ActionIcon.extend` `vars` (see `Input.extend`'s doc comment for why `--input-height`/`--button-
 * height`/`--ai-size`, not `size`, is the override point). `tokens/index.ts`'s `frameworkDerived`
 * emits each of these as a `--vx-space-*` CSS var from these SAME numbers, and `theme/index.ts`
 * re-points its NavLink/Menu/Input/Button/ActionIcon geometry onto that var, so the var and every
 * JS default read one source instead of two that can drift apart. This is the BASE (level-0) table
 * {@link deriveSpacing} scales from.
 */
const SPACE_ANCHORS_BASE = {
  /** Horizontal inset of a nav/menu row (NavLink root, Menu item). */
  rowInsetX: 10,
  /** Vertical inset of a nav/menu row (NavLink root, Menu item). */
  rowInsetY: 6,
  /** The 4px vertical rhythm's tightest step. Rebuilt from a single scaled unit at non-zero levels
   * (see {@link deriveSpacing}'s doc) — this literal is the level-0 reference only. */
  stackXs: 4,
  /** The 4px vertical rhythm, 2nd step — always `2 * stackXs` (see {@link deriveSpacing}'s doc). */
  stackSm: 8,
  /** The 4px vertical rhythm, 3rd step — always `3 * stackXs`; coincides with `SPACE_SCALE.sm` at
   * level 0 (see that constant's doc for why the two stay independent regardless). */
  stackMd: 12,
  /** The 4px vertical rhythm, 4th step — always `4 * stackXs`; coincides with `SPACE_SCALE.md` at
   * level 0. */
  stackLg: 16,
  /** The 4px vertical rhythm's widest step — always `6 * stackXs`; coincides with `SPACE_SCALE.xl`
   * at level 0. */
  stackXl: 24,
  /** A `size: 'md'` Mantine Input's resolved height (see the group doc above). */
  inputHeight: CONTROL_HEIGHT_BASE,
  /** A `size: 'md'` Mantine Button's/ActionIcon's resolved height — the SAME number as `inputHeight`
   * (both read {@link CONTROL_HEIGHT_BASE}), so a Button/ActionIcon placed beside a `size="md"`
   * Input tracks it at every density level instead of only coinciding at level 0 (the defect this
   * anchor fixes — Mantine's own `--button-height-md`/`--ai-size` are static, density-blind). */
  controlHeight: CONTROL_HEIGHT_BASE,
} as const

/**
 * The Mantine `spacing` size-scale (`xs`/`sm`/`md`/`lg`/`xl`) — the app-wide generic rhythm every
 * `p=`/`m=`/`gap=` prop in every consumer resolves through. Density-tracking, like
 * `SPACE_ANCHORS_BASE` above, but deliberately a SEPARATE group even where a level-0 number
 * coincides with an anchor (today `xs`/`sm`/`md`/`xl` happen to equal `rowInsetX`/`stackMd`/
 * `stackLg`/`stackXl` — a past density pass landed there, not a law). An anchor is a SPECIFIC
 * component's inset (NavLink/Menu row padding); a scale stop is the GENERIC scale every layout call
 * site reads. Coupling them would mean retuning a nav row's inset silently reshapes every `p="xs"`
 * app-wide, and {@link deriveSpacing} could never move the two at different rates if they were
 * merged — the same reason `RADIUS_STEP.scaleXs`/`scaleLg`/`scaleXl` stay independent of `RADIUS`
 * even though `radius.md` happens to also equal `RADIUS.ctrl` (that one IS a documented law: the
 * control tier IS the `md` stop, hence `defaultRadius: 'md'` — no such relation exists here). Base
 * table for {@link deriveSpacing}.
 */
const SPACE_SCALE_BASE = {
  xs: 10,
  sm: 12,
  md: 16,
  lg: 18,
  xl: 24,
} as const

/**
 * Density-tracking, genuine one-offs — named insets that fit neither the anchor vertical rhythm/
 * row inset nor the generic scale rhythm above. Unlike `RADIUS_STEP`'s independent scale stops,
 * these DO track density; they are simply each their own single-use anchor, not part of either
 * group above. Base table for {@link deriveSpacing} — level 0 is UNCHANGED from the shipped
 * identity (locked by `theme/spacing.test.ts`).
 *
 * Extended by the CSS-module spacing sweep (`docs/STATUS.md`) — every hardcoded spacing literal in
 * `src/**\/*.module.css` now resolves through one of these named one-offs (or a `SPACE`/`SPACE_SCALE`
 * anchor above, reused where a site is genuinely that concept — e.g. `SPACE.rowInsetX` reused for
 * the sidebar frame/search/section-band/footer-row horizontal inset, `SPACE.stackXs/Sm/Md/Xl` reused
 * for Prose/Callout/ArticleCard vertical-rhythm margins that land exactly on the 4px grid). Two or
 * more sites sharing one entry below means they must render at the SAME value for a structural
 * reason (documented per group); a value that merely coincides with another site's number gets its
 * own entry instead — see `docs/STATUS.md`'s spacing-sweep note for the specific coincidental calls.
 *
 * Extended again by the density pass (this commit) with the STRUCTURAL chart constants
 * `tokens/index.ts`'s `VX` object used to hardcode directly (`legendGap`/`margin`/`dotR` — see the
 * "charts" group below) plus `progressBarSize` (the Progress bar's numeric `defaultProps.size`,
 * previously an untokenized literal `6`) — both are numeric Mantine `defaultProps`/SVG-prop sites
 * with the SAME "dev slider can't reach it" limitation as `timelineBullet` (see `deriveSpacing`'s
 * doc and the `theme-lab` "known constraint" note).
 */
const SPACE_STEP_BASE = {
  /** Timeline `defaultProps.bulletSize`. */
  timelineBullet: 22,

  // ── Shared across ≥2 sites (structural — must render at the same value) ──────────────────────
  // `stickyHeaderClearance`/`stickyHeaderClearanceMobile` USED to live here as ONE independent base
  // literal (84) — they don't any more. Both are DERIVED, post-`step`, from their OWN AppShell
  // header (`appShellHeaderHeight` / `appShellHeaderMobileHeight` below) instead (see
  // {@link deriveSpacing}'s doc for why): an independent literal could drift from the header it's
  // supposed to clear, which is exactly what happened (84 < 96, under-clearing the mobile header at
  // every level before this fix) — and a SINGLE derived value still over-cleared the desktop header
  // by 60px, since the desktop header is less than half the mobile one's height. `SpaceValues.step`
  // still carries both keys — see that type's own doc — they're just not part of this BASE table.
  /** NavLink leftSection icon-to-label gap — shared by `theme/nav-link.module.css` (every render
   * path) and `shell/app-sidebar.module.css`'s own `.link` rule (belt-and-suspenders on the same
   * DOM), and reused verbatim for `.footerBtn`/`.accountRow`'s icon gap (their own doc comments call
   * out "IDENTICAL geometry to a nav row"). */
  navIconGap: 10,
  /** Sidebar region-to-region gap: `.brand`'s bottom padding and `.searchSlot`'s bottom padding (in
   * both the expanded and collapsed rail variants) — the searchSlot comment explicitly says its gap
   * opens the nav region "the same way the brand row's own bottom padding does". */
  sidebarRegionGap: 12,

  // ── content/prose.module.css ──────────────────────────────────────────────────────────────────
  /** Blockquote rail's own vertical inset. */
  proseQuoteInsetY: 2,
  /** Blockquote text indent past the rail. */
  proseQuoteIndent: 12,
  /** Inline code chip vertical inset. */
  proseInlineCodeInsetY: 1.5,
  /** Inline code chip horizontal inset. */
  proseInlineCodeInsetX: 5,
  /** Raw `<pre>` fallback block vertical inset. */
  proseCodeBlockInsetY: 10,
  /** Raw `<pre>` fallback block horizontal inset. */
  proseCodeBlockInsetX: 12,
  /** Heading copy-link anchor's gap from the heading text. */
  proseHeadingAnchorGap: 6,
  /** Table cell vertical inset. */
  proseTableCellInsetY: 5,
  /** Table cell horizontal inset. */
  proseTableCellInsetX: 8,
  /** Chat-density list's bottom margin (top margin reuses `SPACE.stackXs`). */
  proseChatListGapBottom: 10,
  /** Chat-density list indent. */
  proseChatListIndent: 20,
  /** Chat-density list-item vertical margin. */
  proseChatListItemGap: 3,
  /** Chat-density nested-list vertical margin. */
  proseChatNestedListGap: 2,
  /** Chat-density heading top margin. */
  proseChatHeadingGapTop: 14,
  /** Chat-density heading bottom margin. */
  proseChatHeadingGapBottom: 6,
  /** Article-density paragraph bottom margin. */
  proseArticleParagraphGap: 14,
  /** Article-density list top margin. */
  proseArticleListGapTop: 6,
  /** Article-density list bottom margin. */
  proseArticleListGapBottom: 14,
  /** Article-density list indent. */
  proseArticleListIndent: 22,
  /** Article-density `h1` top margin. */
  proseArticleH1GapTop: 6,
  /** Article-density `h1` bottom margin. */
  proseArticleH1GapBottom: 14,
  /** Article-density `h2`/`h3`/`h4`-`h6` shared top margin — one heading-rhythm law repeated
   * verbatim across all three selectors, not a coincidence. */
  proseArticleHeadingGapTop: 30,
  /** Article-density `h2`/`h3`/`h4`-`h6` shared bottom margin (see `proseArticleHeadingGapTop`). */
  proseArticleHeadingGapBottom: 10,
  /** Article-density `h2`'s bottom-rule padding. */
  proseArticleH2RuleGap: 6,
  /** Article-density block-object (blockquote/pre/table/embedded div) margin. */
  proseArticleBlockGap: 18,

  // ── content/article-layout.module.css ─────────────────────────────────────────────────────────
  /** Content-column-to-TOC-rail column gap. The governing `@media (max-width: 1200px)` breakpoint
   *  (`article-layout.module.css`) is deliberately NOT density-coupled — it is a viewport-comfort
   *  threshold for showing the TOC rail at all, not a sum of the column tracks: the grid's first
   *  column is `minmax(0, var(--vx-prose-measure))`, a FLEXIBLE track that shrinks to fit rather
   *  than a fixed width the breakpoint would need to sum. A gap and a responsive breakpoint are
   *  different concepts — forcing them to move together would be the coincidence-not-law trap in
   *  reverse (see `articleTocRailWidth` below for the track this gap sits beside, which — unlike
   *  the breakpoint — IS a genuine density-tracking dimension). */
  articleColumnGap: 56,
  /** TOC rail's own grid-column track width (`.root`'s `grid-template-columns` second track). The
   *  rail's contents (`content/toc.module.css`'s link rows) already track density via
   *  `tocLinkInsetY`/`tocLinkIndent`/`tocSubIndent`, so a fixed-width raw literal here would squeeze
   *  those rows' available space as density rises instead of growing with them — the inverse of the
   *  AppShell navbar/rail-width tokenization, same rationale. */
  articleTocRailWidth: 220,
  /** Meta header's own vertical stack gap (title/description/metaRow). */
  articleHeaderGap: 10,
  /** Meta header's bottom padding (above its divider). */
  articleHeaderPaddingBottom: 20,
  /** Meta header's bottom margin (below its divider). */
  articleHeaderMarginBottom: 28,
  /** Meta-row icon-to-text gap. */
  articleMetaRowGap: 6,
  /** Prev/next footer's column gap. */
  articleFooterGap: 12,
  /** Prev/next footer's top margin (above its divider). */
  articleFooterMarginTop: 40,
  /** Prev/next footer's top padding (below its divider). */
  articleFooterPaddingTop: 20,
  /** Prev/next nav-target icon-to-text gap. */
  articleNavTargetGap: 6,

  // ── content/code-block.module.css ─────────────────────────────────────────────────────────────
  /** Header's title-to-controls gap. */
  codeBlockHeaderGap: 8,
  /** Header's vertical inset. */
  codeBlockHeaderInsetY: 6,
  /** Header's right inset (before the header-right control cluster). */
  codeBlockHeaderInsetRight: 10,
  /** Content-column left edge — shared by the header's left inset and the body's horizontal inset,
   * so the header title and the code text line up on the same left edge. */
  codeBlockContentInsetX: 14,
  /** Header-right control cluster's own gap. */
  codeBlockHeaderRightGap: 6,
  /** Body's vertical inset. */
  codeBlockBodyInsetY: 10,
  /** Floating copy button's corner offset — one value reused for both `top` and `right`. */
  codeBlockFloatingCopyOffset: 6,

  // ── content/callout.module.css ────────────────────────────────────────────────────────────────
  /** Panel vertical inset. */
  calloutInsetY: 10,
  /** Panel horizontal inset. */
  calloutInsetX: 14,
  /** Title row's icon-to-text gap. */
  calloutTitleRowGap: 8,

  // ── content/toc.module.css ────────────────────────────────────────────────────────────────────
  /** Rail's own vertical stack gap (header-to-list). */
  tocRootGap: 6,
  /** Link row's vertical inset. */
  tocLinkInsetY: 4,
  /** Link row's text indent past the rail guide. */
  tocLinkIndent: 12,
  /** Nested (sub-heading) link's extra indent. */
  tocSubIndent: 24,

  // ── content/article-card.module.css ───────────────────────────────────────────────────────────
  /** Tag row's own gap. */
  articleCardTagsGap: 4,
  /** Tag chip's vertical inset. */
  articleCardTagInsetY: 1,
  /** Tag chip's horizontal inset. */
  articleCardTagInsetX: 6,
  /** Meta line's top gap. */
  articleCardMetaGapTop: 2,

  // ── content/guide.module.css ──────────────────────────────────────────────────────────────────
  /** Drawer body's bottom gap (before the footer). */
  guideBodyGapBottom: 8,
  /** Footer's top margin (above its divider). */
  guideFooterGapTop: 20,
  /** Footer's top inset (below its divider). */
  guideFooterInsetTop: 16,

  // ── shell/sidebar-search.module.css ───────────────────────────────────────────────────────────
  /** Trigger's icon-to-label gap. */
  sidebarSearchGap: 8,
  /** Trigger's height — floored at 24px in {@link deriveSpacing} (WCAG 2.5.8 minimum target size);
   * the collapsed rail's `ActionIcon` variant reads the SAME resolved value (`shell/sidebar-
   * search.module.css`'s `.railBtn`), so both states of the control stay consistent at every level. */
  sidebarSearchTriggerHeight: 32,

  // ── dashboard/settings-section.module.css ─────────────────────────────────────────────────────
  /** Row's vertical inset. */
  settingsRowInsetY: 10,
  /** Row's own gap (label cluster to control). */
  settingsRowGap: 16,

  // ── content/mermaid.module.css ────────────────────────────────────────────────────────────────
  /** Diagram container's inset (all sides). */
  mermaidContainerInset: 16,

  // ── shell/app-sidebar.module.css (beyond the shared/reused anchors above) ────────────────────
  /** Brand row's top inset. */
  sidebarBrandInsetTop: 3,
  /** Brand row's horizontal inset. */
  sidebarBrandInsetX: 8,
  /** Gap between nav sections. */
  sidebarSectionGap: 15,
  /** Account row's top inset. */
  sidebarAccountInsetTop: 11,
  /** Account row's horizontal inset. */
  sidebarAccountInsetX: 8,
  /** Account row's bottom inset. */
  sidebarAccountInsetBottom: 3,
  /** Identity-initials avatar block's fixed size (width and height). */
  sidebarAvatarSize: 28,
  /** Section-label row's bottom gap (before the first nav row). */
  sidebarSectionLabelGap: 3,
  /** Collapsible child-list wrapper's top margin. */
  sidebarChildListGapTop: 2,
  /** Collapsible child-list wrapper's bottom margin. */
  sidebarChildListGapBottom: 4,
  /** Collapsible child-list wrapper's left indent. */
  sidebarChildListIndent: 17,
  /** Child NavLink row's vertical inset. */
  sidebarChildRowInsetY: 5,
  /** Child NavLink row's extra left indent (past the rail guide). */
  sidebarChildRowIndent: 14,

  // ── shell/app-sidebar.tsx & app-sidebar-account.tsx (Mantine `<Menu width={…}>` props) ────────
  // Both are FIXED dropdown widths (a JSX number prop, not CSS — same "JS-consumed, no --vx-* var"
  // shape as `appShellNavbarWidth` etc.) holding `Menu.Item` rows padded by `rowInsetX`/`rowInsetY`
  // (`theme/index.ts`'s `Menu.extend`). Unlike `.subnavDropdown`'s `min-width: 180px`
  // (`app-sidebar.module.css`, deliberately left a raw literal — a `min-width` only floors the box
  // and it grows with content, so it can never squeeze), a `width` prop caps the dropdown exactly:
  // as density rises the row's padding/line-height need more room than a frozen width can give,
  // squeezing the label text — the same rationale `articleTocRailWidth` documents for its own
  // fixed-width track.
  /** Account-menu `<Menu width={…}>` (`app-sidebar-account.tsx`). */
  sidebarAccountMenuWidth: 220,
  /** Settings-menu `<Menu width={…}>` (`app-sidebar.tsx`). */
  sidebarSettingsMenuWidth: 200,

  // ── shell/app-header.module.css ───────────────────────────────────────────────────────────────
  /** Mobile two-row header's page-actions row height. */
  appHeaderMobileActionsHeight: 52,

  // ── shell/index.tsx (AppShell dimensions) ──────────────────────────────────────────────
  /** AppShell desktop header bar height — sized to hold one row of `size="md"` controls, so it
   *  tracks `controlHeight`. Its level-0 coincidence with `appShellNavbarRailWidth` below is a
   *  coincidence, not a law: this is a horizontal bar's HEIGHT (governed by control height), that
   *  is a vertical rail's WIDTH (governed by icon footprint). They stay separate entries. */
  appShellHeaderHeight: 48,
  /** AppShell mobile (two-row) header height. Not one concept but a sum: row 1 + `app-header.
   *  module.css`'s wrap row-gap (`--mantine-spacing-sm`) + `appHeaderMobileActionsHeight`. Two of
   *  those three addends already track density, so the container must too — held fixed, row 1's
   *  budget collapses 52px -> 12px across the level range. */
  appShellHeaderMobileHeight: 96,
  /** AppShell navbar width, expanded — ONE entry for both the `base` (mobile drawer) and the
   *  expanded `sm` value: the same `.root` at full width, genuinely one concept. */
  appShellNavbarWidth: 216,
  /** AppShell navbar width, collapsed icon rail. Separate from `appShellHeaderHeight` above
   *  despite sharing 48 at level 0 (see that entry's note). */
  appShellNavbarRailWidth: 48,

  // ── shell/app-mobile-nav.module.css ───────────────────────────────────────────────────────────
  /** Tab's icon-to-label gap. */
  mobileNavTabGap: 3,

  // ── charts (tokens/index.ts's `VX` object — structural, tracks density) ──────────────────────
  // `VX.lineWidth`/`VX.line2Width` are DELIBERATELY absent here — they are stroke WEIGHTS (line
  // thickness), not spacing/gaps/sizes, so they stay fixed regardless of density (see `VX` in
  // `tokens/index.ts`). The six below are gaps/margins/a marker footprint — genuinely spacing.
  /** `ChartLegend`'s column/row gap (`VX.legendGap`). */
  chartLegendGap: 22,
  /** Chart plot-area margin, top (`VX.margin.top`). */
  chartMarginTop: 12,
  /** Chart plot-area margin, right (`VX.margin.right`). */
  chartMarginRight: 16,
  /** Chart plot-area margin, bottom (`VX.margin.bottom`). */
  chartMarginBottom: 30,
  /** Chart plot-area margin, left (`VX.margin.left`). */
  chartMarginLeft: 44,
  /** Data-point marker radius (`VX.dotR`) — a discrete visual footprint, not a stroke weight, so
   * (unlike `lineWidth`/`line2Width`) it tracks density: a judgment call, made this way because it
   * reads as a "size" (closer to `sidebarAvatarSize` above) rather than a line thickness. */
  chartDotR: 5,

  // ── theme/index.ts's Progress `defaultProps.size` (previously an untokenized literal `6`) ──────
  /** Progress bar thickness (`components.Progress.defaultProps.size`) — a numeric Mantine size prop,
   * same "dev slider can't reach it, production `{ density }` rebuilds it" limitation as
   * `timelineBullet` above (see `deriveSpacing`'s doc). */
  progressBarSize: 6,
} as const

/**
 * Density-EXEMPT structurals — unlike `SPACE`/`SPACE_STEP` above, these never move with the density
 * knob. `tokens/index.ts` does NOT emit these as `--vx-*` CSS vars (see the comment there for why: a
 * var would only invite someone to think they move).
 */
export const SPACE_FIXED = {
  /** Timeline `defaultProps.lineWidth`; also used for 1px borders. */
  hairline: 1,
  /** ReadingProgress's fixed top-bar height — a hairline-like indicator line (docs/CONTENT-SPEC.md
   * §7), not a spacing gap that should thicken with density. Stays a literal at its one call site
   * (`content/reading-progress.module.css`), same as `hairline`. */
  readingProgressHeight: 2,
  /** SegmentedControl track's optical inset (`styles.root` padding) — moved OUT of `SPACE_STEP` and
   * exempted from the density knob because it is load-bearing for the nested-corner law
   * (docs/DESIGN-SPEC.md §4): `RADIUS.card === RADIUS_STEP.tight + segmentedTrackInset` (`7 = 5 +
   * 2`). `RADIUS.card`/`RADIUS_STEP.tight` both shift together under the RADIUS knob (`card = 7 +
   * level`, `tight = ctrl - 1 = 5 + level`), so their difference is ALWAYS exactly 2 regardless of
   * that knob — a density-tracking inset would break concentricity in both directions (verified: this
   * inset's own value, HAD it stayed density-tracking, resolves via `scaleSpace(2, level, multiplier)`
   * to 1 at density's floor level -3 and 3 at its ceiling level +3 — the widest swing `deriveSpacing`'s
   * `[-3, 3]` range can produce) for no compensating benefit, since the two radii it sits between
   * never move independently of each other. */
  segmentedTrackInset: 2,
} as const

/**
 * The resolved shape {@link deriveSpacing} returns — the two anchor/scale base groups above (as
 * `anchors`/`scale`) PLUS every `SPACE_STEP_BASE` one-off (as `step`) and the NavLink row
 * line-height (as `rowLineHeight`), all scaled together from one integer `level`. Kept as separate
 * groups rather than flattened into one object for the same reason `SPACE_SCALE_BASE`'s doc gives:
 * the law must be free to move an anchor and a scale stop at different rates. The spacing analog of
 * {@link RadiusValues}.
 */
export type SpaceValues = {
  anchors: { [K in keyof typeof SPACE_ANCHORS_BASE]: number }
  scale: { [K in keyof typeof SPACE_SCALE_BASE]: number }
  /** `SPACE_STEP_BASE`'s one-offs PLUS `stickyHeaderClearance`/`stickyHeaderClearanceMobile`, NEITHER
   * of which is in that base table — both are computed after the rest of `step`, one from
   * `appShellHeaderHeight` (desktop) and one from `appShellHeaderMobileHeight` (mobile), see
   * {@link deriveSpacing}'s doc. Kept on this same `step` object (not split into a third group)
   * because every consumer reads them exactly like any other one-off — only their DERIVATION
   * differs. Two keys, not one, because the clearance is RESPONSIVE (Decision 3): a consumer picks
   * whichever one matches the breakpoint it's rendering at — see `docs/CONTENT-SPEC.md` §5 and
   * `content/prose.module.css`/`content/article-layout.module.css` for the CSS-side split. */
  step: { [K in keyof typeof SPACE_STEP_BASE]: number } & {
    stickyHeaderClearance: number
    stickyHeaderClearanceMobile: number
  }
  /** NavLink row line-height (`theme/index.ts`'s row-geometry styles) — additive, not
   * multiplicative; see {@link deriveSpacing}'s doc for why. */
  rowLineHeight: number
}

/**
 * Scale one density-tracking spacing number by `multiplier`, rounding to the nearest integer and
 * clamping at an UNCONDITIONAL floor of 1 (an aggressive negative level can never collapse a real
 * inset to 0 or below).
 *
 * At `level === 0` the multiplier is exactly 1 — return `value` verbatim instead of routing it
 * through `Math.round`, so a non-integer base (`proseInlineCodeInsetY: 1.5`) stays byte-identical
 * rather than rounding to `2` (`Math.round(1.5 * 1)` rounds half-up) — the level-0 acceptance gate
 * (`theme/spacing.test.ts`) requires the EXACT shipped number, not merely an equal one.
 *
 * The floor is UNREACHABLE through {@link deriveSpacing}'s public `[-3, 3]` level range TODAY: every
 * `SPACE_ANCHORS_BASE`/`SPACE_SCALE_BASE`/`SPACE_STEP_BASE` value is an integer `>= 1`, the
 * shallowest multiplier `deriveSpacing` ever passes is `0.7` (level `-3`), and `round(v * 0.7)` is
 * already `>= 1` for every `v >= 1` (`round(1 * 0.7)` is `1`, the smallest case) — so the clamp
 * never changes the result on that path YET. It is applied unconditionally (not gated behind
 * `value >= 1`) precisely so a FUTURE base `< 1` doesn't silently round to 0: a gated floor only
 * protects inputs that could never reach 0 in the first place and skips the one case that could
 * (`round(0.5 * 0.7) = round(0.35) = 0` for a hypothetical `0.5` base at level `-3`, unguarded by a
 * `value >= 1` gate). Exported (not re-exported by the `./tokens` barrel — this stays outside the
 * published surface, `scripts/export-surface.json`) purely so `palette.test.ts` can drive the clamp
 * directly with a `multiplier`/`value` pair `deriveSpacing` itself can never produce, and prove the
 * floor still holds if a base or the level range ever changes.
 */
export function scaleSpace(value: number, level: number, multiplier: number): number {
  if (level === 0) return value
  const scaled = Math.round(value * multiplier)
  return Math.max(1, scaled)
}

/** Apply {@link scaleSpace} across every value of a base table, preserving its exact key set (a
 * mapped type, not `Record<string, number>`, so a renamed/removed key still fails `tsc` downstream). */
function mapSpaceGroup<T extends Record<string, number>>(
  base: T,
  level: number,
  multiplier: number,
): { -readonly [K in keyof T]: number } {
  const out = {} as { -readonly [K in keyof T]: number }
  for (const key of Object.keys(base) as (keyof T)[])
    out[key] = scaleSpace(base[key]!, level, multiplier)
  return out
}

/**
 * `rowLineHeight`'s own additive per-level step — see {@link deriveSpacing}'s doc for why it is a
 * SEPARATE, explicitly hand-tuned constant rather than something computed from `deriveSpacing`'s
 * own `multiplier`. A prior version of this law computed it as `(multiplier - 1) / 3` and
 * documented that as "derived from `multiplier` itself... so retuning the multiplier's step can
 * never desync this from it" — that claim was false: `/ 3` was itself a second hand-tuned
 * coefficient (reverse-engineered to reproduce the old `1.25`/`1.45` endpoints), and worse, it
 * silently coupled a unitless typographic ratio (line-height) to a px spacing scale factor, so a
 * future purely-spatial retune of `multiplier`'s own coefficient would have moved NavLink row
 * line-height with no typography decision made anywhere. This constant is the honest version of
 * the same idea: still hand-picked to land on the identical `1.25`..`1.45` envelope the old
 * `1.35 + 0.02 * level` law produced at the pre-narrowing `[-5, 5]` range (`0.02 * 5 ===
 * ROW_LINE_HEIGHT_STEP * 3`), but as its own named number — a future edit to the spacing
 * multiplier's `0.1` cannot silently drag this along with it, and a future edit to typography
 * (this constant) cannot silently distort spacing.
 */
const ROW_LINE_HEIGHT_STEP = 1 / 30

/**
 * Derive every density-tracking spacing number (anchors, scale stops, one-offs, row line-height)
 * from a single integer `level` (`docs/DESIGN-SPEC.md` §4-adjacent) — the spacing analog of
 * {@link deriveRadius}. `level: 0` reproduces the shipped identity exactly (locked by
 * `theme/spacing.test.ts` and `tokens/density.test.ts`) for every value EXCEPT
 * `step.stickyHeaderClearance`/`step.stickyHeaderClearanceMobile` — see the third bullet below for
 * why those are a deliberate exception.
 *
 * The law: a MULTIPLIER, `1 + 0.1 * level`, applied to every `SPACE_ANCHORS_BASE`/
 * `SPACE_SCALE_BASE`/`SPACE_STEP_BASE` constant, then rounded (see {@link scaleSpace}) — a
 * multiplier rather than an additive step because these values span 1px to 180px; an additive
 * constant would distort small and large insets by wildly different proportions.
 *
 * Three groups deviate from the plain per-value multiplier above:
 *
 *  - `stackXs`..`stackXl` (the 4px vertical rhythm) are rebuilt from ONE scaled unit —
 *    `unit = scaleSpace(4, level, multiplier)`, then `stackXs = unit`, `stackSm = 2 * unit`,
 *    `stackMd = 3 * unit`, `stackLg = 4 * unit`, `stackXl = 6 * unit` — instead of each step
 *    independently rounding its own base. Independent rounding breaks the rhythm at non-zero levels
 *    (level +1 used to land 4/8/13/17/25, no common factor) and silently drifts the documented 2:1
 *    pairs (`stackXl`:`stackMd`, `stackLg`:`stackSm`) by a px at almost every level; the shared-unit
 *    rebuild keeps every step an exact multiple of `unit` and both pairs exactly 2:1, at every level
 *    including 0 (`unit` is 4 there, reproducing 4/8/12/16/24 verbatim). `SPACE_SCALE_BASE`'s own
 *    `xs`/`sm`/`md`/`lg`/`xl` stops do NOT get this treatment — that group's `sm`:`xl` 1:2 coincidence
 *    is documented as incidental (a past density pass landed there), not a law like the stack rhythm's,
 *    so it keeps the plain per-value multiplier.
 *  - `step.sidebarSearchTriggerHeight` is floored at 24px after scaling — WCAG 2.5.8's minimum
 *    interactive-target size. Without the floor, a negative level shrinks the sidebar search trigger
 *    (and, transitively, the collapsed rail's `ActionIcon` variant, which reads this same resolved
 *    value) below the accessible floor (22px at level -3) while also crowding out its fixed-size icon
 *    and `Kbd` chip.
 *  - `step.stickyHeaderClearance` (desktop) and `step.stickyHeaderClearanceMobile` (mobile) are not
 *    scaled off their own base AT ALL — `SPACE_STEP_BASE` has no such key any more (see that table's
 *    doc). Both are computed AFTER the rest of `step`, RESPONSIVELY, one per AppShell breakpoint:
 *    `stickyHeaderClearance = step.appShellHeaderHeight + anchors.stackMd` (desktop, `>= sm`) and
 *    `stickyHeaderClearanceMobile = step.appShellHeaderMobileHeight + anchors.stackMd` (mobile,
 *    `< sm` — the SAME `sm`/48em breakpoint the AppShell header itself switches on, `shell/index.tsx`).
 *    A SINGLE clearance value (this law's own prior shape) can only be tuned against ONE header, and
 *    whichever one it under-shoots stays broken: the original independent literal (84) was tuned only
 *    against the desktop header (48) and under-cleared the mobile header (96) by 12px at level 0
 *    already, before density entered the picture; deriving ONE value off the taller mobile header
 *    fixed that under-clear but then OVER-cleared the desktop header by 60px (108 vs. the 48px header
 *    needs) — dead space above every anchored heading and a TOC rail shoved down on the common
 *    (desktop) path. Splitting into two responsive values fixes both directions at once: each clears
 *    ONLY its own header, with the SAME `anchors.stackMd` breathing room (not a bare `+ 0`) so a
 *    scrolled-to heading doesn't sit flush against the header's bottom edge — density-tracking, like
 *    the header height it's added to, so the margin itself never freezes at one notch. Level 0:
 *    desktop `48 + 12 = 60` (a deliberate BREAK from the pre-split 84/108 — see `theme/spacing.test.ts`
 *    for why `stickyHeaderClearance` alone is exempt from the byte-identity gate every other spacing
 *    token is held to), mobile `96 + 12 = 108` (unchanged from the pre-split single-value law).
 *    **Consumer coupling (accepted, not hidden):** both values assume `BasaltShell`'s own AppShell
 *    header heights — a `./content` consumer NOT rendering inside `BasaltShell` (e.g. `Prose`/
 *    `ArticleLayout` standalone) gets clearance numbers tuned for a header it may not have, and must
 *    override `--vx-space-sticky-header-clearance`/`--vx-space-sticky-header-clearance-mobile`
 *    itself. Documented on the `./content` surface too (`docs/CONTENT-SPEC.md` §5), not only here.
 *
 * `rowLineHeight` is the ONE exception to the multiplier entirely: `1.35 + ROW_LINE_HEIGHT_STEP *
 * level`, ADDITIVE, its own gentler, INDEPENDENT coefficient (see {@link ROW_LINE_HEIGHT_STEP}'s own
 * doc for why it must stay independent of `multiplier`). It carries the NavLink row's
 * `lineHeight: '1.35'` (`theme/index.ts`, load-bearing for row height) along with the row's padding,
 * but the multiplier law would overshoot it — `1.35 * 1.3` at level +3 is already a much larger
 * relative move than the padding it accompanies, well past the readable line-height range. The
 * additive step instead lands `1.25`..`1.45` across the full range, a proportionate nudge. Rounded
 * to 2 decimals (`Math.round(x * 100) / 100`) to avoid floating-point noise (`1.35 +
 * ROW_LINE_HEIGHT_STEP * 3` is not exactly `1.45` in raw IEEE-754 arithmetic).
 *
 * `SPACE_FIXED` is NEVER part of this law — see that constant's own doc for why.
 *
 * **What actually tracks a retuned `level`, end to end, and what doesn't** (the real scope of the
 * "dev slider gap" — bigger than "a few numeric `defaultProps`", but ALSO narrower than it looks at
 * first glance — see the Input/Button/ActionIcon note below):
 *  - `createBasaltTheme({ density })` (`../theme`) rebuilds `theme.spacing` (the generic Mantine
 *    scale) AND every density-anchored `defaultProps`/`styles` number (Timeline's `bulletSize`,
 *    Progress's `size`) from THIS function's output — this is the one production entry point, and it
 *    is complete for all of those.
 *  - `theme-lab/DeriveControls` (the DEV-tool slider) can only move `--vx-*` CSS custom properties
 *    via an injected `<style>` — it CANNOT reach a numeric `defaultProps`/SVG-prop value baked into
 *    the theme object at all, so Timeline's `bulletSize` and Progress's `size` stay visibly static
 *    there. The SAME limitation applies to `theme.spacing` itself (the generic Mantine `xs`/`sm`/
 *    `md`/`lg`/`xl` scale): `createBasaltTheme({ density })` bakes it into the theme object as
 *    rem strings (`theme/index.ts`'s `buildTheme`), and `spaceDecls` (`tokens/index.ts`) deliberately
 *    emits no `--vx-space-scale-*`/`--mantine-spacing-*` var for it (see that function's own doc) —
 *    so the dev slider's injected `<style>` cannot reach it either, and a component reading
 *    `var(--mantine-spacing-sm)` (e.g. `shell/app-header.module.css`) stays at its level-0 value
 *    under the dev slider even though it correctly retunes on the production path. Input's/Button's/
 *    ActionIcon's `size="md"` height is NOT in this bucket, despite reading
 *    like the same shape of gap: `theme/index.ts`'s `Input.extend`/`Button.extend`/`ActionIcon.extend`
 *    resolve their height through `vars` (`--input-height`/`--button-height`/`--ai-size`, each wrapping
 *    `var(--vx-space-input-height)`/`var(--vx-space-control-height)` in a `calc(...)`), not a numeric
 *    `defaultProps` literal — a CSS custom property the dev slider's injected `<style>` CAN reach, so
 *    it DOES visibly follow the Density slider there too, not only in production.
 *  - `tokens/index.ts`'s `VX.legendGap`/`VX.margin`/`VX.dotR` (chart legend gap, plot-area margins,
 *    marker radius) are the ONE case that fails BOTH paths — including the PRODUCTION one. `VX` is
 *    built once at module load from the frozen level-0 `SPACE_STEP` snapshot (visx SVG props read
 *    plain JS numbers, not `var()` strings), so it never re-reads a `density` option passed to
 *    `createBasaltTheme` at all — a genuine, currently-unfixed production gap, not merely a
 *    dev-tool-only limitation like the `defaultProps` above.
 *
 * Throws on a non-integer or out-of-range (`[-3, 3]`) level — same throw-and-propagate discipline as
 * `deriveRadius`/`deriveTokens`'s accent-seed validation.
 *
 * The range is `[-3, 3]`, not `[-5, 5]` like `deriveRadius` — a DELIBERATE, narrower range with a
 * steeper per-notch coefficient (`0.1`, not `0.06`) chosen so the two endpoints reproduce the exact
 * SAME multiplier envelope (`0.7`..`1.3`, `3 * 0.1 === 5 * 0.06`) at fewer, more meaningful notches.
 * At `0.06`/±5, an integer base `v <= 8` (41 of the 108 spacing values, including the entire 4px
 * stack rhythm) is BYTE-IDENTICAL to level 0 at one notch of movement (`0.06 * v < 0.5` rounds back
 * to `v`) — not a dead zone at one notch, but uniform over-quantization across the whole range: the
 * knob advertised more resolution than integer-px rounding could carry. `0.1`/±3 keeps the identical
 * expressive envelope (nothing about how compact/spacious the knob can go changes) while dropping
 * the frozen-at-one-notch count from 43 (at ±1) to 18/22 — see `Fix 7` in
 * `theme/density-relations.test.ts` for the regression guards that pin this down.
 */
/** `deriveSpacing`'s accepted level range — exported (not through the `./tokens` barrel, same
 * precedent as {@link scaleSpace}) so `density-relations.test.ts`'s `ALL_LEVELS` can derive the
 * levels it loops over from the SAME bound `deriveSpacing` enforces, instead of a hardcoded literal
 * that silently stops covering the real range if the range ever changes again (as it already has
 * once, `[-5, 5]` -> `[-3, 3]` — see this function's own doc above). */
export const DENSITY_LEVEL_RANGE = { min: -3, max: 3 } as const

export function deriveSpacing(level: number): SpaceValues {
  if (
    !Number.isInteger(level) ||
    level < DENSITY_LEVEL_RANGE.min ||
    level > DENSITY_LEVEL_RANGE.max
  ) {
    throw new Error(
      `deriveSpacing: level must be an integer in [${DENSITY_LEVEL_RANGE.min}, ${DENSITY_LEVEL_RANGE.max}], got ${level}`,
    )
  }
  const multiplier = 1 + 0.1 * level
  const anchors = mapSpaceGroup(SPACE_ANCHORS_BASE, level, multiplier)
  // Rebuild the 4px stack rhythm from one scaled unit so the documented 2:1 pairs hold exactly at
  // every level, not just level 0 (see this function's doc for why independent rounding broke it).
  const stackUnit = scaleSpace(4, level, multiplier)
  anchors.stackXs = stackUnit
  anchors.stackSm = stackUnit * 2
  anchors.stackMd = stackUnit * 3
  anchors.stackLg = stackUnit * 4
  anchors.stackXl = stackUnit * 6

  const mappedStep = mapSpaceGroup(SPACE_STEP_BASE, level, multiplier)
  // WCAG 2.5.8 minimum interactive-target size — see this function's doc for why the trigger's
  // density-tracking height alone can't be trusted to stay accessible at a negative level.
  mappedStep.sidebarSearchTriggerHeight = Math.max(24, mappedStep.sidebarSearchTriggerHeight)
  const step: SpaceValues['step'] = {
    ...mappedStep,
    // RESPONSIVE, one per AppShell breakpoint — each DERIVED from its own header, plus
    // density-tracking breathing room — see this function's doc (third bullet, Decision 3) for the
    // full rationale, and `theme/spacing.test.ts` for why `stickyHeaderClearance` alone is exempt
    // from the level-0 byte-identity gate.
    stickyHeaderClearance: mappedStep.appShellHeaderHeight + anchors.stackMd,
    stickyHeaderClearanceMobile: mappedStep.appShellHeaderMobileHeight + anchors.stackMd,
  }

  return {
    anchors,
    scale: mapSpaceGroup(SPACE_SCALE_BASE, level, multiplier),
    step,
    // Additive, gentler, INDEPENDENT law than the multiplier — see `ROW_LINE_HEIGHT_STEP`'s own doc
    // for why it must NOT be computed from `multiplier`.
    rowLineHeight: Math.round((1.35 + ROW_LINE_HEIGHT_STEP * level) * 100) / 100,
  }
}

/** `deriveSpacing(0)` — the shipped identity's spacing values, computed once. `SPACE`/`SPACE_SCALE`/
 * `SPACE_STEP`/`ROW_LINE_HEIGHT` below are defined FROM this, the same way `RADIUS`/`RADIUS_STEP`
 * are defined from `DEFAULT_RADIUS_VALUES = deriveRadius(0)` — one source, so the two can never
 * drift. Exported so `theme/use-basalt-spacing.ts`'s `useBasaltSpacing` can fall back to it when
 * `theme.other.basaltDensity` is absent (the level-0 case — `createBasaltTheme` deliberately omits
 * that key at level 0, see `theme/index.ts`'s `isDefaultDensity` short-circuit). */
export const DEFAULT_SPACE_VALUES = deriveSpacing(0)

/** Density-tracking semantic spacing anchors at the shipped identity — see `SPACE_ANCHORS_BASE`'s
 * doc for what each key means. `deriveSpacing(0)`'s `anchors`, UNCHANGED from the pre-density-knob
 * shipped identity (locked by `theme/spacing.test.ts`). */
export const SPACE = DEFAULT_SPACE_VALUES.anchors

/** The Mantine `spacing` size-scale at the shipped identity — see `SPACE_SCALE_BASE`'s doc.
 * `deriveSpacing(0)`'s `scale`, UNCHANGED from the shipped identity (locked by
 * `theme/spacing.test.ts`). */
export const SPACE_SCALE = DEFAULT_SPACE_VALUES.scale

/** Density-tracking one-offs at the shipped identity — see `SPACE_STEP_BASE`'s doc. `deriveSpacing(0)`'s
 * `step`, UNCHANGED from the shipped identity (locked by `theme/spacing.test.ts`) EXCEPT
 * `stickyHeaderClearance` (originally 84, then a single derived 108, now the desktop half of the
 * Decision-3 responsive split at 60) and its new `stickyHeaderClearanceMobile` sibling (108) — the
 * deliberate level-0 breaks in the density work; see `deriveSpacing`'s doc (third bullet) for why. */
export const SPACE_STEP = DEFAULT_SPACE_VALUES.step

/** NavLink row line-height at the shipped identity (`1.35`) — `deriveSpacing(0)`'s `rowLineHeight`,
 * UNCHANGED from the shipped identity (locked by `theme/spacing.test.ts`). */
export const ROW_LINE_HEIGHT = DEFAULT_SPACE_VALUES.rowLineHeight

/**
 * Assemble every derive-config-dependent palette family from a resolved {@link DeriveConfig},
 * merged with the structural hand-authored tokens (neutrals' chart-chrome rgba()s, the floating
 * overlay surface, the divider fade) that never vary with the config. Pure function of `config` —
 * zero React, zero `@mantine/*`, zero browser API (the Mantine-free boundary applies here).
 *
 * `ACCENT` / `FILL` / `SURFACE` / `INK` / `SEMANTIC` / `STATUS` below are GENERATED from
 * `deriveTokens(config)` (`./derive.ts`) — never hand-edit one of those hexes; retune the derive
 * config or its calibrated constants instead. `SHADOW` / `BP` above are structural and unaffected.
 */
/** Parse a `#rrggbb` hex to an `[r, g, b]` triplet — a local, dependency-free copy (this module
 * can't reach into `theme/index.ts`'s own copy, and `hct.ts`'s is not exported). */
function hexToRgbTriplet(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** `rgba(r, g, b, a)` from a hex color — re-expresses the chart-chrome opacity ramps against the
 * DERIVED ink hex instead of a hand-picked one, so a custom `neutral`/seed still tracks. */
function inkRgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgbTriplet(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function buildPaletteDataUncached(config: DeriveConfig) {
  const DERIVED = deriveTokens(config)

  /** Spec status hues (`docs/DESIGN-SPEC.md` §2) — shared by SEMANTIC + STATUS below. */
  const SUCCESS: ColorPair = DERIVED.status.good
  const WARNING: ColorPair = DERIVED.status.warn
  const DANGER: ColorPair = DERIVED.status.bad

  /** Semantic status hues — solids + the family they fill from (alpha applied in the token layer). */
  const SEMANTIC = {
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
  const STATUS = {
    excellent: p(BP.forest),
    good: SUCCESS,
    warn: WARNING,
    bad: DANGER,
    neutral: p(BP.gray, 1, 2),
  } as const

  // The light-scheme opacity bases below key off the DERIVED light `ink` hex — not a hand-picked
  // near-black — so a custom seed/neutral still tracks. At the shipped default that hex is
  // `#262629` (the old hand-tuned `#262626` this replaces was a pre-derivation approximation, 1 LSB
  // off on the blue channel); the dark-scheme bases stay flat white (chart chrome inverts to a pure
  // white ink on dark, not a derived one).
  const inkLight = DERIVED.ink.ink.light

  /**
   * Theme-resolved neutrals (line / axis / grid / tooltip chrome). Mirrors the old
   * useVxTheme() outputs, retuned to the zinc identity.
   */
  const NEUTRAL = {
    line: { light: BP.gray[0], dark: BP.gray[4] }, // primary line
    line2: { light: BP.gray[1], dark: BP.gray[2] }, // secondary line
    axis: { light: inkRgba(inkLight, 0.6), dark: 'rgba(255,255,255,0.6)' },
    axisStroke: { light: inkRgba(inkLight, 0.12), dark: 'rgba(255,255,255,0.12)' },
    grid: { light: inkRgba(inkLight, 0.07), dark: 'rgba(255,255,255,0.06)' },
    crosshair: { light: inkRgba(inkLight, 0.32), dark: 'rgba(255,255,255,0.42)' },
    dotStroke: { light: BP.white, dark: BP.darkGray[1] }, // matches chart-area bg
    tooltipBg: { light: BP.white, dark: 'rgba(39,39,42,0.96)' },
    tooltipText: { light: inkRgba(inkLight, 0.88), dark: 'rgba(255,255,255,0.88)' },
    tooltipMuted: { light: inkRgba(inkLight, 0.5), dark: 'rgba(255,255,255,0.5)' },
    tooltipBorder: { light: `1px solid ${BP.lightGray[1]}`, dark: 'none' },
    tooltipShadow: {
      light: `0 2px 8px ${inkRgba(inkLight, 0.1)}`,
      dark: '0 2px 8px rgba(0,0,0,0.35)',
    },
    // Chart legend text — same DERIVED-ink treatment as axis/grid/tooltip* above (light keys off
    // `inkLight`; dark stays flat white like every other neutral chart-chrome pair here).
    legendText: { light: inkRgba(inkLight, 0.82), dark: 'rgba(255,255,255,0.92)' },
    // Base neutral for hairlines / muted / DIMMED text / overlays — apply opacity via alpha().
    // Binds to --mantine-color-dimmed, so it is THE dimmed-text lever. Equal to `INK.muted` (the
    // spec's "muted (secondary text)" row) — kept as its own pair for the pre-existing `--vx-neutral`
    // name (never renamed), while `INK.muted` below is the new explicit spec-named token. Both read
    // the SAME generated value (`DERIVED.ink.muted`) so a palette retune can't pull them apart.
    neutral: DERIVED.ink.muted,
  } as const

  /** Ink text ramp (`docs/DESIGN-SPEC.md` §2) — primary/emphasis/secondary/tertiary body text. */
  const INK = {
    ink: DERIVED.ink.ink, // primary text
    ink2: DERIVED.ink.ink2, // emphasis body
    muted: DERIVED.ink.muted, // secondary text (= NEUTRAL.neutral)
    faint: DERIVED.ink.faint, // tertiary text / micro-labels
  } as const

  /**
   * The one saturated sky-blue accent. It has TWO roles, and they are DIFFERENT COLORS —
   * conflating them is what made dark mode unfixable. The LAW below (not a hand-picked hex) is what
   * `./derive.ts` implements.
   *
   *  • `accent` — the accent as INK: link text, active-nav icon, chart lines, focus ring. It is
   *    read AGAINST THE PAGE, so it must be LIGHT on dark and DEEP on light. This pair inverts
   *    across schemes, as it must.
   *
   *  • `accentFill` — the accent as SURFACE: filled buttons, a checked Switch/Checkbox, the active
   *    Timeline bullet, the Composer send button. It CARRIES A LABEL, so it is squeezed from both
   *    sides at once: white text needs ≥3:1 (the codified UI-component floor — see `./derive.ts`'s
   *    `ON_ACCENT_WHITE_CONTRAST_MIN`) against the fill, AND the control needs ≥3:1 against the page
   *    it sits on. The generator places the fill in the Y=0.165 luminance band that satisfies both
   *    on both pages, so the fill is the SAME hex in both schemes, and `onAccent` is white whenever
   *    that floor holds (a near-black ink otherwise, for a fill brightened past the safety margin).
   *
   * `onAccent` is THE foreground for any accent fill. `theme/index.ts` bridges Mantine's
   * `--mantine-color-<primary>-filled` onto `--vx-accentFill` and every filled foreground onto
   * `--vx-onAccent`, so ONE token drives the chrome — which is also what makes the theme lab able to
   * retune the accent live. Mantine's own `autoContrast` cannot express this (it resolves the
   * foreground scheme-blindly, in JS). Regression-locked by `theme/contrast.test.ts`.
   */
  const ACCENT = {
    accent: DERIVED.accent, // accent as INK — inverts across schemes
    accentHover: DERIVED.accentHover,
    accentFill: DERIVED.accentFill, // accent as SURFACE — same hex in both schemes
    accentFillHover: DERIVED.accentFillHover, // deeper on hover
    onAccent: DERIVED.onAccent, // text on an accent fill
  } as const

  /**
   * Filled-surface hexes for the Mantine accent families — THE FILL BAND. The LAW below lives in
   * `./derive.ts`, not in a hand-picked hex here.
   *
   * A filled control is constrained from both sides at once (the `ACCENT` note above derives this
   * for the accent): a white label needs ≥4.5:1 against the fill, and the control needs ≥3:1
   * against the page behind it — on BOTH pages, since a fill does not invert across schemes. In
   * WCAG terms that pins the fill's relative luminance into one narrow band, ~0.150–0.183. There is
   * no room for a family to sit outside it: too light and the label dies, too dark and the button
   * fades into the dark page.
   *
   * So every family's fill is its own hue placed at the SAME luminance (0.165, the band's centre) —
   * `./derive.ts`'s `FILL_LUMINANCE`. The result is a system law rather than a per-color judgement
   * call: EVERY filled surface reads white, on either page, at ~4.9:1 / ~3.2:1 at the shipped
   * default.
   *
   * `blue` is absent on purpose — it is the accent, and its fill lives in `ACCENT.accentFill` so the
   * accent keeps ONE source. `dark` is absent too: `color="dark"` is a deliberately near-black
   * surface, not a band member. Hover is DERIVED in CSS from the fill (see `tokens/index.ts`), so
   * retuning a fill moves its hover with it. Regression-locked by `theme/contrast.test.ts`.
   */
  const FILL = {
    gray: DERIVED.fill.gray.light,
    red: DERIVED.fill.red.light,
    pink: DERIVED.fill.pink.light,
    grape: DERIVED.fill.grape.light,
    violet: DERIVED.fill.violet.light,
    indigo: DERIVED.fill.indigo.light,
    cyan: DERIVED.fill.cyan.light,
    teal: DERIVED.fill.teal.light,
    green: DERIVED.fill.green.light,
    lime: DERIVED.fill.lime.light,
    yellow: DERIVED.fill.yellow.light,
    orange: DERIVED.fill.orange.light,
  } as const

  /**
   * App chrome surfaces — the zinc identity for the Mantine theme (`docs/DESIGN-SPEC.md` §2). Only
   * `overlay`/`divider` (structural, not part of the generator's surface-stop set) stay
   * hand-authored below.
   *
   * `border` ("line") is the STRONG border used broadly for layout/control chrome (AppShell, Table,
   * Input, Divider, Tabs, Popover, Accordion — everything bound through `--mantine-color-default-
   * border` / `--mantine-color-gray-{2,3,4}` in the resolver below). `hairline` ("card ring") is a
   * DISTINCT, thinner pair used ONLY inside `shadow-card`'s embedded ring — cards carry no `border`
   * property at all, the ring lives in the shadow. Never conflate the two.
   */
  const SURFACE = {
    bg: DERIVED.surface.bg, // page background
    panel: DERIVED.surface.panel, // cards, controls
    panelHover: DERIVED.surface.panelHover,
    // Elevated surface (chart area, `--mantine-color-default-hover`) — same lift as panel-hover.
    elevated: DERIVED.surface.elevated,
    border: DERIVED.surface.border, // "line" — strong border (layout/control chrome, NOT the card ring)
    hairline: DERIVED.surface.hairline, // card ring only — consumed by `SHADOW.card`
    // Hover/striped/track fallback surface — a faint step between `panel` and `border`. Used by
    // Table hover/striped, Code, SegmentedControl track fallback, Tabs/Accordion/Menu hover.
    subtle: DERIVED.surface.subtle,
    // Floating-layer surface (menus, popovers, tooltips, modals, drawers). Hand-authored: the
    // generator has no `overlay` stop. On light it reads pure white — a clean lift above the panel;
    // on dark it reuses the `panelHover` elevated step so detached surfaces sit a shade above the
    // panel. Paired with `SHADOW.overlay` + a real `border` so Mantine's arrow renders a proper edge
    // (`docs/DESIGN-SPEC.md` §5).
    overlay: {
      light: '#ffffff',
      dark: 'color-mix(in srgb, #3f3f46 50%, #27272a)',
    },
    // Input field surface (docs/DESIGN-SPEC.md §5 field idiom) — reads slightly inset ON a panel.
    field: DERIVED.surface.field,
    // Hand-authored: the generator has no `divider` stop — layout separators (header bottom rule,
    // sidebar child indent) stay a fixed-opacity color-mix, distinct from the card ring.
    divider: {
      light: 'color-mix(in srgb, #e5e5e5 65%, transparent)',
      dark: 'color-mix(in srgb, #ffffff 6%, transparent)',
    },
  } as const

  return { ACCENT, FILL, SURFACE, INK, NEUTRAL, SEMANTIC, STATUS }
}

const paletteDataCache = new Map<string, ReturnType<typeof buildPaletteDataUncached>>()
/** FIFO cap on `paletteDataCache` — bounds memory when a consumer sweeps many distinct configs
 * (e.g. a theme-lab slider drag), evicting the oldest inserted entry on overflow. */
const PALETTE_DATA_CACHE_MAX = 32

/** The pinned default-config entry — built once and never stored in, or evicted from,
 * `paletteDataCache`. `theme/index.ts`'s `baseTheme` / `cssVariablesResolver` are built from this
 * ONE object at module load (`DEFAULT_PALETTE_DATA`), so this singleton must stay stable forever —
 * a second, distinct object for the same default config would mean two theme builds disagree. */
let defaultPaletteData: ReturnType<typeof buildPaletteDataUncached> | undefined

/**
 * Build the full derive-config-dependent palette data for `config` (defaults to
 * {@link DEFAULT_DERIVE_CONFIG}, the shipped identity). The default config always resolves to one
 * pinned singleton (see `defaultPaletteData` above); any other config is memoized by value (not
 * reference) in `paletteDataCache`, capped at `PALETTE_DATA_CACHE_MAX` entries (FIFO eviction), so
 * repeated calls with an equal config — e.g. from `BasaltProvider` on every render — are a cache
 * hit, not a re-derivation.
 */
export function buildPaletteData(config: DeriveConfig = DEFAULT_DERIVE_CONFIG): PaletteData {
  if (isDefaultDeriveConfig(config)) {
    defaultPaletteData ??= buildPaletteDataUncached(config)
    return defaultPaletteData
  }
  const key = JSON.stringify(config)
  const cached = paletteDataCache.get(key)
  if (cached) return cached
  const data = buildPaletteDataUncached(config)
  paletteDataCache.set(key, data)
  if (paletteDataCache.size > PALETTE_DATA_CACHE_MAX) {
    const oldestKey = paletteDataCache.keys().next().value
    if (oldestKey !== undefined) paletteDataCache.delete(oldestKey)
  }
  return data
}

/** The shape {@link buildPaletteData} returns — the derive-config-dependent half of the palette. */
export type PaletteData = ReturnType<typeof buildPaletteDataUncached>

/** The framework's shipped color identity — the generator's output at the default seed/knobs,
 * computed once (memoized) at module load. See `./derive.ts` for the laws. */
const STATIC_PALETTE_DATA = buildPaletteData(DEFAULT_DERIVE_CONFIG)

/** Semantic status hues — solids + the family they fill from (alpha applied in the token layer).
 * GENERATED — see `buildPaletteData` above. */
export const SEMANTIC = STATIC_PALETTE_DATA.SEMANTIC

/**
 * Score / zone status scale (excellent → poor). `good`/`warn`/`bad` are the SAME spec
 * success/warning/danger pairs as `SEMANTIC`. GENERATED — see `buildPaletteData` above.
 */
export const STATUS = STATIC_PALETTE_DATA.STATUS

/**
 * Theme-resolved neutrals (line / axis / grid / tooltip chrome). GENERATED — see `buildPaletteData`
 * above.
 */
export const NEUTRAL = STATIC_PALETTE_DATA.NEUTRAL

/** Ink text ramp (`docs/DESIGN-SPEC.md` §2). GENERATED — see `buildPaletteData` above. */
export const INK = STATIC_PALETTE_DATA.INK

/** The one saturated sky-blue accent. GENERATED — see `buildPaletteData` above. */
export const ACCENT = STATIC_PALETTE_DATA.ACCENT

/** Filled-surface hexes for the Mantine accent families — THE FILL BAND. GENERATED — see
 * `buildPaletteData` above. */
export const FILL = STATIC_PALETTE_DATA.FILL

/** App chrome surfaces — the zinc identity for the Mantine theme (`docs/DESIGN-SPEC.md` §2).
 * GENERATED — see `buildPaletteData` above. */
export const SURFACE = STATIC_PALETTE_DATA.SURFACE
