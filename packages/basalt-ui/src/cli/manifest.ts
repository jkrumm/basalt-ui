/**
 * The v3 consumer manifest, `.basalt/manifest.json` (docs/v3/ARCHITECTURE.md section 2): the one
 * reader and writer. A leaf module, so sync, init, doctor and eject can all depend on it.
 * `managed` is the E1 ledger: sha256 of the raw bytes `sync` last wrote per managed agent file.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

export const MANIFEST_PATH = '.basalt/manifest.json'
export const PROFILES = ['tokens', 'bridge', 'parts', 'app'] as const
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
  tokens: TokenOutput[]
  /** The `--extra` file `tokens:css` reads. */
  extra?: string
  /** Fields this version does not know, kept so a newer manifest survives an older `sync`. */
  rest: Record<string, unknown>
}

export type ManifestRead = { manifest: Manifest } | { error: string }

const LISTS = ['deepRender', 'authoredContent', 'viewports'] as const
const KNOWN = ['profile', 'version', 'roots', 'ejected', 'managed', 'tokens', 'extra', ...LISTS]

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
const isTokenOutput = (v: unknown): v is TokenOutput =>
  isRecord(v) &&
  typeof v['out'] === 'string' &&
  (v['format'] === 'css' || v['format'] === 'json') &&
  isStrings(v['flags'])

/** Parses manifest text; an `error` names the first thing wrong. */
export function parseManifest(text: string): ManifestRead {
  const bad = (why: string): ManifestRead => ({ error: `${MANIFEST_PATH}: ${why}` })
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return bad('not valid JSON')
  }
  if (!isRecord(raw)) return bad('must be a JSON object')
  const { profile, version = '', roots = {}, ejected = {}, managed = {}, tokens = [], extra } = raw
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
  if (!isRecord(managed) || !Object.values(managed).every((d) => typeof d === 'string')) {
    return bad('`managed` must map a path to a sha256 string')
  }
  if (!Array.isArray(tokens) || !tokens.every(isTokenOutput)) {
    return bad('`tokens` must be an array of { out, format: "css" | "json", flags: string[] }')
  }
  if (extra !== undefined && typeof extra !== 'string') return bad('`extra` must be a file path')
  const lists = LISTS.map((key) => raw[key] ?? [])
  if (!lists.every(isStrings)) return bad(`${LISTS.join(', ')} must be arrays of strings`)

  return {
    manifest: {
      profile,
      version,
      roots: roots as Manifest['roots'],
      ejected: ejected as Manifest['ejected'],
      managed: managed as Manifest['managed'],
      deepRender: lists[0] as string[],
      authoredContent: lists[1] as string[],
      viewports: lists[2] as string[],
      tokens,
      ...(extra === undefined ? {} : { extra }),
      rest: Object.fromEntries(Object.entries(raw).filter(([key]) => !KNOWN.includes(key))),
    },
  }
}

const sorted = <T>(record: Record<string, T>): Record<string, T> =>
  Object.fromEntries(Object.entries(record).toSorted(([a], [b]) => a.localeCompare(b)))

/** The canonical bytes: fixed key order, sorted maps, two-space indent, one trailing newline. */
export function serializeManifest(m: Manifest): string {
  const { profile, version, deepRender, authoredContent, viewports, tokens, extra, rest } = m
  const body = {
    profile,
    version,
    roots: sorted(m.roots),
    ejected: sorted(m.ejected),
    managed: sorted(m.managed),
    deepRender,
    authoredContent,
    viewports,
    tokens,
    ...(extra === undefined ? {} : { extra }),
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
