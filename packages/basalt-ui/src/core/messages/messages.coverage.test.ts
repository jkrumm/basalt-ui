import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createFormat } from '../format'
import { en } from './index'

const MESSAGES = import.meta.dirname
const SRC = join(MESSAGES, '..', '..')
const PACKAGE = join(SRC, '..')

const AREAS = [
  'select',
  'dialogs',
  'base',
  'date',
  'cards',
  'lists',
  'kanban',
  'controls',
  'home',
  'filters',
  'table',
  'live',
  'charts',
]

/** An area whose keys carry component prefixes (`dialog.close`, `combobox.dismiss`) rather than the area's own name. */
const PREFIXES: Record<string, string[]> = {
  dialogs: ['dialog', 'sheet', 'toast'],
  select: ['combobox'],
}

const areaFiles = readdirSync(MESSAGES)
  .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
  .map((name) => name.slice(0, -3))
  .filter((name) => name !== 'index' && name !== 'use-messages')

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sources(path)
    return /\.tsx?$/.test(entry.name) && !/\.(test|type-guard)\./.test(entry.name) ? [path] : []
  })
}

describe('messages.coverage', () => {
  test('one stub or file per seeded area, and index.ts intersects exactly those', () => {
    expect(areaFiles.toSorted()).toEqual(AREAS.toSorted())
    const index = readFileSync(join(MESSAGES, 'index.ts'), 'utf8')
    const imported = [...index.matchAll(/^import \{ \w+ \} from '\.\/([\w-]+)'$/gm)].map(
      (m) => m[1],
    )
    const typed = [...index.matchAll(/^import type \{ \w+ \} from '\.\/([\w-]+)'$/gm)].map(
      (m) => m[1],
    )
    expect(imported.toSorted()).toEqual(areaFiles.toSorted())
    expect(typed.toSorted()).toEqual(areaFiles.toSorted())
    const intersection = /export type BasaltMessages =([^]*?)\n\n/.exec(index)?.[1] ?? ''
    expect([...intersection.matchAll(/\w+Messages/g)]).toHaveLength(areaFiles.length)
  })

  test('every key is prefixed by its area and appears in no other area', () => {
    const seen = new Set<string>()
    for (const area of areaFiles) {
      const source = readFileSync(join(MESSAGES, `${area}.ts`), 'utf8')
      for (const [, key] of source.matchAll(/^\s*'([\w.-]+)':/gm)) {
        const owned = [area, ...(PREFIXES[area] ?? [])]
        expect(owned.some((prefix) => key?.startsWith(`${prefix}.`))).toBe(true)
        expect(seen.has(key ?? '')).toBe(false)
        seen.add(key ?? '')
      }
    }
    expect(Object.keys(en).toSorted()).toEqual([...seen].toSorted())
  })

  test('each key is referenced exactly once outside core/messages (vacuous on the stubs)', () => {
    const consumers = sources(SRC).filter((file) => !file.startsWith(MESSAGES))
    const text = consumers.map((file) => readFileSync(file, 'utf8'))
    for (const key of Object.keys(en)) {
      const hits = consumers.filter((_, i) => text[i]?.includes(`'${key}'`))
      expect(hits.map((f) => relative(PACKAGE, f))).toHaveLength(1)
    }
  })

  test('plural covers the en and de categories', () => {
    for (const locale of ['en', 'de']) {
      const categories = new Intl.PluralRules(locale).resolvedOptions().pluralCategories.toSorted()
      expect(categories).toEqual(['one', 'other'])
      const f = createFormat({ locale })
      expect(new Set([0, 1, 2, 5, 21].map((n) => f.plural(n)))).toEqual(new Set(categories))
    }
  })
})
