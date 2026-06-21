/**
 * Drift gate: the AGENTS.md "Subpath ownership" table must match the SURFACES SSOT.
 * Parses the committed table and asserts every JS subpath (non-#, non-asset) appears once
 * with the SURFACES layer + description — no missing rows, no extras.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'

import { SURFACES } from '../src/surfaces'
import type { SurfaceSpec } from '../src/surfaces'

const AGENTS_PATH = join(import.meta.dir, '..', 'AGENTS.md')

type Row = { subpath: string; layer: string; purpose: string }

function parseSubpathTable(md: string): Row[] {
  const lines = md.split('\n')
  const start = lines.findIndex((l) => l.startsWith('## Subpath ownership'))
  if (start === -1) throw new Error('AGENTS.md: missing "## Subpath ownership" section')

  const rows: Row[] = []
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (line.startsWith('## ')) break
    if (!line.trimStart().startsWith('|')) continue
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim())
    if (cells.length !== 3) continue
    const [subpath, layer, purpose] = cells
    if (subpath === undefined || layer === undefined || purpose === undefined) continue
    if (subpath === 'Subpath') continue // header row
    if (/^-+$/.test(subpath)) continue // separator row
    rows.push({ subpath: subpath.replace(/`/g, ''), layer, purpose })
  }
  return rows
}

function expectedRows(): Row[] {
  const out: Row[] = []
  for (const [key, spec] of Object.entries(SURFACES) as [string, SurfaceSpec][]) {
    if (key.startsWith('#')) continue
    if (spec.layer === 'non-js-asset') continue
    const subpath = key === '.' ? 'basalt-ui' : `basalt-ui${key.slice(1)}`
    out.push({ subpath, layer: spec.layer, purpose: spec.description ?? subpath })
  }
  return out
}

describe('agents-sync', () => {
  const parsed = parseSubpathTable(readFileSync(AGENTS_PATH, 'utf8'))
  const expected = expectedRows()

  it('lists exactly the JS subpaths from SURFACES (no missing, no extra)', () => {
    expect(parsed.map((r) => r.subpath).toSorted()).toEqual(
      expected.map((r) => r.subpath).toSorted(),
    )
  })

  it('matches the SURFACES layer + description for every subpath', () => {
    const byPath = new Map(parsed.map((r) => [r.subpath, r]))
    for (const e of expected) {
      const row = byPath.get(e.subpath)
      expect(row).toBeDefined()
      expect(row?.layer).toBe(e.layer)
      expect(row?.purpose).toBe(e.purpose)
    }
  })
})
