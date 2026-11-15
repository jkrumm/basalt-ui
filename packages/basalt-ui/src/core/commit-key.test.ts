import { describe, expect, test } from 'bun:test'
import { commitsDraft, confirmsComposition } from './commit-key'

const keydown = (key: string, keyCode: number, isComposing: boolean) => ({
  key,
  keyCode,
  nativeEvent: { isComposing },
})

describe('commitsDraft', () => {
  test('only a plain Enter commits: not a composition, not keyCode 229, not another key', () => {
    expect(commitsDraft(keydown('Enter', 13, false))).toBe(true)
    expect(commitsDraft(keydown('Enter', 13, true))).toBe(false)
    expect(commitsDraft(keydown('Enter', 229, false))).toBe(false)
    expect(commitsDraft(keydown('a', 65, false))).toBe(false)
  })

  test('a composition is isComposing or the legacy keyCode 229', () => {
    expect(confirmsComposition(keydown('Enter', 13, false))).toBe(false)
    expect(confirmsComposition(keydown('Process', 229, false))).toBe(true)
    expect(confirmsComposition(keydown('Enter', 13, true))).toBe(true)
  })
})
