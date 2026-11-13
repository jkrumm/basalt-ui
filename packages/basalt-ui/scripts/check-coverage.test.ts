/**
 * `check-coverage` — the 11 assertions (SURFACES consistency + the agent-layer shape and line
 * budgets).
 *
 * The fs half runs against a TEMP package root, never the real `agent/**`: a test that wrote into
 * the shipped rules would break the very gate it exercises. The 2.x generated
 * `<!-- basalt:coverage -->` header is retired (a rule bullet carries its own tag, held by
 * `check-rule-tags.ts`), so `--write` fails.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

import { GUARD_RULES } from '../src/guard/index'
import { SKILL_NAMES, SURFACES } from '../src/surfaces'
import {
  AGENT_LAYER_TOTAL_BUDGET,
  AGENT_LINE_BUDGETS,
  RULES_TOTAL_BUDGET,
  SHIPPED_RULES,
  checkCoverage,
} from './check-coverage'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(resolve(tmpdir(), 'basalt-check-coverage-'))
  mkdirSync(resolve(dir, 'agent/rules'), { recursive: true })
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

const pkgRoot = resolve(import.meta.dir, '..')
const lines = (rel: string, root = pkgRoot) =>
  readFileSync(resolve(root, rel), 'utf8').split('\n').length - 1

// ── the 11 assertions ────────────────────────────────────────────────────────

describe('checkCoverage', () => {
  it('passes against the live registry', () => {
    expect(checkCoverage()).toBe(0)
    expect(checkCoverage(['--check'])).toBe(0)
  })

  it('fails on --write: the generated coverage header is retired', () => {
    expect(checkCoverage(['--write'])).toBe(1)
  })

  it('holds every shipped agent-layer file inside its budget, and the layer inside the total', () => {
    // Assertion 10, read off the real layer rather than a fixture: the budgets ARE the doctrine, so
    // the interesting failure is a shipped file growing past one, not a synthetic file doing it.
    expect(SHIPPED_RULES).toHaveLength(5)
    for (const [rel, budget] of Object.entries(AGENT_LINE_BUDGETS)) {
      expect(lines(rel)).toBeLessThanOrEqual(budget)
    }
    const layer = [
      ...SHIPPED_RULES.map((rule) => `agent/rules/${rule}.md`),
      ...SKILL_NAMES.map((skill) => `agent/skills/${skill}/SKILL.md`),
      'agent/templates/AGENTS-block.md.tpl',
    ].reduce((sum, rel) => sum + lines(rel), 0)
    expect(layer).toBeLessThanOrEqual(AGENT_LAYER_TOTAL_BUDGET)
  })

  it('totals the five rule files at most RULES_TOTAL_BUDGET lines', () => {
    const total = SHIPPED_RULES.reduce((sum, rule) => sum + lines(`agent/rules/${rule}.md`), 0)
    expect(total).toBeLessThanOrEqual(RULES_TOTAL_BUDGET)
  })

  it('imports nothing in the block and never names the suppressing file', () => {
    for (const rel of [
      'agent/templates/AGENTS-block.md.tpl',
      'agent/templates/AGENTS-block.tokens.md.tpl',
    ]) {
      const text = readFileSync(resolve(pkgRoot, rel), 'utf8')
      expect([rel, /^@\S/m.test(text)]).toEqual([rel, false])
      expect([rel, text.includes('CLAUDE.md')]).toEqual([rel, false])
    }
  })

  it('fails on a missing rule, an extra rule file, and a rules dir over its total', () => {
    // A temp root with no agent layer: every shipped rule is missing; the failure is the signal.
    writeFileSync(resolve(dir, 'agent/rules/basalt-extra.md'), '# extra\n')
    writeFileSync(
      resolve(dir, 'agent/rules/basalt-tokens.md'),
      `${'line\n'.repeat(RULES_TOTAL_BUDGET + 1)}`,
    )
    expect(checkCoverage([], dir)).toBe(1)
  })
})

// ── the registry itself ─────────────────────────────────────────────────────

describe('SURFACES.pluginRules', () => {
  it('is required on every doctrine surface — [] is legal, absent is not', () => {
    for (const [key, spec] of Object.entries(SURFACES)) {
      if (spec.kind !== 'doctrine') continue
      expect([key, Array.isArray(spec.pluginRules)]).toEqual([key, true])
    }
  })
})

describe('SURFACES.guardKinds — assertion 11', () => {
  // The twin of assertion 9 for the text lane: a kind shipped on no surface is a kind no doctrine
  // names.
  it('places every GUARD_RULES kind on at least one doctrine surface', () => {
    const surfaced = new Set<string>()
    for (const spec of Object.values(SURFACES)) {
      if (spec.kind !== 'doctrine') continue
      for (const kind of spec.guardKinds) surfaced.add(kind)
    }
    const orphans = Object.keys(GUARD_RULES).filter((kind) => !surfaced.has(kind))
    expect(orphans).toEqual([])
  })
})
