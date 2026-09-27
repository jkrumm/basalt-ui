/**
 * The pointer-tier hit floors, in px — WCAG 2.5.8 Target Size Minimum (24) and 2.5.5 Target Size
 * Enhanced (44). One home for the number `--vx-hit` resolves to under `(pointer: coarse)` and for
 * the components that compare a MEASURED px against it (a virtual list's row height, a column-fold
 * toggle's width, the chart legend's dot pitch). Deliberately not re-exported through
 * `common/index.ts`: a CSS-var's numeric value is not a public symbol.
 */
export const HIT_FINE = 24
export const HIT_COARSE = 44
