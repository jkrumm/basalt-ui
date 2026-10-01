/**
 * `check-grace.ts` — the release-time ledger gate, fed synthetic ledgers. The case that motivated
 * the deprecation half is pinned verbatim: 1.33.0 shipped `useBreakpoint` with `removeIn: '1.33.0'`
 * because this gate only read the grace ledger.
 */
import { describe, expect, it } from 'bun:test'
import { findReleaseBlockers } from './check-grace'

const USE_BREAKPOINT = { subpath: 'basalt-ui', name: 'useBreakpoint', removeIn: '1.33.0' }
const SHIPPED = { '.': ['BasaltShell', 'useBreakpoint'] }
const GONE = { '.': ['BasaltShell'] }

function blockers(input: Partial<Parameters<typeof findReleaseBlockers>[0]>): string[] {
  return findReleaseBlockers({
    version: '1.33.0',
    grace: {},
    deprecations: [],
    surface: {},
    ...input,
  })
}

describe('findReleaseBlockers — deprecations', () => {
  it('refuses 1.33.0 while useBreakpoint (removeIn 1.33.0) still ships — the miss it closes', () => {
    const found = blockers({ deprecations: [USE_BREAKPOINT], surface: SHIPPED })
    expect(found).toHaveLength(1)
    expect(found[0]).toContain('useBreakpoint (basalt-ui)')
  })

  it('refuses a version past removeIn, and compares numerically (1.10.0 > 1.9.0)', () => {
    const row = { ...USE_BREAKPOINT, removeIn: '1.9.0' }
    expect(blockers({ version: '1.10.0', deprecations: [row], surface: SHIPPED })).toHaveLength(1)
  })

  it('clears a version before removeIn', () => {
    expect(
      blockers({ version: '1.32.1', deprecations: [USE_BREAKPOINT], surface: SHIPPED }),
    ).toEqual([])
  })

  it('clears a row whose export is gone from the surface', () => {
    const row = { ...USE_BREAKPOINT, removed: true as const }
    expect(blockers({ version: '1.34.0', deprecations: [row], surface: GONE })).toEqual([])
  })

  it('refuses a row flagged removed whose export still ships', () => {
    const row = { ...USE_BREAKPOINT, removed: true as const }
    expect(blockers({ deprecations: [row], surface: SHIPPED })).toHaveLength(1)
  })

  it('reads a sub-path row against its own subpath key', () => {
    const row = { subpath: 'basalt-ui/tokens', name: 'OLD', removeIn: '1.33.0' }
    expect(blockers({ deprecations: [row], surface: { './tokens': ['OLD'] } })).toHaveLength(1)
    expect(blockers({ deprecations: [row], surface: { '.': ['OLD'] } })).toEqual([])
  })

  it('counts a prop row as shipped until it says removed', () => {
    const row = { subpath: 'basalt-ui', name: 'BasaltShell', prop: 'old', removeIn: '1.33.0' }
    expect(blockers({ deprecations: [row], surface: SHIPPED })).toHaveLength(1)
    expect(
      blockers({ deprecations: [{ ...row, removed: true as const }], surface: SHIPPED }),
    ).toEqual([])
  })
})

describe('findReleaseBlockers — grace', () => {
  const entry = { since: '1.32.0', promote: '1.33.0', why: 'x' }

  it('refuses a version at or past promote', () => {
    expect(blockers({ grace: { 'basalt/x': entry } })).toHaveLength(1)
    expect(blockers({ version: '1.34.0', grace: { 'basalt/x': entry } })).toHaveLength(1)
  })

  it('clears a version before promote', () => {
    expect(blockers({ version: '1.32.1', grace: { 'basalt/x': entry } })).toEqual([])
  })
})
