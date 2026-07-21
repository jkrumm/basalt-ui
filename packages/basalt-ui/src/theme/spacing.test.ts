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
  })
})
