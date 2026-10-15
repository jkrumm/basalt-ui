/**
 * Pins `BASALT_VX_NAMES` to what basalt actually emits. The list is a checked-in literal because
 * the guard is dependency-free; this test is what stops it drifting from what `buildPaletteCss` emits.
 */
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import {
  collectVxNames,
  renderVxFamilies,
  renderVxNames,
  VX_FAMILIES_PATH,
  VX_NAMES_PATH,
} from '../../scripts/gen-vx-names'
import { BP, groupTokens, p, seriesTokens } from '../tokens/index'
import { checkSource, DEFAULT_GUARD_CONFIG, REMOVED_VX_NAMES } from './index'
import { BASALT_VX_FAMILIES } from '../common/vx-families'
import { BASALT_VX_NAMES } from './vx-names'

describe('BASALT_VX_NAMES', () => {
  it('matches the names basalt emits — regenerate with `bun scripts/gen-vx-names.ts`', () => {
    expect([...BASALT_VX_NAMES]).toEqual(collectVxNames())
  })

  it('is the generator output byte for byte (no hand edits)', () => {
    expect(readFileSync(VX_NAMES_PATH, 'utf8')).toBe(renderVxNames(collectVxNames()))
    expect(readFileSync(VX_FAMILIES_PATH, 'utf8')).toBe(renderVxFamilies(collectVxNames()))
  })

  it('carries --vx-hit and the component-scoped names', () => {
    for (const n of ['--vx-hit', '--vx-hit-gap', '--vx-space-icon-size', '--vx-keyboard-inset'])
      expect(BASALT_VX_NAMES).toContain(n)
  })

  it('never lists a removed name, and every named replacement is live', () => {
    expect(Object.keys(REMOVED_VX_NAMES).length).toBeGreaterThan(0)
    for (const [removed, replacement] of Object.entries(REMOVED_VX_NAMES)) {
      expect(BASALT_VX_NAMES).not.toContain(removed)
      if (replacement !== null) expect(BASALT_VX_NAMES).toContain(replacement)
      const f = checkSource(`.a { width: var(${removed}); }`, 'src/a.css', DEFAULT_GUARD_CONFIG)
      expect(f.map((x) => x.kind)).toEqual(['unknown-vx-token'])
    }
  })

  // The 1.4.0 camelCase aliases were deleted from 2.x: 32 of the removed names, derived from the
  // one REMOVED_VX_NAMES map. Each is judged in ANY family — `--vx-onAccent` sits in `on`, which
  // consumers extend — and its replacement is a kebab name basalt emits.
  const REMOVED_ALIASES = Object.entries(REMOVED_VX_NAMES).filter(([name]) =>
    /[a-z][A-Z]/.test(name),
  )

  it('has all 32 removed camelCase aliases, each mapped to a live kebab name', () => {
    expect(REMOVED_ALIASES).toHaveLength(32)
    for (const [, kebab] of REMOVED_ALIASES) expect(BASALT_VX_NAMES).toContain(kebab as string)
  })

  it.each(REMOVED_ALIASES.map(([alias]) => alias))('flags %s as unknown-vx-token', (alias) => {
    const f = checkSource(`.a { width: var(${alias}); }`, 'src/a.css', DEFAULT_GUARD_CONFIG)
    expect(f.map((x) => ({ kind: x.kind, token: x.token }))).toEqual([
      { kind: 'unknown-vx-token', token: alias },
    ])
  })

  it('judges a removed name in a consumer-extensible family but not an unrelated one', () => {
    expect(kinds('--vx-onAccent')).toEqual(['unknown-vx-token'])
    expect(kinds('--vx-on-foo')).toEqual([])
  })

  it('skips a removed name the same file declares itself', () => {
    const src = ':root { --vx-onAccent: #fff; }\n.a { color: var(--vx-onAccent); }'
    expect(checkSource(src, 'src/a.css', DEFAULT_GUARD_CONFIG).map((f) => f.kind)).not.toContain(
      'unknown-vx-token',
    )
  })
})

// The guard judges every name inside a basalt family; that is sound only while the ref factories
// refuse to point there. Both directions, through the real factories.
function kinds(name: string): string[] {
  return checkSource(`.a { color: var(${name}); }`, 'src/a.css', DEFAULT_GUARD_CONFIG).map(
    (f) => f.kind,
  )
}

describe('basalt-owned families', () => {
  it.each(BASALT_VX_FAMILIES.map((f) => [f]))('the factories refuse a %s group', (family) => {
    expect(() => groupTokens(family, { x: p(BP.gray) })).toThrow(`--vx-${family}-x`)
    expect(() => seriesTokens({ [`${family}2`]: p(BP.gray) })).toThrow(`--vx-${family}2`)
  })

  // basalt-lead pre-release: deriving the families from buildPaletteCss() alone missed every
  // component-scoped one, so `var(--vx-keyboard)` passed silently.
  it('covers the component-scoped families, not just the stylesheet', () => {
    expect(BASALT_VX_FAMILIES).toContain('keyboard')
    expect(kinds('--vx-keyboard')).toEqual(['unknown-vx-token'])
    expect(kinds('--vx-keyboard-x')).toEqual(['unknown-vx-token'])
    expect(kinds('--vx-keyboard-inset')).toEqual([])
  })

  it('leaves `on` to the consumer — the theme emits --vx-on-<color> for every color', () => {
    expect(BASALT_VX_FAMILIES).not.toContain('on')
    expect(kinds('--vx-on-brand')).toEqual([])
  })

  it('a name the factories accept is never judged', () => {
    for (const group of ['activity', 'confidence', 'lineup', 'app']) {
      const refs = groupTokens(group, { key: p(BP.gray) })
      expect(kinds(refs.key.slice(4, -1))).toEqual([])
    }
    expect(Object.values(seriesTokens({ hrv: p(BP.blue), cloudHigh: p(BP.gray) })).length).toBe(2)
    expect(kinds('--vx-cloudHigh')).toEqual([])
  })
})
