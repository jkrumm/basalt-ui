import { expect, test } from 'bun:test'
import { buildPaletteCss } from './core'
import { denseCtlBlock } from './ctl-vars'

test('the palette CSS carries the dense block, fine pointers only, beside the coarse hit block', () => {
  for (const only of ['all', 'core'] as const) {
    const css = buildPaletteCss({ only })
    expect(css).toContain(denseCtlBlock())
    expect(css.indexOf('(pointer: coarse)')).toBeLessThan(css.indexOf('(pointer: fine)'))
  }
})
