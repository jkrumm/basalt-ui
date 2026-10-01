/** `sizeClassMaxEm` / `toEm` — the literal forms the CSS modules carry. */
import { describe, expect, test } from 'bun:test'
import {
  CONTAINER_CLASSES,
  CONTAINER_GRID_BREAKPOINTS,
  CONTAINER_KEYS,
  SIZE_CLASSES,
  sizeClassMaxEm,
  toEm,
} from './size-classes'

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

describe('CONTAINER_GRID_BREAKPOINTS', () => {
  test('maps all five Mantine sizes onto a CONTAINER_CLASSES boundary', () => {
    const { compact, regular, wide } = CONTAINER_CLASSES
    expect(CONTAINER_GRID_BREAKPOINTS).toEqual({
      xs: `${compact}px`,
      sm: `${regular}px`,
      md: `${wide}px`,
      lg: `${wide}px`,
      xl: `${wide}px`,
    })
  })
})

describe('CONTAINER_KEYS', () => {
  test('is every non-zero CONTAINER_CLASSES boundary as a px length', () => {
    const { compact, regular, wide } = CONTAINER_CLASSES
    expect(CONTAINER_KEYS).toEqual({
      compact: `${compact}px`,
      regular: `${regular}px`,
      wide: `${wide}px`,
    })
  })
})
