/**
 * Mantine-free token + palette layer.
 *
 * This module is PURE DATA + string helpers — ZERO `@mantine/*` imports (lint-enforced).
 * Colors are CSS custom properties under the `--vx-*` prefix (do NOT rename the prefix).
 * They resolve per color scheme in CSS, so `VX.*` works in components AND in non-component
 * files. Apply opacity via `alpha(token, a)` (never raw `rgba()`) so the hue keeps resolving.
 *
 * Grounded in argo `packages/charts/src/{tokens,palette,theme-vars,utils/color}.ts`.
 */

import {
  buildPaletteData,
  RADIUS,
  RADIUS_STEP,
  ROW_LINE_HEIGHT,
  SHADOW,
  SPACE,
  SPACE_SCALE,
  SPACE_STEP,
} from './palette'
import type { PaletteData, RadiusValues, SpaceValues } from './palette'

// The raw hue families + pair-picker — the building blocks a consumer's series module composes
// (`hrv: p(BP.blue)`). The doctrine sends every consumer here, so they are public surface, not
// palette internals; dropping them from this barrel hard-fails the consumer's build (1.0.0 bug,
// pinned by scripts/export-surface.json).
export { BP, p } from './palette'

// The six-knob derive engine — the generator behind the shipped default palette. Exposed so a
// consumer can retune the palette identity via `createBasaltTheme(overrides, { derive })` (see
// `../theme`) without hand-picking hexes. `buildPaletteData`/`PaletteData` stay internal (not
// re-exported here) — a consumer reaches a derived palette through `createBasaltTheme`, not by
// building `--vx-*` CSS for a custom config directly.
export { DEFAULT_DERIVE_CONFIG, deriveTokens, resolveDeriveConfig } from './derive'
export type { DeriveConfig, DerivedPalette } from './derive'

// The radius analog of the derive engine — the law behind `createBasaltTheme(overrides, { radius })`
// (see `../theme`). `RADIUS`/`RADIUS_STEP` stay internal to the theme layer; a consumer retunes the
// two anchors through `createBasaltTheme`, not by calling `deriveRadius` directly (it is exposed for
// the law itself to be inspectable/testable, same rationale as `deriveTokens`).
export { deriveRadius } from './palette'
export type { RadiusValues } from './palette'

// The density analog of the derive engine — the law behind `createBasaltTheme(overrides, {
// density })` (see `../theme`). `SPACE`/`SPACE_SCALE`/`SPACE_STEP`/`ROW_LINE_HEIGHT` stay internal
// to the theme layer; a consumer retunes them through `createBasaltTheme`, not by calling
// `deriveSpacing` directly (it is exposed for the law itself to be inspectable/testable, same
// rationale as `deriveRadius`).
export { deriveSpacing } from './palette'
export type { SpaceValues } from './palette'

/** A per-theme color pair: a hue keeps its identity but shifts shade across schemes. */
export type ColorPair = { light: string; dark: string }

/** A map of token name → per-theme color pair (the input shape for series/group builders). */
export type SeriesMap = Record<string, ColorPair>

/**
 * Apply opacity to any palette token, theme-aware. Use instead of raw `rgba()` so the
 * underlying hue still resolves per color scheme.
 *
 *   alpha(VX.neutral, 0.5)        // muted hairline
 *   alpha(VX.status.warn, 0.1)    // zone-band fill
 */
export const alpha = (token: string, a: number): string =>
  `color-mix(in srgb, ${token} ${Math.round(a * 100)}%, transparent)`

/**
 * VX tokens — `var(--vx-*)` string refs + non-color sizing constants. Colors resolve per
 * color scheme in CSS, so `VX.*` works in components AND in non-component files. Never
 * reference raw hex in chart files — use `VX.*` / `alpha()`.
 *
 * The framework ships ONLY generic primitives — no domain `VX.series` tree (apps rebuild
 * that with `seriesTokens` / `groupTokens` against their own series maps).
 */
/**
 * The type scale — the ONE owned ladder, in px.
 *
 * Type is a token axis like color / spacing / radius / motion: a single edit point, never a
 * hardcoded literal at a call site. Every font-size in the framework resolves to a step here.
 *
 * Two representations are DERIVED from this one object, so they cannot drift:
 *  • `VX.text.*` — plain numbers, for inline `style` objects and visx SVG props (React appends
 *    `px`; SVG presentation attributes can't resolve `var()`, so a ref string would break charts).
 *  • `--vx-text-*` — the CSS-var form (`11px`, …), for CSS modules and the Mantine theme.
 *
 * The Mantine theme additionally re-expresses the ladder through Mantine's `rem()` (see
 * `theme/index.ts`), so the component surface scales with the user's browser font-size AND with
 * `--mantine-scale`. `md` is the body step; `lg` is pinned at exactly 16px because it doubles as
 * the iOS input floor (see the `styles.css` floor — Safari zooms the viewport on focus below 16px).
 */
const TEXT = {
  micro: 11, // mono uppercase micro-label (table th, Menu.Label, sidebar/section headers, axis ticks)
  xs: 12.5, // delta badges, tooltip meta, dense chrome, StatCard labels
  sm: 13.5, // table/stat numerals, chart tooltip, legend
  md: 15, // BODY — nav rows, menu items, timeline, labels, prose; chart/card titles
  lg: 16, // breadcrumb current — ALSO the iOS input floor (do not lower)
  xl: 18, // section titles
  h2: 21, // article-density Prose h2 (docs/CONTENT-SPEC.md §5)
  kpi: 24, // the StatCard hero numeral (density pass: 31 → 24, tighter/less shouty)
  h1: 26, // article-density Prose h1 (docs/CONTENT-SPEC.md §5)
} as const

export const VX = {
  // Non-color sizing constants
  // Stroke WEIGHTS, not spacing — deliberately fixed, never density-tracking (see
  // `SPACE_STEP_BASE`'s "charts" group doc in tokens/palette.ts).
  lineWidth: 2.5,
  line2Width: 2,
  axisFont: TEXT.micro,
  // A discrete visual footprint (not a stroke weight), so — unlike `lineWidth`/`line2Width` above —
  // it DOES track density; single-sourced from `SPACE_STEP.chartDotR` (see that constant's doc).
  dotR: SPACE_STEP.chartDotR,
  // The ONE dashed pattern — plotted stroke, legend swatch, tooltip swatch all read this.
  dashArray: '6 4' as const,
  // Legend layout — single-sourced from `SPACE_STEP.chartLegendGap` (density-tracking; see that
  // constant's doc). Still a raw number here (not `var()`) — ChartLegend applies it via inline
  // `style`, and this is the one static (level-0) value; `createBasaltTheme({ density })` has no
  // wiring into chart render props yet, so this number does NOT move live with the knob (same
  // "dev slider/production JS defaultProps" gap as Timeline's `bulletSize` — see `deriveSpacing`'s
  // doc in tokens/palette.ts).
  legendGap: SPACE_STEP.chartLegendGap,
  legendFontSize: TEXT.sm,

  // The type scale (px numbers — see TEXT above). Use in inline styles and visx SVG props;
  // use `var(--vx-text-*)` in CSS modules.
  text: TEXT,

  // Single source for the card corner radius — shared by the Mantine-free ChartCard and the
  // Mantine chrome (Card/Paper resolve to this SAME token). One knob, so cards never diverge.
  radiusCard: 'var(--vx-radius-card)',
  // Single source for the control corner radius (inputs, search, buttons, segmented track).
  radiusCtrl: 'var(--vx-radius-ctrl)',
  // Fully-rounded pill affordance (scroll-to-bottom button, chips) — fixed, does not track the
  // radius knob (see `RADIUS_STEP.pill`'s doc in `tokens/palette.ts`).
  radiusPill: 'var(--vx-radius-pill)',

  // Secondary-line color (back-compat alias; now theme-aware via --vx-line2)
  line2Dark: 'var(--vx-line2)',

  // Semantic fills — consistent opacity across all charts
  good: 'var(--vx-good)',
  goodSoft: 'var(--vx-goodSoft)',
  bad: 'var(--vx-bad)',
  warn: 'var(--vx-warn)',
  goodSolid: 'var(--vx-goodSolid)',
  badSolid: 'var(--vx-badSolid)',
  warnSolid: 'var(--vx-warnSolid)',

  // Reference/dashed lines for thresholds
  goodRef: 'var(--vx-goodRef)',
  badRef: 'var(--vx-badRef)',
  warnRef: 'var(--vx-warnRef)',

  // Neutral primary line/text color — the default for single-series, no-signal marks
  // ("white/gray per theme"). Same value as the NEUTRAL.line pair.
  line: 'var(--vx-line)',
  line2: 'var(--vx-line2)',

  // Axis label + axis stroke colors (theme-aware). Exposed as flat refs so a bespoke chart that
  // renders raw <text> labels or axis lines (without the Axis* primitives) needs no hook.
  axis: 'var(--vx-axis)',
  axisStroke: 'var(--vx-axisStroke)',

  // Grid, hover, legend
  grid: 'var(--vx-grid)',
  crosshair: 'var(--vx-crosshair)',
  dotStroke: 'var(--vx-dotStroke)',
  legendText: 'var(--vx-legendText)',

  // Tooltip chrome — muted (secondary) text inside a bespoke tooltip. The other tooltip vars
  // (bg/text/border/shadow) are only exposed via `useVxTheme()` (see `charts/theme.tsx`); this
  // one is flattened onto `VX` too because bespoke-tooltip authors reached for `VX.muted` (the
  // general ink-ramp muted) instead and got the wrong token — same pattern as `VX.muted` below.
  tooltipMuted: 'var(--vx-tooltipMuted)',

  // Base neutral for hairlines / muted text / overlays — apply opacity via alpha()
  neutral: 'var(--vx-neutral)',

  // Ink text ramp (docs/DESIGN-SPEC.md §2) — primary/emphasis/secondary/tertiary body text.
  ink: 'var(--vx-ink)',
  ink2: 'var(--vx-ink2)',
  muted: 'var(--vx-muted)',
  faint: 'var(--vx-faint)',

  // The accent as INK — primary series, active-nav icon, links, focus rings. Read against the PAGE,
  // so it inverts across schemes (light on dark, deep on light).
  accent: 'var(--vx-accent)',
  accentHover: 'var(--vx-accentHover)',
  // The accent as SURFACE — a filled control that carries a label. Squeezed between white-text
  // contrast and page contrast, so it is the same hex in both schemes (see ACCENT in palette.ts).
  // Mantine's `--mantine-color-<primary>-filled` is bridged onto this, so it drives ALL filled
  // chrome; a raw `--vx-accent` fill would be unreadable on dark. Fills use THIS, never `accent`.
  accentFill: 'var(--vx-accentFill)',
  accentFillHover: 'var(--vx-accentFillHover)',
  onAccent: 'var(--vx-onAccent)',

  // Layout separators (header bottom rule, sidebar child indent) — distinct from `surface.border`.
  divider: 'var(--vx-divider)',

  // Depth shadows — a whisper shadow + a 1px ring baked into the value (never a `border` prop).
  shadowCard: 'var(--vx-shadow-card)',
  shadowCtrl: 'var(--vx-shadow-ctrl)',
  // Floating-layer elevation (menus, popovers, tooltips, modals, drawers) — a real drop shadow.
  shadowOverlay: 'var(--vx-shadow-overlay)',

  // App surfaces (cards, borders) — shared with the Mantine chrome
  surface: {
    bg: 'var(--vx-surface-bg)',
    panel: 'var(--vx-surface-panel)',
    panelHover: 'var(--vx-surface-panelHover)',
    elevated: 'var(--vx-surface-elevated)',
    subtle: 'var(--vx-surface-subtle)',
    overlay: 'var(--vx-surface-overlay)', // floating layer (menus, popovers, modals, drawers)
    field: 'var(--vx-surface-field)', // input field surface (slightly inset on a panel)
    border: 'var(--vx-surface-border)', // "line" — strong border
    hairline: 'var(--vx-surface-hairline)', // card ring only
  },

  // Score / zone status scale (excellent → poor)
  status: {
    excellent: 'var(--vx-status-excellent)',
    good: 'var(--vx-status-good)',
    warn: 'var(--vx-status-warn)',
    bad: 'var(--vx-status-bad)',
    neutral: 'var(--vx-status-neutral)',
  },

  // Shared sizing — single-sourced from `SPACE_STEP.chartMargin*` (density-tracking; same
  // static-value/no-live-wiring note as `legendGap` above).
  margin: {
    top: SPACE_STEP.chartMarginTop,
    right: SPACE_STEP.chartMarginRight,
    bottom: SPACE_STEP.chartMarginBottom,
    left: SPACE_STEP.chartMarginLeft,
  },
  minPxPerTick: 55,
} as const

type Side = 'light' | 'dark'

/** A CSS declaration line for a single `--vx-*` custom property. */
const decl = (name: string, value: string): string => `  --vx-${name}: ${value};`

/**
 * A px number expressed as the plain rem STRING literal (16px base: `pxRem(6)` → `'0.375rem'`) —
 * NOT Mantine's own `rem()` helper, which instead emits a `calc(...)` expression bound to
 * `--mantine-scale` (a different value; that scaling happens at the Mantine-coupled call site
 * instead — see `theme/index.ts`'s `Input.extend` `vars` for why `--vx-space-input-height` needs
 * both halves). The SINGLE source for this conversion — `theme/index.ts` imports this instead of
 * keeping its own copy, so the radius/spacing size-scale steps and this module's own rem-emitting
 * vars (`--vx-space-input-height`) can never compute the conversion two different ways.
 */
export function pxRem(px: number): string {
  return `${px / 16}rem`
}

/** Emit one prefixed group of pairs for a given scheme side. */
const groupSide = (prefix: string, map: SeriesMap, side: Side): string =>
  Object.entries(map)
    .map(([key, pair]) => decl(`${prefix}${key}`, pair[side]))
    .join('\n')

/**
 * Built-in framework primitives for a given scheme side — STATUS group, semantic solids,
 * neutral line/axis/grid/tooltip chrome, legend text, and the surface ramp. Domain series
 * (SERIES/ACTIVITY/USAGE) are NOT shipped — apps append them via `opts.groups`.
 */
function frameworkPrimitives(side: Side, data: PaletteData): string {
  const n = data.NEUTRAL
  const s = data.SEMANTIC
  const su = data.SURFACE
  const ink = data.INK
  const ac = data.ACCENT
  return [
    groupSide('status-', data.STATUS as SeriesMap, side),
    decl('goodSolid', s.good[side]),
    decl('badSolid', s.bad[side]),
    decl('warnSolid', s.warn[side]),
    decl('neutral', n.neutral[side]),
    decl('line', n.line[side]),
    decl('line2', n.line2[side]),
    decl('axis', n.axis[side]),
    decl('axisStroke', n.axisStroke[side]),
    decl('grid', n.grid[side]),
    decl('crosshair', n.crosshair[side]),
    decl('dotStroke', n.dotStroke[side]),
    decl('tooltipBg', n.tooltipBg[side]),
    decl('tooltipText', n.tooltipText[side]),
    decl('tooltipMuted', n.tooltipMuted[side]),
    decl('tooltipBorder', n.tooltipBorder[side]),
    decl('tooltipShadow', n.tooltipShadow[side]),
    decl('legendText', n.legendText[side]),
    decl('ink', ink.ink[side]),
    decl('ink2', ink.ink2[side]),
    decl('muted', ink.muted[side]),
    decl('faint', ink.faint[side]),
    decl('accent', ac.accent[side]),
    decl('accentHover', ac.accentHover[side]),
    decl('accentFill', ac.accentFill[side]),
    decl('accentFillHover', ac.accentFillHover[side]),
    decl('onAccent', ac.onAccent[side]),
    decl('divider', su.divider[side]),
    decl('shadow-card', SHADOW.card[side]),
    decl('shadow-ctrl', SHADOW.ctrl[side]),
    decl('shadow-overlay', SHADOW.overlay[side]),
    decl('surface-bg', su.bg[side]),
    decl('surface-panel', su.panel[side]),
    decl('surface-panelHover', su.panelHover[side]),
    decl('surface-elevated', su.elevated[side]),
    decl('surface-subtle', su.subtle[side]),
    decl('surface-overlay', su.overlay[side]),
    decl('surface-field', su.field[side]),
    decl('surface-border', su.border[side]),
    decl('surface-hairline', su.hairline[side]),
  ].join('\n')
}

/**
 * The `--vx-space-*` declaration list for a resolved {@link SpaceValues} — every anchor and one-off
 * that has at least one real `var()` consumer, plus the row line-height. Shared by
 * `frameworkDerived` (emits the shipped defaults unconditionally, called with `DEFAULT_SPACE_
 * VALUES`) and {@link buildDensityCss} (emits an OVERRIDING block for a retuned density level), so
 * the two lists can never drift apart — mirrors `frameworkDerived`'s own single-source reasoning for
 * the radii.
 *
 * `SPACE_FIXED` (Timeline `lineWidth`, 1px borders, the ReadingProgress bar height, SegmentedControl's
 * `segmentedTrackInset`) is deliberately NEVER part of this list — it never moves, so a var would
 * only invite someone to think it does.
 *
 * Deliberately DOES NOT emit a var for every `SpaceValues` number — `space.scale.*` (the generic
 * Mantine spacing scale) and `space.step.{timelineBullet,progressBarSize,chartLegendGap,
 * chartMarginTop,chartMarginRight,chartMarginBottom,chartMarginLeft,chartDotR}` have ZERO `var()`
 * consumers anywhere in the framework or its tests beyond the CSS-emission test itself — each is
 * read straight off the resolved `SpaceValues` as a JS NUMBER instead (`theme/index.ts`'s Timeline/
 * Progress `defaultProps`, and `VX.legendGap`/`VX.margin`/`VX.dotR` in this file's own `VX` object),
 * so a `--vx-space-*` declaration for one of them was dead weight that only looked like the fix for
 * the dev-slider/production gap those JS reads actually have (see `deriveSpacing`'s JSDoc in
 * `tokens/palette.ts` for the real scope of that gap — it is materially bigger than "a var these
 * numbers could round-trip through"). `theme.spacing` (the generic scale, JS) already resolves
 * through `--mantine-spacing-*` on the PRODUCTION `createBasaltTheme({ density })` path
 * (`theme/index.ts`'s `buildTheme`), so nothing downstream of the generic scale actually needed
 * `--vx-space-scale-*` either — deleted along with the rest rather than kept as an unread alias.
 */
function spaceDecls(space: SpaceValues): string[] {
  return [
    decl('space-row-inset-x', `${space.anchors.rowInsetX}px`),
    decl('space-row-inset-y', `${space.anchors.rowInsetY}px`),
    // Additive law, not the multiplier — see `deriveSpacing`'s doc in `tokens/palette.ts`. No unit:
    // `line-height` is a unitless CSS value.
    decl('space-row-line-height', `${space.rowLineHeight}`),
    // A `size: 'md'` Input's resolved height. Mantine's own `--input-height-md` is
    // `calc(2.625rem * var(--mantine-scale))` (BOTH `styles.css` and `styles.layer.css`, verified
    // in the installed package) — REM-relative to the root font size AND scale-aware, not a flat
    // px. Emitting this in REM (via `pxRem`, not a bare `${…}px`) preserves the rem half; the
    // `* var(--mantine-scale))` half is reconstructed at the Mantine-coupled call site
    // (`theme/index.ts`'s `Input.extend` `vars`, which wraps this var in the matching `calc(...)`)
    // — this module stays Mantine-free, so it cannot reference `--mantine-scale` itself. Flattening
    // either half into a flat px would desync input height from the user's root font size (an
    // accessibility regression) and from Mantine's global `--mantine-scale` knob.
    decl('space-input-height', pxRem(space.anchors.inputHeight)),
    // A `size: 'md'` Button's/ActionIcon's resolved height — SAME rem-plus-scale reasoning and
    // reconstruction as `space-input-height` above (`theme/index.ts`'s `Button.extend`/
    // `ActionIcon.extend` `vars`), single-sourced from the SAME `controlHeight` anchor
    // `space-input-height` reads from (`SPACE_ANCHORS_BASE`'s doc in `tokens/palette.ts`).
    decl('space-control-height', pxRem(space.anchors.controlHeight)),
    decl('space-stack-xs', `${space.anchors.stackXs}px`),
    decl('space-stack-sm', `${space.anchors.stackSm}px`),
    decl('space-stack-md', `${space.anchors.stackMd}px`),
    decl('space-stack-lg', `${space.anchors.stackLg}px`),
    decl('space-stack-xl', `${space.anchors.stackXl}px`),
    // The CSS-module spacing sweep's one-offs (docs/STATUS.md) — same single-source reasoning,
    // grouped to match `SPACE_STEP_BASE`'s own grouping in tokens/palette.ts.
    // Responsive pair (Decision 3) — `stickyHeaderClearance` is the desktop (`>= sm`) value,
    // `stickyHeaderClearanceMobile` the mobile (`< sm`) override; a consumer CSS module picks
    // whichever matches its own breakpoint (see `content/prose.module.css`).
    decl('space-sticky-header-clearance', `${space.step.stickyHeaderClearance}px`),
    decl('space-sticky-header-clearance-mobile', `${space.step.stickyHeaderClearanceMobile}px`),
    decl('space-nav-icon-gap', `${space.step.navIconGap}px`),
    decl('space-sidebar-region-gap', `${space.step.sidebarRegionGap}px`),
    decl('space-prose-quote-inset-y', `${space.step.proseQuoteInsetY}px`),
    decl('space-prose-quote-indent', `${space.step.proseQuoteIndent}px`),
    decl('space-prose-inline-code-inset-y', `${space.step.proseInlineCodeInsetY}px`),
    decl('space-prose-inline-code-inset-x', `${space.step.proseInlineCodeInsetX}px`),
    decl('space-prose-code-block-inset-y', `${space.step.proseCodeBlockInsetY}px`),
    decl('space-prose-code-block-inset-x', `${space.step.proseCodeBlockInsetX}px`),
    decl('space-prose-heading-anchor-gap', `${space.step.proseHeadingAnchorGap}px`),
    decl('space-prose-table-cell-inset-y', `${space.step.proseTableCellInsetY}px`),
    decl('space-prose-table-cell-inset-x', `${space.step.proseTableCellInsetX}px`),
    decl('space-prose-chat-list-gap-bottom', `${space.step.proseChatListGapBottom}px`),
    decl('space-prose-chat-list-indent', `${space.step.proseChatListIndent}px`),
    decl('space-prose-chat-list-item-gap', `${space.step.proseChatListItemGap}px`),
    decl('space-prose-chat-nested-list-gap', `${space.step.proseChatNestedListGap}px`),
    decl('space-prose-chat-heading-gap-top', `${space.step.proseChatHeadingGapTop}px`),
    decl('space-prose-chat-heading-gap-bottom', `${space.step.proseChatHeadingGapBottom}px`),
    decl('space-prose-article-paragraph-gap', `${space.step.proseArticleParagraphGap}px`),
    decl('space-prose-article-list-gap-top', `${space.step.proseArticleListGapTop}px`),
    decl('space-prose-article-list-gap-bottom', `${space.step.proseArticleListGapBottom}px`),
    decl('space-prose-article-list-indent', `${space.step.proseArticleListIndent}px`),
    decl('space-prose-article-h1-gap-top', `${space.step.proseArticleH1GapTop}px`),
    decl('space-prose-article-h1-gap-bottom', `${space.step.proseArticleH1GapBottom}px`),
    decl('space-prose-article-heading-gap-top', `${space.step.proseArticleHeadingGapTop}px`),
    decl('space-prose-article-heading-gap-bottom', `${space.step.proseArticleHeadingGapBottom}px`),
    decl('space-prose-article-h2-rule-gap', `${space.step.proseArticleH2RuleGap}px`),
    decl('space-prose-article-block-gap', `${space.step.proseArticleBlockGap}px`),
    decl('space-article-column-gap', `${space.step.articleColumnGap}px`),
    decl('space-article-toc-rail-width', `${space.step.articleTocRailWidth}px`),
    decl('space-article-header-gap', `${space.step.articleHeaderGap}px`),
    decl('space-article-header-padding-bottom', `${space.step.articleHeaderPaddingBottom}px`),
    decl('space-article-header-margin-bottom', `${space.step.articleHeaderMarginBottom}px`),
    decl('space-article-meta-row-gap', `${space.step.articleMetaRowGap}px`),
    decl('space-article-footer-gap', `${space.step.articleFooterGap}px`),
    decl('space-article-footer-margin-top', `${space.step.articleFooterMarginTop}px`),
    decl('space-article-footer-padding-top', `${space.step.articleFooterPaddingTop}px`),
    decl('space-article-nav-target-gap', `${space.step.articleNavTargetGap}px`),
    decl('space-code-block-header-gap', `${space.step.codeBlockHeaderGap}px`),
    decl('space-code-block-header-inset-y', `${space.step.codeBlockHeaderInsetY}px`),
    decl('space-code-block-header-inset-right', `${space.step.codeBlockHeaderInsetRight}px`),
    decl('space-code-block-content-inset-x', `${space.step.codeBlockContentInsetX}px`),
    decl('space-code-block-header-right-gap', `${space.step.codeBlockHeaderRightGap}px`),
    decl('space-code-block-body-inset-y', `${space.step.codeBlockBodyInsetY}px`),
    decl('space-code-block-floating-copy-offset', `${space.step.codeBlockFloatingCopyOffset}px`),
    decl('space-callout-inset-y', `${space.step.calloutInsetY}px`),
    decl('space-callout-inset-x', `${space.step.calloutInsetX}px`),
    decl('space-callout-title-row-gap', `${space.step.calloutTitleRowGap}px`),
    decl('space-toc-root-gap', `${space.step.tocRootGap}px`),
    decl('space-toc-link-inset-y', `${space.step.tocLinkInsetY}px`),
    decl('space-toc-link-indent', `${space.step.tocLinkIndent}px`),
    decl('space-toc-sub-indent', `${space.step.tocSubIndent}px`),
    decl('space-article-card-tags-gap', `${space.step.articleCardTagsGap}px`),
    decl('space-article-card-tag-inset-y', `${space.step.articleCardTagInsetY}px`),
    decl('space-article-card-tag-inset-x', `${space.step.articleCardTagInsetX}px`),
    decl('space-article-card-meta-gap-top', `${space.step.articleCardMetaGapTop}px`),
    decl('space-guide-body-gap-bottom', `${space.step.guideBodyGapBottom}px`),
    decl('space-guide-footer-gap-top', `${space.step.guideFooterGapTop}px`),
    decl('space-guide-footer-inset-top', `${space.step.guideFooterInsetTop}px`),
    decl('space-sidebar-search-gap', `${space.step.sidebarSearchGap}px`),
    decl('space-sidebar-search-trigger-height', `${space.step.sidebarSearchTriggerHeight}px`),
    decl('space-settings-row-inset-y', `${space.step.settingsRowInsetY}px`),
    decl('space-settings-row-gap', `${space.step.settingsRowGap}px`),
    decl('space-mermaid-container-inset', `${space.step.mermaidContainerInset}px`),
    decl('space-sidebar-brand-inset-top', `${space.step.sidebarBrandInsetTop}px`),
    decl('space-sidebar-brand-inset-x', `${space.step.sidebarBrandInsetX}px`),
    decl('space-sidebar-section-gap', `${space.step.sidebarSectionGap}px`),
    decl('space-sidebar-account-inset-top', `${space.step.sidebarAccountInsetTop}px`),
    decl('space-sidebar-account-inset-x', `${space.step.sidebarAccountInsetX}px`),
    decl('space-sidebar-account-inset-bottom', `${space.step.sidebarAccountInsetBottom}px`),
    decl('space-sidebar-avatar-size', `${space.step.sidebarAvatarSize}px`),
    decl('space-sidebar-section-label-gap', `${space.step.sidebarSectionLabelGap}px`),
    decl('space-sidebar-child-list-gap-top', `${space.step.sidebarChildListGapTop}px`),
    decl('space-sidebar-child-list-gap-bottom', `${space.step.sidebarChildListGapBottom}px`),
    decl('space-sidebar-child-list-indent', `${space.step.sidebarChildListIndent}px`),
    decl('space-sidebar-child-row-inset-y', `${space.step.sidebarChildRowInsetY}px`),
    decl('space-sidebar-child-row-indent', `${space.step.sidebarChildRowIndent}px`),
    decl('space-app-header-mobile-actions-height', `${space.step.appHeaderMobileActionsHeight}px`),
    decl('space-mobile-nav-tab-gap', `${space.step.mobileNavTabGap}px`),
    decl('space-agent-rail-inset-x', `${space.step.agentRailInsetX}px`),
    decl('space-agent-part-gap-top', `${space.step.agentPartGapTop}px`),
    decl('space-agent-code-inset', `${space.step.agentCodeInset}px`),
    decl('space-agent-error-inset-y', `${space.step.agentErrorInsetY}px`),
    decl('space-agent-error-inset-x', `${space.step.agentErrorInsetX}px`),
    decl('space-agent-scroll-button-gap-top', `${space.step.agentScrollButtonGapTop}px`),
    decl('space-agent-message-inset-y', `${space.step.agentMessageInsetY}px`),
    decl('space-agent-message-inset-x', `${space.step.agentMessageInsetX}px`),
    decl('space-agent-transcript-inset', `${space.step.agentTranscriptInset}px`),
    decl('space-badge-inset-y', `${space.step.badgeInsetY}px`),
    decl('space-badge-inset-x', `${space.step.badgeInsetX}px`),
    decl('space-stat-card-gap', `${space.step.statCardGap}px`),
    decl('space-virtual-row-inset-y', `${space.step.virtualRowInsetY}px`),
    decl('space-virtual-row-inset-x', `${space.step.virtualRowInsetX}px`),
    // `chartLegendGap`/`chartMarginTop`/`chartMarginRight`/`chartMarginBottom`/`chartMarginLeft`/
    // `chartDotR`/`progressBarSize`/`timelineBullet` are DELIBERATELY absent — see this function's
    // doc for why (JS-number-only consumers, zero `var()` reads). `appShellHeaderHeight`/
    // `appShellHeaderMobileHeight`/`appShellNavbarWidth`/`appShellNavbarRailWidth` join that list —
    // `shell/index.tsx` reads all four as JS numbers via `useBasaltSpacing()` (Mantine's `AppShell`
    // `header`/`navbar` props take numbers, not `var()` strings), so a `--vx-space-app-shell-*` decl
    // here would have had zero consumers, framework-wide, the same dead-weight shape this function's
    // doc already calls out for the chart/Progress/Timeline group. `sidebarAccountMenuWidth`/
    // `sidebarSettingsMenuWidth` join it too — `app-sidebar-account.tsx`/`app-sidebar.tsx` read both
    // as JS numbers via `useBasaltSpacing()` (Mantine's `<Menu width={…}>` also takes a number).
  ]
}

/** The shipped, level-0 spacing values — `frameworkDerived`'s `spaceDecls(...)` call below. No
 * `createBasaltTheme({ density })` retuning applies here; that path calls `buildDensityCss` with a
 * different resolved {@link SpaceValues} instead (see `../theme` and `../provider`). */
const DEFAULT_SPACE_VALUES: SpaceValues = {
  anchors: SPACE,
  scale: SPACE_SCALE,
  step: SPACE_STEP,
  rowLineHeight: ROW_LINE_HEIGHT,
}

/**
 * Theme-independent scalars + semantic fills, defined once on `:root`.
 *
 * Area-gradient strength is a global knob (the theme lab overrides these two on `:root`
 * to retune every line-area fill live). 0%/0% disables gradients app-wide.
 */
function frameworkDerived(data: PaletteData): string {
  return [
    decl('radius-card', `${RADIUS.card}px`),
    decl('radius-ctrl', `${RADIUS.ctrl}px`),
    // The two offset tiers (SegmentedControl indicator/Kbd/Code, Progress/scale-sm) — added so a
    // component's inline `styles`/`style` can read the SAME source as `RADIUS_STEP.tight`/`.fine`
    // instead of a hand-typed literal (see `theme/index.ts`'s component sweep).
    decl('radius-tight', `${RADIUS_STEP.tight}px`),
    decl('radius-fine', `${RADIUS_STEP.fine}px`),
    // The floating tier (Modal/Tooltip/Popover/Notification, content code/mermaid blocks).
    decl('radius-floating', `${RADIUS_STEP.floating}px`),
    // The pill affordance (scroll-to-bottom button, chips) — fixed, level-invariant, so it lives
    // only in this static block, never in `buildRadiusCss`'s dynamic override (see
    // `RADIUS_STEP.pill`'s doc).
    decl('radius-pill', `${RADIUS_STEP.pill}px`),
    ...spaceDecls(DEFAULT_SPACE_VALUES),
    // Article-density Prose measure (docs/CONTENT-SPEC.md §5) — theme-independent, like the radii.
    decl('prose-measure', '72ch'),
    // The fill band (see FILL in palette.ts). Emitted on `:root`, NOT per scheme — a filled surface
    // is the same hex in both, which is the whole point: it is squeezed between its white label and
    // the page behind it, and only one luminance band satisfies both on both pages.
    ...Object.entries(data.FILL).map(([name, hex]) => decl(`fill-${name}`, hex)),
    // Hover is DERIVED from the fill, so retuning a fill (in the theme lab, or here) carries its
    // hover along instead of leaving a stale pair. 88% of the fill over black lands ~0.128 luminance:
    // a visible press-darkening that still clears AA for the white label (~5.9:1).
    ...Object.keys(data.FILL).map((name) =>
      decl(`fillHover-${name}`, `color-mix(in srgb, var(--vx-fill-${name}) 88%, #000)`),
    ),
    // The type scale, emitted from the SAME `TEXT` object `VX.text` reads — CSS modules and the
    // Mantine theme consume these; inline styles / visx read the numbers. One ladder, two forms.
    ...Object.entries(TEXT).map(([step, px]) => decl(`text-${step}`, `${px}px`)),
    decl('area-top', '22%'),
    decl('area-bottom', '1%'),
    decl('good', 'color-mix(in srgb, var(--vx-goodSolid) 18%, transparent)'),
    decl('goodSoft', 'color-mix(in srgb, var(--vx-goodSolid) 8%, transparent)'),
    decl('bad', 'color-mix(in srgb, var(--vx-badSolid) 18%, transparent)'),
    decl('warn', 'color-mix(in srgb, var(--vx-warnSolid) 8%, transparent)'),
    decl('goodRef', 'color-mix(in srgb, var(--vx-goodSolid) 30%, transparent)'),
    decl('badRef', 'color-mix(in srgb, var(--vx-badSolid) 30%, transparent)'),
    decl('warnRef', 'color-mix(in srgb, var(--vx-warnSolid) 20%, transparent)'),
  ].join('\n')
}

/**
 * Wrap a map of `{ name: ColorPair }` into `var(--vx-<prefix><name>)` token refs — the runtime
 * companion to `buildPaletteCss`. Lets a consumer define its own series and read stable refs.
 *
 * Returns an exact-keyed object: the return type mirrors the keys of the input map, so a renamed
 * or removed key becomes a tsc error rather than silently widening to `Record<string, string>`.
 */
export function seriesTokens<const T extends SeriesMap>(
  map: T,
  prefix = '',
): { [K in keyof T]: string } {
  const out = {} as { [K in keyof T]: string }
  for (const key of Object.keys(map) as (keyof T)[]) out[key] = `var(--vx-${prefix}${String(key)})`
  return out
}

/**
 * Define a named series map. Identity passthrough — gives consumers a typed authoring entry
 * point and preserves the exact literal keys of the input (const-generic so callers get back T,
 * not the widened SeriesMap, enabling downstream exact-key checks in groupTokens / seriesTokens).
 */
export function defineSeries<const T extends SeriesMap>(map: T): T {
  return map
}

/**
 * Build a single namespaced group's token refs (`var(--vx-<name>-<key>)`).
 *
 * Returns an exact-keyed object matching the keys of `map` — a stale or renamed key is a tsc
 * error at the call site rather than a silent `Record<string, string>` widening.
 */
export function groupTokens<const T extends SeriesMap>(
  name: string,
  map: T,
): { [K in keyof T]: string } {
  return seriesTokens(map, `${name}-`)
}

/** Options for {@link buildPaletteCss}. */
export type BuildPaletteOpts = {
  /** Extra named series maps to emit under the given prefixes (e.g. `{ '': SERIES, 'activity-': ACTIVITY }`). */
  groups?: Record<string, SeriesMap>
  /** Theme-independent derived declarations (gradients, semantic fills) emitted once on `:root`. */
  derived?: string[]
}

/**
 * Emit the `--vx-*` stylesheet: a `:root` block of theme-independent scalars, then the
 * dark (default) and light primitive blocks under `html[data-mantine-color-scheme='…']`.
 *
 * The framework chrome (STATUS/SEMANTIC/SURFACE pairs + the framework DERIVED defaults) is
 * built in, so an empty `buildPaletteCss()` already emits every framework var. Consumer
 * `opts.groups` / `opts.derived` append on top (e.g. argo's domain SERIES/ACTIVITY/USAGE).
 *
 * `data` defaults to the static, shipped palette (`buildPaletteData()` at `DEFAULT_DERIVE_CONFIG`)
 * — pass the result of `buildPaletteData(config)` to emit CSS for a retuned derive config instead
 * (this is how `BasaltProvider` follows `createBasaltTheme`'s `{ derive }` option; see `../theme`
 * and `../provider`).
 *
 * Dark is the default (`:root`) since the framework defaults to dark; the
 * `[data-mantine-color-scheme]` selectors track Mantine's toggle on `<html>`.
 */
export function buildPaletteCss(
  opts: BuildPaletteOpts = {},
  data: PaletteData = buildPaletteData(),
): string {
  const groups = opts.groups ?? {}
  const extraDerived = (opts.derived ?? []).map((d) => `  ${d}`).join('\n')
  const derivedBlock = frameworkDerived(data)
  const derived = extraDerived ? `${derivedBlock}\n${extraDerived}` : derivedBlock
  const side = (s: Side): string => {
    const extra = Object.entries(groups)
      .map(([prefix, map]) => groupSide(prefix, map, s))
      .join('\n')
    const framework = frameworkPrimitives(s, data)
    return extra ? `${framework}\n${extra}` : framework
  }
  return `:root {
${derived}
}
:root,
html[data-mantine-color-scheme='dark'] {
${side('dark')}
}
html[data-mantine-color-scheme='light'] {
${side('light')}
}`
}

/**
 * The `fonts` option's resolved shape — a full CSS font-family stack string per slot (with its own
 * fallback chain), riding the `--basalt-font-sans/head/mono` override seam `styles.css` ships
 * fallbacks for. Omitted keys keep the shipped fallback untouched. Lives here (not in `../theme`,
 * which only RE-EXPORTS it) because its builder `buildFontsCss` below is a pure, Mantine-free
 * string builder that belongs in the tokens layer — see `../theme`'s
 * `CreateBasaltThemeOptions.fonts` for the production entry point that sets it.
 */
export type BasaltFontsConfig = {
  sans?: string
  head?: string
  mono?: string
}

/** `{ basaltFonts key → --basalt-font-* var name }` — the one place the mapping is spelled out. */
const FONT_VAR_NAMES = {
  sans: '--basalt-font-sans',
  head: '--basalt-font-head',
  mono: '--basalt-font-mono',
} as const satisfies Record<keyof BasaltFontsConfig, string>

/**
 * Build the `:root` block of `--basalt-font-*` declarations for a resolved `basaltFonts` config —
 * only for the keys the consumer actually set (`createBasaltTheme(overrides, { fonts })`); an
 * omitted key keeps the shipped `styles.css` fallback chain untouched. Empty string when `fonts` is
 * absent or every key is omitted, so callers can unconditionally concatenate the result. Importable
 * from `basalt-ui/tokens` — `BasaltProvider`'s bridge (`../provider`) calls this directly to append
 * declarations to its injected `<style>`; an SSR/custom-injection consumer with
 * `injectPalette={false}` calls it themselves (see the JSDoc on that prop).
 */
export function buildFontsCss(fonts: BasaltFontsConfig | undefined): string {
  if (!fonts) return ''
  const decls = (Object.keys(FONT_VAR_NAMES) as (keyof BasaltFontsConfig)[])
    .filter((key) => fonts[key] !== undefined)
    .map((key) => {
      const value = fonts[key] as string
      // A font stack is a plain declaration value — `{`/`}`/`;`/comment openers would let a
      // config string break out of the emitted `<style>` declaration. Throw, don't sanitize,
      // per the repo's validation convention (see `deriveTokens`'s accent-hex assert).
      if (/[{};]|\/\*/.test(value)) {
        throw new Error(
          `Invalid fonts.${key}: a font-family stack must not contain "{", "}", ";" or "/*" — got ${JSON.stringify(value)}`,
        )
      }
      return `  ${FONT_VAR_NAMES[key]}: ${value};`
    })
  if (decls.length === 0) return ''
  return `:root {\n${decls.join('\n')}\n}`
}

/**
 * Build the `:root` block of overriding `--vx-radius-*` declarations for a resolved
 * `basaltRadius` value (`createBasaltTheme(overrides, { radius })`) — analog of {@link buildFontsCss}.
 * Empty string when `radius` is absent (the default level-0 path never sets `theme.other.basaltRadius`
 * in the first place), so callers can unconditionally concatenate the result. Importable from
 * `basalt-ui/tokens`, same SSR/custom-injection use as `buildFontsCss` above.
 */
export function buildRadiusCss(radius: RadiusValues | undefined): string {
  if (!radius) return ''
  return `:root {
  --vx-radius-card: ${radius.card}px;
  --vx-radius-ctrl: ${radius.ctrl}px;
  --vx-radius-tight: ${radius.tight}px;
  --vx-radius-fine: ${radius.fine}px;
  --vx-radius-floating: ${radius.floating}px;
}`
}

/**
 * Build the `:root` block of overriding `--vx-space-*` declarations for a resolved `basaltDensity`
 * value (`createBasaltTheme(overrides, { density })`) — analog of {@link buildRadiusCss}, reusing
 * the SAME `spaceDecls` list `frameworkDerived` emits the shipped defaults from (so the two can
 * never drift). Empty string when `space` is absent (the default level-0 path never sets
 * `theme.other.basaltDensity` in the first place), so callers can unconditionally concatenate the
 * result. Importable from `basalt-ui/tokens`, same SSR/custom-injection use as `buildRadiusCss`
 * above.
 */
export function buildDensityCss(space: SpaceValues | undefined): string {
  if (!space) return ''
  return `:root {\n${spaceDecls(space).join('\n')}\n}`
}
