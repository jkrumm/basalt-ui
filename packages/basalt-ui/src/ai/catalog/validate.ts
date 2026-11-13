/**
 * The catalog's trust boundary (docs/v3/concepts/ai-mdx.md row 11 and P5): every spec a model sends
 * passes here before any `render`. A spec is one JSON object (or its text) naming its block in a
 * `block` field next to the block's props: `{ "block": "stat", "label": "Shipped", "value": 388 }`.
 *
 * In order: parse, find the block, hold the payload to the block's `limits` (bytes of its JSON
 * text, nesting depth), send every `href`, `src`, `url` and `link` string at any depth through the
 * untrusted url policy, then the block's Standard Schema. Each refusal is a sentence a model can act
 * on and ends in advice. Keys under other names are not walked: a block renders those as text.
 */
import { classifyUrl } from '../../core/url'
import type { Block, Resolved, SchemaIssue } from '../contract'

export type Limits = { maxBytes: number; maxDepth: number }

export const DEFAULT_LIMITS: Limits = { maxBytes: 32 * 1024, maxDepth: 6 }

/** The field that names the block; the rest of the object is the block's props. */
export const BLOCK_KEY = 'block'

const URL_KEYS: ReadonlySet<string> = new Set(['href', 'src', 'url', 'link'])
const ADVICE_SHOW = `Send one JSON object with a "${BLOCK_KEY}" field and the block's props.`

export type Checked =
  | { ok: true; block: Resolved; def: Block; text: string }
  | { ok: false; error: string; def?: Block | undefined; text?: string | undefined }

type Path = readonly (string | number)[]

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x)

function pathText(path: Path): string {
  return path.reduce<string>(
    (out, key) => (typeof key === 'number' ? `${out}[${key}]` : out ? `${out}.${key}` : key),
    '',
  )
}

function serialise(x: unknown): string | null {
  if (typeof x === 'string') return x
  try {
    return JSON.stringify(x) ?? null
  } catch {
    return null
  }
}

function parse(text: string, raw: unknown): unknown {
  if (typeof raw !== 'string') return raw
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

/** Nesting depth of objects and arrays; the spec object itself is depth 1. */
function depthOf(x: unknown): number {
  if (typeof x !== 'object' || x === null) return 0
  const children = Array.isArray(x) ? x : Object.values(x)
  let deepest = 0
  for (const child of children) deepest = Math.max(deepest, depthOf(child))
  return deepest + 1
}

/** The first url-bearing field the policy refuses, with its path. */
function hostileUrl(x: unknown, path: Path = []): { path: Path; value: string } | null {
  if (Array.isArray(x)) {
    for (const [i, item] of x.entries()) {
      const found = hostileUrl(item, [...path, i])
      if (found) return found
    }
    return null
  }
  if (!isRecord(x)) return null
  for (const [key, value] of Object.entries(x)) {
    const at = [...path, key]
    if (typeof value === 'string' && URL_KEYS.has(key.toLowerCase())) {
      if (classifyUrl(value, 'untrusted') === 'blocked') return { path: at, value }
      continue
    }
    const found = hostileUrl(value, at)
    if (found) return found
  }
  return null
}

function issuePath(issue: SchemaIssue): string {
  const keys = (issue.path ?? []).map((k) =>
    typeof k === 'object' ? (k as { key: PropertyKey }).key : k,
  )
  return pathText(keys.map((k) => (typeof k === 'number' ? k : String(k))))
}

function schemaError(name: string, issues: readonly SchemaIssue[]): string {
  const lines = issues.slice(0, 5).map((issue) => {
    const at = issuePath(issue)
    return at ? `${at}: ${issue.message}` : issue.message
  })
  const more = issues.length > 5 ? ` (and ${issues.length - 5} more)` : ''
  return `Block "${name}" does not match its props: ${lines.join('; ')}${more}. Fix these fields and send the block again.`
}

const shown = (value: string): string => (value.length > 60 ? `${value.slice(0, 60)}…` : value)

/** Checks one spec against the catalog; `def` and `text` let `Block` reuse the work. */
export function check(raw: unknown, byName: ReadonlyMap<string, Block>): Checked {
  const text = serialise(raw)
  if (text === null) return { ok: false, error: `The spec is not JSON data. ${ADVICE_SHOW}` }
  const spec = parse(text, raw)
  if (!isRecord(spec)) return { ok: false, error: `The spec is not a JSON object. ${ADVICE_SHOW}` }

  const name = spec[BLOCK_KEY]
  const def = typeof name === 'string' ? byName.get(name) : undefined
  if (def === undefined) {
    const known = [...byName.keys()].join(', ')
    const got =
      typeof name === 'string' ? `Unknown block "${shown(name)}"` : 'The spec names no block'
    return { ok: false, error: `${got}. Set "${BLOCK_KEY}" to one of: ${known}.`, text }
  }

  const limits = def.limits ?? DEFAULT_LIMITS
  const bytes = new TextEncoder().encode(text).length
  if (bytes > limits.maxBytes) {
    const error = `Block "${def.name}" is ${bytes} bytes, over its limit of ${limits.maxBytes}. Send fewer items or shorter text.`
    return { ok: false, error, def, text }
  }
  const depth = depthOf(spec)
  if (depth > limits.maxDepth) {
    const error = `Block "${def.name}" nests ${depth} levels, deeper than its limit of ${limits.maxDepth}. Flatten the data.`
    return { ok: false, error, def, text }
  }
  const hostile = hostileUrl(spec)
  if (hostile) {
    const error = `Field ${pathText(hostile.path)} of block "${def.name}" holds a URL the page will not open ("${shown(hostile.value)}"). Use an https: link or a path on this site, or leave the field out.`
    return { ok: false, error, def, text }
  }

  const { [BLOCK_KEY]: _, ...props } = spec
  const result = def.props['~standard'].validate(props)
  if (result instanceof Promise) {
    const error = `Block "${def.name}" has an asynchronous props schema, which a catalog cannot run while rendering. Use a synchronous schema.`
    return { ok: false, error, def, text }
  }
  if (result.issues !== undefined)
    return { ok: false, error: schemaError(def.name, result.issues), def, text }
  return { ok: true, block: { name: def.name, props: result.value }, def, text }
}
