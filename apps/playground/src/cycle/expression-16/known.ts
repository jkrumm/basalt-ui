/**
 * Quality-matrix waivers of expression cycle 16's trial builds (docs/v3/cycles/expression-16.md;
 * docs/v3/CYCLES.md step 2). `knownChips` lists the builds where the kit's hover chip still covers a
 * painted tick label: n80's x chip lands on the tick it reads ('US$0.015' over 'US$0.015') and on its
 * neighbours, at 1800 and 390, because its x ticks are the five prices. Owner: v3-expr-16-kit-fixes,
 * which removes the line with its fix; the full run fails it once the chip clears.
 */
export const knownChips: readonly string[] = ['/scenarios/expr-n80']
