/**
 * Pins `BASALT_VX_NAMES` to what basalt actually emits. The list is a checked-in literal because
 * the guard is dependency-free; this test is what stops it drifting from `dist/tokens.css`.
 */
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { collectVxNames, renderVxNames, VX_NAMES_PATH } from '../../scripts/gen-vx-names'
import { checkSource, DEFAULT_GUARD_CONFIG, guardKindRemedy } from './index'
import { BASALT_VX_NAMES } from './vx-names'

describe('BASALT_VX_NAMES', () => {
  it('matches the names basalt emits — regenerate with `bun scripts/gen-vx-names.ts`', () => {
    expect([...BASALT_VX_NAMES]).toEqual(collectVxNames())
  })

  it('is the generator output byte for byte (no hand edits)', () => {
    expect(readFileSync(VX_NAMES_PATH, 'utf8')).toBe(renderVxNames(collectVxNames()))
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
})
