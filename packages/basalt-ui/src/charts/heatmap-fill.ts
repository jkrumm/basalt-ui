/**
 * The `Heatmap` fills as numbers: the ramp's floor and the flat absent fill are tuned TOGETHER,
 * because a near-baseline measured hour must never read as an unmeasured one. `heatmap-fill.test.ts`
 * holds the pair to a ΔE*ab floor against every ramp step in both schemes — retune here, not at a
 * call site.
 */

/** Intensity steps: quantized, so the gradient legend and the cells are the same ramp. */
export const RAMP_LEVELS = 8
/** Opacity of the lowest ramp step. */
export const RAMP_FLOOR = 0.28
/** Opacity of the flat neutral fill of an absent cell. */
export const ABSENT_OPACITY = 0.08

/** The ramp's opacities, lowest to full ink. */
export const rampOpacities = (): number[] =>
  Array.from(
    { length: RAMP_LEVELS },
    (_, i) => RAMP_FLOOR + ((1 - RAMP_FLOOR) * i) / (RAMP_LEVELS - 1),
  )
