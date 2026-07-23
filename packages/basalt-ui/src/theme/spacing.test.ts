/**
 * The spacing gate — this is a TOKENIZATION-only refactor (`SPACE`/`SPACE_SCALE`/`SPACE_STEP`/
 * `SPACE_FIXED` in `tokens/palette.ts` replace the Mantine `spacing` size-scale plus ~4 components'
 * hardcoded `styles`/`defaultProps` spacing literals and the `--vx-space-*` CSS vars), so the
 * rendered output must stay byte-identical to the numbers shipped before it. This locks today's
 * exact values as the acceptance baseline — a future change to `SPACE`/`SPACE_SCALE`/`SPACE_STEP`/
 * `SPACE_FIXED` that moves one of these numbers is a deliberate visual change, not a silent
 * regression, and must update this file in the same commit.
 *
 * ONE exception: `SPACE_STEP.stickyHeaderClearance` moved from 84 (the original literal) through an
 * intermediate single derived value of 108, to its FINAL shape — a responsive PAIR (Decision 3):
 * `stickyHeaderClearance` (desktop, `>= sm`) now 60, plus a new `stickyHeaderClearanceMobile`
 * (mobile, `< sm`) at 108. Both are DERIVED from their own AppShell header (`appShellHeaderHeight`/
 * `appShellHeaderMobileHeight`) instead of one independent literal, which fixed two bugs at once:
 * the original 84 under-cleared the 96px mobile header at level 0 (before density entered the
 * picture at all), and a single derived value tuned against the mobile header over-cleared the 48px
 * desktop header by 60px on the common (desktop) path. See `deriveSpacing`'s doc in
 * `tokens/palette.ts` for the full rationale. Every other value in this file stays byte-identical.
 */
import { DEFAULT_THEME, mergeMantineTheme } from '@mantine/core'
import type { MantineTheme } from '@mantine/core'
import { describe, expect, test } from 'bun:test'
import { buildPaletteCss } from '../tokens'
import { SPACE, SPACE_FIXED, SPACE_SCALE, SPACE_STEP } from '../tokens/palette'
import { baseTheme } from './index'

const theme: MantineTheme = mergeMantineTheme(DEFAULT_THEME, baseTheme)

describe('SPACE anchors match the shipped identity', () => {
  test('rowInsetX is 10, rowInsetY is 6', () => {
    expect(SPACE.rowInsetX).toBe(10)
    expect(SPACE.rowInsetY).toBe(6)
  })

  test('the 4px vertical rhythm is unchanged', () => {
    expect(SPACE.stackXs).toBe(4)
    expect(SPACE.stackSm).toBe(8)
    expect(SPACE.stackMd).toBe(12)
    expect(SPACE.stackLg).toBe(16)
    expect(SPACE.stackXl).toBe(24)
  })

  test('inputHeight and controlHeight are both 42 (the shared control-height anchor)', () => {
    expect(SPACE.inputHeight).toBe(42)
    expect(SPACE.controlHeight).toBe(42)
  })
})

describe('SPACE_SCALE matches the shipped identity — independent of SPACE even where it coincides', () => {
  test('xs/sm/md/lg/xl are 10/12/16/18/24', () => {
    expect(SPACE_SCALE.xs).toBe(10)
    expect(SPACE_SCALE.sm).toBe(12)
    expect(SPACE_SCALE.md).toBe(16)
    expect(SPACE_SCALE.lg).toBe(18)
    expect(SPACE_SCALE.xl).toBe(24)
  })
})

describe('SPACE_STEP one-offs match the shipped identity', () => {
  test('timelineBullet is 22', () => {
    expect(SPACE_STEP.timelineBullet).toBe(22)
  })
})

describe('SPACE_FIXED structurals match the shipped identity', () => {
  test('hairline is 1', () => {
    expect(SPACE_FIXED.hairline).toBe(1)
  })

  test('readingProgressHeight is 2 (not emitted as a var — see the assertion below)', () => {
    expect(SPACE_FIXED.readingProgressHeight).toBe(2)
  })

  test('segmentedTrackInset is 2 (not emitted as a var — see the assertion below)', () => {
    expect(SPACE_FIXED.segmentedTrackInset).toBe(2)
  })
})

describe('the Mantine spacing size-scale is byte-identical to the pre-tokenization literals', () => {
  test('xs/sm/md/lg/xl resolve to the exact prior rem strings', () => {
    expect(baseTheme.spacing).toEqual({
      xs: '0.625rem',
      sm: '0.75rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.5rem',
    })
  })
})

describe('every re-pointed component styles/defaultProps spacing value matches its shipped number', () => {
  test('NavLink root padding = 6px 10px', () => {
    expect(baseTheme.components?.['NavLink']?.styles?.['root']?.['padding']).toBe(
      'var(--vx-space-row-inset-y) var(--vx-space-row-inset-x)',
    )
  })

  test('Menu item padding = 6px 10px', () => {
    expect(baseTheme.components?.['Menu']?.styles?.['item']?.['padding']).toBe(
      'var(--vx-space-row-inset-y) var(--vx-space-row-inset-x)',
    )
  })

  test('SegmentedControl root padding = 2 (a density-exempt SPACE_FIXED literal, not a var)', () => {
    expect(baseTheme.components?.['SegmentedControl']?.styles?.['root']?.['padding']).toBe('2px')
  })

  test('Timeline defaultProps stays bulletSize: 22, lineWidth: 1', () => {
    const tl = baseTheme.components?.['Timeline']
    expect(tl?.defaultProps?.['bulletSize']).toBe(22)
    expect(tl?.defaultProps?.['lineWidth']).toBe(1)
  })

  test('Progress defaultProps stays size: 6', () => {
    expect(baseTheme.components?.['Progress']?.defaultProps?.['size']).toBe(6)
  })

  test('NavLink root/label lineHeight reads the density-tracking var', () => {
    const nl = baseTheme.components?.['NavLink']
    expect(nl?.styles?.['root']?.['lineHeight']).toBe('var(--vx-space-row-line-height)')
    expect(nl?.styles?.['label']?.['lineHeight']).toBe('var(--vx-space-row-line-height)')
  })

  test('Input --input-height reconstructs BOTH the rem half and the --mantine-scale half', () => {
    // Mantine's own `--input-height-md` is `calc(2.625rem * var(--mantine-scale))` — rem-relative
    // to the root font size AND scale-aware. The override must reconstruct both, not flatten either
    // into a bare px value (see the `Input.extend` `vars` doc comment for why).
    const vars = baseTheme.components?.['Input']?.vars
    // Test-only stub props/ctx — the callback only reads `size`.
    const mdResult = vars?.(theme, { size: 'md' } as never, {} as never)
    expect(mdResult?.wrapper?.['--input-height']).toBe(
      'calc(var(--vx-space-input-height) * var(--mantine-scale))',
    )
  })

  test('Input --input-height leaves a non-md size on Mantine own static height', () => {
    const vars = baseTheme.components?.['Input']?.vars
    const xsResult = vars?.(theme, { size: 'xs' } as never, {} as never)
    expect(xsResult?.wrapper?.['--input-height']).toBeUndefined()
  })

  test('Button --button-height reconstructs BOTH the rem half and the --mantine-scale half', () => {
    // Same reconstruction as Input above — Mantine's own `--button-height-md` is also
    // `calc(2.625rem * var(--mantine-scale))`. Single-sourced from the SAME `controlHeight` anchor
    // `--vx-space-input-height` reads (see `Button.extend`'s doc comment).
    const vars = baseTheme.components?.['Button']?.vars
    const mdResult = vars?.(theme, { size: 'md' } as never, {} as never)
    expect(mdResult?.root?.['--button-height']).toBe(
      'calc(var(--vx-space-control-height) * var(--mantine-scale))',
    )
  })

  test('Button --button-height leaves a non-md size on Mantine own static height', () => {
    const vars = baseTheme.components?.['Button']?.vars
    const smResult = vars?.(theme, { size: 'sm' } as never, {} as never)
    expect(smResult?.root?.['--button-height']).toBeUndefined()
  })

  test('ActionIcon --ai-size reconstructs BOTH the rem half and the --mantine-scale half', () => {
    const vars = baseTheme.components?.['ActionIcon']?.vars
    const mdResult = vars?.(theme, { size: 'md' } as never, {} as never)
    expect(mdResult?.root?.['--ai-size']).toBe(
      'calc(var(--vx-space-control-height) * var(--mantine-scale))',
    )
  })

  test('ActionIcon --ai-size leaves a non-md size on Mantine own static height', () => {
    const vars = baseTheme.components?.['ActionIcon']?.vars
    const smResult = vars?.(theme, { size: 'sm' } as never, {} as never)
    expect(smResult?.root?.['--ai-size']).toBeUndefined()
  })
})

describe('--vx-space-* is emitted from the SAME constants', () => {
  const css = buildPaletteCss()

  test('emits every SPACE anchor, unchanged', () => {
    expect(css).toContain('--vx-space-row-inset-x: 10px;')
    expect(css).toContain('--vx-space-row-inset-y: 6px;')
    expect(css).toContain('--vx-space-stack-xs: 4px;')
    expect(css).toContain('--vx-space-stack-sm: 8px;')
    expect(css).toContain('--vx-space-stack-md: 12px;')
    expect(css).toContain('--vx-space-stack-lg: 16px;')
    expect(css).toContain('--vx-space-stack-xl: 24px;')
  })

  test('does NOT emit SPACE_FIXED as a var', () => {
    expect(css).not.toContain('--vx-space-hairline')
    expect(css).not.toContain('--vx-space-reading-progress-height')
    expect(css).not.toContain('--vx-space-segmented-track-inset')
  })

  test('does NOT emit the dead numbers-only vars (JS-consumed, zero var() reads)', () => {
    // `SPACE_SCALE` (the generic Mantine spacing scale) already reaches production through
    // `theme.spacing` -> `--mantine-spacing-*`, not a `--vx-space-scale-*` var nobody read — and
    // `timelineBullet`/`chart*`/`progressBarSize` are JS-number-only (`Timeline`'s
    // `defaultProps.bulletSize`, `VX.legendGap`/`VX.margin`/`VX.dotR`, `Progress`'s
    // `defaultProps.size`). See `spaceDecls`'s doc in `tokens/index.ts`.
    expect(css).not.toContain('--vx-space-scale-xs')
    expect(css).not.toContain('--vx-space-scale-sm')
    expect(css).not.toContain('--vx-space-scale-md')
    expect(css).not.toContain('--vx-space-scale-lg')
    expect(css).not.toContain('--vx-space-scale-xl')
    expect(css).not.toContain('--vx-space-timeline-bullet')
    expect(css).not.toContain('--vx-space-chart-legend-gap')
    expect(css).not.toContain('--vx-space-chart-margin-top')
    expect(css).not.toContain('--vx-space-chart-margin-right')
    expect(css).not.toContain('--vx-space-chart-margin-bottom')
    expect(css).not.toContain('--vx-space-chart-margin-left')
    expect(css).not.toContain('--vx-space-chart-dot-r')
    expect(css).not.toContain('--vx-space-progress-bar-size')
  })

  test('emits the density pass additions: row line-height, input height, control height', () => {
    expect(css).toContain('--vx-space-row-line-height: 1.35;')
    // REM, not px — Mantine's own `--input-height-md`/`--button-height-md` are both
    // `calc(2.625rem * var(--mantine-scale))` (identical in `styles.css` and the `styles.layer.css`
    // variant consumers load), so flattening this into a flat px value would desync those heights
    // from the root font size AND `--mantine-scale`. See `tokens/index.ts`'s `spaceDecls` and
    // `theme/index.ts`'s `Input.extend`/`Button.extend`/`ActionIcon.extend` `vars` for the halves
    // of the fix.
    expect(css).toContain('--vx-space-input-height: 2.625rem;')
    expect(css).not.toContain('--vx-space-input-height: 42px;')
    expect(css).toContain('--vx-space-control-height: 2.625rem;')
    expect(css).not.toContain('--vx-space-control-height: 42px;')
  })
})

/**
 * The CSS-module spacing sweep (`docs/STATUS.md`) — every new `SPACE_STEP` one-off it introduced,
 * locked to its shipped literal AND, for the ones with a real `var()` consumer, to the exact
 * `--vx-space-*` declaration `buildPaletteCss()` emits for it. Table-driven (one row per constant)
 * instead of one `test()` per constant — this table is the single place a future retune of one of
 * these has to touch. `cssVar: null` marks a JS-number-only constant (no `var()` consumer anywhere —
 * `Timeline`'s `defaultProps.bulletSize`, `VX.legendGap`/`VX.margin`/`VX.dotR`, `Progress`'s
 * `defaultProps.size`) that deliberately has NO `--vx-space-*` declaration (see `spaceDecls`'s doc
 * in `tokens/index.ts`).
 */
const SPACE_STEP_SWEEP: ReadonlyArray<
  readonly [key: keyof typeof SPACE_STEP, value: number, cssVar: string | null]
> = [
  // DERIVED, not an independent literal — see `deriveSpacing`'s doc (`tokens/palette.ts`, third
  // bullet, Decision 3) for why 60/108 (not 84) are the level-0 values: the ONE responsive PAIR
  // deliberately exempt from the "every SPACE_STEP number is byte-identical at level 0" invariant
  // this file otherwise enforces (locked here, not skipped, precisely so a future regression back to
  // 84, or back to a single shared value, shows up as a failing assertion rather than a silent
  // revert).
  ['stickyHeaderClearance', 60, 'space-sticky-header-clearance'],
  ['stickyHeaderClearanceMobile', 108, 'space-sticky-header-clearance-mobile'],
  ['navIconGap', 10, 'space-nav-icon-gap'],
  ['sidebarRegionGap', 12, 'space-sidebar-region-gap'],
  ['proseQuoteInsetY', 2, 'space-prose-quote-inset-y'],
  ['proseQuoteIndent', 12, 'space-prose-quote-indent'],
  ['proseInlineCodeInsetY', 1.5, 'space-prose-inline-code-inset-y'],
  ['proseInlineCodeInsetX', 5, 'space-prose-inline-code-inset-x'],
  ['proseCodeBlockInsetY', 10, 'space-prose-code-block-inset-y'],
  ['proseCodeBlockInsetX', 12, 'space-prose-code-block-inset-x'],
  ['proseHeadingAnchorGap', 6, 'space-prose-heading-anchor-gap'],
  ['proseTableCellInsetY', 5, 'space-prose-table-cell-inset-y'],
  ['proseTableCellInsetX', 8, 'space-prose-table-cell-inset-x'],
  ['proseChatListGapBottom', 10, 'space-prose-chat-list-gap-bottom'],
  ['proseChatListIndent', 20, 'space-prose-chat-list-indent'],
  ['proseChatListItemGap', 3, 'space-prose-chat-list-item-gap'],
  ['proseChatNestedListGap', 2, 'space-prose-chat-nested-list-gap'],
  ['proseChatHeadingGapTop', 14, 'space-prose-chat-heading-gap-top'],
  ['proseChatHeadingGapBottom', 6, 'space-prose-chat-heading-gap-bottom'],
  ['proseArticleParagraphGap', 14, 'space-prose-article-paragraph-gap'],
  ['proseArticleListGapTop', 6, 'space-prose-article-list-gap-top'],
  ['proseArticleListGapBottom', 14, 'space-prose-article-list-gap-bottom'],
  ['proseArticleListIndent', 22, 'space-prose-article-list-indent'],
  ['proseArticleH1GapTop', 6, 'space-prose-article-h1-gap-top'],
  ['proseArticleH1GapBottom', 14, 'space-prose-article-h1-gap-bottom'],
  ['proseArticleHeadingGapTop', 30, 'space-prose-article-heading-gap-top'],
  ['proseArticleHeadingGapBottom', 10, 'space-prose-article-heading-gap-bottom'],
  ['proseArticleH2RuleGap', 6, 'space-prose-article-h2-rule-gap'],
  ['proseArticleBlockGap', 18, 'space-prose-article-block-gap'],
  ['articleColumnGap', 56, 'space-article-column-gap'],
  ['articleTocRailWidth', 220, 'space-article-toc-rail-width'],
  ['articleHeaderGap', 10, 'space-article-header-gap'],
  ['articleHeaderPaddingBottom', 20, 'space-article-header-padding-bottom'],
  ['articleHeaderMarginBottom', 28, 'space-article-header-margin-bottom'],
  ['articleMetaRowGap', 6, 'space-article-meta-row-gap'],
  ['articleFooterGap', 12, 'space-article-footer-gap'],
  ['articleFooterMarginTop', 40, 'space-article-footer-margin-top'],
  ['articleFooterPaddingTop', 20, 'space-article-footer-padding-top'],
  ['articleNavTargetGap', 6, 'space-article-nav-target-gap'],
  ['codeBlockHeaderGap', 8, 'space-code-block-header-gap'],
  ['codeBlockHeaderInsetY', 6, 'space-code-block-header-inset-y'],
  ['codeBlockHeaderInsetRight', 10, 'space-code-block-header-inset-right'],
  ['codeBlockContentInsetX', 14, 'space-code-block-content-inset-x'],
  ['codeBlockHeaderRightGap', 6, 'space-code-block-header-right-gap'],
  ['codeBlockBodyInsetY', 10, 'space-code-block-body-inset-y'],
  ['codeBlockFloatingCopyOffset', 6, 'space-code-block-floating-copy-offset'],
  ['calloutInsetY', 10, 'space-callout-inset-y'],
  ['calloutInsetX', 14, 'space-callout-inset-x'],
  ['calloutTitleRowGap', 8, 'space-callout-title-row-gap'],
  ['tocRootGap', 6, 'space-toc-root-gap'],
  ['tocLinkInsetY', 4, 'space-toc-link-inset-y'],
  ['tocLinkIndent', 12, 'space-toc-link-indent'],
  ['tocSubIndent', 24, 'space-toc-sub-indent'],
  ['articleCardTagsGap', 4, 'space-article-card-tags-gap'],
  ['articleCardTagInsetY', 1, 'space-article-card-tag-inset-y'],
  ['articleCardTagInsetX', 6, 'space-article-card-tag-inset-x'],
  ['articleCardMetaGapTop', 2, 'space-article-card-meta-gap-top'],
  ['guideBodyGapBottom', 8, 'space-guide-body-gap-bottom'],
  ['guideFooterGapTop', 20, 'space-guide-footer-gap-top'],
  ['guideFooterInsetTop', 16, 'space-guide-footer-inset-top'],
  ['sidebarSearchGap', 8, 'space-sidebar-search-gap'],
  ['sidebarSearchTriggerHeight', 32, 'space-sidebar-search-trigger-height'],
  ['settingsRowInsetY', 10, 'space-settings-row-inset-y'],
  ['settingsRowGap', 16, 'space-settings-row-gap'],
  ['mermaidContainerInset', 16, 'space-mermaid-container-inset'],
  ['sidebarBrandInsetTop', 3, 'space-sidebar-brand-inset-top'],
  ['sidebarBrandInsetX', 8, 'space-sidebar-brand-inset-x'],
  ['sidebarSectionGap', 15, 'space-sidebar-section-gap'],
  ['sidebarAccountInsetTop', 11, 'space-sidebar-account-inset-top'],
  ['sidebarAccountInsetX', 8, 'space-sidebar-account-inset-x'],
  ['sidebarAccountInsetBottom', 3, 'space-sidebar-account-inset-bottom'],
  ['sidebarAvatarSize', 28, 'space-sidebar-avatar-size'],
  ['sidebarSectionLabelGap', 3, 'space-sidebar-section-label-gap'],
  ['sidebarChildListGapTop', 2, 'space-sidebar-child-list-gap-top'],
  ['sidebarChildListGapBottom', 4, 'space-sidebar-child-list-gap-bottom'],
  ['sidebarChildListIndent', 17, 'space-sidebar-child-list-indent'],
  ['sidebarChildRowInsetY', 5, 'space-sidebar-child-row-inset-y'],
  ['sidebarChildRowIndent', 14, 'space-sidebar-child-row-indent'],
  // JS-number-only (`app-sidebar-account.tsx`/`app-sidebar.tsx` read both via `useBasaltSpacing()` —
  // Mantine's `<Menu width={…}>` also takes a number, not a `var()` string).
  ['sidebarAccountMenuWidth', 220, null],
  ['sidebarSettingsMenuWidth', 200, null],
  ['appHeaderMobileActionsHeight', 52, 'space-app-header-mobile-actions-height'],
  // JS-number-only (`shell/index.tsx` reads all four via `useBasaltSpacing()` — Mantine's AppShell
  // `header`/`navbar` props take numbers, not `var()` strings) — see `spaceDecls`'s doc in
  // `tokens/index.ts` for why a `--vx-space-app-shell-*` declaration would have zero consumers.
  ['appShellHeaderHeight', 48, null],
  ['appShellHeaderMobileHeight', 96, null],
  ['appShellNavbarWidth', 216, null],
  ['appShellNavbarRailWidth', 48, null],
  ['mobileNavTabGap', 3, 'space-mobile-nav-tab-gap'],
  ['agentRailInsetX', 10, 'space-agent-rail-inset-x'],
  ['agentPartGapTop', 6, 'space-agent-part-gap-top'],
  ['agentCodeInset', 8, 'space-agent-code-inset'],
  ['agentErrorInsetY', 8, 'space-agent-error-inset-y'],
  ['agentErrorInsetX', 10, 'space-agent-error-inset-x'],
  ['agentScrollButtonGapTop', 8, 'space-agent-scroll-button-gap-top'],
  ['agentMessageInsetY', 10, 'space-agent-message-inset-y'],
  ['agentMessageInsetX', 12, 'space-agent-message-inset-x'],
  ['agentTranscriptInset', 16, 'space-agent-transcript-inset'],
  ['badgeInsetY', 2, 'space-badge-inset-y'],
  ['badgeInsetX', 7, 'space-badge-inset-x'],
  ['statCardGap', 8, 'space-stat-card-gap'],
  ['virtualRowInsetY', 8, 'space-virtual-row-inset-y'],
  ['virtualRowInsetX', 12, 'space-virtual-row-inset-x'],
  ['chartLegendGap', 22, null],
  ['chartMarginTop', 12, null],
  ['chartMarginRight', 16, null],
  ['chartMarginBottom', 30, null],
  ['chartMarginLeft', 44, null],
  ['chartDotR', 5, null],
  ['progressBarSize', 6, null],
  ['timelineBullet', 22, null],
]

describe('SPACE_STEP CSS-module spacing-sweep one-offs match the shipped identity', () => {
  test('every constant matches its shipped literal', () => {
    for (const [key, value] of SPACE_STEP_SWEEP) {
      expect(SPACE_STEP[key]).toBe(value)
    }
  })

  test('every constant with a cssVar is emitted as its own --vx-space-* declaration, unchanged', () => {
    const css = buildPaletteCss()
    for (const [, value, cssVar] of SPACE_STEP_SWEEP) {
      if (cssVar === null) continue
      expect(css).toContain(`--vx-${cssVar}: ${value}px;`)
    }
  })

  test('every cssVar: null constant is NOT emitted as a --vx-space-* declaration', () => {
    const css = buildPaletteCss()
    const jsOnlyKeys = SPACE_STEP_SWEEP.filter(([, , cssVar]) => cssVar === null).map(
      ([key]) => key,
    )
    expect(jsOnlyKeys).toEqual([
      'sidebarAccountMenuWidth',
      'sidebarSettingsMenuWidth',
      'appShellHeaderHeight',
      'appShellHeaderMobileHeight',
      'appShellNavbarWidth',
      'appShellNavbarRailWidth',
      'chartLegendGap',
      'chartMarginTop',
      'chartMarginRight',
      'chartMarginBottom',
      'chartMarginLeft',
      'chartDotR',
      'progressBarSize',
      'timelineBullet',
    ])
    expect(css).not.toContain('--vx-space-sidebar-account-menu-width')
    expect(css).not.toContain('--vx-space-sidebar-settings-menu-width')
    expect(css).not.toContain('--vx-space-app-shell-header-height')
    expect(css).not.toContain('--vx-space-app-shell-header-mobile-height')
    expect(css).not.toContain('--vx-space-app-shell-navbar-width')
    expect(css).not.toContain('--vx-space-app-shell-navbar-rail-width')
    expect(css).not.toContain('--vx-space-chart-legend-gap')
    expect(css).not.toContain('--vx-space-progress-bar-size')
    expect(css).not.toContain('--vx-space-timeline-bullet')
  })

  test('the sweep table covers every SPACE_STEP key', () => {
    const tableKeys = new Set(SPACE_STEP_SWEEP.map(([key]) => key))
    for (const key of Object.keys(SPACE_STEP)) {
      expect(tableKeys.has(key as keyof typeof SPACE_STEP)).toBe(true)
    }
  })
})
