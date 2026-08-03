import { describe, expect, test } from 'bun:test'
import type { Element, ElementContent, Properties, Root } from 'hast'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import type { SanitizeSchema, SanitizeSchemaExtension, SanitizeSchemaInput } from './sanitize'
import { BASALT_SANITIZE_SCHEMA, mergeSanitizeSchema } from './sanitize'

// ── Running the REAL sanitizer ────────────────────────────────────────────────────────────────
//
// The merge's promise ("an extension can add but never remove") is a claim about what
// hast-util-sanitize DOES with the merged schema, not about the schema's shape — three of its
// lookup rules turn a bigger schema into a weaker one (see sanitize.ts's module JSDoc). Structural
// assertions cannot see any of that, so every guarantee below is also asserted through an actual
// sanitize() round-trip on the installed peer.

/**
 * `rehype-sanitize`'s default export is `(schema) => (tree) => tree`, and that transform IS
 * `hast-util-sanitize`'s `sanitize()`. The one bridge: upstream's `Schema` declares its arrays
 * mutable where `SanitizeSchema` mirrors them `readonly`, so the schema argument is retyped here
 * (test-only — shipped code hands the peer its own `defaultSchema`-derived object).
 */
const runSanitize = rehypeSanitize as unknown as (
  schema: SanitizeSchemaInput,
) => (tree: Root) => Root

function el(tagName: string, properties: Properties, children: ElementContent[] = []): Element {
  return { type: 'element', tagName, properties, children }
}

/**
 * Sanitizes `tree` with the REAL sanitizer and returns the surviving properties of the node reached
 * by walking `path` (child indices) down from it — `undefined` if the element did not survive.
 */
function sanitized(
  schema: SanitizeSchemaInput,
  tree: Element,
  path: readonly number[] = [],
): Properties | undefined {
  const root: Root = { type: 'root', children: [tree] }
  let node: ElementContent | undefined = runSanitize(schema)(root).children[0] as
    | ElementContent
    | undefined
  for (const index of path) {
    node = node?.type === 'element' ? node.children[index] : undefined
  }
  return node?.type === 'element' ? node.properties : undefined
}

/** `td` only survives inside a `table` (`defaultSchema.ancestors`), so cells are built nested. */
function tableCell(properties: Properties): Element {
  return el('table', {}, [el('tr', {}, [el('td', properties)])])
}
const CELL_PATH = [0, 0] as const

// A representative stand-in for rehype-sanitize's defaultSchema — small enough to assert on
// exhaustively, but carrying one of every field shape the merge has to preserve.
function baseSchema(): SanitizeSchema {
  return {
    allowComments: false,
    allowDoctypes: false,
    ancestors: { td: ['table'], tr: ['table'] },
    attributes: {
      a: ['href', 'ariaLabel'],
      code: [['className', /^language-./]],
      '*': ['id', 'title'],
    },
    clobber: ['id', 'name'],
    clobberPrefix: 'user-content-',
    protocols: { href: ['http', 'https'], src: ['https'] },
    required: { input: { disabled: true, type: 'checkbox' } },
    strip: ['script'],
    tagNames: ['a', 'code', 'p'],
  }
}

describe('mergeSanitizeSchema — the shallow-spread trap', () => {
  test('adding one attribute to one tag leaves every other allowance intact', () => {
    const merged = mergeSanitizeSchema(baseSchema(), { attributes: { 'hermes-badge': ['tone'] } })

    // A naive `{...base, ...extension}` would set attributes to `{'hermes-badge': ['tone']}` and
    // destroy all three entries below — links would lose `href`, fences would lose their
    // `language-*` class, and the `'*'` fallback would vanish. That is the upstream default.
    expect(merged.attributes?.['a']).toEqual(['href', 'ariaLabel'])
    expect(merged.attributes?.['code']).toEqual([['className', /^language-./]])
    expect(merged.attributes?.['*']).toEqual(['id', 'title'])
    expect(merged.attributes?.['hermes-badge']).toEqual(['tone'])
  })

  test('a key present in both keeps base entries AND gains the extension entries', () => {
    const merged = mergeSanitizeSchema(baseSchema(), { attributes: { a: ['dataFootnoteRef'] } })

    expect(merged.attributes?.['a']).toEqual(['href', 'ariaLabel', 'dataFootnoteRef'])
  })
})

describe('mergeSanitizeSchema — tagNames', () => {
  test('concatenates, de-duplicates, and preserves base order', () => {
    const merged = mergeSanitizeSchema(baseSchema(), {
      tagNames: ['hermes-badge', 'code', 'hermes-mark', 'hermes-badge'],
    })

    expect(merged.tagNames).toEqual(['a', 'code', 'p', 'hermes-badge', 'hermes-mark'])
  })

  test('an extension can never remove a base tag', () => {
    const merged = mergeSanitizeSchema(baseSchema(), { tagNames: ['p'] })

    expect(merged.tagNames).toEqual(['a', 'code', 'p'])
  })
})

describe('mergeSanitizeSchema — protocols', () => {
  test('merges per key rather than replacing the map', () => {
    const merged = mergeSanitizeSchema(baseSchema(), { protocols: { href: ['mailto'] } })

    expect(merged.protocols?.['href']).toEqual(['http', 'https', 'mailto'])
    expect(merged.protocols?.['src']).toEqual(['https'])
  })

  test('a new protocol key is added without touching the existing ones', () => {
    const merged = mergeSanitizeSchema(baseSchema(), { protocols: { cite: ['https'] } })

    expect(Object.keys(merged.protocols ?? {})).toEqual(['href', 'src', 'cite'])
  })

  test('an added protocol really is honoured by the sanitizer', () => {
    const link = () => el('a', { href: 'mailto:x@example.com' })

    // Before: `mailto:` is not in `href`'s protocol list, so the whole property is dropped.
    expect(sanitized(mergeSanitizeSchema(baseSchema()), link())).toEqual({})
    expect(
      sanitized(mergeSanitizeSchema(baseSchema(), { protocols: { href: ['mailto'] } }), link()),
    ).toEqual({ href: 'mailto:x@example.com' })
  })
})

describe('mergeSanitizeSchema — untouched base keys', () => {
  test('an extension mentioning none of them leaves every other field intact', () => {
    const base = baseSchema()
    const merged = mergeSanitizeSchema(base, { tagNames: ['hermes-badge'] })

    // Dropping any of these silently breaks sanitization — `strip` most of all.
    expect(merged.strip).toEqual(['script'])
    expect(merged.clobber).toEqual(['id', 'name'])
    expect(merged.ancestors).toEqual({ td: ['table'], tr: ['table'] })
    expect(merged.required).toEqual({ input: { disabled: true, type: 'checkbox' } })
    expect(merged.allowComments).toBe(false)
    expect(merged.allowDoctypes).toBe(false)
  })

  test('the fields are not expressible on an extension at all', () => {
    // Compile-time half of the guarantee: `strip` is not a member of SanitizeSchemaExtension, so
    // "clear the strip list" cannot even be written. @ts-expect-error fails the build if it ever is.
    // @ts-expect-error — removal must stay unrepresentable
    const removal: SanitizeSchemaExtension = { strip: [] }

    expect(mergeSanitizeSchema(baseSchema(), removal).strip).toEqual(['script'])
  })
})

describe('mergeSanitizeSchema — nullable base fields', () => {
  // hast-util-sanitize types every `Schema` field as `T | null | undefined`, which is why the
  // `base` parameter takes `SanitizeSchemaInput`. The null arms must not survive into the output:
  // `SanitizeSchema` promises non-null, and `./markdown` hands the result straight to the peer.
  test('a null-valued field is dropped rather than passed through as null', () => {
    const merged = mergeSanitizeSchema(
      { tagNames: ['a'], attributes: null, strip: null, clobberPrefix: null },
      { tagNames: ['hermes-badge'] },
    )

    expect(merged.tagNames).toEqual(['a', 'hermes-badge'])
    expect('attributes' in merged).toBe(false)
    expect('strip' in merged).toBe(false)
    expect('clobberPrefix' in merged).toBe(false)
  })

  test('a null protocols VALUE is dropped with its key', () => {
    const merged = mergeSanitizeSchema({ protocols: { href: ['https'], src: null } })

    expect(merged.protocols).toEqual({ href: ['https'] })
  })

  test('a false boolean field survives (it is not "absent")', () => {
    const merged = mergeSanitizeSchema({ allowComments: false, allowDoctypes: false })

    expect(merged.allowComments).toBe(false)
    expect(merged.allowDoctypes).toBe(false)
  })

  test('the real defaultSchema is a valid base with no cast at the call site', () => {
    // Compile-time assertion as much as a runtime one: if `SanitizeSchemaInput` ever loses the
    // null arms, this line stops compiling and `./markdown` needs an `as` cast again.
    const merged = mergeSanitizeSchema(defaultSchema, { tagNames: ['hermes-badge'] })

    expect(merged.tagNames).toContain('hermes-badge')
    expect(merged.tagNames).toContain('code')
  })
})

describe('mergeSanitizeSchema — clobberPrefix', () => {
  test('is replaced when given', () => {
    expect(mergeSanitizeSchema(baseSchema(), { clobberPrefix: 'basalt-' }).clobberPrefix).toBe(
      'basalt-',
    )
  })

  test('is preserved when omitted', () => {
    expect(mergeSanitizeSchema(baseSchema(), { tagNames: ['x'] }).clobberPrefix).toBe(
      'user-content-',
    )
  })

  test('last extension wins across several', () => {
    const merged = mergeSanitizeSchema(
      baseSchema(),
      { clobberPrefix: 'first-' },
      { tagNames: ['x'] },
      { clobberPrefix: 'last-' },
    )

    expect(merged.clobberPrefix).toBe('last-')
  })
})

describe('mergeSanitizeSchema — an empty clobberPrefix is a removal, not a value', () => {
  // hast-util-sanitize gates prefixing on TRUTHINESS (`schema.clobber && schema.clobberPrefix &&
  // …`), so `''` does not prefix with nothing — it switches clobber protection off and lets
  // `<a id="body">` through, which is exactly the DOM-clobbering vector `user-content-` closes.
  const clobberingAnchor = () => el('a', { id: 'body', href: '#x' })

  test('the vector is real — a base schema with an empty prefix emits id unprefixed', () => {
    const disarmed: SanitizeSchema = { ...baseSchema(), clobberPrefix: '' }

    expect(sanitized(disarmed, clobberingAnchor())).toEqual({ id: 'body', href: '#x' })
  })

  test('an extension supplying an empty prefix does NOT weaken clobbering', () => {
    const merged = mergeSanitizeSchema(baseSchema(), { clobberPrefix: '' })

    expect(merged.clobberPrefix).toBe('user-content-')
    expect(sanitized(merged, clobberingAnchor())).toEqual({
      id: 'user-content-body',
      href: '#x',
    })
  })

  test('it is ignored over the real defaultSchema too', () => {
    const merged = mergeSanitizeSchema(defaultSchema, BASALT_SANITIZE_SCHEMA, {
      clobberPrefix: '',
    })

    expect(sanitized(merged, clobberingAnchor())).toEqual({
      id: 'user-content-body',
      href: '#x',
    })
  })

  test('an empty prefix cannot erase a real one supplied by an earlier extension', () => {
    const merged = mergeSanitizeSchema(
      baseSchema(),
      { clobberPrefix: 'basalt-' },
      { clobberPrefix: '' },
    )

    expect(merged.clobberPrefix).toBe('basalt-')
  })

  test('warns in dev when it drops one', () => {
    const warnings: string[] = []
    const original = console.warn
    console.warn = (...args: unknown[]) => void warnings.push(String(args[0]))
    try {
      mergeSanitizeSchema(baseSchema(), { clobberPrefix: '' })
    } finally {
      console.warn = original
    }

    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('clobberPrefix')
  })

  test('a non-empty prefix still applies through the real sanitizer', () => {
    const merged = mergeSanitizeSchema(baseSchema(), { clobberPrefix: 'basalt-' })

    expect(sanitized(merged, clobberingAnchor())).toEqual({ id: 'basalt-body', href: '#x' })
  })
})

describe('mergeSanitizeSchema — clobberPrefix: every falsy spelling is refused, not just ""', () => {
  // hast-util-sanitize's gate is `schema.clobber && schema.clobberPrefix && …` — a TRUTHINESS
  // check, not `=== ''`. `SanitizeSchemaExtension` declares `clobberPrefix?: string`, but that is a
  // compile-time claim a plain-JS caller (no type checker in the loop) or an `as` cast can defeat,
  // so `null`, `0`, `false`, and `NaN` are exactly as disarming as `''` once the type boundary is
  // gone — each reads falsy to the same upstream check and lets `<a id="body">` back out
  // unprefixed. A non-string TRUTHY value must be refused too: upstream treats a non-string
  // `clobberPrefix` as a plain string-concat operand (`prefix + value`) and NaN aside, this is the
  // family the runtime `typeof` guard actually has to reject.
  const clobberingAnchor = () => el('a', { id: 'body', href: '#x' })

  const disarmingFalsy: readonly [string, unknown][] = [
    ['null', null],
    ['0', 0],
    ['false', false],
    ['NaN', Number.NaN],
    ['empty string', ''],
  ]
  const nonStringTruthy: readonly [string, unknown][] = [
    ['number', 42],
    ['array', ['x']],
    ['object', { toString: () => 'x-' }],
  ]

  for (const [label, value] of [...disarmingFalsy, ...nonStringTruthy]) {
    test(`clobberPrefix: ${label} does not weaken clobbering`, () => {
      // Test-only: exercising the runtime boundary requires a value the static type forbids —
      // the same idiom as `runSanitize`'s documented cast above.
      const extension = { clobberPrefix: value } as unknown as SanitizeSchemaExtension
      const merged = mergeSanitizeSchema(baseSchema(), extension)

      expect(merged.clobberPrefix).toBe('user-content-')
      expect(sanitized(merged, clobberingAnchor())).toEqual({
        id: 'user-content-body',
        href: '#x',
      })
    })
  }

  test('a genuine non-empty string is still adopted (the guard is not overzealous)', () => {
    const merged = mergeSanitizeSchema(baseSchema(), { clobberPrefix: 'basalt-' })

    expect(merged.clobberPrefix).toBe('basalt-')
    expect(sanitized(merged, clobberingAnchor())).toEqual({ id: 'basalt-body', href: '#x' })
  })
})

describe('mergeSanitizeSchema — a tag-specific addition keeps the wildcard fallback', () => {
  // hast-util-sanitize consults `attributes['*']` ONLY when the tag-specific lookup returns
  // null/undefined. For an ARRAY-valued property a matching tag-specific entry returns `[]`, which
  // is neither — so naming a property on a tag deletes whatever `'*'` granted that tag for it.
  test('introducing a tag key does not strip what the wildcard granted (real defaultSchema)', () => {
    const merged = mergeSanitizeSchema(defaultSchema, {
      attributes: { td: [['headers', 'only-this']] },
    })
    const cell = tableCell({ headers: ['h1'], title: 't' })

    // `headers` and `title` reach `td` only via defaultSchema's `'*'` entry.
    expect(sanitized(defaultSchema, cell, CELL_PATH)).toEqual({ headers: ['h1'], title: 't' })
    expect(sanitized(merged, cell, CELL_PATH)).toEqual({ headers: ['h1'], title: 't' })
  })

  test('the same holds for a tag the base already has an entry for', () => {
    const merged = mergeSanitizeSchema(defaultSchema, {
      attributes: { span: [['headers', 'only-this']] },
    })

    expect(sanitized(merged, el('span', { headers: ['h1', 'h2'] }))).toEqual({
      headers: ['h1', 'h2'],
    })
  })

  test('an extension cannot narrow a wildcard allowance by naming it on one tag', () => {
    const merged = mergeSanitizeSchema(baseSchema(), {
      attributes: { code: [['title', 'only-this']] },
    })

    // `title` came from `'*'` as a bare string (allow any value); the union keeps it that way.
    expect(merged.attributes?.['code']).toEqual([['className', /^language-./], 'title'])
    expect(sanitized(merged, el('code', { title: 'anything' }))).toEqual({ title: 'anything' })
  })

  test("the rescue follows upstream's `data*` fallback, not just exact names", () => {
    const base: SanitizeSchema = {
      ...baseSchema(),
      attributes: { ...baseSchema().attributes, '*': ['id', 'title', 'data*'] },
    }
    const merged = mergeSanitizeSchema(base, { attributes: { code: [['dataFoo', 'only-this']] } })

    // `dataFoo` was allowed via the `'data*'` catch-all; naming it on `code` must not narrow it.
    expect(sanitized(base, el('code', { dataFoo: ['x'] }))).toEqual({ dataFoo: ['x'] })
    expect(sanitized(merged, el('code', { dataFoo: ['x'] }))).toEqual({ dataFoo: ['x'] })
  })

  test('a name the base tag already carried is left alone (base behaviour preserved)', () => {
    // `code` already narrowed `className` itself, so `'*'` never applied to it — and adding
    // another `className` pattern must not silently pull in a wildcard entry that never applied.
    const base: SanitizeSchema = {
      ...baseSchema(),
      attributes: { ...baseSchema().attributes, '*': ['id', 'title', 'className'] },
    }
    const merged = mergeSanitizeSchema(base, { attributes: { code: [['className', /^hljs-/]] } })

    expect(merged.attributes?.['code']).toEqual([['className', /^language-./, /^hljs-/]])
    expect(sanitized(merged, el('code', { className: ['evil'] }))).toEqual({ className: [] })
  })

  test('a wildcard widened by the SAME extension is visible to its tag additions', () => {
    const merged = mergeSanitizeSchema(baseSchema(), {
      attributes: { 'hermes-badge': [['headers', 'only-this']], '*': ['headers'] },
    })

    expect(merged.attributes?.['hermes-badge']).toEqual(['headers'])
  })
})

describe('mergeSanitizeSchema — widening an already-allowed property takes effect', () => {
  // hast-util-sanitize's `findDefinition` returns the FIRST entry matching a property name, so a
  // second entry for that name is dead code. Merging must union per property name, not concatenate.
  test('a code fence gains an extra className pattern without losing the base one', () => {
    const merged = mergeSanitizeSchema(defaultSchema, {
      attributes: { code: [['className', /^hljs-/]] },
    })

    expect(merged.attributes?.['code']).toEqual([['className', /^language-./, /^hljs-/]])
    expect(sanitized(merged, el('code', { className: ['hljs-keyword'] }))).toEqual({
      className: ['hljs-keyword'],
    })
    expect(sanitized(merged, el('code', { className: ['language-ts'] }))).toEqual({
      className: ['language-ts'],
    })
    // Still an allow-list, not a hole.
    expect(sanitized(merged, el('code', { className: ['evil'] }))).toEqual({ className: [] })
  })

  test('a bare-string addition widens a narrowed property to allow-any', () => {
    const merged = mergeSanitizeSchema(defaultSchema, { attributes: { a: ['className'] } })

    // defaultSchema allows only `className="data-footnote-backref"` on links.
    expect(sanitized(defaultSchema, el('a', { className: ['anything'] }))).toEqual({
      className: [],
    })
    expect(sanitized(merged, el('a', { className: ['anything'] }))).toEqual({
      className: ['anything'],
    })
  })

  test('a tuple addition widens a value allow-list', () => {
    const merged = mergeSanitizeSchema(defaultSchema, {
      attributes: { input: [['type', 'checkbox', 'radio']] },
    })

    // defaultSchema pins `input[type]` to `checkbox`; `required` then re-adds the default.
    expect(sanitized(defaultSchema, el('input', { type: 'radio' }))).toEqual({
      disabled: true,
      type: 'checkbox',
    })
    expect(sanitized(merged, el('input', { type: 'radio' }))).toEqual({
      disabled: true,
      type: 'radio',
    })
  })

  test('the merged list never carries two entries for one property name', () => {
    const merged = mergeSanitizeSchema(
      defaultSchema,
      { attributes: { code: [['className', /^hljs-/]] } },
      { attributes: { code: ['title', ['className', 'literal']] } },
    )
    const names = (merged.attributes?.['code'] ?? []).map((definition) =>
      typeof definition === 'string' ? definition : definition[0],
    )

    expect(names).toEqual([...new Set(names)])
    expect(merged.attributes?.['code']).toEqual([
      ['className', /^language-./, /^hljs-/, 'literal'],
      'title',
    ])
  })

  test('allow-any absorbs a tuple regardless of which side it came from', () => {
    const anyFirst = mergeSanitizeSchema(baseSchema(), {
      attributes: { span: ['rel', ['rel', 'noopener']] },
    })
    const tupleFirst = mergeSanitizeSchema(baseSchema(), {
      attributes: { span: [['rel', 'noopener'], 'rel'] },
    })

    expect(anyFirst.attributes?.['span']).toEqual(['rel'])
    expect(tupleFirst.attributes?.['span']).toEqual(['rel'])
  })

  test('a one-element tuple counts as allow-any (upstream needs length > 1)', () => {
    const merged = mergeSanitizeSchema(baseSchema(), { attributes: { code: [['className']] } })

    expect(merged.attributes?.['code']).toEqual(['className'])
    expect(sanitized(merged, el('code', { className: ['anything'] }))).toEqual({
      className: ['anything'],
    })
  })
})

describe('mergeSanitizeSchema — purity', () => {
  test('mutates neither the base nor the extension', () => {
    const base = baseSchema()
    const extension: SanitizeSchemaExtension = {
      tagNames: ['hermes-badge'],
      attributes: { a: ['target'] },
      protocols: { href: ['mailto'] },
    }
    const baseBefore = structuredClone(base)
    const extensionBefore = structuredClone(extension)

    mergeSanitizeSchema(base, extension)

    expect(base).toEqual(baseBefore)
    expect(extension).toEqual(extensionBefore)
  })

  test('is deterministic across repeated calls', () => {
    const extension: SanitizeSchemaExtension = { tagNames: ['x'], attributes: { a: ['target'] } }

    expect(mergeSanitizeSchema(baseSchema(), extension)).toEqual(
      mergeSanitizeSchema(baseSchema(), extension),
    )
  })
})

describe('mergeSanitizeSchema — property definitions', () => {
  test('a tuple entry containing a RegExp survives the merge intact', () => {
    const merged = mergeSanitizeSchema(baseSchema(), {
      attributes: { span: [['className', /^hljs-/, 'token']] },
    })
    const spanDefs = merged.attributes?.['span']

    expect(spanDefs).toEqual([['className', /^hljs-/, 'token']])
    // The RegExp arrives as a RegExp, not a rebuilt/stringified copy.
    const first = spanDefs?.[0] as readonly unknown[] | undefined
    expect(first?.[1]).toBeInstanceOf(RegExp)
    expect(merged.attributes?.['code']).toEqual([['className', /^language-./]])
  })

  test('structurally different patterns for the same property union into one entry', () => {
    const merged = mergeSanitizeSchema(baseSchema(), {
      attributes: { code: [['className', /^hljs-/]] },
    })

    // Two entries would leave the second one dead — upstream stops at the first name match.
    expect(merged.attributes?.['code']).toEqual([['className', /^language-./, /^hljs-/]])
    expect(sanitized(merged, el('code', { className: ['hljs-keyword'] }))).toEqual({
      className: ['hljs-keyword'],
    })
  })

  test('an equal expression applied twice is not duplicated', () => {
    const definition: readonly [string, RegExp] = ['className', /^hljs-/]
    const extension: SanitizeSchemaExtension = { attributes: { span: [definition] } }

    const merged = mergeSanitizeSchema(baseSchema(), extension, extension)

    expect(merged.attributes?.['span']).toEqual([definition])
  })

  test('expressions de-duplicate structurally, and flags are part of the identity', () => {
    const merged = mergeSanitizeSchema(baseSchema(), {
      attributes: { span: [['className', /^hljs-/, /^hljs-/, /^hljs-/i]] },
    })

    expect(merged.attributes?.['span']).toEqual([['className', /^hljs-/, /^hljs-/i]])
  })

  test('primitive values de-duplicate by value and type', () => {
    const merged = mergeSanitizeSchema(baseSchema(), {
      attributes: { span: [['dataX', 1, '1', 1, true, 'true']] },
    })

    expect(merged.attributes?.['span']).toEqual([['dataX', 1, '1', true, 'true']])
  })
})

describe('mergeSanitizeSchema — composition', () => {
  test('multiple extensions compose left to right', () => {
    const merged = mergeSanitizeSchema(
      baseSchema(),
      { tagNames: ['first'], attributes: { a: ['one'] } },
      { tagNames: ['second'], attributes: { a: ['two'], span: ['three'] } },
    )

    expect(merged.tagNames).toEqual(['a', 'code', 'p', 'first', 'second'])
    expect(merged.attributes?.['a']).toEqual(['href', 'ariaLabel', 'one', 'two'])
    expect(merged.attributes?.['span']).toEqual(['three'])
  })

  test('undefined extensions are skipped', () => {
    const merged = mergeSanitizeSchema(baseSchema(), undefined, { tagNames: ['x'] }, undefined)

    expect(merged.tagNames).toEqual(['a', 'code', 'p', 'x'])
  })

  test('no extensions at all returns the base schema unchanged', () => {
    expect(mergeSanitizeSchema(baseSchema())).toEqual(baseSchema())
  })
})

describe('BASALT_SANITIZE_SCHEMA over the real defaultSchema', () => {
  // The regression that matters most: the composition `./markdown` actually performs, against the
  // installed peer rather than a hand-built stand-in — and with a NON-EMPTY consumer extension, so
  // every guard in the merge is actually exercised.
  const extension: SanitizeSchemaExtension = {
    tagNames: ['hermes-badge', 'hermes-mark'],
    attributes: { 'hermes-badge': ['tone'], code: [['className', /^hljs-/]] },
    protocols: { href: ['mailto'] },
  }
  const merged = () => mergeSanitizeSchema(defaultSchema, BASALT_SANITIZE_SCHEMA, extension)

  test('script is still stripped, not merely unwrapped', () => {
    const root: Root = {
      type: 'root',
      children: [el('script', {}, [{ type: 'text', value: 'alert(1)' }])],
    }

    expect(runSanitize(merged())(root).children).toEqual([])
  })

  test("basalt's own pipeline output still survives the extension", () => {
    const schema = merged()

    // The two allowances basalt's markdown renderer depends on, asserted behaviourally.
    expect(sanitized(schema, el('code', { className: ['language-mermaid'] }))).toEqual({
      className: ['language-mermaid'],
    })
    expect(sanitized(schema, el('a', { href: '/docs' }))).toEqual({ href: '/docs' })
    // …and the wildcard `'*'` fallback, reached from a tag the extension never mentions.
    expect(sanitized(schema, tableCell({ headers: ['h1'] }), CELL_PATH)).toEqual({
      headers: ['h1'],
    })
  })

  test('an event handler and a javascript: URL are still rejected', () => {
    const schema = merged()

    expect(sanitized(schema, el('a', { onClick: 'steal()', href: 'javascript:steal()' }))).toEqual(
      {},
    )
  })

  test("the extension's own additions take effect", () => {
    const schema = merged()

    expect(schema.tagNames).toContain('hermes-badge')
    expect(sanitized(schema, el('hermes-badge', { tone: 'warn' }))).toEqual({ tone: 'warn' })
    expect(sanitized(schema, el('code', { className: ['hljs-keyword'] }))).toEqual({
      className: ['hljs-keyword'],
    })
    expect(sanitized(schema, el('a', { href: 'mailto:x@example.com' }))).toEqual({
      href: 'mailto:x@example.com',
    })
  })

  test('clobber protection survives the extension', () => {
    expect(sanitized(merged(), el('a', { id: 'body', href: '#x' }))).toEqual({
      id: 'user-content-body',
      href: '#x',
    })
  })

  test('basalt adds nothing of its own to the baseline', () => {
    // BASALT_SANITIZE_SCHEMA is deliberately empty — everything basalt emits is already allowed by
    // defaultSchema (see its JSDoc). If this ever fails, the addition needs a written justification.
    expect(BASALT_SANITIZE_SCHEMA).toEqual({})
  })
})
