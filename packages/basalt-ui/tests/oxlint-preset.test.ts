/**
 * The generated oxlint presets against the rule table (guardrails sections 6, 9, 10): which ids run
 * at which profile, `tokens` shipping none, the a11y component map, the oxfmt preset, the pins and
 * the drift gate. The preset firing through the real oxlint is the root `oxlint-preset-smoke` test.
 */
import { afterAll, describe, expect, it } from 'bun:test'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import plugin from '../src/lint'
import { tableOf } from '../src/lint/factory'
import { a11yComponents, buildPreset, pascal } from '../src/lint/preset'
import { SLOTS } from '../src/ui/slots'

const PKG = resolve(import.meta.dir, '..')
const ROOT = resolve(PKG, '../..')
const GEN = join(PKG, 'scripts/gen-oxlint.ts')
const RULES = tableOf(plugin)

type Preset = { rules: Record<string, unknown>; settings: Record<string, unknown> }
const read = (name: string): Preset =>
  JSON.parse(readFileSync(join(PKG, 'configs', name), 'utf8')) as Preset

/** The numbered ids of guardrails section 4 that a consumer preset can carry. */
const NUMBERED = [
  'viewport-keyed',
  'dark-fork',
  'fixed-colour',
  'status-fill-as-text',
  'raw-scroll',
  'tw-off-law',
  'app-spacing',
  'import-boundary',
  'primitive-bypass',
  'control-home',
  'router-search',
  'data-primitive',
  'untrusted-markdown',
  'colour-literal',
  'waiver-needs-reason',
]
const numbers = (...ns: number[]): string[] => ns.map((n) => `basalt/${NUMBERED[n - 1]}`).toSorted()
const basaltOn = (preset: Preset): string[] =>
  Object.entries(preset.rules)
    .filter(([name, level]) => name.startsWith('basalt/') && level !== 'off')
    .map(([name]) => name)
    .toSorted()

describe('profiles', () => {
  it('has every numbered id in the rule table', () => {
    expect(Object.keys(RULES).toSorted()).toEqual([...NUMBERED].toSorted())
  })

  it('tokens yields no oxlint preset', () => {
    const inputs = {
      table: RULES,
      pins: { oxlint: '1.93.0', shadcnLint: '0.2.5' },
      contracts: [],
      uiSlots: {},
    }
    expect(buildPreset({ ...inputs, profile: 'tokens' })).toBeUndefined()
    expect(existsSync(join(PKG, 'configs/oxlint-tokens.json'))).toBe(false)
  })

  it('bridge runs exactly ids 1-4, 6, 14, 15', () => {
    expect(basaltOn(read('oxlint-bridge.json'))).toEqual(numbers(1, 2, 3, 4, 6, 14, 15))
  })

  it.each(['oxlint-parts.json', 'oxlint-app.json'])('%s runs ids 1-15', (file) => {
    expect(basaltOn(read(file))).toEqual(numbers(...NUMBERED.map((_, i) => i + 1)))
  })

  it('writes the table options, never typed in the generator', () => {
    expect(read('oxlint-bridge.json').rules['basalt/tw-off-law']).toEqual([
      'error',
      { profile: 'bridge' },
    ])
    expect(read('oxlint-parts.json').rules['basalt/tw-off-law']).toBe('error')
  })

  it('runs the five bought token rules everywhere; no-restyle points at own components at bridge', () => {
    for (const file of ['oxlint-bridge.json', 'oxlint-parts.json', 'oxlint-app.json']) {
      const { rules } = read(file)
      for (const rule of [
        'no-raw-colors',
        'no-arbitrary-values',
        'no-unknown-classes',
        'no-inline-styles',
        'require-static-classes',
      ]) {
        expect(rules[`shadcn/${rule}`]).toBe('error')
      }
    }
    const restyle = (file: string): { componentImports: string[]; contracts: unknown[] } =>
      (read(file).rules['shadcn/no-restyle'] as [string, never])[1]
    expect(restyle('oxlint-bridge.json').componentImports).toEqual(['(?:^|/)components/ui(?:/|$)'])
    expect(restyle('oxlint-bridge.json').contracts).toEqual([])
    expect(restyle('oxlint-parts.json').componentImports).toEqual(['^basalt-ui/ui/'])
    expect(restyle('oxlint-parts.json').contracts.length).toBeGreaterThan(0)
  })
})

describe('pins', () => {
  it('writes the exact pins and the installed oxlint equals the one written', () => {
    const { pins } = read('oxlint-parts.json').settings['basalt'] as {
      pins: Record<string, string>
    }
    expect(pins).toEqual({ oxlint: '1.93.0', '@shadcn/lint': '0.2.5' })
    const installed = JSON.parse(
      readFileSync(join(ROOT, 'node_modules/oxlint/package.json'), 'utf8'),
    ) as { version: string }
    expect(installed.version).toBe(pins['oxlint'] as string)
    const run = Bun.spawnSync([join(ROOT, 'node_modules/.bin/oxlint'), '--version'])
    expect(run.stdout.toString()).toContain(pins['oxlint'] as string)
  })
})

describe('jsx-a11y and oxfmt', () => {
  it('maps every ui/* part to a component in settings.jsx-a11y.components', () => {
    const { components } = read('oxlint-parts.json').settings['jsx-a11y'] as {
      components: Record<string, string>
    }
    const parts = Object.values(SLOTS).flat()
    expect(parts.length).toBeGreaterThan(50)
    for (const slot of parts) expect(components[pascal(slot)]).toBeString()
    expect(components['Button']).toBe('button')
    expect(a11yComponents(SLOTS)).toEqual(components)
  })

  it('enables sortTailwindcss in the oxfmt preset and keeps the base options', () => {
    const preset = JSON.parse(
      readFileSync(join(PKG, 'configs/oxfmt-tailwind.json'), 'utf8'),
    ) as Record<string, unknown>
    const base = JSON.parse(readFileSync(join(PKG, 'configs/oxfmt.json'), 'utf8')) as Record<
      string,
      unknown
    >
    expect(preset['sortTailwindcss']).toEqual({ functions: ['cn', 'clsx', 'cx', 'cva'] })
    expect(preset).toMatchObject(base)
  })
})

describe('gen-oxlint --check', () => {
  const copy = mkdtempSync(join(tmpdir(), 'basalt-gen-oxlint-'))
  afterAll(() => rmSync(copy, { recursive: true, force: true }))
  const check = (dir?: string): number =>
    Bun.spawnSync(['bun', GEN, '--check', ...(dir ? [`--configs-dir=${dir}`] : [])], { cwd: ROOT })
      .exitCode ?? -1

  it('exits 0 on the committed presets', () => {
    expect(check()).toBe(0)
  })

  it('exits 1 after one byte of a generated preset changes', () => {
    cpSync(join(PKG, 'configs'), copy, { recursive: true })
    expect(check(copy)).toBe(0)
    const file = join(copy, 'oxlint-parts.json')
    const text = readFileSync(file, 'utf8')
    const at = text.indexOf('"error"')
    writeFileSync(file, `${text.slice(0, at)}"errot"${text.slice(at + '"error"'.length)}`)
    expect(check(copy)).toBe(1)
  })
})
