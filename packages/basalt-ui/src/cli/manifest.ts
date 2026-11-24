/**
 * The v3 consumer manifest, `.basalt/manifest.json` (docs/v3/ARCHITECTURE.md section 2): the one
 * reader and writer. A leaf module, so sync, init, doctor and eject can all depend on it.
 * `managed` is the E1 ledger: sha256 of the raw bytes `sync` last wrote per managed agent file.
 * The file carries `format`: a file without one is format 0, a newer one is refused, and `sync`
 * rewrites an older one through `MIGRATIONS` (one step per format, each a pure function of the raw
 * object), so a later release can change a key's shape and every install follows on its next sync.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

export const MANIFEST_PATH = '.basalt/manifest.json'
export const PROFILES = ['tokens', 'site', 'bridge', 'parts', 'app'] as const
export type Profile = (typeof PROFILES)[number]

/** One committed `tokens:css` output and the flags that reproduce it. */
export type TokenOutput = { out: string; format: 'css' | 'json'; flags: string[] }

export type Manifest = {
  profile: Profile
  /** The basalt-ui version `sync` last ran at. */
  version: string
  /** Source root (relative to the install root) -> its declared profile. */
  roots: Record<string, Profile>
  ejected: Record<string, Record<string, unknown>>
  /** Managed file path -> sha256 of the raw bytes `sync` last wrote. */
  managed: Record<string, string>
  deepRender: string[]
  authoredContent: string[]
  viewports: string[]
  classPrefixes?: string[]
  /**
   * Directories (relative to the install root) that draw their own surface, a game table or a
   * seating plan: `primitive-bypass` lets positioned geometry and hand-drawn marks through there.
   */
  bespoke?: string[]
  tokens: TokenOutput[]
  /** The `--extra` file `tokens:css` reads. */
  extra?: string
  /** A sibling install's name prefix for its repo-root rules and skills (`basalt-v3-`, `basalt-v3-<dir>-`). */
  sibling?: string
  /** Fields this version does not know, kept so a newer manifest survives an older `sync`. */
  rest: Record<string, unknown>
}

/** The format this version writes. */
export const MANIFEST_FORMAT = 1

/** `MIGRATIONS[n]` lifts a raw format-n manifest to format n + 1. 0 -> 1 only adds the field. */
const MIGRATIONS: readonly ((raw: Record<string, unknown>) => Record<string, unknown>)[] = [
  (raw) => raw,
]

/** `format` is the one the file was written in; `manifest` is already lifted to the current one. */
export type ManifestRead = { manifest: Manifest; format: number } | { error: string }

/**
 * The keys the CLI writes: `init`, `sync` and `eject` own them, and the pre-edit guard refuses a
 * hand edit that changes one. Every other key is the consumer's to edit: `profile`, `roots`,
 * `bespoke`, `deepRender`, `authoredContent`, `viewports`, `classPrefixes`, `tokens`, `extra`.
 */
export const CLI_OWNED_KEYS = ['format', 'version', 'managed', 'ejected', 'sibling'] as const

const LISTS = ['deepRender', 'authoredContent', 'viewports', 'classPrefixes', 'bespoke'] as const
const KNOWN = [
  'format',
  'profile',
  'version',
  'roots',
  'ejected',
  'managed',
  'tokens',
  'extra',
  'sibling',
  ...LISTS,
]

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isProfile = (v: unknown): v is Profile => PROFILES.includes(v as Profile)
const isStrings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((s) => typeof s === 'string')
const isRelative = (root: string): boolean =>
  root !== '' &&
  !/^([/\\]|[a-zA-Z]:)/.test(root) &&
  !/\n|\r/.test(root) &&
  !root.split('/').includes('..')
/** The root (`.`, `./.`) would waive the whole project: a bespoke surface is one named directory, no glob. */
const isBespokeDir = (dir: string): boolean =>
  isRelative(dir) &&
  dir.split('/').some((segment) => segment !== '' && segment !== '.') &&
  !/[*?[\]{}]/.test(dir)
const isTokenOutput = (v: unknown): v is TokenOutput =>
  isRecord(v) &&
  typeof v['out'] === 'string' &&
  (v['format'] === 'css' || v['format'] === 'json') &&
  isStrings(v['flags'])

/** Parses manifest text; an `error` names the first thing wrong. */
export function parseManifest(text: string): ManifestRead {
  const bad = (why: string): ManifestRead => ({ error: `${MANIFEST_PATH}: ${why}` })
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return bad('not valid JSON')
  }
  if (!isRecord(parsed)) return bad('must be a JSON object')
  let raw = parsed
  const format = raw['format'] ?? 0
  if (!Number.isInteger(format) || (format as number) < 0) {
    return bad('`format` must be a non-negative integer')
  }
  if ((format as number) > MANIFEST_FORMAT) {
    return bad(
      `format ${String(format)} is newer than this basalt-ui reads (${MANIFEST_FORMAT}); upgrade basalt-ui`,
    )
  }
  for (const step of MIGRATIONS.slice(format as number, MANIFEST_FORMAT)) raw = step(raw)
  const {
    profile,
    version = '',
    roots = {},
    ejected = {},
    managed = {},
    tokens = [],
    extra,
    sibling,
  } = raw
  if (!isProfile(profile)) {
    return bad(
      `declares no profile (${PROFILES.join(' | ')}); a 2.x manifest has none — ` +
        'run `basalt-ui migrate --from <x.y.z> --profile <profile>`',
    )
  }
  if (typeof version !== 'string') return bad('`version` must be a string')
  if (!isRecord(roots) || !Object.entries(roots).every(([r, p]) => isRelative(r) && isProfile(p))) {
    return bad('`roots` must map a relative directory to a profile')
  }
  if (!isRecord(ejected) || !Object.values(ejected).every(isRecord)) {
    return bad('`ejected` must map a name to an object')
  }
  if (
    !isRecord(managed) ||
    !Object.entries(managed).every(([path, d]) => isRelative(path) && typeof d === 'string')
  ) {
    return bad('`managed` must map a relative path to a sha256 string')
  }
  if (!Array.isArray(tokens) || !tokens.every(isTokenOutput)) {
    return bad('`tokens` must be an array of { out, format: "css" | "json", flags: string[] }')
  }
  if (extra !== undefined && typeof extra !== 'string') return bad('`extra` must be a file path')
  if (
    sibling !== undefined &&
    (typeof sibling !== 'string' || !/^basalt-v3-[\w-]*$/.test(sibling))
  ) {
    return bad('`sibling` must be a name prefix starting `basalt-v3-`')
  }
  const lists = LISTS.map((key) => raw[key] ?? [])
  if (!lists.every(isStrings)) return bad(`${LISTS.join(', ')} must be arrays of strings`)
  if (!(lists[4] as string[]).every(isBespokeDir)) {
    return bad('`bespoke` must list relative directories below the root, without globs')
  }

  return {
    format: format as number,
    manifest: {
      profile,
      version,
      roots: roots as Manifest['roots'],
      ejected: ejected as Manifest['ejected'],
      managed: managed as Manifest['managed'],
      deepRender: lists[0] as string[],
      authoredContent: lists[1] as string[],
      viewports: lists[2] as string[],
      ...((lists[3] as string[]).length > 0 ? { classPrefixes: lists[3] as string[] } : {}),
      ...((lists[4] as string[]).length > 0 ? { bespoke: lists[4] as string[] } : {}),
      tokens,
      ...(extra === undefined ? {} : { extra }),
      ...(typeof sibling === 'string' ? { sibling } : {}),
      rest: Object.fromEntries(Object.entries(raw).filter(([key]) => !KNOWN.includes(key))),
    },
  }
}

const sorted = <T>(record: Record<string, T>): Record<string, T> =>
  Object.fromEntries(Object.entries(record).toSorted(([a], [b]) => a.localeCompare(b)))

/** The canonical bytes: fixed key order, sorted maps, two-space indent, one trailing newline. */
export function serializeManifest(m: Manifest): string {
  const { profile, version, deepRender, authoredContent, viewports, tokens, extra, sibling, rest } =
    m
  const body = {
    format: MANIFEST_FORMAT,
    profile,
    version,
    roots: sorted(m.roots),
    ejected: sorted(m.ejected),
    managed: sorted(m.managed),
    deepRender,
    authoredContent,
    viewports,
    ...(m.classPrefixes?.length ? { classPrefixes: m.classPrefixes } : {}),
    ...(m.bespoke?.length ? { bespoke: m.bespoke } : {}),
    tokens,
    ...(extra === undefined ? {} : { extra }),
    ...(sibling === undefined ? {} : { sibling }),
    ...rest,
  }
  return `${JSON.stringify(body, null, 2)}\n`
}

/** `<dir>/.basalt/manifest.json` parsed, or null when there is none. */
export function readManifest(dir: string): ManifestRead | null {
  try {
    return parseManifest(readFileSync(resolve(dir, MANIFEST_PATH), 'utf8'))
  } catch {
    return null
  }
}

/** Writes the canonical bytes; touches nothing when the file already holds them. */
export function writeManifest(dir: string, manifest: Manifest): void {
  const abs = resolve(dir, MANIFEST_PATH)
  const next = serializeManifest(manifest)
  if (existsSync(abs) && readFileSync(abs, 'utf8') === next) return
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, next)
}
