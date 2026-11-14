/**
 * The catalog's trust boundary (docs/v3/concepts/ai-mdx.md row 11 and P5): every spec a model sends
 * passes here before any `render`. A spec is one JSON object (or its text) naming its block in a
 * `block` field next to the block's props: `{ "block": "stat", "label": "Shipped", "value": 388 }`.
 * `defineCatalog` may name another field (its `discriminator`); that field then stays in the props.
 *
 * In order: parse, find the block, hold the payload to the block's `limits` (bytes of its JSON
 * text, nesting depth), send every `href`, `src`, `url` and `link` string at any depth through the
 * untrusted url policy (except the keys the block lists in `textKeys`: it draws those as text),
 * then the block's Standard Schema. Each refusal is a sentence a model can act on and ends in
 * advice. Keys under other names are not walked: a block renders those as text.
 */
import { classifyUrl } from '../../core/url'
import type { Block, Resolved, SchemaIssue } from '../contract'

export type Limits = { maxBytes: number; maxDepth: number }

export const DEFAULT_LIMITS: Limits = { maxBytes: 32 * 1024, maxDepth: 6 }

/** What a block's `limits` may raise the default to (the epos server holds 300,000 bytes). */
export const MAX_LIMITS: Limits = { maxBytes: 512 * 1024, maxDepth: 12 }

/** The field that names the block unless `defineCatalog` is given another. */
export const BLOCK_KEY = 'block'

const URL_KEYS: ReadonlySet<string> = new Set(['href', 'src', 'url', 'link'])

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

/** The spec's JSON text and value; `spec` is undefined for data that is not JSON. */
function read(raw: unknown): { text: string; spec: unknown } {
  try {
    const text = typeof raw === 'string' ? raw : (JSON.stringify(raw) ?? '')
    return { text, spec: typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw }
  } catch {
    return { text: '', spec: undefined }
  }
}

/** Nesting depth of objects and arrays; the spec object itself is depth 1. */
function depthOf(x: unknown): number {
  if (typeof x !== 'object' || x === null) return 0
  return (
    Object.values(x).reduce<number>((deepest, child) => Math.max(deepest, depthOf(child)), 0) + 1
  )
}

/** The first url-bearing field the policy refuses, with its path; `text` keys are skipped. */
function hostileUrl(
  x: unknown,
  text: ReadonlySet<string>,
  path: Path = [],
): { path: Path; value: string } | null {
  if (typeof x !== 'object' || x === null) return null
  for (const [key, value] of Object.entries(x)) {
    const at = [...path, Array.isArray(x) ? Number(key) : key]
    const low = key.toLowerCase()
    if (typeof value === 'string' && URL_KEYS.has(low)) {
      if (!text.has(low) && classifyUrl(value, 'untrusted') === 'blocked')
        return { path: at, value }
      continue
    }
    const found = hostileUrl(value, text, at)
    if (found) return found
  }
  return null
}

function issuePath(issue: SchemaIssue): string {
  const keys = (issue.path ?? []).map((k) => (typeof k === 'object' ? k.key : k))
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
export function check(
  raw: unknown,
  byName: ReadonlyMap<string, Block>,
  key: string = BLOCK_KEY,
): Checked {
  const advice = `Send one JSON object with a "${key}" field and the block's props.`
  const { text, spec } = read(raw)
  if (!isRecord(spec)) return { ok: false, error: `The spec is not a JSON object. ${advice}` }

  const name = spec[key]
  const def = typeof name === 'string' ? byName.get(name) : undefined
  if (def === undefined) {
    const known = [...byName.keys()].join(', ')
    const got =
      typeof name === 'string' ? `Unknown block "${shown(name)}"` : 'The spec names no block'
    return { ok: false, error: `${got}. Set "${key}" to one of: ${known}.`, text }
  }
  const refuse = (error: string): Checked => ({ ok: false, error, def, text })

  const limits = def.limits ?? DEFAULT_LIMITS
  const bytes = new TextEncoder().encode(text).length
  if (bytes > limits.maxBytes)
    return refuse(
      `Block "${def.name}" is ${bytes} bytes, over its limit of ${limits.maxBytes}. Send fewer items or shorter text.`,
    )
  const depth = depthOf(spec)
  if (depth > limits.maxDepth)
    return refuse(
      `Block "${def.name}" nests ${depth} levels, deeper than its limit of ${limits.maxDepth}. Flatten the data.`,
    )
  const hostile = hostileUrl(spec, new Set(def.textKeys?.map((k) => k.toLowerCase())))
  if (hostile)
    return refuse(
      `Field ${pathText(hostile.path)} of block "${def.name}" holds a URL the page will not open ("${shown(hostile.value)}"). Use an https: link or a path on this site, or leave the field out.`,
    )

  const { [key]: _, ...rest } = spec
  const result = def.props['~standard'].validate(key === BLOCK_KEY ? rest : spec)
  if (result instanceof Promise)
    return refuse(
      `Block "${def.name}" has an asynchronous props schema, which a catalog cannot run while rendering. Use a synchronous schema.`,
    )
  if (result.issues !== undefined) return refuse(schemaError(def.name, result.issues))
  return { ok: true, block: { name: def.name, props: result.value }, def, text }
}
