import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MAX_LINES, fingerprints, pending, readGreen, recordGreen } from './green-cache'
import { astroModel, qualityModel } from './matrix-select'

const ROOT = new URL('..', import.meta.url).pathname

const tree = (files: Record<string, string>) => (file: string) => files[file] ?? null
const pages = new Map([
  ['/a', new Set(['shell.ts', 'a.ts'])],
  ['/b', new Set(['shell.ts', 'b.ts'])],
])

describe('fingerprints', () => {
  const base = { 'shell.ts': 's', 'a.ts': 'a', 'b.ts': 'b', 'harness.ts': 'h' }
  const of = (files: Record<string, string>, extra = {}) =>
    fingerprints({ pages, salt: ['harness.ts'], read: tree(files), ...extra })

  test('equal content is an equal fingerprint, a page apart from its neighbour', () => {
    const fp = of(base)
    expect(of({ ...base }).get('/a')).toBe(fp.get('/a'))
    expect(fp.get('/a')).not.toBe(fp.get('/b'))
  })

  test('a change inside a page moves that page only', () => {
    const fp = of(base)
    const moved = of({ ...base, 'a.ts': 'a2' })
    expect(moved.get('/a')).not.toBe(fp.get('/a'))
    expect(moved.get('/b')).toBe(fp.get('/b'))
  })

  test('a change in the shell or the salt moves every page', () => {
    const fp = of(base)
    for (const files of [
      { ...base, 'shell.ts': 's2' },
      { ...base, 'harness.ts': 'h2' },
    ]) {
      const moved = of(files)
      expect(moved.get('/a')).not.toBe(fp.get('/a'))
      expect(moved.get('/b')).not.toBe(fp.get('/b'))
    }
  })

  test('a deleted file moves the page that reached it', () => {
    const fp = of(base)
    const { 'b.ts': _gone, ...rest } = base
    const moved = of(rest)
    expect(moved.get('/b')).not.toBe(fp.get('/b'))
    expect(moved.get('/a')).toBe(fp.get('/a'))
  })

  test('a file outside every page and the salt moves nothing', () => {
    const fp = of(base)
    const moved = of({ ...base, 'docs.md': 'new words' })
    expect([...moved]).toEqual([...fp])
  })

  test('the pages measured together share their files', () => {
    const family = (page: string) => (page === '/a' || page === '/b' ? ['/a', '/b'] : [])
    const fp = of(base, { siblings: family })
    const moved = of({ ...base, 'b.ts': 'b2' }, { siblings: family })
    expect(moved.get('/a')).not.toBe(fp.get('/a'))
  })
})

describe('pending', () => {
  const fp = new Map([
    ['/a', 'fa'],
    ['/b', 'fb'],
  ])

  test('keeps the pages not recorded as passed, in order', () => {
    expect(pending(['/b', '/a'], fp, new Set(['fa']))).toEqual(['/b'])
    expect(pending(['/a', '/b'], fp, new Set(['fa', 'fb']))).toEqual([])
  })

  test('a page the model does not know always runs', () => {
    expect(pending(['/gone'], fp, new Set(['fa', 'fb']))).toEqual(['/gone'])
  })
})

describe('the store', () => {
  const dir = mkdtempSync(join(tmpdir(), 'green-cache-'))
  const file = (name: string) => join(dir, name)

  test('a missing file is empty, a record is kept once and read back', () => {
    expect(readGreen(file('none')).size).toBe(0)
    recordGreen(file('s'), ['x', 'y'])
    recordGreen(file('s'), ['y', 'z'])
    expect(readFileSync(file('s'), 'utf8')).toBe('x\ny\nz\n')
    expect([...readGreen(file('s'))]).toEqual(['x', 'y', 'z'])
  })

  test('past the cap it keeps the newest half and the new lines', () => {
    const old = Array.from({ length: MAX_LINES }, (_, i) => 'f' + i)
    recordGreen(file('big'), old)
    recordGreen(file('big'), ['new'])
    const kept = [...readGreen(file('big'))]
    expect(kept.length).toBe(MAX_LINES / 2 + 1)
    expect(kept.at(-1)).toBe('new')
    expect(kept[0]).toBe('f' + MAX_LINES / 2)
    rmSync(dir, { recursive: true })
  })
})

describe('the real tree', () => {
  const read = (file: string) => readFileSync(join(ROOT, file), 'utf8')

  test('a quality page moves with a file it imports and not with one it never reaches', () => {
    const model = qualityModel(ROOT)
    const salt = [...model.harness]
    const [route, files] = [...model.pages].find(([, f]) => f.size > 1) ?? []
    if (route === undefined || files === undefined) throw new Error('no quality page')
    const reached = [...files].find((f) => f.endsWith('.tsx')) as string
    const make = (changed: Record<string, string>) =>
      fingerprints({
        pages: model.pages,
        salt,
        read: (f) => changed[f] ?? read(f),
      })
    const fp = make({})
    expect(make({ [reached]: 'changed' }).get(route)).not.toBe(fp.get(route))
    expect(make({ 'docs/validation.md': 'changed' }).get(route)).toBe(fp.get(route))
  })

  test('an Astro part moves with a sibling of its family', () => {
    const model = astroModel(ROOT)
    const ids = [...model.families.values()].find((family) => family.length > 1) ?? []
    const [part, sibling] = ids
    if (part === undefined || sibling === undefined) throw new Error('no family of two parts')
    const own = model.pages.get(part) ?? new Set<string>()
    const only = [...(model.pages.get(sibling) ?? [])].find((f) => !own.has(f))
    if (only === undefined) return
    const make = (changed: Record<string, string>) =>
      fingerprints({
        pages: model.pages,
        salt: [],
        siblings: (page) => ids.filter((id) => id !== page),
        read: (f) => changed[f] ?? read(f),
      })
    expect(make({ [only]: 'changed' }).get(part)).not.toBe(make({}).get(part))
  })
})
