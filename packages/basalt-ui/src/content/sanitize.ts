/**
 * Sanitize-schema composition for `Markdown` (docs/AGENT-CHAT-SPEC.md §7). Owns three things: the
 * additions-only extension type a consumer hands to `Markdown`'s `sanitizeSchema` prop, basalt's
 * own additions layer, and the additive deep merge that composes both over `rehype-sanitize`'s
 * `defaultSchema`.
 *
 * WHY A DATA EXTENSION, NOT A `(base) => Schema` CALLBACK: a callback can return `{}` and silently
 * disable sanitization, and a "never replace" comment is not enforcement. `SanitizeSchemaExtension`
 * makes removal UNREPRESENTABLE — there is no code path in `mergeSanitizeSchema` that shrinks the
 * base. That, plus `./markdown` appending its sanitize pass AFTER the consumer's `rehypePlugins`,
 * is what keeps the baseline un-defeatable from outside the package.
 *
 * The `Schema` shape is MIRRORED here rather than imported from `hast-util-sanitize`, so the
 * content layer's types never depend on an optional peer. `rehype-sanitize` is dynamically imported
 * by `./markdown`, which composes the effective schema at load time:
 *
 *     mergeSanitizeSchema(defaultSchema, BASALT_SANITIZE_SCHEMA, props.sanitizeSchema)
 *
 * THE TRAP THIS MODULE EXISTS TO AVOID: `hast-util-sanitize` merges a supplied schema with a
 * shallow top-level spread (`{...defaultSchema, ...options}`). Passing an `attributes` object
 * therefore REPLACES every default attribute allowance rather than adding to it — one consumer
 * addition would silently strip `href` from links, `className` from code fences, and the whole
 * `'*'` fallback. Upstream's answer is the third-party `deepmerge` package; basalt owns the small
 * merge below instead of taking the dependency.
 *
 * "ADDITIONS ONLY" IS A STATEMENT ABOUT THE SANITIZER'S BEHAVIOUR, NOT ABOUT THE SCHEMA'S SHAPE.
 * A merge that only ever grows arrays still removes allowances, because of three things
 * `hast-util-sanitize@5` does when it CONSUMES the schema (`lib/index.js`, verified against the
 * installed copy). Each is load-bearing for the code below:
 *
 *  1. `clobberPrefix` is gated on TRUTHINESS — `schema.clobber && schema.clobberPrefix &&
 *     schema.clobber.includes(key)`. ANY falsy prefix (`''`, but equally `null`, `0`, `false`,
 *     `NaN` — whatever an untyped caller or a cast smuggles through) therefore turns clobber
 *     protection OFF entirely and emits `id`/`name`/`ariaLabelledBy`/`ariaDescribedBy` unprefixed,
 *     which is the DOM-clobbering hole `user-content-` exists to close. See `adoptClobberPrefix`.
 *  2. The `'*'` fallback is consulted ONLY when the tag-specific lookup yields `null`/`undefined`.
 *     For an ARRAY-valued property (`className`, `headers`, …) a matching tag-specific entry
 *     returns `[]` — neither — so the fallback is skipped. Introducing a tag-specific entry for a
 *     property the base only allowed via `'*'` therefore DELETES that allowance. See
 *     `rescueWildcardDefinitions`.
 *  3. `findDefinition` returns the FIRST entry whose name matches, so any later entry for the same
 *     property name is dead code (it also treats a `'data*'` entry as the fallback for any
 *     `data`-prefixed key). Concatenating a consumer's entry after the base's is a silent no-op.
 *     See `unionDefinitions`, which collapses to ONE entry per property name.
 */

// ── Schema shape (structural mirror of hast-util-sanitize's `Schema`) ─────────────────────────

/**
 * One entry in an `attributes` allow-list. A bare string allows any value for that property; the
 * tuple form allow-lists specific values (a `RegExp` matches a value, e.g. `['className',
 * /^language-./]`). A ONE-element tuple (`['className']`) also allows any value — upstream only
 * treats an entry as an allow-list when `definition.length > 1`.
 *
 * The `null`/`undefined` arms mirror upstream's `PropertyDefinition` exactly (its rest element is
 * `Exclude<Properties[keyof Properties], Array<any>> | RegExp`, which includes both). They are
 * inert: a sanitized value is always a boolean, number or string, so `allowed === value` can never
 * match one.
 */
export type SanitizePropertyDefinition =
  | string
  | readonly [string, ...ReadonlyArray<boolean | number | string | RegExp | null | undefined>]

/**
 * Structural mirror of `hast-util-sanitize`'s `Schema`, defined here rather than imported so the
 * content layer never depends on an OPTIONAL peer's types. This is the OUTPUT shape: no `null`
 * arms, so nothing downstream has to re-check a field the merge already normalized away.
 */
export type SanitizeSchema = {
  readonly allowComments?: boolean
  readonly allowDoctypes?: boolean
  readonly ancestors?: Readonly<Record<string, readonly string[]>>
  readonly attributes?: Readonly<Record<string, readonly SanitizePropertyDefinition[]>>
  readonly clobber?: readonly string[]
  readonly clobberPrefix?: string
  readonly protocols?: Readonly<Record<string, readonly string[]>>
  readonly required?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  readonly strip?: readonly string[]
  readonly tagNames?: readonly string[]
}
/**
 * INPUT shape for `mergeSanitizeSchema`'s base — `SanitizeSchema` with upstream's `| null |
 * undefined` on every field (and on every `protocols` value), so `rehype-sanitize`'s own
 * `defaultSchema` assigns to it directly with NO cast at the call site.
 *
 * It is deliberately separate from `SanitizeSchema` rather than a widening of it: the null arms
 * belong to what callers may HAND IN, not to what the merge HANDS BACK. `normalizeSchemaInput`
 * drops them, so no `null` ever reaches the exported output type.
 */
export type SanitizeSchemaInput = {
  readonly allowComments?: boolean | null | undefined
  readonly allowDoctypes?: boolean | null | undefined
  readonly ancestors?: Readonly<Record<string, readonly string[]>> | null | undefined
  readonly attributes?:
    | Readonly<Record<string, readonly SanitizePropertyDefinition[]>>
    | null
    | undefined
  readonly clobber?: readonly string[] | null | undefined
  readonly clobberPrefix?: string | null | undefined
  readonly protocols?:
    | Readonly<Record<string, readonly string[] | null | undefined>>
    | null
    | undefined
  readonly required?: Readonly<Record<string, Readonly<Record<string, unknown>>>> | null | undefined
  readonly strip?: readonly string[] | null | undefined
  readonly tagNames?: readonly string[] | null | undefined
}

/**
 * ADDITIONS ONLY — the four fields it is safe to widen from outside the package. Removal is
 * deliberately not expressible: there is no way to shrink `tagNames`, drop an attribute allowance,
 * narrow `protocols`, or clear `strip`/`clobber`/`ancestors`/`required`.
 *
 * `clobberPrefix` is the one replace-valued field. Upstream's actual gate is `schema.clobberPrefix`
 * read for TRUTHINESS (`lib/index.js`), not `=== ''` — so `null`, `0`, `false`, `NaN`, and `''` are
 * ALL disarming values, and only a genuine non-empty string keeps the guard live. TypeScript cannot
 * express "a non-empty string" on a plain data field (and the declared `string` type is a
 * compile-time claim a JS caller or an `as` cast can defeat), so `adoptClobberPrefix` re-checks
 * `typeof` at runtime and treats anything that is not a non-empty string as a disarm attempt —
 * ignored with a dev warning, never applied.
 */
export type SanitizeSchemaExtension = {
  readonly tagNames?: readonly string[]
  readonly attributes?: Readonly<Record<string, readonly SanitizePropertyDefinition[]>>
  readonly protocols?: Readonly<Record<string, readonly string[]>>
  readonly clobberPrefix?: string
}

// ── basalt's own additions layer ──────────────────────────────────────────────────────────────

/**
 * basalt's own element allowances, layered over `rehype-sanitize`'s `defaultSchema`.
 *
 * THIS IS THE ADDITIONS LAYER, NOT THE FULL BASELINE. It is deliberately NOT a materialized
 * `defaultSchema + basalt` schema: `defaultSchema` lives in `rehype-sanitize`, an OPTIONAL peer, so
 * materializing it at module scope would require a static import that hard-requires the peer for
 * every consumer of `basalt-ui/content` — and vendoring a copy would silently drift from upstream's
 * GitHub-grade baseline, which for a security default is worse. The effective schema is composed
 * where the peer is dynamically imported (see the module JSDoc).
 *
 * IT IS EMPTY, AND THAT IS THE HONEST ANSWER — everything basalt's markdown pipeline emits into the
 * hast tree is already permitted by `defaultSchema`, verified entry by entry:
 *  - fenced code — `pre` > `code` with a `language-*` class: `defaultSchema.attributes.code` is
 *    `[['className', /^language-./]]`, which covers `language-mermaid` too. The fence's title comes
 *    from the `code` node's `data.meta`, and `data` is preserved by the sanitizer verbatim.
 *  - headings — plain `h1`..`h6`; the slug `id` and the hover anchor are added by basalt's React
 *    renderers AFTER sanitization, so they never pass through the schema.
 *  - GFM alerts — an ordinary `blockquote` whose first paragraph carries a `[!NOTE]`-style text
 *    marker; `Callout` is chosen in the renderer, again downstream of the hast tree.
 *  - GFM tables / task lists / footnotes / strikethrough — `table`+`align`, `input[type=checkbox]
 *    [disabled]`, `.task-list-item`, `section[data-footnotes]`, `del` are all explicit
 *    `defaultSchema` allowances.
 *  - links/images — `href`/`src` survive the schema and are then narrowed further by
 *    `./url-hardening`'s prefix allowlist.
 *
 * So: do not "fill this in". Every entry added here widens the security baseline for every consumer
 * and must be justified by output basalt actually emits. `style`, event handlers, and new protocols
 * are out of bounds; an app-specific need belongs in that app's `sanitizeSchema` prop.
 */
export const BASALT_SANITIZE_SCHEMA: SanitizeSchemaExtension = {}

// ── Input normalization ───────────────────────────────────────────────────────────────────────

/** The `attributes` key upstream treats as "applies to every element". */
const WILDCARD = '*'

/**
 * Drops the `null`/`undefined` arms `SanitizeSchemaInput` carries so the merge — and everything it
 * returns — works in the non-null `SanitizeSchema` world. A `null` `protocols` VALUE is dropped
 * with its key: upstream reads a missing key and a `null` one identically ("no protocols defined?
 * then everything is fine"), so this is shape-only.
 */
function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

function normalizeSchemaInput(base: SanitizeSchemaInput): SanitizeSchema {
  return {
    ...(isPresent(base.allowComments) && { allowComments: base.allowComments }),
    ...(isPresent(base.allowDoctypes) && { allowDoctypes: base.allowDoctypes }),
    ...(isPresent(base.ancestors) && { ancestors: base.ancestors }),
    ...(isPresent(base.attributes) && { attributes: base.attributes }),
    ...(isPresent(base.clobber) && { clobber: base.clobber }),
    ...(isPresent(base.clobberPrefix) && { clobberPrefix: base.clobberPrefix }),
    ...(isPresent(base.protocols) && { protocols: normalizeProtocols(base.protocols) }),
    ...(isPresent(base.required) && { required: base.required }),
    ...(isPresent(base.strip) && { strip: base.strip }),
    ...(isPresent(base.tagNames) && { tagNames: base.tagNames }),
  }
}

function normalizeProtocols(
  protocols: Readonly<Record<string, readonly string[] | null | undefined>>,
): Readonly<Record<string, readonly string[]>> {
  const out = new Map<string, readonly string[]>()
  for (const [key, values] of Object.entries(protocols)) {
    if (isPresent(values)) out.set(key, values)
  }
  return Object.fromEntries(out)
}

// ── Attribute-definition algebra (mirrors upstream's lookup) ──────────────────────────────────

/** The property an entry governs — a bare string IS the name, a tuple carries it at index 0. */
function definitionName(definition: SanitizePropertyDefinition): string {
  return typeof definition === 'string' ? definition : definition[0]
}

/** Upstream only treats an entry as an allow-list when it is a tuple with `length > 1`. */
function definitionAllowsAnyValue(definition: SanitizePropertyDefinition): boolean {
  return typeof definition === 'string' || definition.length < 2
}

function definitionValues(
  definition: SanitizePropertyDefinition,
): readonly (boolean | number | string | RegExp | null | undefined)[] {
  return typeof definition === 'string' ? [] : definition.slice(1)
}

/**
 * De-duplication key for one allow-list value. Expressions are keyed off `String(expression)`
 * (`/^hljs-/i` → `"/^hljs-/i"`), which encodes both source and flags and — unlike `instanceof` —
 * survives a cross-realm `RegExp`, matching upstream's own duck-typed `'flags' in allowed` test.
 */
function definitionValueKey(value: boolean | number | string | RegExp | null | undefined): string {
  if (typeof value === 'object' && value !== null) return `expression ${String(value)}`
  return `${typeof value} ${String(value)}`
}

function toDefinition(
  name: string,
  values: readonly (boolean | number | string | RegExp | null | undefined)[],
): SanitizePropertyDefinition {
  return values.length === 0 ? name : [name, ...values]
}

/**
 * Collapses a list of entries to AT MOST ONE ENTRY PER PROPERTY NAME, unioning their allow-lists.
 *
 * This is the merge's core, and it exists because upstream's `findDefinition` returns the FIRST
 * entry matching a property name — so a second entry for that same name is dead code, and merging
 * by concatenation would make every consumer addition to an already-mentioned property a silent
 * no-op. Union semantics, in the only direction an additions-only API may move:
 *
 *  - allow-any (a bare string, or a one-element tuple) absorbs everything — union-ing it with a
 *    tuple yields allow-any, never the tuple's narrower list. An extension cannot NARROW.
 *  - two tuples yield one tuple whose values are the concatenation, de-duplicated by
 *    `definitionValueKey` (expressions structurally, primitives by value and type).
 *
 * Order is base-first, by first appearance of each property name, so output is stable.
 */
function unionDefinitions(
  definitions: readonly SanitizePropertyDefinition[],
): readonly SanitizePropertyDefinition[] {
  type Slot = {
    allowAny: boolean
    values: (boolean | number | string | RegExp | null | undefined)[]
    keys: Set<string>
  }
  const order: string[] = []
  const byName = new Map<string, Slot>()

  for (const definition of definitions) {
    const name = definitionName(definition)
    let slot = byName.get(name)
    if (!slot) {
      slot = { allowAny: false, values: [], keys: new Set<string>() }
      byName.set(name, slot)
      order.push(name)
    }
    if (definitionAllowsAnyValue(definition)) {
      slot.allowAny = true
      continue
    }
    for (const value of definitionValues(definition)) {
      const key = definitionValueKey(value)
      if (slot.keys.has(key)) continue
      slot.keys.add(key)
      slot.values.push(value)
    }
  }

  const out: SanitizePropertyDefinition[] = []
  for (const name of order) {
    const slot = byName.get(name)
    if (!slot) continue
    out.push(slot.allowAny ? name : toDefinition(name, slot.values))
  }
  return out
}

/**
 * Upstream's `findDefinition`, mirrored: first exact name match wins, otherwise a `'data*'` entry
 * answers for any `data`-prefixed key. Used to locate what the `'*'` fallback would have granted.
 */
function findFallbackDefinition(
  definitions: readonly SanitizePropertyDefinition[] | undefined,
  key: string,
): SanitizePropertyDefinition | undefined {
  let dataDefault: SanitizePropertyDefinition | undefined
  for (const definition of definitions ?? []) {
    const name = definitionName(definition)
    if (name === key) return definition
    if (name === 'data*') dataDefault = definition
  }
  if (key.length > 4 && key.slice(0, 4).toLowerCase() === 'data') return dataDefault
  return undefined
}

/** Re-points a `'*'` entry (possibly the `'data*'` catch-all) at a concrete property name. */
function renameDefinition(
  definition: SanitizePropertyDefinition,
  name: string,
): SanitizePropertyDefinition {
  if (definitionName(definition) === name) return definition
  return definitionAllowsAnyValue(definition)
    ? name
    : toDefinition(name, definitionValues(definition))
}

/**
 * Materializes the `'*'` allowances an addition would otherwise SHADOW OFF a tag.
 *
 * Upstream consults the `'*'` fallback only when the tag-specific lookup returns `null`/undefined —
 * and for an array-valued property a matching tag-specific entry returns `[]`, which is neither.
 * So the moment an extension names property P on tag T, T stops inheriting `'*'`'s P allowance for
 * array values. Rescuing it here (so the union below carries it) is what keeps a widening from
 * being a removal.
 *
 * Only names the extension INTRODUCES to T are rescued: a name T's own base list already carried
 * was already shadowing `'*'` before the merge, so leaving it alone preserves base behaviour
 * exactly rather than widening it.
 */
function rescueWildcardDefinitions({
  wildcard,
  current,
  additions,
}: {
  readonly wildcard: readonly SanitizePropertyDefinition[] | undefined
  readonly current: readonly SanitizePropertyDefinition[] | undefined
  readonly additions: readonly SanitizePropertyDefinition[]
}): readonly SanitizePropertyDefinition[] {
  if (!wildcard || wildcard.length === 0) return []

  const shadowed = new Set((current ?? []).map(definitionName))
  const rescued: SanitizePropertyDefinition[] = []
  for (const definition of additions) {
    const name = definitionName(definition)
    if (shadowed.has(name)) continue
    shadowed.add(name)
    const fallback = findFallbackDefinition(wildcard, name)
    if (fallback !== undefined) rescued.push(renameDefinition(fallback, name))
  }
  return rescued
}

// ── Additive merge ────────────────────────────────────────────────────────────────────────────

/** Base entries first in their original order, then each addition not already present. */
function concatUniqueStrings(
  base: readonly string[] | undefined,
  additions: readonly string[],
): readonly string[] {
  const out = base ? [...base] : []
  const seen = new Set(out)
  for (const value of additions) {
    if (seen.has(value)) continue
    seen.add(value)
    out.push(value)
  }
  return out
}

/**
 * Merges a record-of-lists PER KEY: a key in both ends up with the base list AND the addition's
 * list concatenated, never the addition's replacing the base's. Built through a `Map` +
 * `Object.fromEntries` so key order stays base-first and a `__proto__` key in an addition defines
 * an own property rather than reaching the `Object.prototype` setter.
 */
function mergeRecordOfLists<T>(
  base: Readonly<Record<string, readonly T[]>> | undefined,
  addition: Readonly<Record<string, readonly T[]>>,
  concat: (base: readonly T[] | undefined, additions: readonly T[]) => readonly T[],
): Readonly<Record<string, readonly T[]>> {
  const merged = new Map<string, readonly T[]>(Object.entries(base ?? {}))
  for (const [key, values] of Object.entries(addition)) {
    merged.set(key, concat(merged.get(key), values))
  }
  return Object.fromEntries(merged)
}

/**
 * Merges `attributes` per tag. Unlike the plain record-of-lists merge this has to model two
 * upstream lookup rules at once — one entry per property name (`unionDefinitions`) and the `'*'`
 * fallback that a tag-specific entry switches off (`rescueWildcardDefinitions`).
 *
 * `'*'` is processed FIRST so a wildcard widened by the same extension object is already visible to
 * the per-tag rescue, making the result independent of the addition's key order.
 */
function mergeAttributes(
  base: Readonly<Record<string, readonly SanitizePropertyDefinition[]>> | undefined,
  addition: Readonly<Record<string, readonly SanitizePropertyDefinition[]>>,
): Readonly<Record<string, readonly SanitizePropertyDefinition[]>> {
  const merged = new Map<string, readonly SanitizePropertyDefinition[]>(Object.entries(base ?? {}))
  const tags = Object.keys(addition)
  const ordered = tags.includes(WILDCARD)
    ? [WILDCARD, ...tags.filter((tag) => tag !== WILDCARD)]
    : tags

  for (const tag of ordered) {
    const additions = addition[tag] ?? []
    const current = merged.get(tag)
    if (tag === WILDCARD) {
      merged.set(tag, unionDefinitions([...(current ?? []), ...additions]))
      continue
    }
    const rescued = rescueWildcardDefinitions({
      wildcard: merged.get(WILDCARD),
      current,
      additions,
    })
    merged.set(tag, unionDefinitions([...(current ?? []), ...rescued, ...additions]))
  }
  return Object.fromEntries(merged)
}

/**
 * Applies an extension's `clobberPrefix`, IGNORING anything that is not a non-empty string.
 *
 * Upstream gates prefixing on `schema.clobber && schema.clobberPrefix && …` — a TRUTHINESS check,
 * not `=== ''`. So `''` is not the only disarming value: `null`, `0`, `false`, and `NaN` all read as
 * falsy too and switch clobber protection off entirely, letting `id`/`name` back out unprefixed.
 * That is the DOM-clobbering vector (`<a id="body">`) the default prefix exists to close, and none
 * of its spellings may be reachable through an additions-only API.
 *
 * `next` is typed `unknown` rather than trusting `SanitizeSchemaExtension`'s declared `string` —
 * the type is a compile-time claim, and this is a runtime security boundary: a plain-JS caller (no
 * type checker in the loop) or an `as` cast can hand this function `null`/`0`/`false`/`NaN`/an
 * object despite the type, so the enforcement has to `typeof`-check rather than assume. Only a
 * genuine non-empty string is adopted; everything else — including non-string truthy values, which
 * upstream would coerce/misuse rather than treat as a prefix — is refused with the existing
 * dev-warn and the previous prefix is kept.
 */
function adoptClobberPrefix(current: string | undefined, next: unknown): string | undefined {
  if (typeof next === 'string' && next !== '') return next
  if (process.env['NODE_ENV'] !== 'production') {
    console.warn(
      '[basalt] mergeSanitizeSchema: ignoring an invalid `clobberPrefix`. hast-util-sanitize gates ' +
        'clobber prefixing on truthiness, so a falsy value (or a non-string) disables it entirely ' +
        'and emits id/name unprefixed — the DOM-clobbering hole "user-content-" exists to close. ' +
        'The previous prefix is kept.',
    )
  }
  return current
}

/**
 * Deep-merges additions into a base schema. Additive ONLY — and "additive" is measured by what the
 * SANITIZER then allows, not by array lengths (see the module JSDoc for the three upstream lookup
 * rules this has to model):
 *
 *  - `tagNames` and `protocols` are concatenated per key, de-duplicated.
 *  - `attributes` are merged per tag into ONE entry per property name whose allow-list is the union
 *    of base and addition — and a tag gaining its first entry for a property keeps whatever `'*'`
 *    granted it, so a widening never shadows the wildcard off.
 *  - `clobberPrefix` is the single replace-valued field (a later extension wins; an omitted one
 *    leaves the previous value intact) — except the empty string, which is ignored.
 *
 * Never removes anything from `base`: keys no extension mentions (`strip`, `clobber`, `ancestors`,
 * `required`, `allowComments`, `allowDoctypes`) pass through untouched.
 *
 * The `base` parameter takes the nullable `SanitizeSchemaInput` so `rehype-sanitize`'s own
 * `defaultSchema` assigns with no cast; the RETURN type stays non-null.
 *
 * Pure and order-stable: no input is mutated, and the output ordering is a deterministic function
 * of the inputs, so snapshots don't churn.
 *
 * @example
 * mergeSanitizeSchema(defaultSchema, BASALT_SANITIZE_SCHEMA, { tagNames: ['hermes-badge'] })
 */
export function mergeSanitizeSchema(
  base: SanitizeSchemaInput,
  ...extensions: readonly (SanitizeSchemaExtension | undefined)[]
): SanitizeSchema {
  const normalized = normalizeSchemaInput(base)
  let tagNames = normalized.tagNames
  let attributes = normalized.attributes
  let protocols = normalized.protocols
  let clobberPrefix = normalized.clobberPrefix

  for (const extension of extensions) {
    if (!extension) continue
    if (extension.tagNames) tagNames = concatUniqueStrings(tagNames, extension.tagNames)
    if (extension.attributes) attributes = mergeAttributes(attributes, extension.attributes)
    if (extension.protocols) {
      protocols = mergeRecordOfLists(protocols, extension.protocols, concatUniqueStrings)
    }
    if (extension.clobberPrefix !== undefined) {
      clobberPrefix = adoptClobberPrefix(clobberPrefix, extension.clobberPrefix)
    }
  }

  return {
    ...normalized,
    ...(tagNames !== undefined && { tagNames }),
    ...(attributes !== undefined && { attributes }),
    ...(protocols !== undefined && { protocols }),
    ...(clobberPrefix !== undefined && { clobberPrefix }),
  }
}
