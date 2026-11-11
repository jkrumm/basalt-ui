/**
 * adopt.e2e on the console-shaped fixture (CE2, CE4): only `<root>/components/ui/*.tsx` files
 * present on the merge base are adopted; a shipped name becomes `origin: 'adopted'` with
 * base = seed; a new local file needs `--raise` and becomes `origin: 'local'`.
 */
import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  cleanup,
  commitAll,
  makeConsumer,
  read,
  run,
  snapshot,
} from '../../../test/fixtures/eject/harness'
import { parseManifest } from '../manifest'
import { ejectedSource, readSeed } from '../merge/seed'

afterEach(cleanup)

const ejectedOf = (dir: string): Record<string, Record<string, unknown>> => {
  const parsed = parseManifest(read(dir, '.basalt/manifest.json'))
  if ('error' in parsed) throw new Error(parsed.error)
  return parsed.manifest.ejected
}

describe('adopt.e2e (console)', () => {
  it('a file outside <root>/components/ui exits 1, writing nothing', () => {
    const fx = makeConsumer('console', { git: true })
    const before = snapshot(fx.dir)
    const result = run(fx, ['--adopt', 'src/lib/status-chip.tsx', '--reason', 'r', '--raise', 'x'])
    expect(result.code).toBe(1)
    expect(result.log).toContain('src/components/ui')
    expect(snapshot(fx.dir)).toEqual(before)
  })

  it('adopts a shipped name on the merge base as origin "adopted" with base = seed', () => {
    const fx = makeConsumer('console', { git: true })
    const original = read(fx.dir, 'src/components/ui/button.tsx')
    const budget = read(fx.dir, '.basalt/budget.json')
    const result = run(fx, [
      '--adopt',
      'src/components/ui/button.tsx',
      '--reason',
      'base-nova edits',
    ])
    expect(result.code).toBe(0)
    expect(result.log).toContain('origin "adopted"')

    const seed = readSeed(fx.pkg, 'button')
    const source = seed === null ? null : ejectedSource(seed.seed)
    expect(read(fx.dir, '.basalt/base/src/button.tsx')).toBe(
      source !== null && 'text' in source ? source.text : '',
    )
    expect(ejectedOf(fx.dir)['src#button']).toEqual({
      path: 'src/components/ui/button.tsx',
      fromVersion: '3.0.0-fixture',
      seedDigest: seed?.digest,
      reason: 'base-nova edits',
      origin: 'adopted',
    })
    const adopted = read(fx.dir, 'src/components/ui/button.tsx')
    expect(adopted).toBe(`// basalt:ejected button@3.0.0-fixture base-nova edits\n${original}`)
    expect(existsSync(join(fx.dir, 'src/components/ui/button.guard.ts'))).toBe(true)
    expect(read(fx.dir, 'tsconfig.json')).toContain('"basalt-ui/ui/button"')
    expect(read(fx.dir, '.basalt/budget.json')).toBe(budget)

    commitAll(fx.dir, 'adopt')
    expect(run(fx, ['button', '--undo']).code).toBe(0)
    expect(read(fx.dir, 'src/components/ui/button.tsx')).toBe(original)
    expect(existsSync(join(fx.dir, 'src/components/ui/button.guard.ts'))).toBe(false)
    expect(read(fx.dir, 'tsconfig.json')).not.toContain('basalt-ui/ui/button')
  })

  it('a new local file without --raise exits 1, writing nothing', () => {
    const fx = makeConsumer('console', { git: true })
    const before = snapshot(fx.dir)
    const result = run(fx, ['--adopt', 'src/components/ui/otp-field.tsx', '--reason', 'OTPField'])
    expect(result.code).toBe(1)
    expect(result.log).toContain('--raise')
    expect(snapshot(fx.dir)).toEqual(before)
  })

  it('a new local file with --raise gets origin "local": no base, no guard, a raises row', () => {
    const fx = makeConsumer('console', { git: true })
    const result = run(fx, [
      '--adopt',
      'src/components/ui/otp-field.tsx',
      '--raise',
      'rb PIN entry',
      '--reason',
      'OTPField',
    ])
    expect(result.code).toBe(0)
    expect(ejectedOf(fx.dir)['src#otp-field']).toEqual({
      path: 'src/components/ui/otp-field.tsx',
      fromVersion: '3.0.0-fixture',
      seedDigest: null,
      reason: 'OTPField',
      origin: 'local',
    })
    expect(existsSync(join(fx.dir, '.basalt/base'))).toBe(false)
    expect(existsSync(join(fx.dir, 'src/components/ui/otp-field.guard.ts'))).toBe(false)
    expect(read(fx.dir, 'tsconfig.json')).not.toContain('otp-field')
    expect(JSON.parse(read(fx.dir, '.basalt/budget.json'))).toMatchObject({
      ejects: 3,
      adopted: 10,
      raises: [{ field: 'ejects', from: 3, to: 3, consumer: 'rb PIN entry' }],
    })
  })

  it('a shipped name created on the branch exits 1 with or without --raise, writing nothing', () => {
    const fx = makeConsumer('console', { git: true })
    writeFileSync(join(fx.dir, 'src/components/ui/input.tsx'), 'export const Input = null\n')
    commitAll(fx.dir, 'new input on the branch')
    const before = snapshot(fx.dir)
    for (const extra of [[], ['--raise', 'console login']]) {
      const refused = run(fx, ['--adopt', 'src/components/ui/input.tsx', '--reason', 'r', ...extra])
      expect(refused.code).toBe(1)
      expect(refused.log).toContain('merge base')
      expect(refused.log).toContain('basalt-ui eject input')
      expect(snapshot(fx.dir)).toEqual(before)
    }
  })

  it('an adopted file is not ejected again, and a plain eject over it is refused', () => {
    const fx = makeConsumer('console', { git: true })
    expect(run(fx, ['button', '--reason', 'r']).log).toContain(
      '--adopt src/components/ui/button.tsx',
    )
    expect(run(fx, ['--adopt', 'src/components/ui/button.tsx', '--reason', 'r']).code).toBe(0)
    expect(run(fx, ['--adopt', 'src/components/ui/button.tsx', '--reason', 'r']).code).toBe(1)
  })
})
