/**
 * `basalt-ui check-coverage` — the 9 SURFACES assertions, and the generated
 * `<!-- basalt:coverage -->` header each rule file carries (docs/CONTROLS-SPEC.md §7).
 *
 * The block exists because a rule file's own claim about what enforces it was prose, and prose
 * drifted: a doc could name a guard kind and stay silent about the oxlint rule doing the real work,
 * or claim coverage for a law nothing checks (D8). Generating it from SURFACES makes the claim a
 * projection of the registry, and `--check` makes a stale claim a build failure.
 *
 * The pure half (`coverageFor` / `coverageBlock` / `applyCoverageBlock`) is tested directly; the fs
 * half runs against a TEMP package root, never the real `agent/rules/**` — those files are the next
 * wave's to rewrite, and a test that wrote into them would make `--write` untestable afterwards.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

import { RULE_NAMES, SURFACES } from '../surfaces'
import {
  COVERAGE_BLOCK_CLOSE,
  COVERAGE_BLOCK_OPEN,
  applyCoverageBlock,
  checkCoverage,
  coverageBlock,
  coverageFor,
  readCoverageBlock,
  reconcileCoverageBlocks,
} from './index'

const FRONTMATTER = `---\nsource: basalt-ui\ndescription: d\npaths:\n  - 'src/**'\n---\n`

let dir: string

beforeEach(() => {
  dir = mkdtempSync(resolve(tmpdir(), 'basalt-check-coverage-'))
  mkdirSync(resolve(dir, 'agent/rules'), { recursive: true })
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

/** Writes one rule file into the temp package root and returns its path. */
function writeRuleFile(rule: string, body: string): string {
  const path = resolve(dir, `agent/rules/basalt-${rule}.md`)
  writeFileSync(path, body)
  return path
}

// ── the 9 assertions ─────────────────────────────────────────────────────────

describe('checkCoverage', () => {
  it('passes against the live registry', () => {
    expect(checkCoverage()).toBe(0)
  })

  it('rejects --write and --check together rather than picking one', () => {
    expect(checkCoverage(['--write', '--check'])).toBe(1)
  })
})

// ── coverageFor — the projection ─────────────────────────────────────────────

describe('coverageFor', () => {
  // `rule` is many-to-one: `data` covers ./data, ./data/table and ./data/virtual, `mantine` covers
  // `.` and ./connectivity. Reading one surface would understate the rule's coverage.
  it('unions every surface carrying the rule', () => {
    const mantine = coverageFor('mantine')
    expect(mantine.pluginRules).toContain('hand-rolled-shell')
    expect(mantine.guardKinds).toContain('raw-form-control')
  })

  it('names the control rules under the controls rule', () => {
    expect(coverageFor('controls').pluginRules).toEqual([
      'control-outside-home',
      'control-size-literal',
      'hand-rolled-filter',
      'responsive-twin',
    ])
  })

  it('carries the advisory laws verbatim, in spec order', () => {
    const { advisoryLaws } = coverageFor('controls')
    expect(advisoryLaws.length).toBe(4)
    expect(advisoryLaws[0]).toContain('C1 as a cross-file law')
  })

  it('dedupes a kind two surfaces share', () => {
    const { guardKinds } = coverageFor('charts')
    expect(guardKinds.filter((k) => k === 'raw-hex')).toHaveLength(1)
  })

  it('returns empty lists for a rule nothing enforces', () => {
    expect(coverageFor('forms')).toEqual({ guardKinds: [], pluginRules: [], advisoryLaws: [] })
  })
})

// ── coverageBlock — what the file actually carries ───────────────────────────

describe('coverageBlock', () => {
  it('is HTML comments only, so it renders as nothing', () => {
    for (const rule of RULE_NAMES) {
      for (const line of coverageBlock(rule).split('\n')) {
        expect([rule, line.startsWith('<!--') && line.endsWith('-->')]).toEqual([rule, true])
      }
    }
  })

  it('opens and closes with the delimiters', () => {
    const block = coverageBlock('controls')
    expect(block.startsWith(COVERAGE_BLOCK_OPEN)).toBe(true)
    expect(block.endsWith(COVERAGE_BLOCK_CLOSE)).toBe(true)
  })

  it('names both lanes, prefixing the oxlint ids', () => {
    const block = coverageBlock('controls')
    expect(block).toContain('oxlint rules — basalt/control-outside-home')
    expect(block).toContain('guard kinds — none')
  })

  // A block that simply omitted the section would read as "nothing to declare" whether or not
  // anyone had looked. `—` is a claim someone can check.
  it('prints `not guarded: —` when a rule declares no advisory law', () => {
    expect(coverageBlock('forms')).toContain('<!-- not guarded: — -->')
  })

  it('prints one line per advisory law, so a diff points at the claim', () => {
    const lines = coverageBlock('controls')
      .split('\n')
      .filter((l) => l.includes('not guarded'))
    expect(lines).toHaveLength(4)
  })

  it('is stable — the same registry emits the same bytes', () => {
    expect(coverageBlock('charts')).toBe(coverageBlock('charts'))
  })
})

// ── applyCoverageBlock / readCoverageBlock ──────────────────────────────────

describe('applyCoverageBlock', () => {
  const block = coverageBlock('controls')

  it('inserts below the YAML frontmatter — the paths: header stays first', () => {
    const out = applyCoverageBlock(`${FRONTMATTER}\n# Title\n`, block)
    expect(out.startsWith(FRONTMATTER)).toBe(true)
    expect(out).toContain(block)
    expect(out.indexOf(block)).toBeLessThan(out.indexOf('# Title'))
  })

  it('replaces an existing block instead of stacking a second one', () => {
    const stale = `${COVERAGE_BLOCK_OPEN}\n<!-- backed by: nothing -->\n${COVERAGE_BLOCK_CLOSE}`
    const out = applyCoverageBlock(`${FRONTMATTER}\n${stale}\n\n# Title\n`, block)
    expect(out).toContain(block)
    expect(out).not.toContain('backed by: nothing')
    expect(out.split(COVERAGE_BLOCK_OPEN)).toHaveLength(2)
  })

  it('is idempotent', () => {
    const once = applyCoverageBlock(`${FRONTMATTER}\n# T\n`, block)
    expect(applyCoverageBlock(once, block)).toBe(once)
  })

  it('prepends when there is no frontmatter', () => {
    expect(applyCoverageBlock('# T\n', block).startsWith(block)).toBe(true)
  })

  it('readCoverageBlock returns null for a file with no block', () => {
    expect(readCoverageBlock(`${FRONTMATTER}\n# T\n`)).toBeNull()
  })
})

// ── reconcileCoverageBlocks — --write / --check ─────────────────────────────

describe('reconcileCoverageBlocks', () => {
  /** Every rule file the temp root needs, so only the block state under test varies. */
  function seedRuleFiles(body: (rule: string) => string): void {
    for (const rule of RULE_NAMES) writeRuleFile(rule, body(rule))
  }

  it('--write inserts a block into every rule file', () => {
    seedRuleFiles(() => `${FRONTMATTER}\n# T\n`)
    const { failures, notes } = reconcileCoverageBlocks(dir, 'write')
    expect(failures).toEqual([])
    expect(notes).toHaveLength(RULE_NAMES.length)
    const text = readFileSync(resolve(dir, 'agent/rules/basalt-controls.md'), 'utf8')
    expect(text).toContain(coverageBlock('controls'))
  })

  it('--write is idempotent — a second run reports unchanged and rewrites nothing', () => {
    seedRuleFiles(() => `${FRONTMATTER}\n# T\n`)
    reconcileCoverageBlocks(dir, 'write')
    const before = readFileSync(resolve(dir, 'agent/rules/basalt-controls.md'), 'utf8')
    const { notes } = reconcileCoverageBlocks(dir, 'write')
    expect(notes.every((n) => n.endsWith('unchanged'))).toBe(true)
    expect(readFileSync(resolve(dir, 'agent/rules/basalt-controls.md'), 'utf8')).toBe(before)
  })

  it('--check passes once the blocks are written', () => {
    seedRuleFiles(() => `${FRONTMATTER}\n# T\n`)
    reconcileCoverageBlocks(dir, 'write')
    expect(reconcileCoverageBlocks(dir, 'check').failures).toEqual([])
  })

  // The wave-6 requirement: the blocks are inserted by the agent-layer wave, and a gate that failed
  // before they exist would have to land disabled — which is how a gate stays disabled.
  it('--check REPORTS a file with no block yet, and does not fail it', () => {
    seedRuleFiles(() => `${FRONTMATTER}\n# T\n`)
    const { failures, notes } = reconcileCoverageBlocks(dir, 'check')
    expect(failures).toEqual([])
    expect(notes).toHaveLength(RULE_NAMES.length)
    expect(notes[0]).toContain('no <!-- basalt:coverage --> block yet')
  })

  it('--check FAILS a block that disagrees with SURFACES', () => {
    seedRuleFiles(() => `${FRONTMATTER}\n# T\n`)
    reconcileCoverageBlocks(dir, 'write')
    const path = resolve(dir, 'agent/rules/basalt-controls.md')
    writeFileSync(path, readFileSync(path, 'utf8').replace('basalt/hand-rolled-filter', 'basalt/x'))
    const { failures } = reconcileCoverageBlocks(dir, 'check')
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('basalt-controls.md')
  })

  it('skips a missing rule file — assertion 2 already reports that', () => {
    expect(reconcileCoverageBlocks(dir, 'check')).toEqual({ failures: [], notes: [] })
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
