import { describe, expect, it } from 'bun:test'

import { deltaEOk, hexToOklab, hexToOklch, simulateCvd } from './oklab'

const near = (actual: number, expected: number, eps = 1e-4) =>
  expect(Math.abs(actual - expected)).toBeLessThan(eps)

// Reference values: Ottosson, "A perceptual color space for image processing" (the sRGB primaries'
// OKLab coordinates published beside the definition).
describe('hexToOklab', () => {
  it.each([
    ['#ffffff', 1, 0, 0],
    ['#000000', 0, 0, 0],
    ['#ff0000', 0.62796, 0.22486, 0.12585],
    ['#00ff00', 0.86644, -0.23389, 0.17943],
    ['#0000ff', 0.45201, -0.03246, -0.31153],
  ])('%s', (hex, L, a, b) => {
    const lab = hexToOklab(hex)
    near(lab.L, L, 1e-3)
    near(lab.a, a, 1e-3)
    near(lab.b, b, 1e-3)
  })

  it('accepts #rgb shorthand', () => {
    expect(hexToOklab('#f00')).toEqual(hexToOklab('#ff0000'))
  })
})

describe('hexToOklch', () => {
  it('white has no chroma; red sits near hue 29°', () => {
    near(hexToOklch('#ffffff').C, 0, 1e-3)
    const red = hexToOklch('#ff0000')
    near(red.C, 0.25768, 1e-3)
    near(red.h, 29.23, 0.1)
  })
})

describe('deltaEOk', () => {
  it('is Euclidean OKLab scaled by 100', () => {
    near(deltaEOk('#000000', '#ffffff'), 100, 1e-6)
    expect(deltaEOk('#336699', '#336699')).toBe(0)
  })
})

// Machado, Oliveira & Fernandes (2009), severity 1.0, applied in linear RGB.
describe('simulateCvd', () => {
  it('leaves neutrals alone (every matrix row sums to 1)', () => {
    for (const kind of ['protan', 'deutan'] as const) {
      near(deltaEOk(simulateCvd('#808080', kind), '#808080'), 0, 0.01)
    }
  })

  it('maps pure red under protanopia to the matrix first column', () => {
    // linear (0.152286, 0.114503, -0.003882→0) → sRGB ≈ (109, 95, 0)
    const sim = simulateCvd('#ff0000', 'protan')
    const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(sim.slice(i, i + 2), 16))
    expect([r, g, b]).toEqual([109, 95, 0])
  })

  it('collapses red and green under deuteranopia far below their normal-vision distance', () => {
    const normal = deltaEOk('#cc3333', '#33aa33')
    const sim = deltaEOk(simulateCvd('#cc3333', 'deutan'), simulateCvd('#33aa33', 'deutan'))
    expect(sim).toBeLessThan(normal / 2)
  })
})
