import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateLlmsTxt } from './gen-llms'
import { missingSubpaths } from './gen-llms-assert.mjs'

const SCRIPT = join(import.meta.dir, 'gen-llms-assert.mjs')
const pkgPath = join(import.meta.dir, '..', 'package.json')
const exportsMap = JSON.parse(readFileSync(pkgPath, 'utf8')).exports as Record<string, unknown>

describe('gen-llms tarball assertion', () => {
  test('the generated file names every package.json export', () => {
    expect(missingSubpaths(generateLlmsTxt(), exportsMap)).toEqual([])
  }, 30_000)

  test('a seeded file that lacks a subpath fails, naming it', () => {
    const seeded = generateLlmsTxt().replace('## basalt-ui/charts\n', '## basalt-ui/chartz\n')
    expect(missingSubpaths(seeded, exportsMap)).toEqual(['## basalt-ui/charts'])

    const llms = join(mkdtempSync(join(tmpdir(), 'llms-assert-')), 'llms.txt')
    writeFileSync(llms, seeded, 'utf8')
    const run = Bun.spawnSync(['node', SCRIPT, llms, pkgPath])
    expect(run.exitCode).toBe(1)
    expect(run.stderr.toString()).toContain('missing: ## basalt-ui/charts')
  }, 30_000)
})
