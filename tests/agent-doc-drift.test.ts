/**
 * Agent-doc drift guard.
 *
 * Asserts the two checks that would have caught basalt-ui's two historical `ChartTooltip` misses
 * (the CLAUDE.md block fixed in 1.16.0, and the SKILL.md line found by a human two lines further
 * down): a fixture doc naming a removed API in the bolded-backtick form fails Check A, one naming
 * it in plain backticks fails Check B, the denylist's own self-consistency guard fires when a
 * denylisted name looks live again, and the real `agent/**` tree passes both checks post-fix.
 */
import { describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  checkA,
  checkB,
  checkDenylistIsGenuinelyRemoved,
  collectValidNames,
  findAgentMdFiles,
  REMOVED_APIS,
} from '../packages/basalt-ui/scripts/check-agent-doc-drift'

function withFixture(content: string, run: (file: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), 'agent-doc-drift-'))
  const file = join(dir, 'fixture.md')
  writeFileSync(file, content)
  try {
    run(file)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('agent-doc-drift guard', () => {
  const validNames = collectValidNames()

  it('collects a non-trivial valid-name surface (value exports ∪ barrel type exports)', () => {
    expect(validNames.size).toBeGreaterThan(100)
    expect(validNames.has('ChartTooltipFloat')).toBe(true)
    expect(validNames.has('CartesianChart')).toBe(true)
    expect(validNames.has('AxisBottomDate')).toBe(true)
  })

  // ── Check A: bolded-backtick claim ──────────────────────────────────────────

  it('Check A fails a fixture doc naming a removed API in the bolded-backtick form', () => {
    withFixture('Compose **`ChartTooltip`** for the floating tooltip.\n', (file) => {
      const failures = checkA([file], validNames)
      expect(failures).toHaveLength(1)
      expect(failures[0]?.line).toBe(1)
      expect(failures[0]?.name).toBe('ChartTooltip')
    })
  })

  it('Check A passes a fixture naming a real export in the bolded-backtick form', () => {
    withFixture('Compose **`ChartTooltipFloat`** for the floating tooltip.\n', (file) => {
      expect(checkA([file], validNames)).toEqual([])
    })
  })

  it('Check A does not flag an allowlisted literal token value', () => {
    withFixture('Allowed accents: **`blue`** (the earned accent hue).\n', (file) => {
      expect(checkA([file], validNames)).toEqual([])
    })
  })

  it('Check A ignores bold-backtick spans that are not a single identifier', () => {
    withFixture('Run **`basalt-ui check-theme`** before committing.\n', (file) => {
      expect(checkA([file], validNames)).toEqual([])
    })
  })

  // ── Check B: plain-backtick denylist ────────────────────────────────────────

  it('Check B fails a fixture doc naming a removed API in plain backticks', () => {
    withFixture('Tooltip = `ChartCard` / `ChartTooltip` primitives.\n', (file) => {
      const failures = checkB([file])
      expect(failures).toHaveLength(1)
      expect(failures[0]?.line).toBe(1)
      expect(failures[0]?.name).toBe('ChartTooltip')
      expect(failures[0]?.replacement).toBe('ChartTooltipFloat')
    })
  })

  it('Check B passes a fixture using only the live replacement name', () => {
    withFixture('Tooltip = `ChartCard` / `ChartTooltipFloat` primitives.\n', (file) => {
      expect(checkB([file])).toEqual([])
    })
  })

  it('Check B sees through HTML entities and tags — the guard claims "in any form"', () => {
    // Not an adversarial threat model: these docs are written by us and by agents, and nobody
    // drifts a doc by entity-encoding a letter. This exists because a gate whose stated invariant
    // is wider than its implementation earns trust it has not got.
    withFixture('See ChartTool&#116;ip for details.\n', (file) => {
      expect(checkB([file])[0]?.name).toBe('ChartTooltip')
    })
    withFixture('See ChartTool<span></span>tip for details.\n', (file) => {
      expect(checkB([file])[0]?.name).toBe('ChartTooltip')
    })
  })

  // ── denylist self-consistency ────────────────────────────────────────────────

  it('every REMOVED_APIS entry is genuinely absent from the real export surface', () => {
    expect(checkDenylistIsGenuinelyRemoved(validNames)).toEqual([])
  })

  it('fires when a denylisted name looks live again', () => {
    const [firstRemoved] = Object.keys(REMOVED_APIS)
    expect(firstRemoved).toBeDefined()
    const reintroduced = new Set([firstRemoved as string])
    const failures = checkDenylistIsGenuinelyRemoved(reintroduced)
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain(firstRemoved)
  })

  // ── the real tree ──────────────────────────────────────────────────────────

  it('the real agent/** tree passes both checks', () => {
    const mdFiles = findAgentMdFiles()
    expect(mdFiles.length).toBeGreaterThan(0)
    expect(checkA(mdFiles, validNames)).toEqual([])
    expect(checkB(mdFiles)).toEqual([])
  })
})
