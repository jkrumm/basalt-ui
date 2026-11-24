/**
 * Skill reference files: every file under `agent/skills/<name>/` (SKILL.md plus `references/**`) is its
 * own managed unit, placed and drift-checked like a rule. The walk is exercised against a scratch
 * package dir (`renderManaged`'s package root) so it does not depend on which references the
 * shipped skills carry today.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import type { Manifest } from './manifest'
import { renderManaged } from './sync/render'

let scratch: string

beforeEach(() => {
  scratch = mkdtempSync(resolve(tmpdir(), 'basalt-skillrefs-'))
})
afterEach(() => {
  rmSync(scratch, { recursive: true, force: true })
})

function put(root: string, rel: string, text: string): void {
  const abs = join(root, rel)
  mkdirSync(resolve(abs, '..'), { recursive: true })
  writeFileSync(abs, text, 'utf8')
}

const APP: Manifest = {
  profile: 'app',
  version: '',
  roots: { src: 'app' },
  ejected: {},
  managed: {},
  deepRender: [],
  authoredContent: [],
  viewports: [],
  tokens: [],
  rest: {},
}

const skillUnits = (pkgRoot: string) =>
  renderManaged(pkgRoot, APP).filter((u) => u.path.startsWith('.claude/skills/basalt-design/'))

describe('skill tree walk', () => {
  it('places SKILL.md and every nested reference as its own managed file', () => {
    put(scratch, 'agent/skills/basalt-design/SKILL.md', '# router\n')
    put(scratch, 'agent/skills/basalt-design/references/scenario.md', '# scenario\n')
    put(scratch, 'agent/skills/basalt-design/references/deep/x.md', '# x\n')
    expect(skillUnits(scratch).map((u) => u.path)).toEqual([
      '.claude/skills/basalt-design/references/deep/x.md',
      '.claude/skills/basalt-design/references/scenario.md',
      '.claude/skills/basalt-design/SKILL.md',
    ])
    const ref = skillUnits(scratch).find((u) => u.path.endsWith('scenario.md'))
    expect(ref?.generated).toBeUndefined()
    expect(ref?.source).toBe('agent/skills/basalt-design/references/scenario.md')
    expect(ref?.content).toBe('# scenario\n')
  })

  it('skips anything under a dot-segment', () => {
    put(scratch, 'agent/skills/basalt-design/SKILL.md', '# router\n')
    put(scratch, 'agent/skills/basalt-design/references/.DS_Store', 'junk')
    put(scratch, 'agent/skills/basalt-design/.hidden/b.md', 'junk')
    expect(skillUnits(scratch).map((u) => u.path)).toEqual([
      '.claude/skills/basalt-design/SKILL.md',
    ])
  })
})
