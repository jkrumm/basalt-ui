/**
 * The shipped blocks (docs/v3/BENCHMARK-ACCORDEE-BLUEPRINT.md section 6): product-shaped page source
 * under the package's `blocks/<name>/`, described by `block.json`, copied into an app by `add` and
 * merged by `sync`. Read from the installed package, never from the consumer's copy.
 *
 * A block imports only published `basalt-ui` specifiers, its declared peers and its own siblings, so
 * the installed bytes are the shipped bytes: no import rewrite, no header line. `digest` is the one
 * value the ledger row records and `sync` compares: sha256 over each file's name and bytes, in the
 * descriptor's order.
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const BLOCKS_DIR = 'blocks'
export const DESCRIPTOR = 'block.json'

const NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
/** One flat file name: no directory, no dot-dot. */
const FILE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

export type BlockDescriptor = {
  name: string
  /** The page archetype the block answers, e.g. `list page`. */
  archetype: string
  summary: string
  /** Every installed file, in order. */
  files: string[]
  /** Every non-relative specifier the files import. */
  imports: string[]
  /** One line per prop or export the app wires. */
  ports: string[]
}

export type Block = BlockDescriptor & { sources: ReadonlyMap<string, string>; digest: string }

const isStrings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((s) => typeof s === 'string')

/** Every block the package ships, sorted. */
export function blockNames(pkgRoot: string): string[] {
  const dir = join(pkgRoot, BLOCKS_DIR)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => NAME.test(name) && existsSync(join(dir, name, DESCRIPTOR)))
    .toSorted()
}

export function blockDigest(files: readonly (readonly [string, string])[]): string {
  const hash = createHash('sha256')
  for (const [file, text] of files) hash.update(file).update('\0').update(text).update('\0')
  return hash.digest('hex')
}

function parseDescriptor(name: string, text: string): BlockDescriptor | { error: string } {
  const bad = (why: string) => ({ error: `${BLOCKS_DIR}/${name}/${DESCRIPTOR}: ${why}` })
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return bad('not valid JSON')
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return bad('not an object')
  const d = raw as Record<string, unknown>
  if (d['name'] !== name) return bad(`"name" must be "${name}"`)
  for (const key of ['archetype', 'summary'] as const) {
    if (typeof d[key] !== 'string' || d[key] === '') return bad(`"${key}" must be a string`)
  }
  for (const key of ['files', 'imports', 'ports'] as const) {
    if (!isStrings(d[key])) return bad(`"${key}" must be an array of strings`)
  }
  const files = d['files'] as string[]
  if (files.length === 0) return bad('"files" is empty')
  const unsafe = files.find((f) => !FILE.test(f) || f === DESCRIPTOR)
  if (unsafe !== undefined) return bad(`"${unsafe}" is not a flat file name`)
  if (new Set(files).size !== files.length) return bad('"files" names a file twice')
  return {
    name,
    archetype: d['archetype'] as string,
    summary: d['summary'] as string,
    files,
    imports: d['imports'] as string[],
    ports: d['ports'] as string[],
  }
}

/** The shipped block `name`; null when the package ships none, an error when it is malformed. */
export function readBlock(pkgRoot: string, name: string): Block | { error: string } | null {
  if (!NAME.test(name)) return null
  const dir = join(pkgRoot, BLOCKS_DIR, name)
  const descriptor = join(dir, DESCRIPTOR)
  if (!existsSync(descriptor)) return null
  const parsed = parseDescriptor(name, readFileSync(descriptor, 'utf8'))
  if ('error' in parsed) return parsed
  const missing = parsed.files.filter((f) => !existsSync(join(dir, f)))
  if (missing.length > 0) {
    return { error: `${BLOCKS_DIR}/${name} lists ${missing.join(', ')}, which it does not ship` }
  }
  const entries = parsed.files.map((f) => [f, readFileSync(join(dir, f), 'utf8')] as const)
  return { ...parsed, sources: new Map(entries), digest: blockDigest(entries) }
}
