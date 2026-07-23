/**
 * The radius gate — this is a TOKENIZATION-only refactor (`RADIUS`/`RADIUS_STEP` in
 * `tokens/palette.ts` replace ~10 components' hardcoded `defaultProps`/`styles` radius literals,
 * the Mantine `radius` size-scale, and the `--vx-radius-card`/`--vx-radius-ctrl` CSS vars), so the
 * rendered output must stay byte-identical to the numbers shipped before it. This locks today's
 * exact values as the acceptance baseline — a future change to `RADIUS.card`/`RADIUS.ctrl` (or any
 * `RADIUS_STEP` offset) that moves one of these numbers is a deliberate visual change, not a
 * silent regression, and must update this file in the same commit.
 */
import { describe, expect, test } from 'bun:test'
import { buildPaletteCss } from '../tokens'
import { RADIUS, RADIUS_STEP } from '../tokens/palette'
import { baseTheme } from './index'

describe('the two anchors match the shipped identity', () => {
  test('RADIUS.card is 7', () => {
    expect(RADIUS.card).toBe(7)
  })

  test('RADIUS.ctrl is 6', () => {
    expect(RADIUS.ctrl).toBe(6)
  })
})

describe('every derived/independent step reproduces its exact shipped number', () => {
  test('floating (Tooltip/Popover/Modal/Notification) = card + 1 = 8', () => {
    expect(RADIUS_STEP.floating).toBe(8)
  })

  test('tight (SegmentedControl indicator, Kbd, Code) = ctrl - 1 = 5', () => {
    expect(RADIUS_STEP.tight).toBe(5)
  })

  test('fine (Progress, Mantine scale sm) = ctrl - 2 = 4', () => {
    expect(RADIUS_STEP.fine).toBe(4)
  })

  test('the independent Mantine-scale steps are unchanged', () => {
    expect(RADIUS_STEP.scaleXs).toBe(2)
    expect(RADIUS_STEP.scaleLg).toBe(16)
    expect(RADIUS_STEP.scaleXl).toBe(32)
  })

  test('the pill affordance is fixed at 9999, independent of the radius knob', () => {
    expect(RADIUS_STEP.pill).toBe(9999)
  })
})

describe('the Mantine radius size-scale is byte-identical to the pre-tokenization literals', () => {
  test('xs/sm/md/lg/xl resolve to the exact prior rem strings', () => {
    expect(baseTheme.radius).toEqual({
      xs: '0.125rem',
      sm: '0.25rem',
      md: '0.375rem',
      lg: '1rem',
      xl: '2rem',
    })
  })

  test('defaultRadius stays "md" (= RADIUS.ctrl)', () => {
    expect(baseTheme.defaultRadius).toBe('md')
  })
})

describe('every re-pointed component defaultProps/styles radius matches its shipped number', () => {
  test('Badge = 6', () => {
    expect(baseTheme.components?.['Badge']?.defaultProps?.['radius']).toBe(6)
  })

  test('SegmentedControl root = 7, indicator = 5', () => {
    const sc = baseTheme.components?.['SegmentedControl']
    expect(sc?.defaultProps?.['radius']).toBe(7)
    expect(sc?.styles?.['indicator']?.['borderRadius']).toBe('var(--vx-radius-tight)')
  })

  test('Progress = 4', () => {
    expect(baseTheme.components?.['Progress']?.defaultProps?.['radius']).toBe(4)
  })

  test('Tooltip = 8', () => {
    expect(baseTheme.components?.['Tooltip']?.defaultProps?.['radius']).toBe(8)
  })

  test('Popover = 8', () => {
    expect(baseTheme.components?.['Popover']?.defaultProps?.['radius']).toBe(8)
  })

  test('Modal = 8', () => {
    expect(baseTheme.components?.['Modal']?.defaultProps?.['radius']).toBe(8)
  })

  test('Notification = 8', () => {
    expect(baseTheme.components?.['Notification']?.defaultProps?.['radius']).toBe(8)
  })

  test('NavLink root = 6', () => {
    expect(baseTheme.components?.['NavLink']?.styles?.['root']?.['borderRadius']).toBe(
      'var(--vx-radius-ctrl)',
    )
  })

  test('Menu item = 6', () => {
    expect(baseTheme.components?.['Menu']?.styles?.['item']?.['borderRadius']).toBe(
      'var(--vx-radius-ctrl)',
    )
  })

  test('Kbd = 5', () => {
    expect(baseTheme.components?.['Kbd']?.styles?.['root']?.['borderRadius']).toBe(
      'var(--vx-radius-tight)',
    )
  })

  test('Code = 5', () => {
    expect(baseTheme.components?.['Code']?.styles?.['root']?.['borderRadius']).toBe(
      'var(--vx-radius-tight)',
    )
  })
})

describe('--vx-radius-card / --vx-radius-ctrl are emitted from the SAME constants', () => {
  const css = buildPaletteCss()

  test('emits 7px / 6px, unchanged', () => {
    expect(css).toContain('--vx-radius-card: 7px;')
    expect(css).toContain('--vx-radius-ctrl: 6px;')
  })

  test('emits the fixed pill radius', () => {
    expect(css).toContain('--vx-radius-pill: 9999px;')
  })
})
