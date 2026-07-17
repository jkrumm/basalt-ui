/**
 * Surfaces coverage.
 *
 * Asserts:
 *  1. Every doctrine spec's guardKinds ⊆ keyof GUARD_RULES.
 *  2. Every doctrine rule (deduped via RULE_NAMES) maps to an on-disk agent/rules/basalt-{rule}.md.
 *  3. Every doctrine skill (deduped via SKILL_NAMES) maps to an on-disk
 *     agent/skills/{skill}/SKILL.md (skills ship in the npm package, placed by init/sync).
 *  4. Every non-#, non-'.' JS-subpath SURFACES key has a package.json exports entry.
 *  6. Every surface with non-empty forbiddenImports has a globs field.
 *  7. Every headless surface carries all 3 Mantine bans (Mantine-free boundary).
 *  8. Every doctrine optionalPeers entry exists in peerDependencies AND peerDependenciesMeta.
 *
 * Uses checkCoverage() as the primary gate (exit-code assertion), then redundant structural
 * assertions for direct test feedback on failure.
 */
import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { GUARD_RULES } from '../packages/basalt-ui/src/guard'
import { RULE_NAMES, SKILL_NAMES, SURFACES } from '../packages/basalt-ui/src/surfaces'
import type { DoctrineSpec } from '../packages/basalt-ui/src/surfaces'
import { checkCoverage } from '../packages/basalt-ui/src/cli'

const root = join(import.meta.dir, '..')
const pkgRoot = join(root, 'packages/basalt-ui')

// ── helpers ─────────────────────────────────────────────────────────────────

const doctrineSpecs = (Object.values(SURFACES) as { kind: string }[]).filter(
  (s): s is DoctrineSpec => s.kind === 'doctrine',
)

function packageExports(): Set<string> {
  const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8')) as {
    exports?: Record<string, unknown>
  }
  return new Set(Object.keys(pkg.exports ?? {}))
}

// ── gate: checkCoverage() must return 0 ─────────────────────────────────────

describe('check-coverage gate', () => {
  it('checkCoverage() returns 0 (all 8 assertions pass)', () => {
    expect(checkCoverage()).toBe(0)
  })
})

// ── Assertion 1: doctrine guardKinds ⊆ keyof GUARD_RULES ────────────────────

describe('guardKinds coverage', () => {
  const validKinds = new Set(Object.keys(GUARD_RULES))

  for (const [key, spec] of Object.entries(SURFACES) as [string, { kind: string }][]) {
    if (spec.kind !== 'doctrine') continue
    const doctrine = spec as unknown as DoctrineSpec
    for (const kind of doctrine.guardKinds) {
      it(`SURFACES['${key}'].guardKinds: '${kind}' is in GUARD_RULES`, () => {
        expect(validKinds.has(kind)).toBe(true)
      })
    }
  }

  it('all doctrine specs have only valid guardKinds', () => {
    const bad: string[] = []
    for (const [key, spec] of Object.entries(SURFACES) as [string, { kind: string }][]) {
      if (spec.kind !== 'doctrine') continue
      const doctrine = spec as unknown as DoctrineSpec
      for (const kind of doctrine.guardKinds) {
        if (!validKinds.has(kind)) bad.push(`${key}:${kind}`)
      }
    }
    expect(bad).toEqual([])
  })
})

// ── Assertion 2: doctrine rules → on-disk agent/rules/basalt-{rule}.md ──────

describe('rule file coverage', () => {
  for (const rule of RULE_NAMES) {
    it(`agent/rules/basalt-${rule}.md exists on disk`, () => {
      expect(existsSync(join(pkgRoot, `agent/rules/basalt-${rule}.md`))).toBe(true)
    })
  }
})

// ── Assertion 3: doctrine skills → on-disk agent/skills/{skill}/SKILL.md ────

describe('skill file coverage', () => {
  for (const skill of SKILL_NAMES) {
    it(`agent/skills/${skill}/SKILL.md exists on disk`, () => {
      expect(existsSync(join(pkgRoot, `agent/skills/${skill}/SKILL.md`))).toBe(true)
    })
  }

  it('SKILL_NAMES covers the deduped doctrine skill union', () => {
    const skillUnion = new Set(doctrineSpecs.flatMap((s) => [...s.skill]))
    expect([...skillUnion].toSorted()).toEqual([...SKILL_NAMES].toSorted())
  })
})

// ── Assertion 4: subpath-export-coverage ────────────────────────────────────

describe('subpath export coverage', () => {
  it('every non-# non-"." SURFACES key has a package.json exports entry', () => {
    const exports = packageExports()
    const missing = Object.keys(SURFACES).filter(
      (key) => !key.startsWith('#') && key !== '.' && !exports.has(key),
    )
    expect(missing).toEqual([])
  })
})

// ── Assertion 7: every headless surface carries all 3 Mantine bans ─────────

describe('headless Mantine-ban coverage', () => {
  const REQUIRED_MANTINE_BANS = ['@mantine/core', '@mantine/hooks', '@mantine/*'] as const

  it('every headless surface has all 3 Mantine bans in forbiddenImports', () => {
    const missing: string[] = []
    for (const [key, spec] of Object.entries(SURFACES)) {
      if (spec.layer !== 'headless') continue
      for (const required of REQUIRED_MANTINE_BANS) {
        const hasBan = spec.forbiddenImports.some((fi) => fi.spec === required)
        if (!hasBan) missing.push(`${key} missing ban for '${required}'`)
      }
    }
    expect(missing).toEqual([])
  })
})

// ── Assertion 8: doctrine optionalPeers → peerDependencies + peerDependenciesMeta ────

describe('optionalPeers peerDependencies coverage', () => {
  const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8')) as {
    peerDependencies?: Record<string, string>
    peerDependenciesMeta?: Record<string, { optional?: boolean }>
  }
  const peerDeps = pkg.peerDependencies ?? {}
  const peerMeta = pkg.peerDependenciesMeta ?? {}

  it('every doctrine optionalPeer is in peerDependencies', () => {
    const missing: string[] = []
    for (const spec of doctrineSpecs) {
      for (const peer of spec.optionalPeers ?? []) {
        if (!(peer in peerDeps)) missing.push(peer)
      }
    }
    expect(missing).toEqual([])
  })

  it('every doctrine optionalPeer is marked optional in peerDependenciesMeta', () => {
    const missing: string[] = []
    for (const spec of doctrineSpecs) {
      for (const peer of spec.optionalPeers ?? []) {
        if (peerMeta[peer]?.optional !== true) missing.push(peer)
      }
    }
    expect(missing).toEqual([])
  })
})
