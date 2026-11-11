/**
 * eject.e2e on the linewatch-shaped fixture (primitives-distribution section 13): eject `button`,
 * edit it, and the app type-checks, builds and renders on the server with the npm composite
 * `SaveBar` drawing the LOCAL button; `--undo` then restores the tree byte-for-byte.
 */
import { afterEach, describe, expect, it } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'vite'

import {
  PKG_ROOT,
  cleanup,
  commitAll,
  makeConsumer,
  read,
  run,
  snapshot,
} from '../../../test/fixtures/eject/harness'
import { parseManifest } from '../manifest'
import { ejectedSource, readSeed, seedDigest } from '../merge/seed'

afterEach(cleanup)

const EDIT = 'data-local-edit="ejected"'
const manifestOf = (dir: string) => {
  const parsed = parseManifest(read(dir, '.basalt/manifest.json'))
  if ('error' in parsed) throw new Error(parsed.error)
  return parsed.manifest
}

describe('eject.e2e (linewatch)', () => {
  it('eject, edit: tsc, build and SSR pass and the npm composite renders the local file; --undo restores the tree', async () => {
    const fx = makeConsumer('linewatch', { git: true })
    const before = snapshot(fx.dir)

    const ejected = run(fx, ['button', '--reason', 'status bar needs a pill size'])
    expect(ejected.log).toContain('button -> src/components/ui/button.tsx')
    expect(ejected.code).toBe(0)

    const local = read(fx.dir, 'src/components/ui/button.tsx')
    expect(local.split('\n')[0]).toBe(
      '// basalt:ejected button@3.0.0-fixture status bar needs a pill size',
    )
    expect(local).toContain("from 'basalt-ui'")
    expect(local).not.toContain('../core/cn')
    const guard = read(fx.dir, 'src/components/ui/button.guard.ts')
    expect(guard).toContain('export const requires')
    expect(guard).not.toContain('basalt:guard closed')
    expect(guard).not.toContain('closedVariant')
    const seed = readSeed(fx.pkg, 'button')
    const source = seed === null ? null : ejectedSource(seed.seed)
    expect(source !== null && 'text' in source ? source.text : null).toBe(
      read(fx.dir, '.basalt/base/src/button.tsx'),
    )
    const tsconfig = read(fx.dir, 'tsconfig.json')
    expect(tsconfig).toContain("// linewatch's web app")
    expect(tsconfig).toContain(
      '"basalt-ui/ui/button": ["./src/components/ui/button.tsx"],\n      "@/*": ["./src/*"]',
    )
    expect(manifestOf(fx.dir).ejected['src#button']).toEqual({
      path: 'src/components/ui/button.tsx',
      fromVersion: '3.0.0-fixture',
      seedDigest: seed?.digest,
      reason: 'status bar needs a pill size',
      origin: 'seed',
    })

    // The consumer edits its file: the composite must pick the edit up.
    writeFileSync(
      join(fx.dir, 'src/components/ui/button.tsx'),
      local.replace('data-slot="button"', `data-slot="button" ${EDIT}`),
    )
    expect(read(fx.dir, 'src/components/ui/button.tsx')).toContain(EDIT)

    const tsc = spawnSync(join(PKG_ROOT, 'node_modules/.bin/tsc'), ['-p', fx.dir], {
      encoding: 'utf8',
    })
    expect(tsc.stdout + tsc.stderr).toBe('')
    expect(tsc.status).toBe(0)

    await build({ root: fx.dir, configFile: join(fx.dir, 'vite.config.mjs'), logLevel: 'silent' })
    await build({
      root: fx.dir,
      configFile: join(fx.dir, 'vite.config.mjs'),
      logLevel: 'silent',
      build: { ssr: 'src/entry-server.tsx', outDir: 'dist-ssr' },
    })
    const server = (await import(pathToFileURL(join(fx.dir, 'dist-ssr/entry-server.js')).href)) as {
      render: () => string
    }
    const html = server.render()
    const saveBar = /<div data-slot="save-bar">(.*?)<\/div>/.exec(html)?.[1] ?? ''
    expect(saveBar).toContain(EDIT)
    expect(saveBar).toContain('Save')

    commitAll(fx.dir, 'eject button')
    const undone = run(fx, ['button', '--undo'])
    expect(undone.code).toBe(0)
    expect(snapshot(fx.dir)).toEqual(before)
    expect(existsSync(join(fx.dir, 'src/components'))).toBe(false)
    expect(existsSync(join(fx.dir, '.basalt/base'))).toBe(false)
  }, 120_000)

  it('seedDigest equals sha256 of the tarball seed plus guard', () => {
    const fx = makeConsumer('linewatch')
    expect(run(fx, ['input', '--reason', 'r']).code).toBe(0)
    const seed = read(fx.pkg, 'src/ui/input.tsx')
    const guard = read(fx.pkg, 'src/ui/input.guard.ts')
    const digest = new Bun.CryptoHasher('sha256').update(`${seed}\0${guard}`).digest('hex')
    expect(manifestOf(fx.dir).ejected['src#input']?.['seedDigest']).toBe(digest)
    expect(seedDigest(seed, guard)).toBe(digest)
  })

  it('an unknown flag exits 1 naming it, writing nothing', () => {
    const fx = makeConsumer('linewatch')
    const before = snapshot(fx.dir)
    const result = run(fx, ['button', '--reason', 'r', '--bogus'])
    expect(result.code).toBe(1)
    expect(result.log).toContain('--bogus')
    expect(snapshot(fx.dir)).toEqual(before)
  })

  it('a second eject of the same name exits 1, writing nothing', () => {
    const fx = makeConsumer('linewatch')
    expect(run(fx, ['button', '--reason', 'r']).code).toBe(0)
    const before = snapshot(fx.dir)
    const second = run(fx, ['button', '--reason', 'again'])
    expect(second.code).toBe(1)
    expect(second.log).toContain('already ejected')
    expect(snapshot(fx.dir)).toEqual(before)
  })

  it('eject --all without --raise exits 1 and budget.json is byte-identical', () => {
    const fx = makeConsumer('linewatch')
    writeFileSync(join(fx.dir, '.basalt/budget.json'), '{ "ejects": 3, "raises": [] }\n')
    const before = snapshot(fx.dir)
    const all = run(fx, ['--all', '--reason', 'shape C'])
    expect(all.code).toBe(1)
    expect(all.log).toContain('--raise')
    expect(snapshot(fx.dir)).toEqual(before)
  })

  it('eject --all --raise ejects every shipped seed and records the raise', () => {
    const fx = makeConsumer('linewatch', { seeds: ['button', 'input', 'switch', 'tabs'] })
    const all = run(fx, ['--all', '--reason', 'shape C', '--raise', 'F3 flipped'])
    expect(all.code).toBe(0)
    expect(Object.keys(manifestOf(fx.dir).ejected).toSorted()).toEqual([
      'src#button',
      'src#input',
      'src#switch',
      'src#tabs',
    ])
    expect(JSON.parse(read(fx.dir, '.basalt/budget.json'))).toEqual({
      ejects: 4,
      raises: [{ field: 'ejects', from: 3, to: 4, consumer: 'F3 flipped' }],
    })
  })

  it('a seed importing a package path with no published specifier exits 1, writing nothing', () => {
    const fx = makeConsumer('linewatch', { seeds: ['card'] })
    const before = snapshot(fx.dir)
    const card = run(fx, ['card', '--reason', 'r'])
    expect(card.code).toBe(1)
    expect(card.log).toContain("'../core/phase'")
    expect(snapshot(fx.dir)).toEqual(before)
  })

  it('--all over the full shipped set names every blocked seed at once, writing nothing', () => {
    const fx = makeConsumer('linewatch')
    const before = snapshot(fx.dir)
    const all = run(fx, ['--all', '--reason', 'shape C', '--raise', 'F3 flipped'])
    expect(all.code).toBe(1)
    expect(all.log).toContain('badge imports')
    expect(all.log).toContain('card imports')
    expect(snapshot(fx.dir)).toEqual(before)
  })

  it('exits 1 without basalt() in the app, writing nothing', () => {
    const fx = makeConsumer('linewatch')
    writeFileSync(join(fx.dir, 'vite.config.mjs'), 'export default { plugins: [] }\n')
    const before = snapshot(fx.dir)
    const result = run(fx, ['button', '--reason', 'r'])
    expect(result.code).toBe(1)
    expect(result.log).toContain('basalt()')
    expect(snapshot(fx.dir)).toEqual(before)
  })

  it('--undo refuses uncommitted changes', () => {
    const fx = makeConsumer('linewatch', { git: true })
    expect(run(fx, ['button', '--reason', 'r']).code).toBe(0)
    const before = snapshot(fx.dir)
    const undo = run(fx, ['button', '--undo'])
    expect(undo.code).toBe(1)
    expect(undo.log).toContain('uncommitted')
    expect(snapshot(fx.dir)).toEqual(before)
  })

  it('names the shipped primitives for an unknown name and requires --reason', () => {
    const fx = makeConsumer('linewatch')
    expect(run(fx, ['nope', '--reason', 'r']).log).toContain('Shipped: ')
    expect(run(fx, ['button']).code).toBe(1)
    expect(run(fx, ['--help']).code).toBe(0)
  })
})
