/**
 * Skill reference files: every file under `agent/skills/<name>/` (SKILL.md plus `references/**`) is its
 * own managed unit, placed, drift-checked and pruned like a rule. The walk is exercised against a
 * scratch package dir (`managedFiles`' injectable source root) so it does not depend on which
 * references the shipped skills carry today.
 */
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import {
  classify,
  init,
  MANIFEST_PATH,
  readManifest,
  managedFiles,
  pruneRetiredManagedFiles,
  ROOT_PLACEMENT,
  sha256,
  sync,
  unitState,
} from './index'
import type { Manifest } from './index'

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

function skillDests(pkgRoot: string): string[] {
  return managedFiles(ROOT_PLACEMENT, pkgRoot)
    .map((f) => f.dest)
    .filter((d) => d.startsWith('.claude/skills/basalt-design/'))
}

describe('skill tree walk', () => {
  it('places SKILL.md and every nested reference as its own managed file', () => {
    put(scratch, 'agent/skills/basalt-design/SKILL.md', '# router\n')
    put(scratch, 'agent/skills/basalt-design/references/scenario.md', '# scenario\n')
    put(scratch, 'agent/skills/basalt-design/references/deep/x.md', '# x\n')
    expect(skillDests(scratch)).toEqual([
      '.claude/skills/basalt-design/SKILL.md',
      '.claude/skills/basalt-design/references/deep/x.md',
      '.claude/skills/basalt-design/references/scenario.md',
    ])
    const ref = managedFiles(ROOT_PLACEMENT, scratch).find((f) => f.dest.endsWith('scenario.md'))
    expect(ref?.mode).toBe('managed')
    expect(ref?.source).toBe('agent/skills/basalt-design/references/scenario.md')
    expect(ref?.render({ pkgRoot: scratch, vars: {} as never })).toBe('# scenario\n')
  })

  it('a skill without references still places just SKILL.md', () => {
    put(scratch, 'agent/skills/basalt-design/SKILL.md', '# router\n')
    expect(skillDests(scratch)).toEqual(['.claude/skills/basalt-design/SKILL.md'])
  })
})

describe('reference drift', () => {
  it('a locally edited reference classifies as drifted, an untouched one as unchanged', () => {
    put(scratch, 'agent/skills/basalt-design/SKILL.md', '# router\n')
    put(scratch, 'agent/skills/basalt-design/references/scenario.md', 'v1\n')
    const consumer = join(scratch, 'consumer')
    const file = managedFiles(ROOT_PLACEMENT, scratch).find((f) => f.dest.endsWith('scenario.md'))!
    const ctx = { pkgRoot: scratch, vars: {} as never }
    put(consumer, file.dest, 'v1\n')
    // The shipped bytes moved on (v2); the consumer copy still matches the recorded v1 hash.
    put(scratch, 'agent/skills/basalt-design/references/scenario.md', 'v2\n')
    expect(classify(unitState(file, consumer, ctx), sha256('v1\n'))).toBe('unchanged')
    put(consumer, file.dest, 'edited locally\n')
    expect(classify(unitState(file, consumer, ctx), sha256('v1\n'))).toBe('drifted')
  })
})

describe('retired references', () => {
  it('prunes a reference a later version no longer ships, then its empty dirs', () => {
    put(scratch, 'agent/skills/basalt-design/SKILL.md', '# router\n')
    const consumer = join(scratch, 'consumer')
    const dest = '.claude/skills/basalt-design/references/old.md'
    put(consumer, dest, 'old\n')
    const manifest: Manifest = { version: 1, files: { [dest]: sha256('old\n') } }
    const result = pruneRetiredManagedFiles(
      consumer,
      manifest,
      managedFiles(ROOT_PLACEMENT, scratch),
    )
    expect(result.removed).toEqual([dest])
    expect(existsSync(join(consumer, dest))).toBe(false)
    expect(existsSync(join(consumer, '.claude/skills/basalt-design/references'))).toBe(false)
    expect(manifest.files[dest]).toBeUndefined()
  })

  it('leaves a locally edited retired reference in place and reports it', () => {
    put(scratch, 'agent/skills/basalt-design/SKILL.md', '# router\n')
    const consumer = join(scratch, 'consumer')
    const dest = '.claude/skills/basalt-design/references/old.md'
    put(consumer, dest, 'mine\n')
    const manifest: Manifest = { version: 1, files: { [dest]: sha256('old\n') } }
    const result = pruneRetiredManagedFiles(
      consumer,
      manifest,
      managedFiles(ROOT_PLACEMENT, scratch),
    )
    expect(result.drifted).toEqual([dest])
    expect(existsSync(join(consumer, dest))).toBe(true)
  })

  it('`sync --check` is red on a tracked retired reference; `sync` deletes it', () => {
    const dest = '.claude/skills/basalt-design/references/retired.md'
    put(
      scratch,
      'package.json',
      JSON.stringify({ name: 'app', dependencies: { 'basalt-ui': '*' } }),
    )
    put(scratch, 'src/main.tsx', '// entry\n')
    put(
      scratch,
      'node_modules/basalt-ui/package.json',
      JSON.stringify({ name: 'basalt-ui', version: '1.0.0' }),
    )
    quiet(() => init(scratch))
    put(scratch, dest, 'retired\n')
    const manifest = readManifest(scratch)
    manifest.files[dest] = sha256('retired\n')
    writeFileSync(join(scratch, MANIFEST_PATH), JSON.stringify(manifest))
    expect(quiet(() => sync({ check: true }, scratch))).toBe(1)
    expect(existsSync(join(scratch, dest))).toBe(true)
    expect(quiet(() => sync({}, scratch))).toBe(0)
    expect(existsSync(join(scratch, dest))).toBe(false)
  })
})

function quiet<T>(fn: () => T): T {
  const log = spyOn(console, 'log').mockImplementation(() => {})
  const err = spyOn(console, 'error').mockImplementation(() => {})
  try {
    return fn()
  } finally {
    log.mockRestore()
    err.mockRestore()
  }
}
