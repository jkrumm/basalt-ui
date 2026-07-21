/**
 * Cross-level RELATION tests for the density knob — the audit that drove the Fix 1-7 pass in this
 * commit found the knob correct only at level 0 because every prior test was a level-0 snapshot, not
 * a relation that has to hold at every level. These loop over the full accepted range instead of
 * spot-checking one or two levels, so a future edit that reintroduces one of the audited defects
 * fails here regardless of which level it breaks first.
 *
 * `ALL_LEVELS` is derived from {@link DENSITY_LEVEL_RANGE} (`deriveSpacing`'s accepted `[-3, 3]`
 * range, narrowed from `[-5, 5]` by Fix 7 in this same commit — see `deriveSpacing`'s JSDoc in
 * `../tokens/palette` for why) rather than a hardcoded literal, so a future range change is picked
 * up here automatically instead of silently narrowing this file's own coverage. `ALL_RADIUS_LEVELS`
 * is the same derivation off {@link RADIUS_LEVEL_RANGE} — `deriveRadius` still accepts the wider
 * `[-5, 5]`, so the radius-only relation test below (Fix 3) samples MORE points than the density
 * tests, every one of them a real, valid radius level.
 */
import { DEFAULT_THEME, mergeMantineTheme } from '@mantine/core'
import type { MantineTheme } from '@mantine/core'
import { describe, expect, test } from 'bun:test'
import { VX } from '../tokens'
import {
  DENSITY_LEVEL_RANGE,
  RADIUS_LEVEL_RANGE,
  deriveRadius,
  deriveSpacing,
  scaleSpace,
  SPACE,
  SPACE_FIXED,
  SPACE_SCALE,
  SPACE_STEP,
} from '../tokens/palette'
import { baseTheme } from './index'

const theme: MantineTheme = mergeMantineTheme(DEFAULT_THEME, baseTheme)
const ALL_LEVELS = Array.from(
  { length: DENSITY_LEVEL_RANGE.max - DENSITY_LEVEL_RANGE.min + 1 },
  (_, i) => DENSITY_LEVEL_RANGE.min + i,
)
const ALL_RADIUS_LEVELS = Array.from(
  { length: RADIUS_LEVEL_RANGE.max - RADIUS_LEVEL_RANGE.min + 1 },
  (_, i) => RADIUS_LEVEL_RANGE.min + i,
)

/** Flatten `deriveSpacing(level)`'s anchors + scale + step into one numeric record — `rowLineHeight`
 * is excluded (it is additive, not routed through `scaleSpace`, and always moves, which would
 * inflate a change ratio and can never be "frozen"). Used by the "Fix 7" resolution-honesty block. */
function flattenSpacing(level: number): Record<string, number> {
  const { anchors, scale, step } = deriveSpacing(level)
  return { ...anchors, ...scale, ...step }
}

describe('Fix 1 — input height, button height, and ActionIcon size never drift', () => {
  test('every level: controlHeight AND inputHeight resolve to the exact scaled anchor, not merely to each other', () => {
    // The old form of this test (`controlHeight === inputHeight`) is true BY CONSTRUCTION — both
    // keys hold the literal same `CONTROL_HEIGHT_BASE` and are scaled by the SAME deterministic
    // `scaleSpace(value, level, multiplier)` call, so they can never disagree regardless of what the
    // multiplier law actually computes. Assert each against its own hardcoded expected value instead
    // — this bites on a change to `CONTROL_HEIGHT_BASE`, the multiplier law, OR a divergence between
    // the two keys, none of which the old form could catch.
    const expected: Record<number, number> = {
      [-3]: 29,
      [-2]: 34,
      [-1]: 38,
      0: 42,
      1: 46,
      2: 50,
      3: 55,
    }
    for (const level of ALL_LEVELS) {
      const { anchors } = deriveSpacing(level)
      expect(anchors.inputHeight).toBe(expected[level])
      expect(anchors.controlHeight).toBe(expected[level])
    }
  })

  test('every level: Input/Button/ActionIcon vars() resolve to the SAME calc() shape at size=md', () => {
    // The three overrides read different CSS custom properties (`--vx-space-input-height` vs.
    // `--vx-space-control-height`) but the same anchor, so their `calc(...)` bodies differ only in
    // var NAME, never in the numeric anchor they carry.
    const inputVars = baseTheme.components?.['Input']?.vars
    const buttonVars = baseTheme.components?.['Button']?.vars
    const actionIconVars = baseTheme.components?.['ActionIcon']?.vars
    const inputResult = inputVars?.(theme, { size: 'md' } as never, {} as never)
    const buttonResult = buttonVars?.(theme, { size: 'md' } as never, {} as never)
    const actionIconResult = actionIconVars?.(theme, { size: 'md' } as never, {} as never)
    expect(inputResult?.wrapper?.['--input-height']).toBe(
      'calc(var(--vx-space-input-height) * var(--mantine-scale))',
    )
    expect(buttonResult?.root?.['--button-height']).toBe(
      'calc(var(--vx-space-control-height) * var(--mantine-scale))',
    )
    expect(actionIconResult?.root?.['--ai-size']).toBe(
      'calc(var(--vx-space-control-height) * var(--mantine-scale))',
    )
  })
})

describe('Fix 2 — the 4px stack rhythm holds its 2:1 pairs at every level', () => {
  test('stackXl = 2 * stackMd, stackLg = 2 * stackSm, and every step is its documented multiple of stackXs', () => {
    for (const level of ALL_LEVELS) {
      const { anchors } = deriveSpacing(level)
      expect(anchors.stackXl).toBe(2 * anchors.stackMd)
      expect(anchors.stackLg).toBe(2 * anchors.stackSm)
      // The DOCUMENTED law (`deriveSpacing`'s JSDoc): stackSm/stackMd/stackLg/stackXl are exactly
      // 2x/3x/4x/6x stackXs. A real equality against that documented multiple — not a `% === 0`
      // divisibility check, which the two ratio assertions above already guarantee for free (any
      // value that IS `stackXs * N` trivially divides `stackXs`) and so adds zero independent
      // coverage on top of them.
      expect(anchors.stackSm).toBe(2 * anchors.stackXs)
      expect(anchors.stackMd).toBe(3 * anchors.stackXs)
      expect(anchors.stackLg).toBe(4 * anchors.stackXs)
      expect(anchors.stackXl).toBe(6 * anchors.stackXs)
    }
  })
})

describe('Fix 3 — SegmentedControl concentricity holds at every RADIUS level', () => {
  test('RADIUS.card === RADIUS_STEP.tight + segmentedTrackInset, every RADIUS level (the full [-5, 5] range, not the narrower density range)', () => {
    for (const level of ALL_RADIUS_LEVELS) {
      const radius = deriveRadius(level)
      expect(radius.card).toBe(radius.tight + SPACE_FIXED.segmentedTrackInset)
    }
  })

  test('at the radius floor (-5), tight is clamped exactly to 0 while card is not — the closest the accepted range gets to breaking concentricity', () => {
    const radius = deriveRadius(RADIUS_LEVEL_RANGE.min)
    expect(radius.tight).toBe(0) // clampRadius(ctrl - 1) = clampRadius((6 - 5) - 1) = clampRadius(0)
    expect(radius.card).toBe(2) // clampRadius(7 - 5) = 2, still positive — the clamp doesn't engage
    // Concentricity holds here only because `ctrl - 1` landed EXACTLY on the clamp floor (0), not
    // below it: one level further down (out of the accepted range) would clamp `tight` to 0 while
    // `card` kept falling, breaking `card === tight + 2` — which is exactly why the range stops here.
    expect(radius.card).toBe(radius.tight + SPACE_FIXED.segmentedTrackInset)
  })

  test("segmentedTrackInset never moves with density — it's a SPACE_FIXED constant, not part of deriveSpacing's step output at ANY level", () => {
    // Claim 1 (the constant itself): the shipped value.
    expect(SPACE_FIXED.segmentedTrackInset).toBe(2)
    // Claim 2 (deriveSpacing has no such key any more): a bare `.toBe(2)` on the constant alone would
    // still pass even if `segmentedTrackInset` were ALSO reintroduced into `SPACE_STEP_BASE` at a
    // level-0 value of 2 — it would just happen to coincide there. Assert its actual absence from
    // `step` at every level instead, which a reintroduction WOULD break immediately.
    for (const level of ALL_LEVELS) {
      expect(deriveSpacing(level).step).not.toHaveProperty('segmentedTrackInset')
    }
  })
})

describe('Fix 4 — every interactive target clears the WCAG 2.5.8 24px floor at every level', () => {
  test('sidebar search trigger (and its collapsed rail ActionIcon, which reads the same value)', () => {
    for (const level of ALL_LEVELS) {
      expect(deriveSpacing(level).step.sidebarSearchTriggerHeight).toBeGreaterThanOrEqual(24)
    }
  })

  test('a NavLink/Menu row (2 * rowInsetY padding + rowLineHeight * the fixed md text step)', () => {
    for (const level of ALL_LEVELS) {
      const { anchors, rowLineHeight } = deriveSpacing(level)
      const rowHeight = 2 * anchors.rowInsetY + rowLineHeight * VX.text.md
      expect(rowHeight).toBeGreaterThanOrEqual(24)
    }
  })

  test('the mobile header actions row (appHeaderMobileActionsHeight — the closest in-scope, density-tracked mobile nav target size; the app-mobile-nav tab bar itself is a fixed AppShell footer height, out of scope for this pass)', () => {
    for (const level of ALL_LEVELS) {
      expect(deriveSpacing(level).step.appHeaderMobileActionsHeight).toBeGreaterThanOrEqual(24)
    }
  })

  test('the resolved control/input height (size="md" Button/ActionIcon/Input) clears the floor too', () => {
    for (const level of ALL_LEVELS) {
      const { anchors } = deriveSpacing(level)
      expect(anchors.controlHeight).toBeGreaterThanOrEqual(24)
      expect(anchors.inputHeight).toBeGreaterThanOrEqual(24)
    }
  })
})

describe('Fix 5 — scaleSpace floors a sub-1 base at 1 (the inverted-clamp regression)', () => {
  test('a base below 1 that would round to 0 floors at 1 instead', () => {
    // round(0.5 * 0.35) = round(0.175) = 0 without the unconditional floor — the exact regression
    // the old `value >= 1 ? ... : scaled` guard let through (see `scaleSpace`'s doc).
    expect(scaleSpace(0.5, -5, 0.35)).toBe(1)
  })

  test('a base below 1 at level 0 still returns verbatim (bypasses scaling entirely)', () => {
    expect(scaleSpace(0.5, 0, 1)).toBe(0.5)
  })
})

/**
 * Faithful reconstruction of the pre-Fix-7 law: IDENTICAL structural shape to the current
 * `deriveSpacing` (shared stack-unit rebuild, the WCAG floor, the sticky-clearance derivation) —
 * ONLY the multiplier coefficient (0.1 -> 0.06) and the accepted range ([-3,3] -> [-5,5]) revert,
 * exactly the regression the "Fix 7" resolution-floor block below exists to catch.
 */
function oldLawFlatten(level: number): Record<string, number> {
  const multiplier = 1 + 0.06 * level
  const anchors: Record<string, number> = {}
  for (const [k, v] of Object.entries(SPACE)) anchors[k] = scaleSpace(v, level, multiplier)
  const stackUnit = scaleSpace(4, level, multiplier)
  anchors['stackXs'] = stackUnit
  anchors['stackSm'] = stackUnit * 2
  anchors['stackMd'] = stackUnit * 3
  anchors['stackLg'] = stackUnit * 4
  anchors['stackXl'] = stackUnit * 6
  const scale: Record<string, number> = {}
  for (const [k, v] of Object.entries(SPACE_SCALE)) scale[k] = scaleSpace(v, level, multiplier)
  const step: Record<string, number> = {}
  for (const [k, v] of Object.entries(SPACE_STEP)) {
    if (k === 'stickyHeaderClearance' || k === 'stickyHeaderClearanceMobile') continue
    step[k] = scaleSpace(v, level, multiplier)
  }
  step['sidebarSearchTriggerHeight'] = Math.max(24, step['sidebarSearchTriggerHeight']!)
  step['stickyHeaderClearance'] = step['appShellHeaderHeight']! + anchors['stackMd']!
  step['stickyHeaderClearanceMobile'] = step['appShellHeaderMobileHeight']! + anchors['stackMd']!
  return { ...anchors, ...scale, ...step }
}

describe("Fix 7 — the knob's resolution is honest at every notch", () => {
  test('adjacent-notch resolution floor: more than 70% of the flattened spacing set changes at every step', () => {
    for (let i = 0; i < ALL_LEVELS.length - 1; i++) {
      const a = flattenSpacing(ALL_LEVELS[i]!)
      const b = flattenSpacing(ALL_LEVELS[i + 1]!)
      const keys = Object.keys(a)
      const changed = keys.filter((k) => a[k] !== b[k]).length
      // Observed minimum under the current 0.1/±3 law is ~0.759 (level -3 -> -2) — the 0.7 floor
      // leaves a small margin for legitimate retuning while still catching the regression the next
      // test proves it catches.
      expect(changed / keys.length).toBeGreaterThan(0.7)
    }
  })

  test('regression proof: the OLD 0.06/±5 law fails the SAME 0.7 floor — confirms the floor above actually bites', () => {
    // Run here, not merely claimed, so a future edit to the CURRENT law can't silently make this
    // proof stale without failing too — see `oldLawFlatten`'s own doc above.
    const oldLawLevels = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5]
    let minRatio = 1
    for (let i = 0; i < oldLawLevels.length - 1; i++) {
      const a = oldLawFlatten(oldLawLevels[i]!)
      const b = oldLawFlatten(oldLawLevels[i + 1]!)
      const keys = Object.keys(a)
      const changed = keys.filter((k) => a[k] !== b[k]).length
      minRatio = Math.min(minRatio, changed / keys.length)
    }
    // Observed: ~0.491 (level -4 -> -3 and level 3 -> 4), well under the 0.7 floor above — the old
    // law's dead zone this whole fix replaced.
    expect(minRatio).toBeLessThan(0.7)
  })

  test('frozen-vs-baseline ceiling: fewer than 25 of the ~108 values equal their level-0 value at any non-zero level', () => {
    // Measured under the 0.1/±3 law: worst case is 22 (at level ±1) — down from 43 under the old
    // 0.06/±5 law. The ceiling of 25 leaves margin while still catching a future step reduction
    // that reintroduces that dead zone.
    const baseline = flattenSpacing(0)
    const keys = Object.keys(baseline)
    for (const level of ALL_LEVELS) {
      if (level === 0) continue
      const values = flattenSpacing(level)
      const frozen = keys.filter((k) => values[k] === baseline[k]).length
      expect(frozen).toBeLessThan(25)
    }
  })

  test('monotonicity: every flattened value is non-decreasing across adjacent levels', () => {
    for (let i = 0; i < ALL_LEVELS.length - 1; i++) {
      const a = flattenSpacing(ALL_LEVELS[i]!)
      const b = flattenSpacing(ALL_LEVELS[i + 1]!)
      for (const key of Object.keys(a)) {
        expect(b[key]!).toBeGreaterThanOrEqual(a[key]!)
      }
    }
  })

  test('endpoint preservation: deriveSpacing(±3) reproduces the exact value set the old deriveSpacing(±5) produced', () => {
    expect(deriveSpacing(-3).anchors.inputHeight).toBe(29)
    expect(deriveSpacing(3).anchors.inputHeight).toBe(55)
    expect(deriveSpacing(-3).anchors.rowInsetX).toBe(7)
    expect(deriveSpacing(3).anchors.rowInsetX).toBe(13)
    // `stickyHeaderClearance`/`stickyHeaderClearanceMobile` are EXCLUDED here on purpose — since both
    // now DERIVE from their own AppShell header instead of scaling off an independent base (see
    // `deriveSpacing`'s doc, third bullet, Decision 3), neither reproduced the old ±5 envelope to
    // begin with; their own law is asserted by the dedicated describe block in `tokens/density.test.ts`
    // (specific low/zero/high values) AND by the "Fix 8" describe block below in this same file
    // (the generic `clearance = header + anchors.stackMd` relation, looped over every level).
    expect(deriveSpacing(-3).rowLineHeight).toBe(1.25)
    expect(deriveSpacing(3).rowLineHeight).toBe(1.45)
  })
})

describe('Fix 8 — the sticky-header clearance clears its OWN breakpoint header, exactly (Decision 3 — desktop/mobile split)', () => {
  test('desktop clearance = appShellHeaderHeight + stackMd, exactly, at every level', () => {
    for (const level of ALL_LEVELS) {
      const { step, anchors } = deriveSpacing(level)
      expect(step.stickyHeaderClearance).toBe(step.appShellHeaderHeight + anchors.stackMd)
    }
  })

  test('mobile clearance = appShellHeaderMobileHeight + stackMd, exactly, at every level', () => {
    for (const level of ALL_LEVELS) {
      const { step, anchors } = deriveSpacing(level)
      expect(step.stickyHeaderClearanceMobile).toBe(
        step.appShellHeaderMobileHeight + anchors.stackMd,
      )
    }
  })

  test('mobile clearance exceeds desktop clearance at every level — catches a swap of the two formulas', () => {
    // Both formulas add the SAME `anchors.stackMd` breathing room, so this reduces to
    // `mobileHeader > desktopHeader`, which holds at every level today — but a bug that swapped
    // which header feeds which key would flip this comparison immediately.
    for (const level of ALL_LEVELS) {
      const { step } = deriveSpacing(level)
      expect(step.stickyHeaderClearanceMobile).toBeGreaterThan(step.stickyHeaderClearance)
    }
  })

  // The "both breathing-room margins (clearance minus own header) are monotonically non-decreasing"
  // check used to live here as its own test — deleted, not merely renamed: the two tests above this
  // one already assert `clearance = header + anchors.stackMd` EXACTLY at every level, so
  // `clearance - header` is identically `anchors.stackMd` — its monotonicity adds no coverage beyond
  // what "Fix 7"'s global "every flattened value is non-decreasing across adjacent levels" test
  // already guarantees (`stackMd` is one of the flattened anchors that test loops over). A bug this
  // block could catch independently of both of those would have to leave `clearance - header`
  // non-monotonic while `clearance = header + stackMd` still holds exactly and `stackMd` itself still
  // stays monotonic — impossible by substitution.
})

describe('Fix 6 — BasaltShell AppShell dimensions track density', () => {
  test('desktop header always holds a size="md" control', () => {
    for (const level of ALL_LEVELS) {
      const { step, anchors } = deriveSpacing(level)
      expect(step.appShellHeaderHeight).toBeGreaterThanOrEqual(anchors.controlHeight)
    }
  })

  test('the collapsed rail content box (rail width minus its own row inset) stays positive', () => {
    for (const level of ALL_LEVELS) {
      const { step, anchors } = deriveSpacing(level)
      expect(step.appShellNavbarRailWidth - 2 * anchors.rowInsetX).toBeGreaterThan(0)
    }
  })

  test("mobile header row-1 budget never falls below Mantine's static default ActionIcon (22px)", () => {
    // The 22px floor is `--ai-size-sm` — verified directly against the INSTALLED Mantine source
    // (`@mantine/core/styles/ActionIcon.css`: `--ai-size-xs: 18px; --ai-size-sm: 22px; --ai-size-md:
    // 28px; ...`), not recalled from memory. The budget at every level in `[-3, 3]` under the current
    // law: 23 / 25 / 28 / 32 / 36 / 39 / 41 (level -3 through +3) — never below the floor, with the
    // smallest margin (1px) at level -3, not at -2 as sometimes assumed by eye.
    for (const level of ALL_LEVELS) {
      const { step, scale } = deriveSpacing(level)
      const budget = step.appShellHeaderMobileHeight - step.appHeaderMobileActionsHeight - scale.sm
      expect(budget).toBeGreaterThanOrEqual(22)
    }
  })

  test('the mobile header row-1 budget is monotonically non-decreasing across levels', () => {
    const budgets = ALL_LEVELS.map((level) => {
      const { step, scale } = deriveSpacing(level)
      return step.appShellHeaderMobileHeight - step.appHeaderMobileActionsHeight - scale.sm
    })
    for (let i = 1; i < budgets.length; i++) {
      expect(budgets[i]).toBeGreaterThanOrEqual(budgets[i - 1]!)
    }
  })

  test('the collapsed-rail content box is monotonically non-decreasing across levels', () => {
    const boxes = ALL_LEVELS.map((level) => {
      const { step, anchors } = deriveSpacing(level)
      return step.appShellNavbarRailWidth - 2 * anchors.rowInsetX
    })
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i]).toBeGreaterThanOrEqual(boxes[i - 1]!)
    }
  })

  test('the navbar label column never shrinks as density rises', () => {
    const columns = ALL_LEVELS.map((level) => {
      const { step, anchors } = deriveSpacing(level)
      return step.appShellNavbarWidth - (4 * anchors.rowInsetX + step.navIconGap)
    })
    for (let i = 1; i < columns.length; i++) {
      expect(columns[i]).toBeGreaterThanOrEqual(columns[i - 1]!)
    }
  })

  // The "header/rail 48-coincidence at level 0" check that used to live here is deleted, not
  // rewritten: it asserted `appShellHeaderHeight === appShellNavbarRailWidth` at level 0, which is
  // true BY CONSTRUCTION (both `SPACE_STEP_BASE` entries hold the literal same base, 48, and are
  // mapped through the same deterministic `scaleSpace` call) and stays true at every OTHER level for
  // the identical reason — no value-based assertion can distinguish "these two happen to share a
  // base" (a coincidence) from "one is derived from the other" (a law) without mutating the source,
  // which is out of scope for a value-level test. The actual claim (they are two INDEPENDENT
  // `SPACE_STEP_BASE` entries, not one derived from the other) is already documented at the source —
  // see `appShellHeaderHeight`'s own JSDoc in `tokens/palette.ts`.

  test('the footer stays a structural literal — no density-tracking entry for it, and the sm:0 landmine stays fenced', () => {
    for (const level of ALL_LEVELS) {
      expect(deriveSpacing(level).step).not.toHaveProperty('appShellFooterHeight')
    }
    // `scaleSpace(0, level, m)` floors at 1 for any non-zero level — this is why `shell/index.tsx`'s
    // `footer.sm` stays a literal 0, never routed through the density law (it would paint a 1px
    // desktop footer strip at every non-zero level).
    expect(scaleSpace(0, -5, 0.7)).toBe(1)
    expect(scaleSpace(0, 5, 1.3)).toBe(1)
  })
})

describe('Fix 9 — the Mantine spacing scale keeps its strict xs < sm < md < lg < xl ordering at every level', () => {
  test('every level: the five scale stops are strictly increasing, never tying or inverting', () => {
    // Every consumer `p=`/`m=`/`gap=` prop app-wide resolves through this scale, and its five stops
    // are independently rounded (unlike the anchor group's shared-unit stack rhythm) — a retune plus
    // rounding could tie or invert two adjacent stops with nothing else in this file catching it.
    for (const level of ALL_LEVELS) {
      const { scale } = deriveSpacing(level)
      expect(scale.xs).toBeLessThan(scale.sm)
      expect(scale.sm).toBeLessThan(scale.md)
      expect(scale.md).toBeLessThan(scale.lg)
      expect(scale.lg).toBeLessThan(scale.xl)
    }
  })
})
