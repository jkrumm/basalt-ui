/**
 * Guards over the shipped agent layer (agent/**): the text an agent loads while it builds with
 * basalt-ui. Four pure checks take the text they read and return their findings. allFindings() runs
 * them on the real tree for the CLI:
 *
 *   bun packages/basalt-ui/scripts/agent-layer-guards.ts
 *
 * The claim check resolves names against the package SOURCE (the src barrels, package.json "exports",
 * src/cli/help.ts COMMAND_OPTIONS and the parseArgs schemas of the verbs that keep their own). It
 * mirrors the built package and needs no build.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

import { COMMAND_OPTIONS } from '../src/cli/help'

export const PKG_ROOT = resolve(import.meta.dir, '..')

export type SourceFile = { path: string; text: string }

export type HistoryPattern = { id: string; re: RegExp; why: string }

export type HistoryFinding = { file: string; line: number; id: string; text: string }

export type ClaimKind = 'specifier' | 'import-name' | 'export-name' | 'cli-flag'

export type ClaimFinding = { file: string; line: number; kind: ClaimKind; text: string }

type Exports = Record<string, string | { import?: string } | null>

/** Backticked names that are not package exports: third-party or platform names only, never a missing name. */
export const NON_EXPORT_NAMES: ReadonlyMap<string, string> = new Map<string, string>([
  ...['useState', 'useMemo', 'useCallback'].map((name): [string, string] => [name, 'react']),
  ...['Intl', 'Date', 'Infinity', 'TypeError'].map((name): [string, string] => [
    name,
    'JavaScript built-in',
  ]),
  ...['EventSource', 'WebSocket', 'ResizeObserver', 'IntersectionObserver', 'PointerEvent'].map(
    (name): [string, string] => [name, 'browser API'],
  ),
  ['QueryClient', '@tanstack/react-query'],
  ...['ScriptOnce', 'ClientOnly', 'RouterContext', 'Register'].map((name): [string, string] => [
    name,
    '@tanstack/react-router',
  ]),
  ['useHotkey', '@tanstack/react-hotkeys (optional peer)'],
  ['useChat', '@ai-sdk/react (the AI SDK hook the import-boundary form constrains)'],
  ['useReducedMotionConfig', 'motion/react (src/motion/index.ts imports it)'],
  ['useReducedMotion', 'motion/react (re-exported from framer-motion)'],
  ...['Craft', 'Expression', 'Communication'].map((name): [string, string] => [
    name,
    'a rubric axis (`Craft 3`), not a code name',
  ]),
  ...['Stack', 'Group', 'Flex', 'Center', 'Text', 'SimpleGrid'].map((name): [string, string] => [
    name,
    'a 2.x layout name the migrate codemod rewrites',
  ]),
])

export const HISTORY_PATTERNS: ReadonlyArray<HistoryPattern> = [
  { id: 'cycle-number', re: /\bcycle \d+/i, why: 'a numbered build cycle is history, not a rule' },
  { id: 'expression-id', re: /\bexpression-\d/i, why: 'an expression-track id is history' },
  { id: 'mr-id', re: /(^|[\s(])![0-9]{2,5}\b/i, why: 'a GitLab merge request number is history' },
  { id: 'issue-ref', re: /\b(issue|PR|MR) #?\d{2,}\b/i, why: 'a tracker reference is history' },
  { id: 'issue-ref', re: /(^|\s)#\d{3,}\b/i, why: 'a tracker reference is history' },
  { id: 'trial-name', re: /\btrials?\b/i, why: 'a trial is a measurement record, not a rule' },
  { id: 'trial-name', re: /\bn\d{2,3}('s)?\b/, why: 'a trial case name is history' },
  { id: 'trial-name', re: /\bD\d{2}\b/, why: 'a trial design id is history' },
  { id: 'date', re: /\b20\d{2}-\d{2}-\d{2}\b/i, why: 'a dated fact belongs in docs/ or git' },
  { id: 'wave-id', re: /\bwave\s?\d{1,3}\b/i, why: 'a wave number is plan history' },
  { id: 'wave-id', re: /\bW\s?\d{1,3}\b/, why: 'a wave number is plan history' },
  { id: 'wave-id', re: /\bv3-[a-z]+-\d+/i, why: 'a cycle area id is plan history' },
  { id: 'owner', re: /\bthe owner\b|\bowner's\b/i, why: 'a person role is not a rule' },
  {
    id: 'anecdote',
    re: /\b(one|a|another|the first|the second|the third) (page|build|builder|pass|round) (printed|said|named|lost|drew|left|wrote|stopped|showed|put|kept|repeated|filled)\b/i,
    why: 'one run told as a story is history',
  },
  {
    id: 'anecdote',
    re: /\b(two|three|four|five|six|seven) of (two|three|four|five|six|seven|eight) (builds|pages|passes|rounds)\b/i,
    why: 'one run told as a story is history',
  },
  {
    id: 'anecdote',
    re: /\bbuilds? (lost|printed|drew)\b/i,
    why: 'one run told as a story is history',
  },
  {
    id: 'private-name',
    re: /\b(software-factory|Nextcloud|Globex|Accordee|TuffUI|CBBI|argo)\b/i,
    why: 'a private or other-project name',
  },
]

const NOT_SHIPPED = '## Not shipped'
const FENCE = /^\s*```/
/** Accepted on every verb (the dispatcher's own), without their dashes. */
const GLOBAL_FLAGS: ReadonlySet<string> = new Set(['help', 'h'])

// ─── Files ───────────────────────────────────────────────────────────────────

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

function readTree(rel: string, keep: (path: string) => boolean = () => true): SourceFile[] {
  return walk(join(PKG_ROOT, rel))
    .filter(keep)
    .toSorted()
    .map((path) => ({ path: relative(PKG_ROOT, path), text: readFileSync(path, 'utf8') }))
}

/** Every file under agent/**, any extension. */
export function agentFiles(): SourceFile[] {
  return readTree('agent')
}

/** Every markdown file under docs/**. */
export function docFiles(): SourceFile[] {
  return readTree('docs', (path) => path.endsWith('.md'))
}

export function blockText(): string {
  return readFileSync(join(PKG_ROOT, 'agent/templates/AGENTS-block.md.tpl'), 'utf8')
}

/** The directories under agent/skills/. */
export function skillNames(): string[] {
  const dir = join(PKG_ROOT, 'agent/skills')
  return readdirSync(dir)
    .filter((name) => statSync(join(dir, name)).isDirectory())
    .toSorted()
}

// ─── Lines ───────────────────────────────────────────────────────────────────

type Line = { no: number; text: string; code: boolean; marker: boolean; notShipped: boolean }

/** Each line with its number and whether it sits in a fenced block or the "## Not shipped" section. */
function scanLines(text: string): Line[] {
  let code = false
  let notShipped = false
  return text.split('\n').map((line, index) => {
    const no = index + 1
    if (FENCE.test(line)) {
      code = !code
      return { no, text: line, code: false, marker: true, notShipped }
    }
    if (!code && line.startsWith('## ')) notShipped = line === NOT_SHIPPED
    return { no, text: line, code, marker: false, notShipped }
  })
}

const isProse = (line: Line): boolean => !line.code && !line.marker

/** The fenced code of a file with every prose line blanked, so line numbers still match. */
function codeText(lines: readonly Line[]): string {
  return lines.map((line) => (line.code ? line.text : '')).join('\n')
}

const SPAN = /`([^`\n]+)`/g

function spansOf(text: string): string[] {
  return [...text.matchAll(SPAN)].map((m) => m[1] ?? '')
}

/** A line with its inline code spans blanked, so only prose is left. */
function maskInline(text: string): string {
  return text.replace(/`[^`\n]*`/g, (span) => ' '.repeat(span.length))
}

type Snippet = { no: number; text: string }

/** Fenced code as one snippet per command: a line ending in a backslash continues into the next. */
function logicalCode(lines: readonly Line[]): Snippet[] {
  const out: Snippet[] = []
  let current: Snippet | undefined
  for (const line of lines) {
    if (!line.code) {
      current = undefined
      continue
    }
    const body = line.text.trimEnd()
    const continues = body.endsWith('\\')
    const piece = continues ? body.slice(0, -1) : body
    if (current === undefined) {
      current = { no: line.no, text: piece }
      out.push(current)
    } else {
      current.text += ' ' + piece
    }
    if (!continues) current = undefined
  }
  return out
}

// ─── Guard 1: one bullet per shipped skill ───────────────────────────────────

/** Each skill has a "- /<name>:" bullet with 20+ characters of text, and the block names the lint and Claude Code. */
export function skillLines(blockText: string, skillNames: readonly string[]): string[] {
  const bullets = skillNames.flatMap((name) => {
    const bullet = new RegExp('^- `/' + escapeRegExp(name) + '`:(.*)$', 'm')
    const text = (bullet.exec(blockText)?.[1] ?? '').trim()
    if (text.length >= 20) return []
    return [`skill /${name}: no bullet "- /${name}:" with 20 characters of text`]
  })
  const literals = ['basalt-ui lint --changed', 'Claude Code']
    .filter((literal) => !blockText.includes(literal))
    .map((literal) => `block: missing "${literal}"`)
  return [...bullets, ...literals]
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ─── Guard 2: no repo-only apps/ paths ───────────────────────────────────────

const APPS_PATH = /(^|[^\w-])apps\//g

/** Every "apps/" path in any line of the files, fenced code included. */
export function appsPaths(files: readonly SourceFile[]): string[] {
  return files.flatMap((file) =>
    file.text.split('\n').flatMap((line, index) =>
      [...line.matchAll(APPS_PATH)].map((m) => {
        const match = (m[0] ?? '').slice((m[1] ?? '').length)
        return file.path + ':' + (index + 1) + ': ' + match
      }),
    ),
  )
}

// ─── Guard 3: no history in prose ────────────────────────────────────────────

/** A line of prose with a history pattern in it, once per pattern. Code and code spans are not prose. */
export function historyFindings(files: readonly SourceFile[]): HistoryFinding[] {
  return files.flatMap((file) =>
    scanLines(file.text).flatMap((line) => {
      if (!isProse(line)) return []
      const prose = maskInline(line.text)
      return HISTORY_PATTERNS.filter((pattern) => pattern.re.test(prose)).map((pattern) => ({
        file: file.path,
        line: line.no,
        id: pattern.id,
        text: line.text.trim(),
      }))
    }),
  )
}

// ─── Guard 4: every claim resolves against the package source ────────────────

type ClaimContext = {
  pkgRoot: string
  exports: Exports
  entries: Map<string, Set<string>>
  known: Set<string>
  verbs: Map<string, Set<string>>
}

/**
 * Every basalt-ui specifier, imported name, backticked export name and CLI flag in agent/** prose and
 * in fenced code of docs/**, checked against the package source (see the module comment).
 * A file under agent/ is prose plus code; any other file contributes its code and CLI snippets.
 */
export function claimFindings(
  files: readonly SourceFile[] = [...agentFiles(), ...docFiles()],
  pkgRoot: string = PKG_ROOT,
): ClaimFinding[] {
  const entries = publicEntries(pkgRoot)
  const ctx: ClaimContext = {
    pkgRoot,
    exports: readExports(pkgRoot),
    entries,
    known: new Set([...entries.values()].flatMap((names) => [...names])),
    verbs: verbFlags(pkgRoot),
  }
  return files.flatMap((file) => {
    const lines = scanLines(file.text)
    const agent = file.path.startsWith('agent/')
    const spans: Snippet[] = lines
      .filter(isProse)
      .flatMap((line) => spansOf(line.text).map((text) => ({ no: line.no, text })))
    const code = logicalCode(lines)
    return [
      ...(agent ? spans : []).flatMap((s) => specifierFindings(file.path, s, ctx)),
      ...code.flatMap((s) => specifierFindings(file.path, s, ctx)),
      ...[...spans, ...code].flatMap((s) => cliFindings(file.path, s, ctx)),
      ...importNameFindings(file.path, codeText(lines), ctx),
      ...(agent ? exportNameFindings(file.path, lines, ctx) : []),
    ].toSorted((a, b) => a.line - b.line)
  })
}

const SPECIFIER = /(?<![\w@./-])basalt-ui(?:\/([\w./*-]*[\w*]))?(?![\w/<-])/g

function specifierFindings(file: string, snippet: Snippet, ctx: ClaimContext): ClaimFinding[] {
  return [...snippet.text.matchAll(SPECIFIER)].flatMap((m) => {
    const sub = m[1]
    if (sub === undefined || resolvesToExport(sub, ctx)) return []
    return [{ file, line: snippet.no, kind: 'specifier', text: m[0] }]
  })
}

/**
 * A subpath resolves when package.json "exports" has its key, or a wildcard key whose module exists.
 * As in Node, the exact key wins, then the longest matching pattern; a null target is not exported.
 */
function resolvesToExport(sub: string, ctx: ClaimContext): boolean {
  const key = './' + sub
  if (key in ctx.exports) return ctx.exports[key] !== null
  const match = Object.entries(ctx.exports)
    .filter(([pattern]) => {
      const star = pattern.indexOf('*')
      if (star < 0) return false
      const prefix = pattern.slice(0, star)
      const suffix = pattern.slice(star + 1)
      return key.length >= pattern.length - 1 && key.startsWith(prefix) && key.endsWith(suffix)
    })
    .toSorted(([a], [b]) => b.indexOf('*') - a.indexOf('*') || b.length - a.length)[0]
  if (match === undefined) return false
  const [pattern, target] = match
  if (target === null) return false
  const star = pattern.indexOf('*')
  const mod = key.slice(star, key.length - (pattern.length - star - 1))
  return moduleExists(ctx.pkgRoot, typeof target === 'string' ? undefined : target.import, mod)
}

function moduleExists(pkgRoot: string, target: string | undefined, mod: string): boolean {
  if (target === undefined || mod === '') return false
  const path = target.replace('*', mod)
  if (target.startsWith('./dist/')) return sourceOf(pkgRoot, path) !== undefined
  return existsSync(join(pkgRoot, path))
}

const IMPORT = /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s+(['"])(basalt-ui(?:\/[^'"\s]*)?)\2/g

/** Each name in an import from a basalt-ui entry is exported by that entry. */
function importNameFindings(file: string, text: string, ctx: ClaimContext): ClaimFinding[] {
  return [...text.matchAll(IMPORT)].flatMap((m) => {
    const entry = m[3] ?? ''
    const names = ctx.entries.get(entry)
    if (names === undefined) return []
    const line = text.slice(0, m.index ?? 0).split('\n').length
    return (m[1] ?? '')
      .split(',')
      .map((part) =>
        (
          part
            .trim()
            .replace(/^type\s+/, '')
            .split(/\s+as\s+/)[0] ?? ''
        ).trim(),
      )
      .filter((name) => name !== '' && !names.has(name))
      .map((name) => ({
        file,
        line,
        kind: 'import-name' as const,
        text: name + " from '" + entry + "'",
      }))
  })
}

const PASCAL_SPAN = /^([A-Z][a-z0-9][A-Za-z0-9]*)(?:\s[^`]*)?$/
const USE_SPAN = /^((?:use|define|create)[A-Z]\w*)(?:\(\)|\(…\))?$/

/** The export a backticked span names: PascalCase (optionally followed by text) or a use/define/create call. */
function exportCandidate(span: string): string | undefined {
  return PASCAL_SPAN.exec(span)?.[1] ?? USE_SPAN.exec(span)?.[1]
}

/** Backticked names in agent prose (the "## Not shipped" section excepted) are exports or listed platform names. */
function exportNameFindings(
  file: string,
  lines: readonly Line[],
  ctx: ClaimContext,
): ClaimFinding[] {
  return lines
    .filter((line) => isProse(line) && !line.notShipped)
    .flatMap((line) =>
      spansOf(line.text).flatMap((span) => {
        const name = exportCandidate(span)
        if (name === undefined || ctx.known.has(name) || NON_EXPORT_NAMES.has(name)) return []
        return [{ file, line: line.no, kind: 'export-name' as const, text: name }]
      }),
    )
}

/** A `basalt-ui <verb>` call; one inside a quoted string ("basalt-ui compared with") is prose. */
const BIN_CALL = /(?<![\w@./"'-])basalt-ui\s+/g
const FLAG = /(?:^|[\s[(|])(--?[A-Za-z][\w-]*)/g
const VERB = /^[a-z][\w:-]*$/
/** A verb after one of these is a package name (bun add basalt-ui react-markdown), not a CLI call. */
const INSTALL_VERBS: ReadonlySet<string> = new Set(['add', 'install', 'i', 'remove', 'rm', 'link'])

/** Each "basalt-ui <verb>" snippet names a known verb, and each flag in it is one of that verb's. */
function cliFindings(file: string, snippet: Snippet, ctx: ClaimContext): ClaimFinding[] {
  const starts = [...snippet.text.matchAll(BIN_CALL)].map((m) => m.index ?? 0)
  return starts.flatMap((start, i) => {
    const segment = snippet.text.slice(start, starts[i + 1] ?? snippet.text.length)
    const [, verb = '', sub = ''] = segment.split(/\s+/)
    const before = snippet.text.slice(0, start).trimEnd().split(/\s+/).pop() ?? ''
    if (!VERB.test(verb) || INSTALL_VERBS.has(before)) return []
    const key = verb === 'shot' && sub === 'detect' ? 'shot detect' : verb
    const allowed = ctx.verbs.get(key)
    if (allowed === undefined)
      return [{ file, line: snippet.no, kind: 'cli-flag' as const, text: 'basalt-ui ' + verb }]
    return [...segment.matchAll(FLAG)].flatMap((m) => {
      const flag = m[1] ?? ''
      if (allowed.has(flag.replace(/^-+/, '')) || GLOBAL_FLAGS.has(flag.replace(/^-+/, '')))
        return []
      return [
        {
          file,
          line: snippet.no,
          kind: 'cli-flag' as const,
          text: 'basalt-ui ' + key + ' ' + flag,
        },
      ]
    })
  })
}

// ─── Source readers ──────────────────────────────────────────────────────────

/** The file behind a "./dist/X.js" export target: src/X.ts, src/X.tsx or src/X/index.ts. */
function sourceOf(pkgRoot: string, target: string): string | undefined {
  const base = join(pkgRoot, target.replace(/^\.\/dist\//, 'src/').replace(/\.js$/, ''))
  return [base + '.ts', base + '.tsx', join(base, 'index.ts')].find((file) => existsSync(file))
}

function readExports(pkgRoot: string): Exports {
  const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8')) as {
    exports: Exports
  }
  return pkg.exports
}

/** Names one source file exports, following \`export * from './x'\` through its barrels. */
function namesIn(file: string, pkgRoot: string, seen = new Set<string>()): Set<string> {
  const names = new Set<string>()
  if (seen.has(file)) return names
  seen.add(file)
  const text = readFileSync(file, 'utf8')
  for (const block of text.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)) {
    for (const part of (block[1] ?? '').split(',')) {
      const alias = part
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)
        .pop()
      if (alias) names.add(alias.trim())
    }
  }
  for (const m of text.matchAll(
    /export\s+(?:declare\s+)?(?:async\s+)?(?:function|const|let|class|type|interface|enum)\s+(\w+)/g,
  )) {
    if (m[1]) names.add(m[1])
  }
  const srcDir = join(pkgRoot, 'src')
  for (const m of text.matchAll(/export\s+\*\s+from\s+'(\.[^']+)'/g)) {
    const target = sourceOf(
      pkgRoot,
      './dist/' + join(relative(srcDir, dirname(file)), m[1] ?? '') + '.js',
    )
    if (target !== undefined) for (const name of namesIn(target, pkgRoot, seen)) names.add(name)
  }
  return names
}

/** Public entry specifier (\`basalt-ui\`, \`basalt-ui/charts\`) → the names it exports; design-references.test.ts reads the same map. */
export function publicEntries(pkgRoot: string = PKG_ROOT): Map<string, Set<string>> {
  const entries = new Map<string, Set<string>>()
  const exports = readExports(pkgRoot)
  for (const [sub, target] of Object.entries(exports)) {
    const importTarget = target === null || typeof target === 'string' ? undefined : target.import
    if (importTarget === undefined) continue
    // A wildcard subpath (\`./ui/*\`) is one entry per module in its source directory.
    if (sub.includes('*')) {
      const dir = join(
        pkgRoot,
        importTarget.replace(/^\.\/dist\//, 'src/').replace(/\/\*\.js$/, ''),
      )
      for (const name of readdirSync(dir)) {
        const mod = name.replace(/\.tsx?$/, '')
        if (mod === name || /\.(test|guard|type-guard)$/.test(mod)) continue
        // A module the map nulls (`"./ui/slots": null`) is not published, though the wildcard matches it.
        if (exports[sub.replace('*', mod)] === null) continue
        const file = sourceOf(pkgRoot, importTarget.replace('*', mod))
        if (file !== undefined)
          entries.set('basalt-ui/' + sub.slice(2).replace('*', mod), namesIn(file, pkgRoot))
      }
      continue
    }
    const file = sourceOf(pkgRoot, importTarget)
    if (file !== undefined)
      entries.set(sub === '.' ? 'basalt-ui' : 'basalt-ui/' + sub.slice(2), namesIn(file, pkgRoot))
  }
  return entries
}

/** The flags each verb accepts: COMMAND_OPTIONS, and the parseArgs schemas of the verbs outside it. */
function verbFlags(pkgRoot: string): Map<string, Set<string>> {
  const verbs = new Map<string, Set<string>>()
  for (const [verb, options] of Object.entries(COMMAND_OPTIONS))
    verbs.set(verb, new Set(Object.keys(options)))
  verbs.set(
    'shot detect',
    optionKeys(readFileSync(join(pkgRoot, 'src/cli/shot/detect.ts'), 'utf8')),
  )
  for (const verb of ['add', 'eject', 'migrate']) {
    verbs.set(
      verb,
      optionKeys(readFileSync(join(pkgRoot, 'src/cli/' + verb + '/index.ts'), 'utf8')),
    )
  }
  verbs.set('help', new Set())
  verbs.set('version', new Set())
  return verbs
}

const OPTION_KEY = /(?:^|[\s,{])(?:'([^']+)'|"([^"]+)"|([\w-]+))\s*:\s*\{/g

/** The option names of the first parseArgs call in a source file, whether its options object is inline or a const. */
function optionKeys(source: string): Set<string> {
  const call = source.indexOf('parseArgs({')
  if (call < 0) throw new Error('no parseArgs call in source')
  const optionsAt = /\boptions:\s*/g
  optionsAt.lastIndex = call
  const match = optionsAt.exec(source)
  if (match === null) throw new Error('parseArgs call has no options')
  let open = match.index + match[0].length
  if (source[open] !== '{') {
    const name = /^\w+/.exec(source.slice(open))?.[0] ?? ''
    const decl = new RegExp('\\b(?:const|let)\\s+' + name + '\\b[^=]*=\\s*').exec(source)
    if (decl === null) throw new Error('no declaration of options ' + name)
    open = decl.index + decl[0].length
  }
  return new Set(
    [...balancedBody(source, open).matchAll(OPTION_KEY)].map((m) => m[1] ?? m[2] ?? m[3] ?? ''),
  )
}

/** The text between the brace at \`open\` and its matching close. */
function balancedBody(source: string, open: number): string {
  let depth = 0
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++
    if (source[i] === '}') {
      depth--
      if (depth === 0) return source.slice(open + 1, i)
    }
  }
  throw new Error('unbalanced options schema')
}

// ─── CLI: every guard on the real tree ───────────────────────────────────────

/** Every finding of all four guards on the real tree, one printable line each. */
export function allFindings(): string[] {
  const agent = agentFiles()
  const docs = docFiles()
  return [
    ...skillLines(blockText(), skillNames()).map((f) => 'skill-lines: ' + f),
    ...appsPaths(agent).map((f) => 'apps-paths: ' + f),
    ...historyFindings(agent.filter((f) => /\.(md|tpl)$/.test(f.path))).map(
      (f) => 'history ' + f.id + ': ' + f.file + ':' + f.line + ': ' + f.text,
    ),
    ...claimFindings([...agent, ...docs]).map(
      (f) => 'claim ' + f.kind + ': ' + f.file + ':' + f.line + ': ' + f.text,
    ),
  ]
}

if (import.meta.main) {
  const lines = allFindings()
  for (const line of lines) console.log(line)
  process.exit(lines.length === 0 ? 0 : 1)
}
