/**
 * The import census: what an app takes from basalt-ui, read from its own source. Regex over text,
 * no AST and no network: the census selects rows, it does not prove a rewrite (`verify` does).
 * Scans ts, tsx, astro and css under a directory.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const EXTENSIONS = ['.ts', '.tsx', '.astro', '.css']
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.next',
  '.astro',
  '.turbo',
  '.vite',
  '.output',
  '.claude',
  '.basalt',
  'coverage',
])
const MAX_BYTES = 1_000_000

/** `module#symbol` for a named, default (`default`) or namespace (`*`) import; bare `module` for a side-effect one. */
export interface Census {
  /** Scanned files, relative to the scan root, posix separators. */
  files: string[]
  text: Map<string, string>
  /** Symbol key (`basalt-ui/content#Markdown`) to the `file:line` places it is imported or used. */
  symbols: Map<string, string[]>
  /** Module specifier to every `file:line` that imports it, whatever it takes. */
  modules: Map<string, string[]>
  /** Files importing a symbol key, with the local name it is bound to. */
  importers: Map<string, Map<string, string>>
  /** Legacy-namespace storage and url keys, with where each is used. */
  storageKeys: Map<string, string[]>
  urlKeys: Map<string, string[]>
}

function walk(dir: string, root: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(join(dir, entry.name), root, out)
    } else if (entry.isFile() && EXTENSIONS.some((e) => entry.name.endsWith(e))) {
      const path = join(dir, entry.name)
      if (statSync(path).size <= MAX_BYTES) out.push(relative(root, path).split(sep).join('/'))
    }
  }
}

function push<K>(map: Map<K, string[]>, key: K, place: string): void {
  const list = map.get(key)
  if (list === undefined) map.set(key, [place])
  else if (!list.includes(place)) list.push(place)
}

const MODULE = String.raw`basalt-ui(?:\/[^'"]*)?`
const FROM_CLAUSE = new RegExp(
  String.raw`\b(?:import|export)\s+(?:type\s+)?([^'";]*?)\s*from\s*(['"])(${MODULE})\2`,
  'g',
)
const SIDE_EFFECT = new RegExp(String.raw`\bimport\s*(['"])(${MODULE})\1`, 'g')
const DYNAMIC = new RegExp(String.raw`\bimport\(\s*(['"])(${MODULE})\1\s*\)`, 'g')
const CSS_IMPORT = new RegExp(String.raw`@import\s+(?:url\(\s*)?(['"])(${MODULE})\1`, 'g')
const STORAGE_CALL =
  /\b(?:localStorage|sessionStorage)\s*\.\s*(?:getItem|setItem|removeItem)\s*\(\s*(['"`])([^'"`$]+)\1/g
const URL_PARAM_CALL =
  /\b\w*[pP]arams\s*\.\s*(?:get|getAll|has|set|append|delete)\s*\(\s*(['"`])([^'"`$]+)\1/g

/** Keys in basalt's own legacy namespaces; every other key is the app's and none of our business. */
export const LEGACY_KEY_PREFIX = /^(mantine-|basalt-)/

function lineOf(text: string, index: number): number {
  let line = 1
  for (let i = text.indexOf('\n'); i !== -1 && i < index; i = text.indexOf('\n', i + 1)) line++
  return line
}

/** Names bound by an import clause: `A, { B, type C as D }` / `* as NS` / `{}`. */
function parseClause(clause: string): { symbol: string; local: string }[] {
  const found: { symbol: string; local: string }[] = []
  const ns = /\*\s+as\s+([\w$]+)/.exec(clause)
  if (ns?.[1] !== undefined) found.push({ symbol: '*', local: ns[1] })
  const braces = /\{([^}]*)\}/.exec(clause)
  if (braces?.[1] !== undefined) {
    for (const part of braces[1].split(',')) {
      const m = /^\s*(?:type\s+)?([\w$]+)(?:\s+as\s+([\w$]+))?\s*$/.exec(part)
      if (m?.[1] !== undefined) found.push({ symbol: m[1], local: m[2] ?? m[1] })
    }
  }
  const head = clause.replace(/\{[^}]*\}/, '').replace(/\*\s+as\s+[\w$]+/, '')
  const def = /^\s*(?:type\s+)?([\w$]+)\s*,?\s*$/.exec(head)
  if (def?.[1] !== undefined) found.push({ symbol: 'default', local: def[1] })
  return found
}

function scanFile(census: Census, file: string, text: string): void {
  const at = (index: number): string => `${file}:${lineOf(text, index)}`
  const bind = (key: string, local: string, place: string): void => {
    push(census.symbols, key, place)
    const byFile = census.importers.get(key) ?? new Map<string, string>()
    byFile.set(file, local)
    census.importers.set(key, byFile)
  }

  for (const m of text.matchAll(FROM_CLAUSE)) {
    const [, clause = '', , module = ''] = m
    const place = at(m.index)
    push(census.modules, module, place)
    for (const { symbol, local } of parseClause(clause)) {
      if (symbol !== '*') {
        bind(`${module}#${symbol}`, local, place)
        continue
      }
      // A namespace import names what it uses at each `NS.Member`.
      const uses = [
        ...text.matchAll(new RegExp(String.raw`\b${local.replace(/\$/g, '\\$')}\.([\w$]+)`, 'g')),
      ]
      if (uses.length === 0) bind(`${module}#*`, local, place)
      for (const use of uses) bind(`${module}#${use[1] ?? ''}`, local, at(use.index))
    }
  }
  for (const re of [SIDE_EFFECT, DYNAMIC, CSS_IMPORT]) {
    for (const m of text.matchAll(re)) push(census.modules, m[2] ?? '', at(m.index))
  }
  for (const m of text.matchAll(STORAGE_CALL)) {
    if (LEGACY_KEY_PREFIX.test(m[2] ?? '')) push(census.storageKeys, m[2] ?? '', at(m.index))
  }
  for (const m of text.matchAll(URL_PARAM_CALL)) {
    if (LEGACY_KEY_PREFIX.test(m[2] ?? '')) push(census.urlKeys, m[2] ?? '', at(m.index))
  }
}

/** Scan `root`. Never writes; an unreadable file is skipped, not fatal. */
export function takeCensus(root: string): Census {
  const files: string[] = []
  walk(root, root, files)
  files.sort()
  const census: Census = {
    files: [],
    text: new Map(),
    symbols: new Map(),
    modules: new Map(),
    importers: new Map(),
    storageKeys: new Map(),
    urlKeys: new Map(),
  }
  for (const file of files) {
    let text: string
    try {
      text = readFileSync(join(root, file), 'utf8')
    } catch {
      continue
    }
    census.files.push(file)
    census.text.set(file, text)
    scanFile(census, file, text)
  }
  return census
}

/** `file:line` of every occurrence of `needle` in the scanned text. */
export function findText(census: Census, needle: string): string[] {
  const places: string[] = []
  for (const [file, text] of census.text) {
    for (let i = text.indexOf(needle); i !== -1; i = text.indexOf(needle, i + needle.length)) {
      places.push(`${file}:${lineOf(text, i)}`)
    }
  }
  return places
}
