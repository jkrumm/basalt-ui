/**
 * P5 (docs/v3/concepts/ai-mdx.md section 7): the validator refuses hostile URLs in `href`, `src`,
 * `url` and `link` at any depth and payloads over the block's limits, and every refusal is a
 * sentence that ends in advice.
 */
import { describe, expect, test } from 'bun:test'
import { z } from 'zod'
import { defineBlock, defineCatalog } from './define'

const note = defineBlock({
  name: 'note',
  description: 'A free-form note.',
  props: z.object({ title: z.string() }).loose(),
  sample: [{ title: 'Hello' }],
  render: () => null,
})
const small = defineBlock({
  name: 'small',
  description: 'A tight block.',
  props: z.object({ title: z.string() }).loose(),
  limits: { maxBytes: 64, maxDepth: 2 },
  sample: [{ title: 'Hi' }],
  render: () => null,
})
const catalog = defineCatalog([note, small])

const HOSTILE = ['//h', 'javascript:alert(1)', 'data:text/html,<b>x</b>']
const KEYS = ['href', 'src', 'url', 'link']

/** A spec carrying `{ [key]: value }` inside an object at `depth` (the spec itself is depth 1). */
function at(depth: number, key: string, value: string): Record<string, unknown> {
  let inner: Record<string, unknown> = { [key]: value }
  for (let d = depth; d > 1; d--) inner = { child: inner }
  return { block: 'note', title: 'x', ...inner }
}

const endsInAdvice = (error: string): void => {
  expect(error).toMatch(/\.$/)
  expect(error.split('. ').length).toBeGreaterThan(1)
}

describe('validate: url policy (P5)', () => {
  for (const depth of [1, 5]) {
    for (const key of KEYS) {
      for (const url of HOSTILE) {
        test(`rejects ${key}="${url}" at depth ${depth}`, () => {
          const result = catalog.validate(at(depth, key, url))
          expect(result.ok).toBe(false)
          if (result.ok) return
          expect(result.error).toContain(key)
          endsInAdvice(result.error)
        })
      }
    }
  }

  test('a url field inside an array is walked', () => {
    const spec = { block: 'note', title: 'x', rows: [{ href: '/ok' }, { href: '//h' }] }
    const result = catalog.validate(spec)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('rows[1].href')
  })

  test('allowed urls pass at any depth: https, mailto, tel, same-origin paths and anchors', () => {
    for (const url of ['https://example.com/a', 'mailto:a@b.c', 'tel:+49', '/a/b', 'a/b', '#f']) {
      expect(catalog.validate(at(5, 'href', url)).ok).toBe(true)
    }
  })

  test('the key match is case-insensitive', () => {
    expect(catalog.validate(at(1, 'HREF', '//h')).ok).toBe(false)
  })
})

describe('validate: limits (P5)', () => {
  test('a payload over the default 32 KiB is refused', () => {
    const result = catalog.validate({ block: 'note', title: 'x'.repeat(32 * 1024) })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('32768')
    endsInAdvice(result.error)
  })

  test('a payload over the block’s own limits.maxBytes is refused', () => {
    expect(catalog.validate({ block: 'small', title: 'x'.repeat(20) }).ok).toBe(true)
    const result = catalog.validate({ block: 'small', title: 'x'.repeat(80) })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('over its limit of 64')
  })

  test('nesting past maxDepth is refused; the spec itself is depth 1', () => {
    expect(catalog.validate(at(6, 'title', 'x')).ok).toBe(true)
    const result = catalog.validate(at(7, 'title', 'x'))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('deeper than its limit of 6')
    expect(catalog.validate({ block: 'small', title: 'x', a: { b: { c: 1 } } }).ok).toBe(false)
  })

  test('a JSON text is measured and parsed like the object', () => {
    expect(catalog.validate(JSON.stringify({ block: 'note', title: 'x' }))).toEqual({
      ok: true,
      block: { name: 'note', props: { title: 'x' } },
    })
    expect(catalog.validate(JSON.stringify(at(1, 'src', 'javascript:x'))).ok).toBe(false)
  })
})

describe('validate: resolving and schema errors', () => {
  test('resolves the block and strips the block field from the props', () => {
    expect(catalog.validate({ block: 'note', title: 'x' })).toEqual({
      ok: true,
      block: { name: 'note', props: { title: 'x' } },
    })
  })

  test('every refusal is model-readable and ends in advice', () => {
    const cases: unknown[] = [
      'not json',
      42,
      { title: 'x' },
      { block: 'chart' },
      { block: 'note', title: 3 },
      { block: 'note', a: 1n },
    ]
    for (const spec of cases) {
      const result = catalog.validate(spec)
      expect(result.ok).toBe(false)
      if (!result.ok) endsInAdvice(result.error)
    }
    const unknown = catalog.validate({ block: 'chart' })
    if (!unknown.ok) expect(unknown.error).toContain('note, small')
    const schema = catalog.validate({ block: 'note', title: 3 })
    if (!schema.ok)
      expect(schema.error).toStartWith('Block "note" does not match its props: title:')
  })

  test('an asynchronous schema is refused, never awaited', () => {
    const lazy = defineBlock({
      name: 'lazy',
      description: 'Async.',
      props: z.object({ title: z.string() }).refine(async () => true),
      sample: [{ title: 'x' }],
      render: () => null,
    })
    const result = defineCatalog([lazy]).validate({ block: 'lazy', title: 'x' })
    expect(result.ok).toBe(false)
  })
})

describe('defineBlock and defineCatalog', () => {
  test('limits may only tighten the default', () => {
    expect(() =>
      defineBlock({ ...note, name: 'big', limits: { maxBytes: 64 * 1024, maxDepth: 6 } }),
    ).toThrow('only tighten')
    expect(() =>
      defineBlock({ ...note, name: 'deep', limits: { maxBytes: 1024, maxDepth: 9 } }),
    ).toThrow()
  })

  test('a block needs a kebab-case name and a sample; a catalog needs unique names', () => {
    expect(() => defineBlock({ ...note, name: 'Stat Card' })).toThrow('kebab-case')
    expect(() => defineBlock({ ...note, sample: [] })).toThrow('sample')
    expect(() => defineCatalog([note, note])).toThrow('two blocks')
  })

  test('blocks expose name, description, props and sample', () => {
    const [first] = catalog.blocks
    expect(first?.name).toBe('note')
    expect(first?.description).toBe('A free-form note.')
    expect(first?.props).toBe(note.props)
    expect(first?.sample).toEqual([{ title: 'Hello' }])
  })
})
