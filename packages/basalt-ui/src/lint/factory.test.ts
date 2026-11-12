/**
 * The factory under both hosts it ships for (guardrails section 13): ESLint's RuleTester in
 * process, oxlint's `plugins-dev` RuleTester in a Node child over a bundled copy of the same
 * suites. A synthetic table proves the machinery; real forms arrive with their families.
 */
import { afterAll, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { Rule } from 'eslint'
import { RuleTester } from 'eslint'

import { createPlugin, formMessage, isClassShaped, tableOf } from './factory'
import { SHAPES, SUITES, SYNTHETIC, toneHole } from './factory.cases'
import plugin from './index'

RuleTester.describe = describe
RuleTester.it = it

describe('ESLint RuleTester', () => {
  const tester = new RuleTester({
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
  })
  for (const suite of SUITES) {
    tester.run(suite.name, suite.rule as unknown as Rule.RuleModule, suite.cases)
  }
})

describe('oxlint plugins-dev RuleTester', () => {
  const outdir = mkdtempSync(join(tmpdir(), 'basalt-lint-factory-'))
  afterAll(() => rmSync(outdir, { recursive: true, force: true }))

  it('runs every suite green under Node', async () => {
    const build = await Bun.build({
      entrypoints: [resolve(import.meta.dirname, 'factory.cases.ts')],
      outdir,
      target: 'node',
      format: 'esm',
      naming: 'cases.mjs',
    })
    expect(build.success).toBe(true)
    const run = Bun.spawnSync([
      'node',
      resolve(import.meta.dirname, 'factory.oxlint.mjs'),
      join(outdir, 'cases.mjs'),
    ])
    const stderr = run.stderr.toString()
    const stdout = run.stdout.toString()
    expect({ exitCode: run.exitCode, stderr }).toEqual({ exitCode: 0, stderr: '' })
    const result = JSON.parse(stdout) as { passed: number; failures: string[] }
    expect(result.failures).toEqual([])
    const total = SUITES.reduce(
      (sum, { cases }) => sum + cases.valid.length + cases.invalid.length,
      0,
    )
    expect(result.passed).toBe(total)
  }, 60_000)
})

describe('shapes', () => {
  it('has one invalid case per shape the brief names', () => {
    expect(SHAPES.map((shape) => shape.name)).toEqual([
      'className',
      'cn()',
      'cva()',
      'object map',
      'array',
      'join',
      'template quasi',
    ])
  })
})

describe('createPlugin', () => {
  it('builds one rule per id under the basalt namespace', () => {
    const synthetic = createPlugin(SYNTHETIC)
    expect(synthetic.meta.name).toBe('basalt')
    expect(Object.keys(synthetic.rules)).toEqual(['synthetic-class', 'synthetic-ast'])
    expect(Object.keys(synthetic.rules['synthetic-class']?.meta.messages ?? {})).toEqual([
      'prefix',
      'tone-hole',
      'padding',
    ])
    expect(tableOf(synthetic)).toBe(SYNTHETIC)
  })

  it('ships the merged families as the package plugin, readable through tableOf', () => {
    expect(plugin.meta.name).toBe('basalt')
    expect(Object.keys(plugin.rules)).toEqual(Object.keys(tableOf(plugin)))
  })

  it('tableOf refuses a plugin it did not build', () => {
    expect(() => tableOf({ meta: { name: 'other' }, rules: {} })).toThrow(
      'tableOf: not a plugin built by createPlugin',
    )
  })
})

describe('helpers', () => {
  it('formMessage names the fix and the next rung', () => {
    expect(formMessage(toneHole)).toBe(
      '`{{subject}}`: A cva variant per tone. Next: Status or Num tone from parts.',
    )
  })

  it('isClassShaped accepts utilities and refuses prose and URLs', () => {
    expect(isClassShaped('flex gap-4.5 @narrow:p-2 bg-(--vx-good) !p-0 -mt-1')).toBe(true)
    expect(isClassShaped('Use sm: for small')).toBe(false)
    expect(isClassShaped('https://example.com')).toBe(false)
    expect(isClassShaped('   ')).toBe(false)
  })
})
