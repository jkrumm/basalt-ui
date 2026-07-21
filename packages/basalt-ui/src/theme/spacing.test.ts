/**
 * The spacing gate — this is a TOKENIZATION-only refactor (`SPACE`/`SPACE_SCALE`/`SPACE_STEP`/
 * `SPACE_FIXED` in `tokens/palette.ts` replace the Mantine `spacing` size-scale plus ~4 components'
 * hardcoded `styles`/`defaultProps` spacing literals and the `--vx-space-*` CSS vars), so the
 * rendered output must stay byte-identical to the numbers shipped before it. This locks today's
 * exact values as the acceptance baseline — a future change to `SPACE`/`SPACE_SCALE`/`SPACE_STEP`/
 * `SPACE_FIXED` that moves one of these numbers is a deliberate visual change, not a silent
 * regression, and must update this file in the same commit.
 */
import { describe, expect, test } from 'bun:test'
import { buildPaletteCss } from '../tokens'
import { SPACE, SPACE_FIXED, SPACE_SCALE, SPACE_STEP } from '../tokens/palette'
import { baseTheme } from './index'

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
  test('segmentedTrackInset is 2', () => {
    expect(SPACE_STEP.segmentedTrackInset).toBe(2)
  })

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

  test('SegmentedControl root padding = 2', () => {
    expect(baseTheme.components?.['SegmentedControl']?.styles?.['root']?.['padding']).toBe(
      'var(--vx-space-segmented-track-inset)',
    )
  })

  test('Timeline defaultProps stays bulletSize: 22, lineWidth: 1', () => {
    const tl = baseTheme.components?.['Timeline']
    expect(tl?.defaultProps?.['bulletSize']).toBe(22)
    expect(tl?.defaultProps?.['lineWidth']).toBe(1)
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

  test('emits every SPACE_SCALE stop, unchanged', () => {
    expect(css).toContain('--vx-space-scale-xs: 10px;')
    expect(css).toContain('--vx-space-scale-sm: 12px;')
    expect(css).toContain('--vx-space-scale-md: 16px;')
    expect(css).toContain('--vx-space-scale-lg: 18px;')
    expect(css).toContain('--vx-space-scale-xl: 24px;')
  })

  test('emits every SPACE_STEP one-off, unchanged', () => {
    expect(css).toContain('--vx-space-segmented-track-inset: 2px;')
    expect(css).toContain('--vx-space-timeline-bullet: 22px;')
  })

  test('does NOT emit SPACE_FIXED as a var', () => {
    expect(css).not.toContain('--vx-space-hairline')
    expect(css).not.toContain('--vx-space-reading-progress-height')
  })
})

/**
 * The CSS-module spacing sweep (`docs/STATUS.md`) — every new `SPACE_STEP` one-off it introduced,
 * locked to its shipped literal AND to the exact `--vx-space-*` declaration `buildPaletteCss()`
 * emits for it. Table-driven (one row per constant) instead of one `test()` per constant — this
 * table is the single place a future retune of one of these has to touch.
 */
const SPACE_STEP_SWEEP: ReadonlyArray<
  readonly [key: keyof typeof SPACE_STEP, value: number, cssVar: string]
> = [
  ['stickyHeaderClearance', 84, 'space-sticky-header-clearance'],
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
  ['appHeaderMobileActionsHeight', 52, 'space-app-header-mobile-actions-height'],
  ['mobileNavTabGap', 3, 'space-mobile-nav-tab-gap'],
]

describe('SPACE_STEP CSS-module spacing-sweep one-offs match the shipped identity', () => {
  test('every constant matches its shipped literal', () => {
    for (const [key, value] of SPACE_STEP_SWEEP) {
      expect(SPACE_STEP[key]).toBe(value)
    }
  })

  test('every constant is emitted as its own --vx-space-* declaration, unchanged', () => {
    const css = buildPaletteCss()
    for (const [, value, cssVar] of SPACE_STEP_SWEEP) {
      expect(css).toContain(`--vx-${cssVar}: ${value}px;`)
    }
  })

  test('the sweep table covers every SPACE_STEP key beyond the two pre-existing ones', () => {
    const preExisting = new Set(['segmentedTrackInset', 'timelineBullet'])
    const tableKeys = new Set(SPACE_STEP_SWEEP.map(([key]) => key))
    for (const key of Object.keys(SPACE_STEP)) {
      if (preExisting.has(key)) continue
      expect(tableKeys.has(key as keyof typeof SPACE_STEP)).toBe(true)
    }
  })
})
