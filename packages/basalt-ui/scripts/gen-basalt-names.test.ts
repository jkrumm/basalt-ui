/**
 * Pins `BASALT_NAMES` to what basalt actually emits. The list is a checked-in literal because a
 * release tag carries it (`release-migrating` diffs it against the previous tag); this test is what
 * stops it drifting from what the token layer and the shipped sources emit.
 */
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'

import { BASALT_FAMILIES } from '../src/common/basalt-families'
import { BP, groupTokens, p, seriesTokens } from '../src/tokens/index'
import { TOKENS } from '../src/tokens/table'
import { BASALT_NAMES } from '../src/tokens/basalt-names'
import { REMOVED_BASALT_NAMES } from '../tests/removed-basalt-names'
import {
  collectBasaltNames,
  GENERATED_OUTPUTS,
  renderBasaltFamilies,
  renderBasaltNames,
  BASALT_FAMILIES_PATH,
  BASALT_NAMES_PATH,
} from './gen-basalt-names'

describe('BASALT_NAMES', () => {
  it('matches the names basalt emits — regenerate with `bun scripts/gen-basalt-names.ts`', () => {
    expect([...BASALT_NAMES]).toEqual(collectBasaltNames())
  })

  it('is the generator output byte for byte (no hand edits)', () => {
    expect(readFileSync(BASALT_NAMES_PATH, 'utf8')).toBe(renderBasaltNames(collectBasaltNames()))
    expect(readFileSync(BASALT_FAMILIES_PATH, 'utf8')).toBe(
      renderBasaltFamilies(collectBasaltNames()),
    )
  })

  it('never scans its own output, or a name basalt stopped emitting would stay in the list', () => {
    expect([...GENERATED_OUTPUTS]).toContain(
      relative(resolve(import.meta.dirname, '..'), BASALT_NAMES_PATH),
    )
  })

  it('carries every name the v3 token table emits', () => {
    for (const { name } of TOKENS) expect(BASALT_NAMES).toContain(`--basalt-${name}`)
  })

  it('carries --basalt-hit and the component-scoped names', () => {
    for (const n of ['--basalt-hit', '--basalt-hit-gap']) expect(BASALT_NAMES).toContain(n)
  })

  it('never lists a removed name, and every named replacement is live', () => {
    expect(Object.keys(REMOVED_BASALT_NAMES).length).toBeGreaterThan(0)
    for (const [removed, replacement] of Object.entries(REMOVED_BASALT_NAMES)) {
      expect(BASALT_NAMES).not.toContain(removed)
      if (replacement !== null) expect(BASALT_NAMES).toContain(replacement)
    }
  })

  it('has all 32 removed camelCase aliases', () => {
    const aliases = Object.keys(REMOVED_BASALT_NAMES).filter((name) => /[a-z][A-Z]/.test(name))
    expect(aliases).toHaveLength(32)
  })
})

describe('basalt-owned families', () => {
  it.each(BASALT_FAMILIES.map((f) => [f]))('the factories refuse a %s group', (family) => {
    expect(() => groupTokens(family, { x: p(BP.gray) })).toThrow(`--basalt-${family}-x`)
    expect(() => seriesTokens({ [`${family}2`]: p(BP.gray) })).toThrow(`--basalt-${family}2`)
  })

  // Deriving the families from buildPaletteCss() alone missed every component-scoped one.
  it('covers the component-scoped families, not just the stylesheet', () => {
    expect(BASALT_FAMILIES).toContain('hit')
  })

  it('leaves `on` to the consumer — the theme emits --basalt-on-<color> for every color', () => {
    expect(BASALT_FAMILIES).not.toContain('on')
  })

  it('accepts a consumer group outside every basalt family', () => {
    for (const group of ['activity', 'confidence', 'lineup', 'app']) {
      const refs = groupTokens(group, { key: p(BP.gray) })
      expect(refs.key).toBe(`var(--basalt-${group}-key)`)
    }
    expect(Object.values(seriesTokens({ hrv: p(BP.blue), cloudHigh: p(BP.gray) })).length).toBe(2)
  })
})
