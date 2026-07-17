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
 *  7. Every headless surface is Mantine-free — via all 3 forbiddenImports bans, OR (for
 *     TOKEN_LAYER_BOUNDARY_SURFACES members, ./charts/./tokens) exemption backed by the repo-
 *     local-only basalt/token-layer-boundary plugin rule's LIVE registration — verified here, not
 *     in checkCoverage() itself (see cli/index.ts's assertion-7 comment for why it can't).
 *  8. Every doctrine optionalPeers entry exists in peerDependencies AND peerDependenciesMeta.
 *
 * Uses checkCoverage() as the primary gate (exit-code assertion), then redundant structural
 * assertions for direct test feedback on failure.
 */
import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { GUARD_RULES } from '../packages/basalt-ui/src/guard'
import {
  hasTokenLayerBoundaryRegistered,
  RULE_NAMES,
  SKILL_NAMES,
  SURFACES,
  TOKEN_LAYER_BOUNDARY_SURFACES,
} from '../packages/basalt-ui/src/surfaces'
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

// ── Assertion 7: every headless surface is Mantine-free ─────────────────────
// Coverage is either all 3 forbiddenImports bans, or — for the two surfaces the
// `basalt/token-layer-boundary` plugin rule actually fires on (charts/tokens path segments) —
// exemption backed by that rule's LIVE registration in the repo-local `.oxlintrc.json`. It is
// deliberately registered repo-local ONLY (never the shipped consumer preset): it protects two
// things — layering (tokens is pure data that `cssVariablesResolver` reads to bind Mantine's
// surfaces to the same `--vx-*` vars charts reads — an `@mantine/*` import in either would cycle
// back through the theme layer or let a chart bypass `--vx-*` and fork chrome/charts apart) and
// packaging (`./charts`/`./tokens` resolve and render with no `@mantine/*` installed, CI-tested via
// `scripts/pack-test.sh` + `scripts/check-dist-layering.mjs`). The LAYER is Mantine-free — the
// FRAMEWORK is not (`.` requires Mantine as a non-optional peer). Both are a basalt-internal
// invariant, not a consumer contract. This describe block is basalt's own CI guarantee that a
// future removal of the rule fails loudly — `checkCoverage()` (a shipped CLI subcommand) cannot
// verify this itself, since it must run from inside a consumer's node_modules, where the
// repo-local `.oxlintrc.json` path resolves to the CONSUMER's own config.

describe('headless Mantine-ban coverage', () => {
  const REQUIRED_MANTINE_BANS = ['@mantine/core', '@mantine/hooks', '@mantine/*'] as const
  const repoConfig = JSON.parse(readFileSync(join(root, '.oxlintrc.json'), 'utf8')) as {
    rules?: Record<string, unknown>
  }
  const shippedConfig = JSON.parse(readFileSync(join(pkgRoot, 'configs/oxlint.json'), 'utf8')) as {
    rules?: Record<string, unknown>
  }
  const tokenLayerBoundaryRegistered = hasTokenLayerBoundaryRegistered(repoConfig.rules)

  it('the basalt/token-layer-boundary plugin rule is registered as error in the repo-local config', () => {
    // Load-bearing for the exemption below: if this ever goes false, ./charts and ./tokens have
    // NO Mantine-free coverage at all (their forbiddenImports are intentionally empty).
    expect(tokenLayerBoundaryRegistered).toBe(true)
  })

  it('the shipped consumer preset does NOT register basalt/token-layer-boundary (deliberately absent)', () => {
    // This governs basalt's own internal layering (tokens upstream of Mantine), not a consumer
    // contract — it must never leak into the shipped preset.
    expect(hasTokenLayerBoundaryRegistered(shippedConfig.rules)).toBe(false)
  })

  it('every member of TOKEN_LAYER_BOUNDARY_SURFACES is thereby covered', () => {
    expect(tokenLayerBoundaryRegistered).toBe(true)
    expect([...TOKEN_LAYER_BOUNDARY_SURFACES].toSorted()).toEqual(['./charts', './tokens'])
  })

  it('every headless surface is Mantine-free (forbiddenImports, or exemption for TOKEN_LAYER_BOUNDARY_SURFACES members)', () => {
    const missing: string[] = []
    for (const [key, spec] of Object.entries(SURFACES)) {
      if (spec.layer !== 'headless') continue
      if (TOKEN_LAYER_BOUNDARY_SURFACES.has(key)) continue
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
