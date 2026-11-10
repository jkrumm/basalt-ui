/**
 * The shell slot table's own test: pure data, no Chrome, no `./harness`. It pins the slots the
 * concept names (docs/v3/concepts/shell-nav-router.md § 3.5) so removing one from `SHELL_SLOTS`
 * fails here instead of silently shrinking what the v3 shell must provide.
 */
import { describe, expect, test } from 'bun:test'
import { SHELL_SLOTS } from './shell-slots'

const CONCEPT_SLOTS = [
  'shell-skip',
  'shell-header',
  'shell-titlebar',
  'shell-lead',
  'shell-trail',
  'shell-breadcrumb',
  'shell-rail',
  'shell-rail-footer',
  'shell-rail-block',
  'shell-main',
  'page',
  'page-bar',
  'shell-aside',
  'shell-tab-bar',
] as const

describe('SHELL_SLOTS', () => {
  for (const name of CONCEPT_SLOTS) {
    test(`the concept slot ${name} is a key`, () => {
      expect(Object.keys(SHELL_SLOTS)).toContain(name)
    })
  }

  test('every v3 selector is exactly its own data-slot', () => {
    for (const [name, entry] of Object.entries(SHELL_SLOTS)) {
      expect(entry.v3, name).toBe(`[data-slot="${name}"]`)
    }
  })

  test('every v2 selector is a non-empty string or null', () => {
    for (const [name, entry] of Object.entries(SHELL_SLOTS)) {
      if (entry.v2 === null) continue
      expect(typeof entry.v2, name).toBe('string')
      expect(entry.v2.length, name).toBeGreaterThan(0)
    }
  })
})
