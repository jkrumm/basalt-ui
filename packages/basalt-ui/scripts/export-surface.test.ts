import { afterAll, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  diffShards,
  readShards,
  serializeShard,
  shardFile,
  shardName,
  subpathOfShardFile,
} from './export-surface-shards.mjs'

const SCRIPTS = import.meta.dir
const SHARDS = join(SCRIPTS, 'export-surface')
const scratches: string[] = []

afterAll(() => {
  for (const dir of scratches) rmSync(dir, { recursive: true, force: true })
})

function run(pkg: string, shards: string, ...extra: string[]) {
  const result = Bun.spawnSync(
    ['node', join(SCRIPTS, 'export-surface.mjs'), '--base', pkg, '--shards', shards, ...extra],
    { stdout: 'pipe', stderr: 'pipe' },
  )
  return { code: result.exitCode, out: `${result.stdout}${result.stderr}` }
}

/** A fake package whose built entries export known names, with shards written by `--update`. */
function fixture(): { pkg: string; shards: string } {
  const pkg = mkdtempSync(join(tmpdir(), 'export-surface-'))
  scratches.push(pkg)
  mkdirSync(join(pkg, 'dist'), { recursive: true })
  writeFileSync(
    join(pkg, 'package.json'),
    JSON.stringify({
      exports: {
        '.': { import: './dist/index.js' },
        './charts': { import: './dist/charts.js' },
        './ui/button': { import: './dist/ui-button.js' },
        './tokens.css': './dist/tokens.css',
      },
    }),
  )
  writeFileSync(
    join(pkg, 'dist/index.js'),
    'export const b = 1\nexport const a = 2\nexport default 0\n',
  )
  writeFileSync(join(pkg, 'dist/charts.js'), 'export const Chart = 1\n')
  writeFileSync(join(pkg, 'dist/ui-button.js'), 'export const Button = 1\n')
  const shards = join(pkg, 'shards')
  expect(run(pkg, shards, '--update').code).toBe(0)
  return { pkg, shards }
}

describe('shard naming', () => {
  test('subpath ↔ file name', () => {
    expect(shardName('.')).toBe('index')
    expect(shardName('./charts')).toBe('charts')
    expect(shardName('./ui/button')).toBe('ui__button')
    expect(shardFile('./ui/button')).toBe('ui__button.json')
    for (const subpath of ['.', './charts', './ui/button']) {
      expect(subpathOfShardFile(shardFile(subpath))).toBe(subpath)
    }
    expect(subpathOfShardFile('README.md')).toBeUndefined()
  })
})

describe('diffShards', () => {
  const base = { '.': ['a', 'b'], './charts': ['Chart'] }

  test('equal surfaces have no drift', () => {
    expect(diffShards(base, structuredClone(base))).toEqual([])
  })

  test('a differing name fails naming that shard only', () => {
    expect(diffShards({ ...base, './charts': ['Chart', 'Old'] }, base)).toEqual([
      'export-surface/charts.json: missing exports: Old',
    ])
    expect(diffShards(base, { ...base, '.': ['a', 'b', 'c'] })).toEqual([
      'export-surface/index.json: unsnapshotted exports: c',
    ])
  })

  test('an orphan shard and a subpath without a shard both fail', () => {
    expect(diffShards({ ...base, './gone': ['x'] }, base)).toEqual([
      'export-surface/gone.json: orphan shard, ./gone is not a published subpath',
    ])
    expect(diffShards(base, { ...base, './new': ['x'] })).toEqual([
      'export-surface/new.json: no shard for published subpath ./new',
    ])
  })
})

describe('export-surface.mjs on a temp package', () => {
  test('--update writes one sorted shard per subpath, then the check passes', () => {
    const { pkg, shards } = fixture()
    expect(readShards(shards)).toEqual({
      '.': ['a', 'b'],
      './charts': ['Chart'],
      './ui/button': ['Button'],
    })
    expect(readFileSync(join(shards, 'index.json'), 'utf8')).toBe(serializeShard(['a', 'b']))
    expect(run(pkg, shards).code).toBe(0)
    console.log(`export-surface shard count: ${Object.keys(readShards(shards)).length}`)
  })

  test('an edited name fails naming the shard; --update restores only that shard', () => {
    const { pkg, shards } = fixture()
    const edited = join(shards, 'charts.json')
    const other = join(shards, 'index.json')
    writeFileSync(edited, serializeShard(['Chart', 'Renamed']))
    const before = readFileSync(other, 'utf8')
    const mtime = Bun.file(other).lastModified

    const failed = run(pkg, shards)
    expect(failed.code).toBe(1)
    expect(failed.out).toContain('export-surface/charts.json: missing exports: Renamed')

    expect(run(pkg, shards, '--update').code).toBe(0)
    expect(readFileSync(edited, 'utf8')).toBe(serializeShard(['Chart']))
    expect(readFileSync(other, 'utf8')).toBe(before)
    expect(Bun.file(other).lastModified).toBe(mtime)
    expect(run(pkg, shards).code).toBe(0)
  })

  test('an orphan shard fails; --update deletes it', () => {
    const { pkg, shards } = fixture()
    writeFileSync(join(shards, 'orphan.json'), serializeShard(['x']))
    const failed = run(pkg, shards)
    expect(failed.code).toBe(1)
    expect(failed.out).toContain('export-surface/orphan.json: orphan shard')
    expect(run(pkg, shards, '--update').code).toBe(0)
    expect(existsSync(join(shards, 'orphan.json'))).toBe(false)
  })

  test('a subpath without a shard fails; --update writes it', () => {
    const { pkg, shards } = fixture()
    rmSync(join(shards, 'ui__button.json'))
    const failed = run(pkg, shards)
    expect(failed.code).toBe(1)
    expect(failed.out).toContain(
      'export-surface/ui__button.json: no shard for published subpath ./ui/button',
    )
    expect(run(pkg, shards, '--update').code).toBe(0)
    expect(existsSync(join(shards, 'ui__button.json'))).toBe(true)
  })
})

describe('the committed shards', () => {
  test('are sorted arrays, one per subpath', () => {
    const surface = readShards(SHARDS)
    expect(Object.keys(surface).length).toBeGreaterThan(0)
    for (const names of Object.values(surface)) expect(names).toEqual([...names].toSorted())
  })
})
