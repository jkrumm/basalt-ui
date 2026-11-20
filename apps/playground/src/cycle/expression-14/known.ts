/**
 * Quality-matrix waivers of expression cycle 14's trial builds (docs/v3/cycles/expression-14.md;
 * docs/v3/CYCLES.md step 2). `knownChips` lists the builds where the kit's hover chip still covers a
 * painted tick label: n67's x chip lands on its neighbouring date ticks ('18 Aug' over '17 Aug' at 1800,
 * '26 Sep' over '1 Oct' at 390). Owner: v3-expr-14-kit-fixes, which removes the line with its fix; the
 * full run fails it once the chip clears.
 */
export const knownChips: readonly string[] = ['/scenarios/expr-n67']
