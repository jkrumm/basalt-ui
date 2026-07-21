/**
 * `deriveSpacing` — the spacing analog of `deriveRadius`. Locks the law (a `1 + 0.1 * level`
 * multiplier, over a narrower `[-3, 3]` range than `deriveRadius`'s `[-5, 5]` — see `deriveSpacing`'s
 * own JSDoc in `palette.ts` for why — applied to every density-tracking anchor/scale-stop/one-off,
 * rounded and floored at 1, plus the row line-height's own additive law) at a handful of levels,
 * plus the throw-and-propagate
 * validation and `buildDensityCss`'s CSS output. `theme/spacing.test.ts` separately locks that
 * `SPACE`/`SPACE_SCALE`/`SPACE_STEP`/`ROW_LINE_HEIGHT` equal `deriveSpacing(0)`'s output
 * byte-for-byte — this file is the law itself (and the CSS builder), not the shipped-identity
 * snapshot. Lives in `tokens/` (a sibling to `derive-radius.test.ts`/`build-radius-css.test.ts`,
 * merged into one file here) rather than extending `theme/spacing.test.ts`: that file's own doc
 * comment scopes it strictly to "the rendered output must stay byte-identical to the numbers
 * shipped" — the LAW at non-zero levels is a different concern, same split radius already made.
 */
import { describe, expect, test } from 'bun:test'
import { buildDensityCss, VX } from './index'
import { deriveSpacing, scaleSpace } from './palette'

// The "deriveSpacing(0) matches SPACE/SPACE_SCALE/SPACE_STEP/ROW_LINE_HEIGHT byte-for-byte" check
// used to live here as its own test — deleted, not merely renamed: `SPACE`/`SPACE_SCALE`/
// `SPACE_STEP`/`ROW_LINE_HEIGHT` (`palette.ts`) are DEFINED as `DEFAULT_SPACE_VALUES = deriveSpacing(0)`
// and its destructured fields, so `expect(deriveSpacing(0)).toEqual({ anchors: SPACE, ... })` compared
// `deriveSpacing(0)` against itself — no source-level change could ever fail it. The real level-0
// acceptance gate (a hardcoded literal table, not a derived comparison) lives in
// `theme/spacing.test.ts`.
describe('deriveSpacing(0) reproduces the shipped identity exactly', () => {
  test('a non-integer base (proseInlineCodeInsetY: 1.5) survives untouched at level 0', () => {
    // The naive `Math.round(1.5 * 1)` rounds half-up to 2 — `deriveSpacing` must special-case
    // level 0 to skip rounding entirely, or this silently regresses the byte-identical gate.
    expect(deriveSpacing(0).step.proseInlineCodeInsetY).toBe(1.5)
  })
})

describe('VX chart geometry at level 0 (single-sourced from SPACE_STEP)', () => {
  // Locks the shipped identity so a future SPACE_STEP edit can't silently move chart geometry —
  // `VX.dotR`/`VX.legendGap`/`VX.margin` (`tokens/index.ts`) read straight off `SPACE_STEP`, which
  // is itself `deriveSpacing(0).step` (see the top describe block above).
  test('dotR is 5', () => expect(VX.dotR).toBe(5))
  test('legendGap is 22', () => expect(VX.legendGap).toBe(22))
  test('margin is { top: 12, right: 16, bottom: 30, left: 44 }', () => {
    expect(VX.margin).toEqual({ top: 12, right: 16, bottom: 30, left: 44 })
  })
})

describe('a positive level scales anchors/scale/step by the multiplier, rounded', () => {
  test('level +2: a 10px anchor -> 12, a 6px anchor -> 7', () => {
    const result = deriveSpacing(2)
    expect(result.anchors.rowInsetX).toBe(12)
    expect(result.anchors.rowInsetY).toBe(7)
  })

  test('level +3 (the new endpoint — reproduces the old ±5 envelope, 0.1 * 3 === 0.06 * 5): the same two land at 13 / 8, and a 2px one-off lands at 3', () => {
    const result = deriveSpacing(3)
    expect(result.anchors.rowInsetX).toBe(13)
    expect(result.anchors.rowInsetY).toBe(8)
    expect(result.step.proseQuoteInsetY).toBe(3)
  })

  test('a scale stop moves independently of its coinciding anchor', () => {
    const result = deriveSpacing(3)
    expect(result.scale.xs).toBe(13)
    expect(result.scale.md).toBe(21)
    // scale.md (21) diverges from anchors.stackLg (20, rebuilt from the shared stack unit) even
    // though both share a 16px level-0 base — proving the two groups scale independently.
    expect(result.anchors.stackLg).toBe(20)
  })
})

describe('a negative level scales down, floored at 1 for any base >= 1', () => {
  test('level -3 (the new endpoint): a 10px anchor -> 7, a 6px anchor -> 4', () => {
    const result = deriveSpacing(-3)
    expect(result.anchors.rowInsetX).toBe(7)
    expect(result.anchors.rowInsetY).toBe(4)
  })

  test('level -3: a 2px one-off lands at 1, not 0 (the floor)', () => {
    expect(deriveSpacing(-3).step.proseQuoteInsetY).toBe(1)
  })

  test("scaleSpace's unconditional floor actually engages for a sub-1 base — the property `deriveSpacing`'s own [-3, 3] range/bases can never exercise", () => {
    // Every real `SPACE_ANCHORS_BASE`/`SPACE_SCALE_BASE`/`SPACE_STEP_BASE` value is an integer >= 1,
    // and the shallowest multiplier `deriveSpacing` ever passes (0.7, at level -3) still keeps
    // `round(v * 0.7) >= 1` for any `v >= 1` — so looping `deriveSpacing(-3)`'s own output (the old
    // form of this test) can NEVER fail regardless of whether the floor exists at all. Drive
    // `scaleSpace` directly with a sub-1 base instead (as its own JSDoc names this test for) to
    // exercise the actual clamp: without it, `round(0.5 * 0.7) = round(0.35) = 0`.
    expect(scaleSpace(0.5, -3, 0.7)).toBe(1)
    // A future base as small as `0.1` collapses even further without the floor — confirms the clamp
    // holds regardless of how far below 1 a hypothetical base sits, not just at the one boundary case.
    expect(scaleSpace(0.1, -3, 0.7)).toBe(1)
  })
})

describe('the input-height anchor scales with density', () => {
  test('level -3/0/+3: 29 / 42 / 55', () => {
    expect(deriveSpacing(-3).anchors.inputHeight).toBe(29)
    expect(deriveSpacing(0).anchors.inputHeight).toBe(42)
    expect(deriveSpacing(3).anchors.inputHeight).toBe(55)
  })
})

// The "controlHeight tracks inputHeight at every level" cross-level check used to live here as its
// own describe block — deleted, not merely renamed: both keys read the literal same
// `CONTROL_HEIGHT_BASE` and are scaled by the SAME deterministic `scaleSpace` call, so
// `controlHeight === inputHeight` is true BY CONSTRUCTION and can never fail regardless of what the
// multiplier law actually computes. `theme/density-relations.test.ts`'s "Fix 1" describe block
// replaced this exact form with one that asserts each key against its own hardcoded expected value
// (29 / 34 / 38 / 42 / 46 / 50 / 55 across the full level range) — that version bites on a change to
// `CONTROL_HEIGHT_BASE`, the multiplier law, OR a divergence between the two keys, none of which the
// by-construction equality could catch. Not re-duplicated.

// The 4px-stack-rhythm cross-level relation (2:1 pairs, exact multiples of stackXs) is covered by
// `theme/density-relations.test.ts`'s "Fix 2" describe block — that version asserts the DOCUMENTED
// exact multiples (2x/3x/4x/6x of stackXs), which subsumes and is strictly stronger than the
// `% === 0` divisibility form this file used to duplicate here (any value that IS `stackXs * N`
// trivially divides `stackXs`, so the weaker form added no independent coverage). Not re-duplicated.

describe('rowLineHeight follows its own additive law, not the multiplier', () => {
  test('level -3/0/+3: 1.25 / 1.35 / 1.45', () => {
    expect(deriveSpacing(-3).rowLineHeight).toBe(1.25)
    expect(deriveSpacing(0).rowLineHeight).toBe(1.35)
    expect(deriveSpacing(3).rowLineHeight).toBe(1.45)
  })
})

describe('stickyHeaderClearance/stickyHeaderClearanceMobile derive from their OWN AppShell header, not a shared base (Decision 3 — responsive split)', () => {
  test('level -3/0/+3: desktop 43 / 60 / 77 — appShellHeaderHeight + anchors.stackMd at each level', () => {
    const low = deriveSpacing(-3)
    const zero = deriveSpacing(0)
    const high = deriveSpacing(3)
    expect(low.step.stickyHeaderClearance).toBe(43)
    expect(low.step.stickyHeaderClearance).toBe(low.step.appShellHeaderHeight + low.anchors.stackMd)
    expect(zero.step.stickyHeaderClearance).toBe(60)
    expect(high.step.stickyHeaderClearance).toBe(77)
    expect(high.step.stickyHeaderClearance).toBe(
      high.step.appShellHeaderHeight + high.anchors.stackMd,
    )
  })

  test('level -3/0/+3: mobile 76 / 108 / 140 — appShellHeaderMobileHeight + anchors.stackMd at each level', () => {
    const low = deriveSpacing(-3)
    const zero = deriveSpacing(0)
    const high = deriveSpacing(3)
    expect(low.step.stickyHeaderClearanceMobile).toBe(76)
    expect(low.step.stickyHeaderClearanceMobile).toBe(
      low.step.appShellHeaderMobileHeight + low.anchors.stackMd,
    )
    expect(zero.step.stickyHeaderClearanceMobile).toBe(108)
    expect(high.step.stickyHeaderClearanceMobile).toBe(140)
    expect(high.step.stickyHeaderClearanceMobile).toBe(
      high.step.appShellHeaderMobileHeight + high.anchors.stackMd,
    )
  })

  test('every level: each clearance exceeds ONLY the header it exists to clear, exactly by anchors.stackMd', () => {
    for (let level = -3; level <= 3; level++) {
      const { step, anchors } = deriveSpacing(level)
      expect(step.stickyHeaderClearance - step.appShellHeaderHeight).toBe(anchors.stackMd)
      expect(step.stickyHeaderClearanceMobile - step.appShellHeaderMobileHeight).toBe(
        anchors.stackMd,
      )
    }
  })
})

describe('deriveSpacing rejects a malformed level', () => {
  test('a non-integer throws', () => {
    expect(() => deriveSpacing(1.5)).toThrow()
  })

  test('below -3 throws', () => {
    expect(() => deriveSpacing(-4)).toThrow()
  })

  test('above 3 throws', () => {
    expect(() => deriveSpacing(4)).toThrow()
  })

  test('the old ±5 endpoints are now out of range too', () => {
    expect(() => deriveSpacing(-5)).toThrow()
    expect(() => deriveSpacing(5)).toThrow()
  })

  test('NaN throws', () => {
    expect(() => deriveSpacing(Number.NaN)).toThrow()
  })
})

describe('buildDensityCss', () => {
  test('returns empty string when space is undefined', () => {
    expect(buildDensityCss(undefined)).toBe('')
  })

  test('emits every anchor/one-off declaration under one :root block, at the retuned level', () => {
    const css = buildDensityCss(deriveSpacing(3))
    expect(css).toContain(':root {')
    expect(css).toContain('--vx-space-row-inset-x: 13px;')
    expect(css).toContain('--vx-space-row-inset-y: 8px;')
    expect(css).toContain('--vx-space-row-line-height: 1.45;')
    // REM, not px — see the input-height describe block below for why.
    expect(css).toContain('--vx-space-input-height: 3.4375rem;')
    expect(css).toContain('--vx-space-control-height: 3.4375rem;')
    // 77 (desktop) / 140 (mobile), not the anchor/scale/step multiplier result for an 84px base —
    // both are DERIVED (own header + anchors.stackMd), see the dedicated describe block above.
    expect(css).toContain('--vx-space-sticky-header-clearance: 77px;')
    expect(css).toContain('--vx-space-sticky-header-clearance-mobile: 140px;')
    // JS-number-only constants (Timeline's bulletSize, VX chart geometry, Progress's size) have no
    // CSS var to override — see `spaceDecls`'s doc in `tokens/index.ts`.
    expect(css).not.toContain('--vx-space-timeline-bullet')
    expect(css).not.toContain('--vx-space-chart-legend-gap')
    expect(css).not.toContain('--vx-space-progress-bar-size')
  })
})

describe('the input-height var is emitted in REM, never a flat px', () => {
  test("level 0 emits exactly 2.625rem — Mantine's own --input-height-md value", () => {
    expect(buildDensityCss(deriveSpacing(0))).toContain('--vx-space-input-height: 2.625rem;')
    expect(buildDensityCss(deriveSpacing(0))).not.toContain('--vx-space-input-height: 42px;')
  })

  test('a retuned level still emits rem, computed from the scaled px anchor', () => {
    // inputHeight scales like every other anchor (42 -> 55 at level +3, the new endpoint), then
    // converts to rem — the LAW stays px-denominated; only the CSS emission is rem, per `pxRem`.
    expect(deriveSpacing(3).anchors.inputHeight).toBe(55)
    expect(buildDensityCss(deriveSpacing(3))).toContain('--vx-space-input-height: 3.4375rem;')
  })
})
