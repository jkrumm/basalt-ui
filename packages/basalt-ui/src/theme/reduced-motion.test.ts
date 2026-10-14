/** V2-SPEC § 5: Mantine's own transitions follow the OS setting, and a consumer can opt out. */
import { describe, expect, test } from 'bun:test'
import { createBasaltTheme } from './index'

describe('respectReducedMotion', () => {
  test('the base theme turns it on', () => {
    expect(createBasaltTheme().respectReducedMotion).toBe(true)
  })

  test('a consumer override of false wins', () => {
    expect(createBasaltTheme({ respectReducedMotion: false }).respectReducedMotion).toBe(false)
  })

  test('a derive option does not reset it', () => {
    expect(createBasaltTheme(undefined, { radius: 1 }).respectReducedMotion).toBe(true)
  })
})
