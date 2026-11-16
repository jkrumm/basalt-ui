/**
 * Surfaces coverage.
 *
 * Asserts:
 *  2. Every shipped rule (SHIPPED_RULES, the v3 five) is on disk, and agent/rules/ holds no other file.
 *  3. Every doctrine skill (deduped via SKILL_NAMES) maps to an on-disk
 *     agent/skills/{skill}/SKILL.md (skills ship in the npm package, placed by init/sync).
 *  4. Every non-#, non-'.' JS-subpath SURFACES key has a package.json exports entry.
 *  6. Every surface with non-empty forbiddenImports has a globs field.
 *  7. The token-layer boundary (./charts, ./tokens) rests on the repo-local-only
 *     basalt/token-layer-boundary plugin rule's LIVE registration — verified here, not in
 *     checkCoverage() itself (a shipped CLI subcommand cannot read the repo-local config).
 *  8. Every doctrine optionalPeers entry exists in peerDependencies AND peerDependenciesMeta.
 *
 * Uses checkCoverage() as the primary gate (exit-code assertion), then redundant structural
 * assertions for direct test feedback on failure.
 */
import { describe, expect, it } from 'bun:test'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  hasTokenLayerBoundaryRegistered,
  SKILL_NAMES,
  SURFACES,
  TOKEN_LAYER_BOUNDARY_SURFACES,
} from '../packages/basalt-ui/src/surfaces'
import type { DoctrineSpec } from '../packages/basalt-ui/src/surfaces'
import { checkCoverage, SHIPPED_RULES } from '../packages/basalt-ui/scripts/check-coverage'

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
  it('checkCoverage() returns 0 (all 9 assertions pass)', () => {
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

  it('agent/rules/ lists exactly the five shipped files', () => {
    expect(readdirSync(join(pkgRoot, 'agent/rules')).toSorted()).toEqual(
      SHIPPED_RULES.map((rule) => `${rule}.md`).toSorted(),
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

// ── Assertion 7: every headless surface imports no UI framework ─────────────
// Coverage is either all 3 forbiddenImports bans, or — for the two surfaces the
// `basalt/token-layer-boundary` plugin rule actually fires on (charts/tokens path segments) —
// exemption backed by that rule's LIVE registration in the repo-local `.oxlintrc.json`. It is
// deliberately registered repo-local ONLY (never the shipped consumer preset): it protects two
// things — layering (tokens is pure data that the generated stylesheet and charts both read — a
// UI-layer import in either would cycle back through the token layer or let a chart bypass
// `--basalt-*` and fork chrome/charts apart) and packaging (`./charts`/`./tokens` resolve and
// render with no UI framework installed, CI-tested via `scripts/pack-test.sh` +
// `scripts/check-dist-layering.mjs`). The LAYER imports no UI framework — the app layer does.
// Both are a basalt-internal invariant, not a consumer contract. This describe block is basalt's
// own CI guarantee that a future removal of the rule fails loudly — `checkCoverage()` (a shipped
// CLI subcommand) cannot verify this itself, since it must run from inside a consumer's
// node_modules, where the repo-local `.oxlintrc.json` path resolves to the CONSUMER's own config.

describe('token-layer boundary coverage', () => {
  const repoConfig = JSON.parse(readFileSync(join(root, '.oxlintrc.json'), 'utf8')) as {
    rules?: Record<string, unknown>
  }
  // The basalt/* levels live in the guards-only preset the full one extends.
  const shippedConfig = JSON.parse(
    readFileSync(join(pkgRoot, 'configs/oxlint-basalt.json'), 'utf8'),
  ) as {
    rules?: Record<string, unknown>
  }
  const tokenLayerBoundaryRegistered = hasTokenLayerBoundaryRegistered(repoConfig.rules)

  it('the basalt/token-layer-boundary plugin rule is registered as error in the repo-local config', () => {
    // Load-bearing for the exemption below: if this ever goes false, ./charts and ./tokens have
    // NO UI-free coverage at all (their forbiddenImports are intentionally empty).
    expect(tokenLayerBoundaryRegistered).toBe(true)
  })

  it('the shipped consumer preset does NOT register basalt/token-layer-boundary (deliberately absent)', () => {
    // This governs basalt's own internal layering (tokens upstream of the UI layer), not a consumer
    // contract — it must never leak into the shipped preset.
    expect(hasTokenLayerBoundaryRegistered(shippedConfig.rules)).toBe(false)
  })

  it('every member of TOKEN_LAYER_BOUNDARY_SURFACES is thereby covered', () => {
    expect(tokenLayerBoundaryRegistered).toBe(true)
    expect([...TOKEN_LAYER_BOUNDARY_SURFACES].toSorted()).toEqual(['./charts', './tokens'])
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
