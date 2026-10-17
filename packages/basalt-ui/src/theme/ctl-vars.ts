/**
 * The Mantine size vars that carry the `ctl` tier's HEIGHT — one list, read by `ctlSizeVars`
 * (`theme/index.ts`, which sets each to the `ctl` height) and by `scripts/gen-dense-css.ts` (which
 * restates each at the dense height for `[data-basalt-dense]` in `styles.css`). Mantine substitutes
 * these where they are declared (`:root`), so the dense tier cannot re-point the token alone.
 */
export const CTL_HEIGHT_VARS = [
  '--button-height-ctl',
  '--input-height-ctl',
  '--ai-size-ctl',
  '--badge-height-ctl',
] as const

/** The dense-tier rule (SPEC D6) as the formatter lays it out inside `styles.css`'s `@layer basalt`. */
export function denseCtlCss(): string {
  const height = 'calc(var(--vx-space-control-height-dense) * var(--mantine-scale))'
  const decls = CTL_HEIGHT_VARS.map((name) => `      ${name}: ${height};`).join('\n')
  return [
    '  /* The DENSE control tier (SPEC D6): a table toolbar / filter row re-points the `ctl` size vars at',
    '     `--vx-space-control-height-dense` (28) at fine pointers only. Generated from `CTL_HEIGHT_VARS`.',
    '     A coarse pointer keeps the `ctl` height and the 44px hit overlay below. */',
    '  @media (pointer: fine) {',
    '    [data-basalt-dense] {',
    '      --vx-space-control-height-ctl: var(--vx-space-control-height-dense);',
    decls,
    '    }',
    '  }',
  ].join('\n')
}
