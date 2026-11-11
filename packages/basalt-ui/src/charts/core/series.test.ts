import { describe, expect, it } from 'bun:test'
import { defineSeries } from './series'

describe('defineSeries', () => {
  it('returns the map it was given, keys intact', () => {
    const map = {
      requests: { light: '#0b6bcb', dark: '#5aa9f0' },
      errors: { light: '#b3261e', dark: '#f2a29b' },
    }
    const series = defineSeries(map)
    expect(series).toBe(map)
    expect(Object.keys(series)).toEqual(['requests', 'errors'])
  })

  it('keeps the literal keys of the input in the type', () => {
    const series = defineSeries({ a: { light: '#000', dark: '#fff' } })
    const key: keyof typeof series = 'a'
    // @ts-expect-error a key the map never named
    const missing: keyof typeof series = 'b'
    expect([key, missing].length).toBe(2)
  })
})
