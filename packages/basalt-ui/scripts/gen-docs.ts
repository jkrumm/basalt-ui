/**
 * The docs extractor (skills-agent-layer 3.1): one `docs/<kebab-name>.md` per public VALUE export of
 * every JS subpath, read from source through the TypeScript compiler API, rendered by
 * `docs-format.ts`, plus the JSDoc gate: an export without the summary, `@useWhen` and `@neverWhen`
 * the format needs is a failure that names it.
 *
 * Usage: bun packages/basalt-ui/scripts/gen-docs.ts             rewrite the docs, trim the baseline
 *        bun packages/basalt-ui/scripts/gen-docs.ts --check     exit 1 on drift or a JSDoc gap
 *        bun packages/basalt-ui/scripts/gen-docs.ts --baseline  also record every undocumented export
 *        --root <dir>   treat <dir> as the package (fixtures): src, docs, playground, baseline in it
 *
 * Out of scope here: `./ui/*` (gen-ui's), the CSS and config entries (no types), and any hand-written
 * guide in `docs/` (a file without generated frontmatter is never touched; a name clash fails).
 *
 * The baseline (`gen-docs.baseline.json`) lists the exports that predate the gate. It only shrinks:
 * a baselined export that is documented or gone fails `--check` until it is removed (a plain run
 * trims it), and an undocumented export that is not in it fails by name. No doc is written for an
 * export with a JSDoc gap, so a baselined export has no doc yet.
 *
 * Examples: a `// #region example:<export>` (the export name or its kebab name) in a playground file
 * is appended to that export's doc, verbatim and dedented.
 */
import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, relative } from 'node:path'
import ts from 'typescript'
import { SURFACES } from '../src/surfaces'
import { checkExport, formatExportDoc } from './docs-format'
import type { ExportInfo, ExportJsdoc } from './docs-format'
import { propShapeLines, valueSignature } from './llms-signatures'
import { SUBPATH_REQUIRED_PEERS } from './surface-gates'

const REAL_PKG = join(import.meta.dirname, '..')

export type GenRoots = {
  /** The repo root: example file names print relative to it. */
  repoRoot: string
  /** The package directory: `package.json`, `src`, `docs`. */
  pkgRoot: string
  /** Where playground files holding `example:` regions live. */
  examplesDir: string
  /** The legacy-export baseline. */
  baselinePath: string
  /** Peer package names a subpath needs, keyed by `package.json` export key. */
  peersFor: (key: string) => readonly string[]
}

const realPeersFor = (key: string): string[] => {
  const spec = (SURFACES as Record<string, { optionalPeers?: readonly string[] }>)[key]
  const pkg = JSON.parse(readFileSync(join(REAL_PKG, 'package.json'), 'utf8')) as {
    peerDependenciesMeta?: Record<string, { optional?: boolean }>
  }
  const optional = (spec?.optionalPeers ?? []).filter(
    (p) => pkg.peerDependenciesMeta?.[p]?.optional === true,
  )
  return [...new Set([...(SUBPATH_REQUIRED_PEERS[key] ?? []), ...optional])].toSorted()
}

export const REAL_ROOTS: GenRoots = {
  repoRoot: join(REAL_PKG, '..', '..'),
  pkgRoot: REAL_PKG,
  examplesDir: join(REAL_PKG, '..', '..', 'apps', 'playground', 'src'),
  baselinePath: join(REAL_PKG, 'scripts', 'gen-docs.baseline.json'),
  peersFor: realPeersFor,
}

/** The layout of a fixture package under `--root`. */
export const fixtureRoots = (dir: string): GenRoots => ({
  repoRoot: dir,
  pkgRoot: dir,
  examplesDir: join(dir, 'playground'),
  baselinePath: join(dir, 'gen-docs.baseline.json'),
  peersFor: () => [],
})

// ── Names ────────────────────────────────────────────────────────────────────────────────────────

/** `StatCard` → `stat-card`, `createSearchStore` → `create-search-store`, `VX` → `vx`. */
export function kebab(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
}

// ── Extraction ───────────────────────────────────────────────────────────────────────────────────

type Extracted = {
  info: ExportInfo
  /** The rendered `## Signature` text. */
  signature: string
}

/** `./dist/charts/index.d.ts` → `<pkg>/src/charts/index.ts(x)`; undefined when no source entry exists. */
function sourceEntry(pkgRoot: string, typesPath: string): string | undefined {
  const base = join(pkgRoot, typesPath.replace(/^\.\/dist\//, 'src/').replace(/\.d\.ts$/, ''))
  return [`${base}.ts`, `${base}.tsx`].find(existsSync)
}

const FALLBACK_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2023,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.ReactJSX,
  strict: true,
  noEmit: true,
  skipLibCheck: true,
}

function compilerOptions(pkgRoot: string): ts.CompilerOptions {
  const tsconfig = join(pkgRoot, 'tsconfig.json')
  if (!existsSync(tsconfig)) return FALLBACK_OPTIONS
  const config = ts.getParsedCommandLineOfConfigFile(
    tsconfig,
    { noEmit: true },
    { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} },
  )
  if (config === undefined) throw new Error('gen-docs: tsconfig.json did not parse')
  return config.options
}

/** The package exports that carry types and are not `./ui/*`: CSS and config entries have none. */
function publishedEntries(pkgRoot: string): Array<{ key: string; file: string }> {
  const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8')) as {
    exports?: Record<string, unknown>
  }
  return Object.entries(pkg.exports ?? {}).flatMap(([key, value]) => {
    if (key.startsWith('./ui/') || typeof value !== 'object' || value === null) return []
    const types = (value as { types?: unknown }).types
    if (typeof types !== 'string') return []
    const file = sourceEntry(pkgRoot, types)
    return file === undefined ? [] : [{ key, file }]
  })
}

function literal(n: ts.Node | undefined): string | undefined {
  if (n === undefined) return undefined
  if (ts.isJsxExpression(n)) return literal(n.expression)
  return ts.isStringLiteralLike(n) ? n.text : undefined
}

/** `data-slot` string literals written inside one declaration, sorted and unique. */
function slotsIn(node: ts.Node): string[] {
  const slots = new Set<string>()
  const visit = (n: ts.Node): void => {
    if (ts.isJsxAttribute(n) && ts.isIdentifier(n.name) && n.name.text === 'data-slot') {
      const value = literal(n.initializer)
      if (value !== undefined) slots.add(value)
    } else if (
      ts.isPropertyAssignment(n) &&
      ts.isStringLiteralLike(n.name) &&
      n.name.text === 'data-slot'
    ) {
      const value = literal(n.initializer)
      if (value !== undefined) slots.add(value)
    }
    ts.forEachChild(n, visit)
  }
  visit(node)
  return [...slots].toSorted()
}

const firstParagraph = (text: string): string =>
  text
    .trim()
    .split(/\n\s*\n/)[0]!
    .trim()

/** The JSDoc an export carries, or null when it has none of the three parts. */
function jsdocOf(checker: ts.TypeChecker, symbol: ts.Symbol): ExportJsdoc | null {
  const summary = ts.displayPartsToString(symbol.getDocumentationComment(checker))
  const tags = symbol.getJsDocTags(checker)
  const tag = (tagName: string): string => {
    const text = tags.find((t) => t.name === tagName)?.text
    return text === undefined ? '' : ts.displayPartsToString(text).trim()
  }
  const jsdoc = {
    summary: firstParagraph(summary),
    useWhen: tag('useWhen'),
    neverWhen: tag('neverWhen'),
  }
  return jsdoc.summary === '' && jsdoc.useWhen === '' && jsdoc.neverWhen === '' ? null : jsdoc
}

/** The value exports of one module, aliases resolved, `default` left out. */
function valueExports(
  checker: ts.TypeChecker,
  source: ts.SourceFile,
): Array<{ name: string; symbol: ts.Symbol }> | undefined {
  const moduleSymbol = checker.getSymbolAtLocation(source)
  if (moduleSymbol === undefined) return undefined
  return checker
    .getExportsOfModule(moduleSymbol)
    .map((exported) => ({
      name: exported.name,
      symbol: exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported,
    }))
    .filter(({ name, symbol }) => name !== 'default' && (symbol.flags & ts.SymbolFlags.Value) !== 0)
}

type Collected = {
  out: Extracted[]
  problems: string[]
  seen: Set<ts.Symbol>
  names: Map<string, string>
  /** Doc file names claimed by a baselined legacy root export, which a v3 subpath may take over. */
  legacy: Set<string>
  /** `<subpath>#<name>` baseline keys. */
  baseline: ReadonlySet<string>
}

/** Records one export, or notes a problem when its doc file name is taken. */
function extractOne(
  checker: ts.TypeChecker,
  roots: GenRoots,
  at: { key: string; subpath: string; source: ts.SourceFile },
  value: { name: string; symbol: ts.Symbol },
  acc: Collected,
): void {
  const { name, symbol } = value
  const taken = acc.names.get(kebab(name))
  // TRANSITIONAL: a baselined legacy root export is a shadow. A non-root (v3) export of the same
  // name takes the doc file; the legacy one stays undocumented and baselined.
  const takesOver = taken !== undefined && acc.legacy.has(kebab(name)) && at.key !== '.'
  // A baselined legacy export that meets a name already documented (a v3 root export that reuses a
  // 2.x subpath name) is recorded without claiming the doc file: its JSDoc gap keeps it undocumented
  // and baselined, so it is not a clash to fix.
  const shadowed = taken !== undefined && !takesOver && acc.baseline.has(`${at.subpath}#${name}`)
  if (taken !== undefined && !takesOver && !shadowed) {
    acc.problems.push(
      `${name} (${at.subpath}): docs/${kebab(name)}.md is already taken by ${taken}`,
    )
    return
  }
  if (!shadowed) {
    acc.names.set(kebab(name), `${name} (${at.subpath})`)
    if (at.key === '.' && acc.baseline.has(`${at.subpath}#${name}`)) acc.legacy.add(kebab(name))
    else acc.legacy.delete(kebab(name))
  }
  const decl = symbol.valueDeclaration ?? symbol.declarations?.[0] ?? at.source
  acc.out.push({
    info: {
      name,
      subpath: at.subpath,
      peers: roots.peersFor(at.key),
      slots: slotsIn(decl),
      jsdoc: jsdocOf(checker, symbol),
    },
    signature: signatureOf(checker, name, symbol, decl),
  })
}

/** Every public value export, once, under the first subpath (in `package.json` order) that has it. */
function extractExports(roots: GenRoots): { exports: Extracted[]; problems: string[] } {
  const entries = publishedEntries(roots.pkgRoot)
  const program = ts.createProgram(
    entries.map((e) => e.file),
    compilerOptions(roots.pkgRoot),
  )
  const checker = program.getTypeChecker()
  const pkgName = (
    JSON.parse(readFileSync(join(roots.pkgRoot, 'package.json'), 'utf8')) as { name: string }
  ).name
  const acc: Collected = {
    out: [],
    problems: [],
    seen: new Set(),
    names: new Map(),
    legacy: new Set(),
    baseline: new Set(readBaseline(roots)),
  }

  for (const { key, file } of entries) {
    const source = program.getSourceFile(file)
    const values = source === undefined ? undefined : valueExports(checker, source)
    if (source === undefined || values === undefined) {
      acc.problems.push(`${key}: no module symbol for ${relative(roots.pkgRoot, file)}`)
      continue
    }
    const at = { key, source, subpath: key === '.' ? pkgName : `${pkgName}${key.slice(1)}` }
    for (const value of values.filter((v) => !acc.seen.has(v.symbol))) {
      acc.seen.add(value.symbol)
      extractOne(checker, roots, at, value, acc)
    }
  }
  const exports = acc.out.toSorted((x, y) => x.info.name.localeCompare(y.info.name))
  return { exports, problems: acc.problems }
}

/** A primitive constant has no shape: `valueSignature` would list its `Number` or `String` methods. */
const PRIMITIVE_LIKE =
  ts.TypeFlags.StringLike |
  ts.TypeFlags.NumberLike |
  ts.TypeFlags.BooleanLike |
  ts.TypeFlags.BigIntLike

const TYPE_FLAGS =
  ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope

/** The signature, then the props block, as `llms.txt` prints them (same `llms-signatures` helpers). */
function signatureOf(
  checker: ts.TypeChecker,
  name: string,
  symbol: ts.Symbol,
  node: ts.Node,
): string {
  const type = checker.getTypeOfSymbolAtLocation(symbol, node)
  const call = type.getCallSignatures()[0]
  if (call === undefined && type.flags & PRIMITIVE_LIKE) {
    return `${name}: ${checker.typeToString(type, node, TYPE_FLAGS)}`
  }
  if (call === undefined) return valueSignature(checker, name, type, node, TYPE_FLAGS)
  const head = `${name}${checker.signatureToString(call, node, TYPE_FLAGS)}`.replace(/\s+/g, ' ')
  const first = call.getParameters()[0]
  const props =
    first === undefined
      ? []
      : propShapeLines(checker, checker.getTypeOfSymbolAtLocation(first, node), node, TYPE_FLAGS)
  return [head.replace('__0:', 'props:'), ...props].join('\n')
}

// ── Examples ─────────────────────────────────────────────────────────────────────────────────────

type Example = { name: string; file: string; body: string[] }

const EXAMPLE_START = /^\s*\/\/ #region example:([\w-]+)\s*$/
const ANY_REGION_START = /^\s*\/\/ #region\b/
const REGION_END = /^\s*\/\/ #endregion\b/

function dedent(lines: string[]): string[] {
  const indents = lines.filter((l) => l.trim() !== '').map((l) => /^\s*/.exec(l)![0].length)
  const cut = indents.length === 0 ? 0 : Math.min(...indents)
  return lines.map((l) => l.slice(cut))
}

/** The `example:` regions of one file; a nested region's marker lines stay in the outer body. */
function examplesIn(text: string, file: string): Example[] {
  const found: Example[] = []
  const open: Array<{ name: string | undefined; body: string[] }> = []
  for (const line of text.split('\n')) {
    const closed = REGION_END.test(line) ? open.pop() : undefined
    if (closed?.name) found.push({ name: closed.name, file, body: dedent(closed.body) })
    for (const region of open) region.body.push(line)
    const start = EXAMPLE_START.exec(line)
    if (start || ANY_REGION_START.test(line)) open.push({ name: start?.[1], body: [] })
  }
  return found
}

/** Every `// #region example:<name>` under the examples dir, with repo-relative file names. */
function scanExamples(roots: GenRoots): Example[] {
  if (!existsSync(roots.examplesDir)) return []
  return readdirSync(roots.examplesDir, { recursive: true, encoding: 'utf8' })
    .filter((f) => ['.ts', '.tsx', '.mts'].includes(extname(f)) && !f.includes('node_modules'))
    .toSorted()
    .flatMap((f) =>
      examplesIn(
        readFileSync(join(roots.examplesDir, f), 'utf8'),
        relative(roots.repoRoot, join(roots.examplesDir, f)),
      ),
    )
}

// ── Rendering ────────────────────────────────────────────────────────────────────────────────────

/** `docs/<kebab-name>.md`: the docs-format text, the signature, then the example regions. */
function renderDoc(item: Extracted, examples: readonly Example[]): string {
  const { name } = item.info
  const mine = examples.filter((e) => e.name === name || e.name === kebab(name))
  const parts = [
    formatExportDoc(item.info).markdown,
    `\n## Signature\n\n\`\`\`ts\n${item.signature}\n\`\`\`\n`,
    ...mine.map(
      (e) =>
        `\n## Example\n\n\`${e.file}\`\n\n\`\`\`${extname(e.file).slice(1)}\n${e.body.join('\n')}\n\`\`\`\n`,
    ),
  ]
  return parts.join('')
}

// ── The run ──────────────────────────────────────────────────────────────────────────────────────

const isGenerated = (text: string): string | undefined =>
  /^---\nname: .*\n(?:.*\n)*?subpath: (\S+)\n/.exec(text)?.[1]?.replace(/^"|"$/g, '')

export type GenResult = {
  /** `docs/<name>.md` → text, for every export with complete JSDoc. */
  docs: Map<string, string>
  /** `<subpath>#<name>` for every export with a JSDoc gap. */
  undocumented: string[]
  /** Exports with a JSDoc gap that the baseline does not cover, and extraction failures. */
  problems: string[]
}

const baselineKey = (info: ExportInfo): string => `${info.subpath}#${info.name}`

export function readBaseline(roots: GenRoots): string[] {
  return existsSync(roots.baselinePath)
    ? (JSON.parse(readFileSync(roots.baselinePath, 'utf8')) as string[])
    : []
}

export function generate(roots: GenRoots): GenResult {
  const { exports, problems: extraction } = extractExports(roots)
  const examples = scanExamples(roots)
  const baseline = new Set(readBaseline(roots))
  const docs = new Map<string, string>()
  const undocumented: string[] = []
  const problems = [...extraction]

  for (const item of exports) {
    const gaps = checkExport(item.info)
    if (gaps.length === 0) {
      docs.set(`${kebab(item.info.name)}.md`, renderDoc(item, examples))
      continue
    }
    undocumented.push(baselineKey(item.info))
    if (!baseline.has(baselineKey(item.info))) {
      for (const gap of gaps) problems.push(`${gap.message} (${item.info.subpath})`)
    }
  }
  return { docs, undocumented: undocumented.toSorted(), problems }
}

/** Generated docs on disk that no export produces any more (gen-ui's `basalt-ui/ui/*` docs are not ours). */
function orphans(roots: GenRoots, docs: ReadonlyMap<string, string>): string[] {
  const dir = join(roots.pkgRoot, 'docs')
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !docs.has(f))
    .filter((f) => {
      const subpath = isGenerated(readFileSync(join(dir, f), 'utf8'))
      return subpath !== undefined && !subpath.includes('/ui/')
    })
    .toSorted()
}

/** Everything `--check` fails on; empty when the tree is clean. */
export function checkDocs(roots: GenRoots): string[] {
  const { docs, undocumented, problems } = generate(roots)
  const failures = [...problems]
  const dir = join(roots.pkgRoot, 'docs')
  const rel = (f: string): string => relative(dirname(roots.pkgRoot), join(dir, f))

  for (const [file, text] of docs) {
    const path = join(dir, file)
    if (!existsSync(path)) failures.push(`${rel(file)} is missing; run gen-docs`)
    else if (isGenerated(readFileSync(path, 'utf8')) === undefined) {
      failures.push(`${rel(file)} exists and is not generated; rename it or the export's doc`)
    } else if (readFileSync(path, 'utf8') !== text) {
      failures.push(`${rel(file)} is out of sync; run gen-docs`)
    }
  }
  for (const file of orphans(roots, docs)) {
    failures.push(`${rel(file)} is generated for an export that is gone; run gen-docs`)
  }
  const gaps = new Set(undocumented)
  for (const entry of readBaseline(roots)) {
    if (!gaps.has(entry)) {
      failures.push(`baseline entry ${entry} is documented or gone; run gen-docs to trim it`)
    }
  }
  return failures
}

/** Writes the docs, removes orphans, trims the baseline (or, with `record`, replaces it). */
export function writeDocs(roots: GenRoots, record = false): string[] {
  const { docs, undocumented } = generate(roots)
  const dir = join(roots.pkgRoot, 'docs')
  const written: string[] = []
  for (const [file, text] of docs) {
    const path = join(dir, file)
    if (existsSync(path)) {
      const current = readFileSync(path, 'utf8')
      if (isGenerated(current) === undefined) continue // checkDocs names the clash
      if (current === text) continue
    }
    writeFileSync(path, text, 'utf8')
    written.push(relative(dirname(roots.pkgRoot), path))
  }
  for (const file of orphans(roots, docs)) unlinkSync(join(dir, file))

  const gaps = new Set(undocumented)
  const next = record ? undocumented : readBaseline(roots).filter((e) => gaps.has(e))
  if (record || next.length !== readBaseline(roots).length) {
    writeFileSync(roots.baselinePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  }
  return written
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────────

function main(): void {
  const args = process.argv.slice(2)
  const rootAt = args.indexOf('--root')
  const roots = rootAt === -1 ? REAL_ROOTS : fixtureRoots(args[rootAt + 1]!)

  if (args.includes('--check')) {
    const failures = checkDocs(roots)
    for (const f of failures) console.error(`✖ gen-docs --check: ${f}`)
    if (failures.length > 0) process.exit(1)
    console.log(`✓ gen-docs --check: ${generate(roots).docs.size} docs in sync, JSDoc gate green.`)
    return
  }

  for (const file of writeDocs(roots, args.includes('--baseline'))) console.log(`wrote ${file}`)
  const failures = checkDocs(roots)
  for (const f of failures) console.error(`✖ gen-docs: ${f}`)
  if (failures.length > 0) process.exit(1)
}

if (import.meta.path === Bun.main) {
  main()
}
