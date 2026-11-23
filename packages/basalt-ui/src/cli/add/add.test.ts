/**
 * `basalt-ui add` and the block half of `sync` on a fixture app (test/fixtures/sync, single-root)
 * with a miniature package whose one block changes between two versions: an edit the app made
 * survives the upstream change, a clashing edit stops on diff3 markers, and add never overwrites.
 */
import { afterEach, describe, expect, it } from 'bun:test'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { readManifest } from '../manifest'
import { sync } from '../sync'
import { add } from './index'
import { renderAddDoc } from './help'

const FIXTURES = fileURLToPath(new URL('../../../test/fixtures/sync/', import.meta.url))
const PKG_ROOT = fileURLToPath(new URL('../../../', import.meta.url))

const scratch: string[] = []
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function tmp(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  scratch.push(dir)
  return dir
}

const V1 = {
  'Demo.tsx': [
    "export const title = 'Parts'",
    '',
    '// the columns',
    "export const columns = ['name', 'stock']",
    '',
    '// the footer',
    "export const footer = 'sum'",
    '',
  ].join('\n'),
  'model.ts': 'export type Part = { id: string }\n',
  'old.ts': 'export const old = 1\n',
}

/** The miniature package at `version` shipping the `demo` block made of `files`. */
function writePackage(pkg: string, version: string, files: Record<string, string>): void {
  writeFileSync(join(pkg, 'package.json'), `${JSON.stringify({ name: 'basalt-ui', version })}\n`)
  const dir = join(pkg, 'blocks/demo')
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
  const descriptor = {
    name: 'demo',
    archetype: 'list page',
    summary: 'A demo list.',
    files: Object.keys(files),
    imports: ['lucide-react'],
    ports: ['parts: the parts query state'],
  }
  writeFileSync(join(dir, 'block.json'), `${JSON.stringify(descriptor, null, 2)}\n`)
}

type Fx = { app: string; pkg: string }

function fixture(): Fx {
  const app = tmp('basalt-add-app-')
  cpSync(join(FIXTURES, 'consumers/single-root'), app, { recursive: true })
  mkdirSync(join(app, '.git'))
  const pkg = tmp('basalt-add-pkg-')
  cpSync(join(FIXTURES, 'pkg'), pkg, { recursive: true })
  writePackage(pkg, '3.0.0', V1)
  return { app, pkg }
}

type Run = { code: number; log: string }

function capture(fn: () => number): Run {
  const saved = { log: console.log, error: console.error }
  let log = ''
  const sink = (...args: unknown[]): void => {
    log += `${args.join(' ')}\n`
  }
  console.log = sink
  console.error = sink
  try {
    return { code: fn(), log }
  } finally {
    console.log = saved.log
    console.error = saved.error
  }
}

const runAdd = (fx: Fx, flags: string[]): Run =>
  capture(() => add(flags, fx.app, { pkgRoot: fx.pkg }))
const runSync = (fx: Fx, check = false): Run =>
  capture(() => sync({ pkgRoot: fx.pkg, presetFiles: () => [], check, note: false }, fx.app))
const read = (dir: string, rel: string): string => readFileSync(join(dir, rel), 'utf8')
const rowOf = (dir: string) => {
  const read = readManifest(dir)
  if (read === null || 'error' in read) throw new Error('no manifest')
  return read.manifest.ejected['src#block:demo']
}

/** A settled install with the demo block added at 3.0.0. */
function added(): Fx {
  const fx = fixture()
  expect(runSync(fx).code).toBe(0)
  const result = runAdd(fx, ['demo'])
  expect(result.code).toBe(0)
  return fx
}

describe('basalt-ui add', () => {
  it('copies the block byte for byte, writes its bases and one block row, and prints the ports', () => {
    const fx = fixture()
    expect(runSync(fx).code).toBe(0)
    const result = runAdd(fx, ['demo'])
    expect(result.code).toBe(0)
    expect(result.log).toContain(
      'basalt-ui add: demo -> src/blocks/demo/ (Demo.tsx, model.ts, old.ts)',
    )
    expect(result.log).toContain('port  parts: the parts query state')
    expect(result.log).toContain('peers lucide-react: not in package.json')
    for (const [file, text] of Object.entries(V1)) {
      expect(read(fx.app, `src/blocks/demo/${file}`)).toBe(text)
      expect(read(fx.app, `.basalt/base/src/blocks/demo/${file}`)).toBe(text)
    }
    expect(rowOf(fx.app)).toEqual({
      origin: 'block',
      path: 'src/blocks/demo',
      files: ['Demo.tsx', 'model.ts', 'old.ts'],
      fromVersion: '3.0.0',
      seedDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
    })
    // A block row is not a primitive eject: sync has nothing to merge and nothing to report.
    expect(runSync(fx, true).code).toBe(0)
  })

  it('never overwrites: an existing target file refuses the whole run and writes nothing', () => {
    const fx = fixture()
    mkdirSync(join(fx.app, 'src/blocks/demo'), { recursive: true })
    writeFileSync(join(fx.app, 'src/blocks/demo/model.ts'), 'mine\n')
    const result = runAdd(fx, ['demo'])
    expect(result.code).toBe(1)
    expect(result.log).toContain('src/blocks/demo/model.ts already exists; add never overwrites')
    expect(read(fx.app, 'src/blocks/demo/model.ts')).toBe('mine\n')
    expect(existsSync(join(fx.app, 'src/blocks/demo/Demo.tsx'))).toBe(false)
    expect(existsSync(join(fx.app, '.basalt/base'))).toBe(false)
    expect(rowOf(fx.app)).toBeUndefined()
  })

  it('refuses a second add, an unknown block and a bad flag; --dir places it elsewhere; --list lists', () => {
    const fx = added()
    expect(runAdd(fx, ['demo']).log).toContain('demo is already added in src (src/blocks/demo)')
    expect(runAdd(fx, ['nope']).log).toContain("'nope' is not a shipped block. Shipped: demo")
    expect(runAdd(fx, ['demo', '--force']).code).toBe(1)
    const other = fixture()
    expect(runAdd(other, ['demo', '--dir', 'src/pages/parts']).code).toBe(0)
    expect(read(other.app, 'src/pages/parts/Demo.tsx')).toBe(V1['Demo.tsx'])
    expect(runAdd(other, ['demo', '--dir', '../outside']).code).toBe(1)
    const listed = runAdd(fx, ['--list'])
    expect(listed.code).toBe(0)
    expect(listed.log).toBe('demo  list page: A demo list.\n')
  })
})

describe('sync on an added block', () => {
  it('keeps a local edit through an upstream change: merged, new file added, dropped file kept', () => {
    const fx = added()
    const local = read(fx.app, 'src/blocks/demo/Demo.tsx').replace("'sum'", "'count'")
    writeFileSync(join(fx.app, 'src/blocks/demo/Demo.tsx'), local)
    writePackage(fx.pkg, '3.1.0', {
      'Demo.tsx': V1['Demo.tsx'].replace("'Parts'", "'Inventory'"),
      'model.ts': 'export type Part = { id: string; sku: string }\n',
      'extra.ts': 'export const extra = 2\n',
    })

    const check = runSync(fx, true)
    expect(check.code).toBe(1)
    expect(check.log).toContain('merged src/blocks/demo/Demo.tsx (3.0.0 -> 3.1.0)')

    const result = runSync(fx)
    expect(result.code).toBe(0)
    const merged = read(fx.app, 'src/blocks/demo/Demo.tsx')
    expect(merged).toContain("export const title = 'Inventory'")
    expect(merged).toContain("export const footer = 'count'")
    expect(read(fx.app, 'src/blocks/demo/model.ts')).toBe(
      'export type Part = { id: string; sku: string }\n',
    )
    expect(read(fx.app, 'src/blocks/demo/extra.ts')).toBe('export const extra = 2\n')
    expect(read(fx.app, 'src/blocks/demo/old.ts')).toBe(V1['old.ts'])
    expect(result.log).toContain('added src/blocks/demo/extra.ts')
    expect(result.log).toContain('kept src/blocks/demo/old.ts: the block no longer ships it')
    expect(existsSync(join(fx.app, '.basalt/base/src/blocks/demo/old.ts'))).toBe(false)
    expect(read(fx.app, '.basalt/base/src/blocks/demo/Demo.tsx')).toContain("'Inventory'")
    expect(rowOf(fx.app)).toMatchObject({
      files: ['Demo.tsx', 'model.ts', 'extra.ts'],
      fromVersion: '3.1.0',
    })
    expect(runSync(fx, true).code).toBe(0)
  })

  it('stops on diff3 markers when the edits clash, advances the base, and a second sync is quiet', () => {
    const fx = added()
    const local = read(fx.app, 'src/blocks/demo/Demo.tsx').replace("'Parts'", "'Stock'")
    writeFileSync(join(fx.app, 'src/blocks/demo/Demo.tsx'), local)
    writePackage(fx.pkg, '3.1.0', {
      ...V1,
      'Demo.tsx': V1['Demo.tsx'].replace("'Parts'", "'Inventory'"),
    })

    const result = runSync(fx)
    expect(result.code).toBe(1)
    expect(result.log).toContain('✖ conflict src/blocks/demo/Demo.tsx (3.0.0 -> 3.1.0)')
    const marked = read(fx.app, 'src/blocks/demo/Demo.tsx')
    expect(marked).toContain('<<<<<<< local')
    expect(marked).toContain("export const title = 'Stock'")
    expect(marked).toContain('||||||| base@3.0.0')
    expect(marked).toContain("export const title = 'Inventory'")
    expect(marked).toContain('>>>>>>> shipped@3.1.0')
    expect(rowOf(fx.app)).toMatchObject({ fromVersion: '3.1.0' })

    const again = runSync(fx)
    expect(again.code).toBe(0)
    expect(read(fx.app, 'src/blocks/demo/Demo.tsx')).toBe(marked)
  })

  it('leaves a file the app deleted deleted', () => {
    const fx = added()
    rmSync(join(fx.app, 'src/blocks/demo/old.ts'))
    writePackage(fx.pkg, '3.1.0', { ...V1, 'old.ts': 'export const old = 2\n' })
    const result = runSync(fx)
    expect(result.code).toBe(0)
    expect(result.log).toContain('kept src/blocks/demo/old.ts deleted')
    expect(existsSync(join(fx.app, 'src/blocks/demo/old.ts'))).toBe(false)
  })
})

describe('docs/add.md', () => {
  it('is generated from the help text', () => {
    expect(read(PKG_ROOT, 'docs/add.md')).toBe(renderAddDoc())
  })
})
