/**
 * Pins `BASALT_VX_NAMES` to what basalt actually emits. The list is a checked-in literal because
 * the guard is dependency-free; this test is what stops it drifting from `dist/tokens.css`.
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
import { checkSource, DEFAULT_GUARD_CONFIG, guardKindRemedy } from './index'
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
    const pairs = [
      ...guardKindRemedy('unknown-vx-token').matchAll(/(--vx-[\w-]+) → (--vx-[\w-]+)?/g),
    ]
    expect(pairs.length).toBeGreaterThan(0)
    for (const [, removed, replacement] of pairs) {
      expect(BASALT_VX_NAMES).not.toContain(removed)
      if (replacement !== undefined) expect(BASALT_VX_NAMES).toContain(replacement)
      const f = checkSource(`.a { width: var(${removed}); }`, 'src/a.css', DEFAULT_GUARD_CONFIG)
      expect(f.map((x) => x.kind)).toEqual(['unknown-vx-token'])
    }
  })

  // The 1.4.0 camelCase aliases were deleted from 2.x. Each must still be a finding, and the
  // remedy must name its kebab canonical so the fix is a rename, not a search.
  const REMOVED_ALIASES = {
    '--vx-goodSolid': '--vx-good-solid',
    '--vx-badSolid': '--vx-bad-solid',
    '--vx-warnSolid': '--vx-warn-solid',
    '--vx-axisStroke': '--vx-axis-stroke',
    '--vx-dotStroke': '--vx-dot-stroke',
    '--vx-tooltipBg': '--vx-tooltip-bg',
    '--vx-tooltipText': '--vx-tooltip-text',
    '--vx-tooltipMuted': '--vx-tooltip-muted',
    '--vx-tooltipBorder': '--vx-tooltip-border',
    '--vx-tooltipShadow': '--vx-tooltip-shadow',
    '--vx-legendText': '--vx-legend-text',
    '--vx-accentHover': '--vx-accent-hover',
    '--vx-accentFill': '--vx-accent-fill',
    '--vx-accentFillHover': '--vx-accent-fill-hover',
    '--vx-onAccent': '--vx-on-accent',
    '--vx-surface-panelHover': '--vx-surface-panel-hover',
    '--vx-goodSoft': '--vx-good-soft',
    '--vx-goodRef': '--vx-good-ref',
    '--vx-badRef': '--vx-bad-ref',
    '--vx-warnRef': '--vx-warn-ref',
    ...Object.fromEntries(
      [
        'gray',
        'red',
        'pink',
        'grape',
        'violet',
        'indigo',
        'cyan',
        'teal',
        'green',
        'lime',
        'yellow',
        'orange',
      ].map((c) => [`--vx-fillHover-${c}`, `--vx-fill-hover-${c}`]),
    ),
  } as const

  it('has all 32 removed camelCase aliases, each mapped to a live kebab name', () => {
    expect(Object.keys(REMOVED_ALIASES)).toHaveLength(32)
    for (const [alias, kebab] of Object.entries(REMOVED_ALIASES)) {
      expect(BASALT_VX_NAMES).not.toContain(alias)
      expect(BASALT_VX_NAMES).toContain(kebab)
    }
  })

  it.each(Object.entries(REMOVED_ALIASES))(
    'flags %s as unknown-vx-token and names %s as the replacement',
    (alias, kebab) => {
      const f = checkSource(`.a { width: var(${alias}); }`, 'src/a.css', DEFAULT_GUARD_CONFIG)
      expect(f.map((x) => x.kind)).toEqual(['unknown-vx-token'])
      expect(f[0]?.token).toBe(alias)
      expect(guardKindRemedy('unknown-vx-token')).toContain(`${alias} → ${kebab}`)
    },
  )
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
