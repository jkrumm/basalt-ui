/** `sizeClassMaxEm` / `toEm` — the literal forms the CSS modules carry. */
import { describe, expect, test } from 'bun:test'
import { SIZE_CLASSES, sizeClassMaxEm, toEm } from './size-classes'

describe('size-class em literals', () => {
  test('toEm converts px at a 16px root', () => {
    expect(toEm(SIZE_CLASSES.medium)).toBe('52.5em')
    expect(toEm(SIZE_CLASSES.expanded)).toBe('75em')
  })

  test('sizeClassMaxEm is 0.1px under the boundary', () => {
    expect(sizeClassMaxEm(SIZE_CLASSES.medium)).toBe('52.49375em')
    expect(sizeClassMaxEm(SIZE_CLASSES.expanded)).toBe('74.99375em')
  })
})
