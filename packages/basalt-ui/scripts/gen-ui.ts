/**
 * The primitives generator: reads every `src/ui/<module>.tsx` cva table and part list statically
 * (TypeScript compiler API, never by executing the module) and writes what must not drift from them:
 *
 * - `src/ui/slots.ts`: `SLOTS`, every module's `<module>Parts` as plain literal data.
 * - `src/ui/no-restyle.generated.json`: one `no-restyle` contract per cva table.
 * - `docs/<module>.md`: the six frontmatter keys of `docs-format.ts`, the axes and the slots.
 *
 * A module is every `src/ui/*.tsx` that is not a test or a guard; it must export `<module>Parts`,
 * and each exported `<x>Variants` cva table pairs with the part `kebab(x)`, which must be listed in
 * it. A table that cannot be read statically (spread, computed key, non-literal) is a hard error.
 *
 * Usage: bun packages/basalt-ui/scripts/gen-ui.ts            write the outputs
 *        bun packages/basalt-ui/scripts/gen-ui.ts --check    exit 1 on drift
 *        --root <dir>   treat <dir> as the package (fixtures): package.json, src/ui, docs in it
 */
import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { SURFACES } from '../src/surfaces'
import { formatExportDoc } from './docs-format'
import type { ExportJsdoc } from './docs-format'
import { kebab } from './gen-docs'
import { SUBPATH_REQUIRED_PEERS } from './surface-gates'

const REAL_PKG = join(import.meta.dirname, '..')
const UI_KEY = './ui/*'
const HINT = 'run: bun packages/basalt-ui/scripts/gen-ui.ts'
const PRINT_WIDTH = 100

export type UiRoots = {
  /** The package directory: `package.json`, `src/ui`, `docs`. */
  pkgRoot: string
  /** Peer package names the `./ui/*` subpath needs. */
  peers: () => readonly string[]
}

const realPeers = (): string[] => {
  const spec = (SURFACES as Record<string, { optionalPeers?: readonly string[] }>)[UI_KEY]
  const pkg = JSON.parse(readFileSync(join(REAL_PKG, 'package.json'), 'utf8')) as {
    peerDependenciesMeta?: Record<string, { optional?: boolean }>
  }
  const optional = (spec?.optionalPeers ?? []).filter(
    (p) => pkg.peerDependenciesMeta?.[p]?.optional === true,
  )
  return [...new Set([...(SUBPATH_REQUIRED_PEERS[UI_KEY] ?? []), ...optional])].toSorted()
}

export const REAL_ROOTS: UiRoots = { pkgRoot: REAL_PKG, peers: realPeers }

/** The layout of a fixture package under `--root`. */
export const fixtureRoots = (dir: string): UiRoots => ({ pkgRoot: dir, peers: () => [] })

/** The generated files, relative to the package root. */
export const SLOTS_FILE = 'src/ui/slots.ts'
export const CONTRACTS_FILE = 'src/ui/no-restyle.generated.json'

/** Classes no primitive accepts through `className`: height and display belong to the table. */
export const DENY = ['h-*', 'min-h-*', 'size-*', 'hidden', 'flex', 'block', 'grid', 'inline-flex']

// ── Names ────────────────────────────────────────────────────────────────────────────────────────

/** `toggle-group` → `ToggleGroup`. */
export const pascal = (name: string): string =>
  name
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')

/** `toggle-group` → `toggleGroup`. */
const camel = (name: string): string => {
  const p = pascal(name)
  return p.charAt(0).toLowerCase() + p.slice(1)
}

// ── Extraction ───────────────────────────────────────────────────────────────────────────────────

type Axis = { name: string; values: string[]; default: string | undefined }
type Table = { exportName: string; part: string; axes: Axis[] }
type UiModule = {
  name: string
  parts: string[]
  tables: Table[]
  jsdoc: ExportJsdoc | null
}

/** Modules on disk: `src/ui/*.tsx`, tests and guards left out, sorted. */
export function moduleFiles(pkgRoot: string): string[] {
  const dir = join(pkgRoot, 'src', 'ui')
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx') && !f.includes('.guard.'))
    .toSorted()
}

function fail(file: string, source: ts.SourceFile, node: ts.Node, message: string): never {
  const { line } = source.getLineAndCharacterOfPosition(node.getStart(source))
  throw new Error(`src/ui/${file}:${line + 1}: ${message}`)
}

const unwrap = (node: ts.Expression): ts.Expression =>
  ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)
    ? unwrap(node.expression)
    : node

/** A literal property name, or undefined when it is computed or private. */
function keyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) {
    return name.text
  }
  return undefined
}

type Reader = { file: string; source: ts.SourceFile; where: string }

/** The `key: value` pairs of an object literal; anything else (spread, computed, shorthand) fails. */
function entries(r: Reader, node: ts.Expression): Array<[string, ts.Expression]> {
  const obj = unwrap(node)
  if (!ts.isObjectLiteralExpression(obj)) {
    return fail(r.file, r.source, node, `${r.where} is not an object literal`)
  }
  return obj.properties.map((prop) => {
    const key = ts.isPropertyAssignment(prop) ? keyName(prop.name) : undefined
    if (!ts.isPropertyAssignment(prop) || key === undefined) {
      return fail(r.file, r.source, prop, `${r.where} has a spread, computed or shorthand member`)
    }
    return [key, prop.initializer]
  })
}

function literalValue(r: Reader, node: ts.Expression): string {
  const n = unwrap(node)
  if (ts.isStringLiteralLike(n) || ts.isNumericLiteral(n)) return n.text
  if (n.kind === ts.SyntaxKind.TrueKeyword) return 'true'
  if (n.kind === ts.SyntaxKind.FalseKeyword) return 'false'
  return fail(r.file, r.source, node, `${r.where} is not a literal`)
}

function readTable(r: Reader, exportName: string, call: ts.CallExpression): Table {
  const part = kebab(exportName.replace(/Variants$/, ''))
  const config = call.arguments[1]
  if (config === undefined) return { exportName, part, axes: [] }
  const members = new Map(entries({ ...r, where: `${exportName} config` }, config))
  const variants = members.get('variants')
  const defaults = new Map(
    members.has('defaultVariants')
      ? entries({ ...r, where: `${exportName} defaultVariants` }, members.get('defaultVariants')!)
      : [],
  )
  const axes = (
    variants === undefined ? [] : entries({ ...r, where: `${exportName} variants` }, variants)
  ).map(([axis, values]): Axis => {
    const names = entries({ ...r, where: `${exportName} variants.${axis}` }, values).map(([v]) => v)
    const fallback = defaults.get(axis)
    const value =
      fallback === undefined
        ? undefined
        : literalValue({ ...r, where: `${exportName} defaultVariants.${axis}` }, fallback)
    if (value !== undefined && !names.includes(value)) {
      return fail(
        r.file,
        r.source,
        fallback!,
        `${exportName} default ${axis}="${value}" is no value`,
      )
    }
    return { name: axis, values: names, default: value }
  })
  for (const [axis, node] of defaults) {
    if (!axes.some((a) => a.name === axis)) {
      fail(r.file, r.source, node, `${exportName} defaultVariants names unknown axis ${axis}`)
    }
  }
  return { exportName, part, axes }
}

function readParts(r: Reader, node: ts.Expression): string[] {
  const list = unwrap(node)
  if (!ts.isArrayLiteralExpression(list)) {
    return fail(r.file, r.source, node, `${r.where} is not an array literal`)
  }
  return list.elements.map((el) => {
    if (!ts.isStringLiteralLike(el))
      return fail(r.file, r.source, el, `${r.where} has a non-string`)
    return el.text
  })
}

const firstParagraph = (text: string): string =>
  text
    .trim()
    .split(/\n\s*\n/)[0]!
    .trim()

/** The summary and routing tags of the module's primary export, or null without a JSDoc. */
function jsdocOf(node: ts.Node): ExportJsdoc | null {
  const doc = ts.getJSDocCommentsAndTags(node).find(ts.isJSDoc)
  if (doc === undefined) return null
  const tag = (name: string): string =>
    ts.getTextOfJSDocComment(doc.tags?.find((t) => t.tagName.text === name)?.comment)?.trim() ?? ''
  return {
    summary: firstParagraph(ts.getTextOfJSDocComment(doc.comment) ?? ''),
    useWhen: tag('useWhen'),
    neverWhen: tag('neverWhen'),
  }
}

const isExported = (node: ts.Node): boolean =>
  ts.canHaveModifiers(node) &&
  (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)

/** One module: its parts, its cva tables in source order, the primary export's JSDoc. */
export function readModule(pkgRoot: string, file: string): UiModule {
  const name = file.replace(/\.tsx$/, '')
  const text = readFileSync(join(pkgRoot, 'src', 'ui', file), 'utf8')
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const partsName = `${camel(name)}Parts`
  const primary = pascal(name)
  let parts: string[] | undefined
  let jsdoc: ExportJsdoc | null = null
  const tables: Table[] = []

  for (const statement of source.statements.filter(isExported)) {
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === primary) {
      jsdoc = jsdocOf(statement)
    }
    if (!ts.isVariableStatement(statement)) continue
    for (const decl of statement.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || decl.initializer === undefined) continue
      const id = decl.name.text
      const r: Reader = { file, source, where: id }
      if (id === primary) jsdoc = jsdocOf(statement)
      if (id === partsName) parts = readParts(r, decl.initializer)
      if (!id.endsWith('Variants')) continue
      const init = unwrap(decl.initializer)
      const isCva =
        ts.isCallExpression(init) &&
        ts.isIdentifier(init.expression) &&
        init.expression.text === 'cva'
      if (!isCva) fail(file, source, decl, `${id} is not a cva(base, config) call`)
      tables.push(readTable(r, id, init))
    }
  }

  if (parts === undefined) {
    throw new Error(`src/ui/${file}: module ${name} exports no ${partsName}`)
  }
  for (const table of tables) {
    if (!parts.includes(table.part)) {
      throw new Error(
        `src/ui/${file}: ${table.exportName} pairs with part "${table.part}", which ${partsName} does not list`,
      )
    }
  }
  return { name, parts, tables, jsdoc }
}

// ── Rendering ────────────────────────────────────────────────────────────────────────────────────

/** An inline array when the line fits, one element per line otherwise (both are oxfmt fixed points). */
function array(
  items: readonly string[],
  quote: (s: string) => string,
  lead: string,
  trail: string,
): string {
  const inline = `${lead}[${items.map(quote).join(', ')}]${trail}`
  if (inline.length <= PRINT_WIDTH) return inline
  const indent = /^\s*/.exec(lead)![0]
  return `${lead}[\n${items.map((i) => `${indent}  ${quote(i)},`).join('\n')}\n${indent}]${trail}`
}

const tsString = (s: string): string => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
const tsKey = (s: string): string => (/^[A-Za-z_$][\w$]*$/.test(s) ? s : tsString(s))

function renderSlots(modules: readonly UiModule[]): string {
  const lines = modules.map((m) => array(m.parts, tsString, `  ${tsKey(m.name)}: `, ','))
  return [
    '// Generated by scripts/gen-ui.ts; do not edit. Regenerate: bun packages/basalt-ui/scripts/gen-ui.ts',
    "// The owner of a `data-slot` is the part; SLOTS mirrors each module's `<name>Parts`.",
    '',
    '/** Every `data-slot` each `basalt-ui/ui/*` module renders, keyed by module name. */',
    modules.length === 0
      ? 'export const SLOTS = {} as const'
      : `export const SLOTS = {\n${lines.join('\n')}\n} as const`,
    '',
    '/** A `basalt-ui/ui/*` module name. */',
    'export type SlotModule = keyof typeof SLOTS',
    '',
  ].join('\n')
}

/** The deny message: one fixed phrasing, `size` first when the table has a `size` axis. */
export function contractMessage(module: string, table: Table): string {
  const name = pascal(table.part)
  const size = table.axes.find((a) => a.name === 'size')
  if (size === undefined) {
    return `${name} owns its height and display: eject it (basalt-ui eject ${module}) to change them.`
  }
  return `${name} owns its height and display: use size (${size.values.join(', ')}), or eject it (basalt-ui eject ${module}).`
}

function renderContracts(modules: readonly UiModule[]): string {
  const json = JSON.stringify
  const contracts = modules.flatMap((m) =>
    m.tables.map((t) =>
      [
        '    {',
        `      "module": ${json(m.name)},`,
        `      "part": ${json(t.part)},`,
        `      "pattern": ${json(`^${pascal(t.part)}$`)},`,
        array(['layout'], json, '      "allow": ', ','),
        array(DENY, json, '      "deny": ', ','),
        `      "message": ${json(contractMessage(m.name, t))}`,
        '    }',
      ].join('\n'),
    ),
  )
  if (contracts.length === 0) return '{ "contracts": [] }\n'
  return `{\n  "contracts": [\n${contracts.join(',\n')}\n  ]\n}\n`
}

const code = (s: string): string => `\`${s}\``

const requote = (quoted: string): string => {
  const text = JSON.parse(quoted) as string
  return /['\n]/.test(text) ? quoted : `'${text}'`
}

/**
 * oxfmt (`singleQuote`) rewrites a double-quoted YAML scalar in the frontmatter as single-quoted,
 * so the docs-format text is requoted the same way to stay a fixed point of `bun run fmt`.
 */
function singleQuoteFrontmatter(markdown: string): string {
  const end = markdown.indexOf('\n---\n', 4)
  return markdown.slice(0, end).replace(/"(?:[^"\\]|\\.)*"/g, requote) + markdown.slice(end)
}

function renderDoc(m: UiModule, subpath: string, peers: readonly string[]): string {
  const head = singleQuoteFrontmatter(
    formatExportDoc({ name: pascal(m.name), subpath, peers, slots: m.parts, jsdoc: m.jsdoc })
      .markdown,
  )
  const tables = m.tables.map((t) => {
    const axes =
      t.axes.length === 0
        ? ['No variant axes.']
        : t.axes.map(
            (a) =>
              `- ${code(a.name)}: ${a.values.map(code).join(', ')} (default ${a.default === undefined ? 'none' : code(a.default)})`,
          )
    return `\n## ${code(t.exportName)}\n\nPart ${code(t.part)}.\n\n${axes.join('\n')}\n`
  })
  const slots = `\n## Slots\n\n${m.parts.map((p) => `- ${code(p)}`).join('\n')}\n`
  return [head, ...tables, slots].join('')
}

// ── The run ──────────────────────────────────────────────────────────────────────────────────────

/** Every generated file, path relative to the package root → text. Throws on an unreadable module. */
export function generate(roots: UiRoots): Map<string, string> {
  const pkgName = (
    JSON.parse(readFileSync(join(roots.pkgRoot, 'package.json'), 'utf8')) as { name: string }
  ).name
  const modules = moduleFiles(roots.pkgRoot).map((f) => readModule(roots.pkgRoot, f))
  const out = new Map<string, string>([
    [SLOTS_FILE, renderSlots(modules)],
    [CONTRACTS_FILE, renderContracts(modules)],
  ])
  for (const m of modules) {
    out.set(`docs/${m.name}.md`, renderDoc(m, `${pkgName}/ui/${m.name}`, roots.peers()))
  }
  return out
}

/** The subpath in a generated doc's frontmatter, or undefined for a hand-written file. */
const generatedSubpath = (text: string): string | undefined =>
  /^---\nname: .*\n(?:.*\n)*?subpath: (\S+)\n/.exec(text)?.[1]?.replace(/^"|"$/g, '')

/** Generated `ui/*` docs on disk that no module produces any more. */
function orphans(roots: UiRoots, files: ReadonlyMap<string, string>): string[] {
  const dir = join(roots.pkgRoot, 'docs')
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !files.has(`docs/${f}`))
    .filter((f) => generatedSubpath(readFileSync(join(dir, f), 'utf8'))?.includes('/ui/') === true)
    .map((f) => `docs/${f}`)
    .toSorted()
}

/** A doc path that a hand-written file already holds: never overwritten. */
function clashes(roots: UiRoots, files: ReadonlyMap<string, string>): string[] {
  return [...files.keys()].filter((rel) => {
    const path = join(roots.pkgRoot, rel)
    return (
      rel.startsWith('docs/') &&
      existsSync(path) &&
      generatedSubpath(readFileSync(path, 'utf8')) === undefined
    )
  })
}

/** Everything `--check` fails on; empty when the tree is clean. */
export function checkUi(roots: UiRoots): string[] {
  const files = generate(roots)
  const clash = new Set(clashes(roots, files))
  const failures = [...clash].map((rel) => `${rel} exists and is not generated; rename it`)
  for (const [rel, text] of files) {
    if (clash.has(rel)) continue
    const path = join(roots.pkgRoot, rel)
    if (!existsSync(path)) failures.push(`${rel} is missing; ${HINT}`)
    else if (readFileSync(path, 'utf8') !== text) failures.push(`${rel} is out of sync; ${HINT}`)
  }
  for (const rel of orphans(roots, files)) {
    failures.push(`${rel} is generated for a module that is gone; ${HINT}`)
  }
  return failures
}

/** Writes every changed file and removes orphans; returns the paths it touched. */
export function writeUi(roots: UiRoots): string[] {
  const files = generate(roots)
  const clash = new Set(clashes(roots, files))
  const written: string[] = []
  for (const [rel, text] of files) {
    const path = join(roots.pkgRoot, rel)
    if (clash.has(rel) || (existsSync(path) && readFileSync(path, 'utf8') === text)) continue
    writeFileSync(path, text, 'utf8')
    written.push(rel)
  }
  for (const rel of orphans(roots, files)) {
    unlinkSync(join(roots.pkgRoot, rel))
    written.push(rel)
  }
  return written
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────────

function run(args: readonly string[]): number {
  const rootAt = args.indexOf('--root')
  const roots = rootAt === -1 ? REAL_ROOTS : fixtureRoots(args[rootAt + 1]!)
  if (args.includes('--check')) {
    const failures = checkUi(roots)
    for (const f of failures) console.error(`✖ gen-ui --check: ${f}`)
    if (failures.length > 0) return 1
    console.log('gen-ui: 0 drift')
    return 0
  }
  const written = writeUi(roots)
  const failures = checkUi(roots)
  for (const f of failures) console.error(`✖ gen-ui: ${f}`)
  if (failures.length > 0) return 1
  console.log(`gen-ui: wrote ${written.length} files`)
  return 0
}

if (import.meta.path === Bun.main) {
  try {
    process.exit(run(process.argv.slice(2)))
  } catch (error) {
    console.error(`✖ gen-ui: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}
