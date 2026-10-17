/**
 * The Mantine size vars that carry the `ctl` tier's HEIGHT — one list, read by `ctlSizeVars`
 * (`theme/index.ts`, which sets each to the `ctl` height) and by {@link denseCtlBlock} (which
 * restates each at the dense height for `[data-basalt-dense]`). Mantine substitutes these where they
 * are declared (`:root`), so the dense tier cannot re-point the token alone.
 */
export const CTL_HEIGHT_VARS = [
  '--button-height-ctl',
  '--input-height-ctl',
  '--ai-size-ctl',
  '--badge-height-ctl',
] as const

export type CtlHeightVar = (typeof CTL_HEIGHT_VARS)[number]

/**
 * The dense-tier rule (SPEC D6), emitted beside `coarseHitBlock` in the palette CSS. A scope that
 * carries `data-basalt-dense` re-points the `ctl` height at `--vx-space-control-height-dense` at
 * FINE pointers only; a coarse pointer keeps the `ctl` height and the 44px hit overlay.
 */
export function denseCtlBlock(): string {
  const height = 'calc(var(--vx-space-control-height-dense) * var(--mantine-scale))'
  const decls = CTL_HEIGHT_VARS.map((name) => `    ${name}: ${height};`).join('\n')
  return [
    '@media (pointer: fine) {',
    '  [data-basalt-dense] {',
    '    --vx-space-control-height-ctl: var(--vx-space-control-height-dense);',
    decls,
    '  }',
    '}',
  ].join('\n')
}
