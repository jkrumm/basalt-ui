import { describe, expect, test } from 'bun:test'
import type { Element, ElementContent, Properties, Root } from 'hast'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import { createSanitizeSchema } from './sanitize'
import type { SanitizeAdditions } from './sanitize'

// Every assertion runs the REAL sanitizer: the guarantee is about what hast-util-sanitize does with
// the schema, not about the schema's shape.
type Schema = ReturnType<typeof createSanitizeSchema>
const runSanitize = rehypeSanitize as unknown as (schema: Schema) => (tree: Root) => Root

function el(tagName: string, properties: Properties, children: ElementContent[] = []): Element {
  return { type: 'element', tagName, properties, children }
}

function sanitizeTree(tree: Element, additions?: SanitizeAdditions): ElementContent | undefined {
  const out = runSanitize(createSanitizeSchema(additions))({ type: 'root', children: [tree] })
  return out.children[0] as ElementContent | undefined
}

function sanitized(
  tree: Element,
  additions?: SanitizeAdditions,
  path: readonly number[] = [],
): Properties | undefined {
  let node = sanitizeTree(tree, additions)
  for (const index of path) node = node?.type === 'element' ? node.children[index] : undefined
  return node?.type === 'element' ? node.properties : undefined
}

const dataDiv = () => el('div', { dataFoo: 'bar', dataBlocked: 'x' })
const notAllowed = () => el('blockquote', { dataCallout: '', dataNotAllowed: 'x' })

describe('createSanitizeSchema — the shallow-spread trap', () => {
  test('adding one attribute to one tag leaves every other allowance intact', () => {
    const schema = createSanitizeSchema({ allowAttrs: { 'hermes-badge': ['tone'] } })

    expect(schema.attributes['code']).toEqual(defaultSchema.attributes?.['code'])
    expect(schema.attributes['*']).toEqual(defaultSchema.attributes?.['*'])
    expect(schema.attributes['hermes-badge']).toEqual(['tone'])
  })

  test('links keep href and code fences keep their language class after an addition', () => {
    const additions = { allowAttrs: { a: ['rel'] } }

    expect(sanitized(el('a', { href: '/x', rel: ['me'] }), additions)).toEqual({
      href: '/x',
      rel: ['me'],
    })
    expect(sanitized(el('code', { className: ['language-ts'] }), additions)).toEqual({
      className: ['language-ts'],
    })
  })

  test('a key present in both keeps base entries AND gains the addition', () => {
    const entries = createSanitizeSchema({ allowAttrs: { a: ['data-extra'] } }).attributes['a']

    expect(entries).toContain('href')
    expect(entries).toContain('dataExtra')
  })
})

describe('createSanitizeSchema — tagNames', () => {
  test('keeps every default tag and appends additions once', () => {
    const { tagNames } = createSanitizeSchema({
      allowTags: ['hermes-badge', 'code', 'hermes-badge'],
    })

    expect(tagNames.slice(0, defaultSchema.tagNames?.length)).toEqual(defaultSchema.tagNames ?? [])
    expect(tagNames.filter((name) => name === 'hermes-badge')).toHaveLength(1)
    expect(tagNames.filter((name) => name === 'code')).toHaveLength(1)
  })

  test('an unlisted tag is unwrapped, an allowed one survives', () => {
    expect(sanitizeTree(el('hermes-badge', {}))).toBeUndefined()
    expect(sanitizeTree(el('hermes-badge', {}), { allowTags: ['hermes-badge'] })).toMatchObject({
      tagName: 'hermes-badge',
    })
  })

  test('allowing a tag does not allow its attributes', () => {
    expect(
      sanitized(el('hermes-badge', { tone: 'warn' }), { allowTags: ['hermes-badge'] }),
    ).toEqual({})
    expect(
      sanitized(el('hermes-badge', { tone: 'warn' }), {
        allowTags: ['hermes-badge'],
        allowAttrs: { 'hermes-badge': ['tone'] },
      }),
    ).toEqual({ tone: 'warn' })
  })
})

describe('createSanitizeSchema — untouched fields', () => {
  test('strip, clobber, ancestors, required pass through from the default', () => {
    const schema = createSanitizeSchema({ allowTags: ['x'], allowAttrs: { x: ['y'] } })

    expect(schema.strip).toEqual(defaultSchema.strip)
    expect(schema.clobber).toEqual(defaultSchema.clobber)
    expect(schema.ancestors).toEqual(defaultSchema.ancestors)
    expect(schema.required).toEqual(defaultSchema.required)
  })

  test('removal is not expressible on the additions type', () => {
    // @ts-expect-error — `strip` is not an addition
    const removal: SanitizeAdditions = { strip: [] }

    expect(createSanitizeSchema(removal).strip).toEqual(['script'])
  })

  test('script is stripped with its content, not merely unwrapped', () => {
    const tree = el('div', {}, [el('script', {}, [{ type: 'text', value: 'alert(1)' }])])

    expect(JSON.stringify(sanitizeTree(tree))).not.toContain('alert')
  })

  test('event handlers and style are dropped', () => {
    expect(sanitized(el('p', { onClick: 'x()', onError: 'x()', style: 'color:red' }))).toEqual({})
  })

  test('javascript: hrefs are dropped by the real sanitizer', () => {
    expect(sanitized(el('a', { href: 'javascript:alert(1)' }))).toEqual({})
  })

  test('the defaultSchema object is never mutated', () => {
    const before = JSON.stringify(defaultSchema, (_, v: unknown) =>
      v instanceof RegExp ? String(v) : v,
    )
    createSanitizeSchema({ allowTags: ['x'], allowAttrs: { a: ['data-x'], code: ['class'] } })
    const after = JSON.stringify(defaultSchema, (_, v: unknown) =>
      v instanceof RegExp ? String(v) : v,
    )

    expect(after).toBe(before)
  })

  test('is deterministic across calls', () => {
    const additions = { allowTags: ['x'], allowAttrs: { x: ['a', 'b'] } }

    expect(JSON.stringify(createSanitizeSchema(additions))).toBe(
      JSON.stringify(createSanitizeSchema(additions)),
    )
  })
})

describe('createSanitizeSchema — clobber: exactly one layer', () => {
  test('the sanitizer does not add a second prefix', () => {
    expect(createSanitizeSchema().clobberPrefix).toBe('')
    expect(sanitized(el('h2', { id: 'user-content-fn-1' }))).toEqual({ id: 'user-content-fn-1' })
  })

  test('a caller cannot re-arm or alter it through additions', () => {
    const additions = { clobberPrefix: 'x-' } as unknown as SanitizeAdditions

    expect(createSanitizeSchema(additions).clobberPrefix).toBe('')
  })

  test('footnote link and back-link survive with matching ids and hrefs', () => {
    const ref = el('a', {
      id: 'user-content-fnref-1',
      href: '#user-content-fn-1',
      dataFootnoteRef: true,
    })

    expect(sanitized(ref)).toEqual({
      id: 'user-content-fnref-1',
      href: '#user-content-fn-1',
      dataFootnoteRef: true,
    })
  })
})

describe('createSanitizeSchema — wildcard fallback survives a tag addition', () => {
  test('naming a property on a tag keeps what the wildcard granted for other properties', () => {
    const additions = { allowAttrs: { p: ['data-x'] } }

    expect(sanitized(el('p', { dataX: '1', title: 't', id: 'a', lang: 'en' }), additions)).toEqual({
      dataX: '1',
      title: 't',
      id: 'a',
      lang: 'en',
    })
  })

  test('re-naming a wildcard property on a tag does not narrow it', () => {
    expect(sanitized(el('p', { title: 't' }), { allowAttrs: { p: ['title'] } })).toEqual({
      title: 't',
    })
  })

  test('a name the base tag already carried as a tuple is widened to allow-any', () => {
    const narrow = el('code', { className: ['language-ts', 'hljs-keyword'] })

    expect(sanitized(narrow)).toEqual({ className: ['language-ts'] })
    expect(sanitized(narrow, { allowAttrs: { code: ['class'] } })).toEqual({
      className: ['language-ts', 'hljs-keyword'],
    })
  })

  test('the merged list never carries two entries for one property name', () => {
    const entries = createSanitizeSchema({ allowAttrs: { a: ['href', 'href', 'class'] } })
      .attributes['a']
    const names = (entries ?? []).map((entry) => (typeof entry === 'string' ? entry : entry[0]))

    expect(new Set(names).size).toBe(names.length)
  })

  test('a __proto__ tag key defines an own property and pollutes nothing', () => {
    const allowAttrs = JSON.parse('{"__proto__": ["data-x"]}') as Record<string, string[]>
    createSanitizeSchema({ allowAttrs })

    expect(({} as Record<string, unknown>)['dataX']).toBeUndefined()
  })
})

describe('createSanitizeSchema — dashed to hast property names', () => {
  test.each([
    ['data-callout-kind', 'dataCalloutKind'],
    ['aria-label', 'ariaLabel'],
    ['class', 'className'],
    ['for', 'htmlFor'],
    ['DATA-Mixed-Case', 'dataMixedCase'],
    ['tone', 'tone'],
  ])('%s becomes %s', (html, hast) => {
    expect(createSanitizeSchema({ allowAttrs: { x: [html] } }).attributes['x']).toEqual([hast])
  })

  test('an added data attribute is honoured by the real sanitizer', () => {
    expect(sanitized(dataDiv())).toEqual({})
    expect(sanitized(dataDiv(), { allowAttrs: { div: ['data-foo'] } })).toEqual({ dataFoo: 'bar' })
  })
})

describe('createSanitizeSchema — obsidian fixtures survive the base policy', () => {
  test('blockquote callout attributes', () => {
    const props = {
      dataCallout: '',
      dataCalloutKind: 'warning',
      dataCalloutTitle: 'Heads up',
      dataCalloutFold: '-',
    }

    expect(sanitized(el('blockquote', props))).toEqual(props)
  })

  test('wikilink anchor', () => {
    expect(sanitized(el('a', { href: '/note', dataWikilink: 'note' }))).toEqual({
      href: '/note',
      dataWikilink: 'note',
    })
  })

  test('image width and height', () => {
    expect(sanitized(el('img', { src: '/a.png', width: 40, height: 20 }))).toEqual({
      src: '/a.png',
      width: 40,
      height: 20,
    })
  })

  test('task-list checkbox keeps checked, type and disabled', () => {
    expect(sanitized(el('input', { type: 'checkbox', checked: true, disabled: true }))).toEqual({
      type: 'checkbox',
      checked: true,
      disabled: true,
    })
  })

  test('a non-checkbox input has its type forced back to a disabled checkbox', () => {
    expect(sanitized(el('input', { type: 'text' }))).toEqual({ type: 'checkbox', disabled: true })
  })

  test('data-not-allowed is dropped unless a caller passes allowAttrs', () => {
    expect(sanitized(notAllowed())).toEqual({ dataCallout: '' })
    expect(sanitized(notAllowed(), { allowAttrs: { blockquote: ['data-not-allowed'] } })).toEqual({
      dataCallout: '',
      dataNotAllowed: 'x',
    })
  })

  test('the base never weakens: every default tag and attribute entry is still present', () => {
    const schema = createSanitizeSchema()

    for (const tag of defaultSchema.tagNames ?? []) expect(schema.tagNames).toContain(tag)
    for (const [tag, entries] of Object.entries(defaultSchema.attributes ?? {})) {
      const names = (schema.attributes[tag] ?? []).map((e) => (typeof e === 'string' ? e : e[0]))
      for (const entry of entries) {
        const name = typeof entry === 'string' ? entry : entry[0]
        const widened = ['a', 'blockquote', 'img', 'input'].includes(tag)
        expect(names.includes(name) || widened).toBe(true)
      }
    }
  })
})

describe('createSanitizeSchema — protocols', () => {
  test('tel: hrefs survive (the URL policy allows them) and javascript: still does not', () => {
    expect(sanitized(el('a', { href: 'tel:+1' }))).toEqual({ href: 'tel:+1' })
    expect(sanitized(el('a', { href: 'javascript:x' }))).toEqual({})
  })

  test('the default protocol lists are kept', () => {
    expect(createSanitizeSchema().protocols?.['href']).toEqual([
      ...(defaultSchema.protocols?.['href'] ?? []),
      'tel',
    ])
    expect((createSanitizeSchema().protocols as Record<string, unknown>)['src']).toEqual(
      defaultSchema.protocols?.['src'],
    )
  })
})

describe('createSanitizeSchema — forbidden additions', () => {
  test('on* and style cannot be added to any tag, in either spelling', () => {
    const tree = el('a', {
      href: '/x',
      onClick: 'x()',
      onerror: 'x()',
      style: 'color:red',
      title: 't',
    })
    const out = sanitized(tree, {
      allowAttrs: { a: ['onclick', 'onClick', 'onerror', 'style', 'title'] },
    })

    expect(out).toEqual({ href: '/x', title: 't' })
  })
})
