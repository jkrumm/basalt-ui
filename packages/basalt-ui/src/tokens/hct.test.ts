import { describe, expect, test } from 'bun:test'
import { contrastRatio } from './hct'

describe('contrastRatio', () => {
  test('black on white is 21, in either order', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5)
  })

  test('#777777 on white is ~4.48', () => {
    // luminance of #777 = ((0x77/255 + 0.055)/1.055)^2.4 ≈ 0.1845 → 1.05 / 0.2345
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2)
  })
})
