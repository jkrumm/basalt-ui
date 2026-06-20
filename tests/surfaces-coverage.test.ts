/**
 * PROJECTION 5 — surfaces coverage + plugin-version lockstep.
 *
 * Asserts:
 *  1. Every doctrine spec's guardKinds ⊆ keyof GUARD_RULES.
 *  2. Every doctrine rule (deduped via RULE_NAMES) maps to an on-disk agent/rules/basalt-{rule}.md.
 *  3. Deduped union of doctrine skill[] ⊆ plugin.json skills (CHECK, not derive).
 *  4. Every non-#, non-'.' JS-subpath SURFACES key has a package.json exports entry.
 *  5. plugin.json and package.json share a major version (lockstep assertion from legacy test).
 *
 * Uses checkCoverage() as the primary gate (exit-code assertion), then redundant structural
 * assertions for direct test feedback on failure.
 */
import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { GUARD_RULES } from '../packages/basalt-ui/src/guard'
import { RULE_NAMES, SURFACES } from '../packages/basalt-ui/src/surfaces'
import type { DoctrineSpec } from '../packages/basalt-ui/src/surfaces'
import { checkCoverage } from '../packages/basalt-ui/src/cli'

const root = join(import.meta.dir, '..')
const pkgRoot = join(root, 'packages/basalt-ui')

const major = (version: string): string => version.split('.')[0] ?? ''

// ── helpers ─────────────────────────────────────────────────────────────────

const doctrineSpecs = (Object.values(SURFACES) as { kind: string }[]).filter(
  (s): s is DoctrineSpec => s.kind === 'doctrine',
)

function pluginSkillNames(): Set<string> {
  const pluginJson = JSON.parse(
    readFileSync(join(root, 'plugins/basalt/.claude-plugin/plugin.json'), 'utf8'),
  ) as { skills?: string[] }
  return new Set((pluginJson.skills ?? []).map((s) => s.split('/').pop() ?? s))
}

function packageExports(): Set<string> {
  const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8')) as {
    exports?: Record<string, unknown>
  }
  return new Set(Object.keys(pkg.exports ?? {}))
}

// ── gate: checkCoverage() must return 0 ─────────────────────────────────────

describe('check-coverage gate', () => {
  it('checkCoverage() returns 0 (all PROJECTION 5 assertions pass)', () => {
    // Pass root as cwd so plugin.json is found at <root>/plugins/basalt/.claude-plugin/plugin.json
    expect(checkCoverage(root)).toBe(0)
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

// ── Assertion 3: doctrine skill union ⊆ plugin.json skills ──────────────────

describe('plugin skill coverage', () => {
  it('deduped doctrine skill union ⊆ plugin.json skills', () => {
    const skills = pluginSkillNames()
    const skillUnion = new Set(doctrineSpecs.flatMap((s) => [...s.skill]))
    const missing = [...skillUnion].filter((s) => !skills.has(s))
    expect(missing).toEqual([])
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

// ── Assertion 5: plugin-version lockstep (migrated from plugin-version-lockstep.test.ts) ──

describe('plugin version lockstep', () => {
  it('plugin.json and package.json share a major version (one doctrine generation)', () => {
    const pluginJson = JSON.parse(
      readFileSync(join(root, 'plugins/basalt/.claude-plugin/plugin.json'), 'utf8'),
    ) as { version?: string }
    const packageJson = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8')) as {
      version?: string
    }

    // Major-version, NOT exact: semantic-release bumps packages/basalt-ui/package.json on every
    // patch/minor release and commits it back (.releaserc.json exec + git), but the
    // isolated-basalt-ui lefthook guard forbids that release commit from also staging the
    // non-package plugin.json. Exact lockstep would therefore break CI on the second release.
    // Majors are rare and bumped by hand, so a shared major still answers "which doctrine
    // generation am I on?" without coupling the plugin manifest to every npm patch.
    expect(major(pluginJson.version ?? '0.0.0')).toBe(major(packageJson.version ?? '0.0.0'))
  })
})
