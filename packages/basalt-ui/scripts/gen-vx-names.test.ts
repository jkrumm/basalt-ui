/**
 * Pins `BASALT_VX_NAMES` to what basalt actually emits. The list is a checked-in literal because a
 * release tag carries it (`release-migrating` diffs it against the previous tag); this test is what
 * stops it drifting from what the token layer and the shipped sources emit.
 */
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'

import { BASALT_VX_FAMILIES } from '../src/common/vx-families'
import { BP, groupTokens, p, seriesTokens } from '../src/tokens/index'
import { TOKENS } from '../src/tokens/table'
import { BASALT_VX_NAMES } from '../src/tokens/vx-names'
import { REMOVED_VX_NAMES } from '../tests/removed-vx-names'
import {
  collectVxNames,
  GENERATED_OUTPUTS,
  renderVxFamilies,
  renderVxNames,
  VX_FAMILIES_PATH,
  VX_NAMES_PATH,
} from './gen-vx-names'

describe('BASALT_VX_NAMES', () => {
  it('matches the names basalt emits — regenerate with `bun scripts/gen-vx-names.ts`', () => {
    expect([...BASALT_VX_NAMES]).toEqual(collectVxNames())
  })

  it('is the generator output byte for byte (no hand edits)', () => {
    expect(readFileSync(VX_NAMES_PATH, 'utf8')).toBe(renderVxNames(collectVxNames()))
    expect(readFileSync(VX_FAMILIES_PATH, 'utf8')).toBe(renderVxFamilies(collectVxNames()))
  })

  it('never scans its own output, or a name basalt stopped emitting would stay in the list', () => {
    expect([...GENERATED_OUTPUTS]).toContain(
      relative(resolve(import.meta.dirname, '..'), VX_NAMES_PATH),
    )
  })

  it('carries every name the v3 token table emits', () => {
    for (const { name } of TOKENS) expect(BASALT_VX_NAMES).toContain(`--vx-${name}`)
  })

  it('carries --vx-hit and the component-scoped names', () => {
    for (const n of ['--vx-hit', '--vx-hit-gap']) expect(BASALT_VX_NAMES).toContain(n)
  })

  it('never lists a removed name, and every named replacement is live', () => {
    expect(Object.keys(REMOVED_VX_NAMES).length).toBeGreaterThan(0)
    for (const [removed, replacement] of Object.entries(REMOVED_VX_NAMES)) {
      expect(BASALT_VX_NAMES).not.toContain(removed)
      if (replacement !== null) expect(BASALT_VX_NAMES).toContain(replacement)
    }
  })

  it('has all 32 removed camelCase aliases', () => {
    const aliases = Object.keys(REMOVED_VX_NAMES).filter((name) => /[a-z][A-Z]/.test(name))
    expect(aliases).toHaveLength(32)
  })
})

describe('basalt-owned families', () => {
  it.each(BASALT_VX_FAMILIES.map((f) => [f]))('the factories refuse a %s group', (family) => {
    expect(() => groupTokens(family, { x: p(BP.gray) })).toThrow(`--vx-${family}-x`)
    expect(() => seriesTokens({ [`${family}2`]: p(BP.gray) })).toThrow(`--vx-${family}2`)
  })

  // Deriving the families from buildPaletteCss() alone missed every component-scoped one.
  it('covers the component-scoped families, not just the stylesheet', () => {
    expect(BASALT_VX_FAMILIES).toContain('hit')
  })

  it('leaves `on` to the consumer — the theme emits --vx-on-<color> for every color', () => {
    expect(BASALT_VX_FAMILIES).not.toContain('on')
  })

  it('accepts a consumer group outside every basalt family', () => {
    for (const group of ['activity', 'confidence', 'lineup', 'app']) {
      const refs = groupTokens(group, { key: p(BP.gray) })
      expect(refs.key).toBe(`var(--vx-${group}-key)`)
    }
    expect(Object.values(seriesTokens({ hrv: p(BP.blue), cloudHigh: p(BP.gray) })).length).toBe(2)
  })
})
