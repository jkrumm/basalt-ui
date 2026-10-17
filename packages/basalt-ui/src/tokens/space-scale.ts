/**
 * The Mantine `spacing` size-scale at level 0, in its own dependency-free module so the headless
 * guard core (`guard/index.ts`, which runs on every Write/Edit) can read the SAME constant the token
 * layer derives from without dragging `derive.ts`/`hct.ts`'s colour math in. `tokens/palette.ts`
 * documents the scale's role (`SPACE_SCALE_BASE`); this file only owns the numbers.
 */
export const SPACE_SCALE_LEVEL0 = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
} as const
