/**
 * Surfaces coverage.
 *
 * Asserts:
 *  2. Every shipped rule (SHIPPED_RULES, the v3 five, and SITE_RULES) is on disk, and agent/rules/ holds no other file.
 *  3. Every doctrine skill (deduped via SKILL_NAMES) maps to an on-disk
 *     agent/skills/{skill}/SKILL.md (skills ship in the npm package, placed by init/sync).
 *  4. Every non-#, non-'.' JS-subpath SURFACES key has a package.json exports entry.
 *  6. Every surface with non-empty forbiddenImports has a globs field.
 *  8. Every doctrine optionalPeers entry exists in peerDependencies AND peerDependenciesMeta.
 *
 * Uses checkCoverage() as the primary gate (exit-code assertion), then redundant structural
 * assertions for direct test feedback on failure.
 */
import { describe, expect, it } from 'bun:test'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { SKILL_NAMES, SURFACES } from '../packages/basalt-ui/src/surfaces'
import type { DoctrineSpec } from '../packages/basalt-ui/src/surfaces'
import {
  checkCoverage,
  SHIPPED_RULES,
  SITE_RULES,
} from '../packages/basalt-ui/scripts/check-coverage'
import { subpathFamilies } from '../packages/basalt-ui/scripts/export-keys'

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
  // The eject paths (`./core/<module>`) are the one `./core/*` family SURFACES names.
  return new Set(subpathFamilies(pkg.exports ?? {}))
}

// ── gate: checkCoverage() must return 0 ─────────────────────────────────────

describe('check-coverage gate', () => {
  it('checkCoverage() returns 0 (all 7 assertions pass)', () => {
    expect(checkCoverage()).toBe(0)
  })
})

// ── Assertion 2: the five shipped rules are on disk, and only they ───────────

describe('rule file coverage', () => {
  for (const rule of SHIPPED_RULES) {
    it(`agent/rules/${rule}.md exists on disk`, () => {
      expect(existsSync(join(pkgRoot, `agent/rules/${rule}.md`))).toBe(true)
    })
  }

  it('agent/rules/ lists exactly the five shipped files and the site rule', () => {
    expect(readdirSync(join(pkgRoot, 'agent/rules')).toSorted()).toEqual(
      [...SHIPPED_RULES, ...SITE_RULES].map((rule) => `${rule}.md`).toSorted(),
    )
  })
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
