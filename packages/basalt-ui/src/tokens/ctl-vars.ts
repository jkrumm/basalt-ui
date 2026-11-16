/**
 * The dense-tier rule (SPEC D6), emitted beside `coarseHitBlock` in the palette CSS. A scope that
 * carries `data-basalt-dense` re-points the `ctl` height at `--basalt-space-control-height-dense` at
 * FINE pointers only; a coarse pointer keeps the `ctl` height and the 44px hit overlay.
 */
export function denseCtlBlock(): string {
  return [
    '@media (pointer: fine) {',
    '  [data-basalt-dense] {',
    '    --basalt-space-control-height-ctl: var(--basalt-space-control-height-dense);',
    '  }',
    '}',
  ].join('\n')
}
