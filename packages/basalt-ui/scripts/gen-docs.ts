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
import { isEjectPath } from './export-keys'
import { currentArms, propShapeLines, valueSignature } from './llms-signatures'
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

/** `StatCard` → `stat-card`, `createSearchStore` → `create-search-store`, `MOTION_DURATION` → `motion-duration`. */
export function kebab(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replaceAll('_', '-')
    .toLowerCase()
}

// ── Extraction ───────────────────────────────────────────────────────────────────────────────────

type Extracted = {
  info: ExportInfo
  /** The rendered `## Signature` text. */
  signature: string
  /** The export's `@example` JSDoc tags, fences stripped. */
  examples: string[]
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

export function compilerOptions(pkgRoot: string): ts.CompilerOptions {
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
    if (key.startsWith('./ui/') || isEjectPath(key) || typeof value !== 'object' || value === null)
      return []
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

/**
 * The `@example` bodies of a symbol, fences stripped. Read from the comment's own text: TypeScript
 * ends an example at an `@` after a space, so a `// @check` line would cut the body short.
 */
function jsdocExamples(symbol: ts.Symbol): string[] {
  const node = symbol.valueDeclaration ?? symbol.declarations?.[0]
  if (node === undefined) return []
  const file = node.getSourceFile()
  return ts
    .getJSDocCommentsAndTags(node)
    .filter(ts.isJSDoc)
    .flatMap((doc) => exampleBodies(file.text.slice(doc.getStart(file), doc.end)))
}

/** The `@example` bodies in one raw JSDoc comment: each runs to the next tag or the comment's end. */
function exampleBodies(comment: string): string[] {
  const bodies: string[][] = []
  let open: string[] | undefined
  for (const raw of comment.split('\n')) {
    const line = raw.replace(/^\s*(?:\/\*\*|\*\/|\*)? ?/, '').replace(/\s*\*\/\s*$/, '')
    const tag = /^@(\w+)/.exec(line)
    if (tag !== null) {
      open = tag[1] === 'example' ? [line.slice(tag[0].length)] : undefined
      if (open !== undefined) bodies.push(open)
      continue
    }
    open?.push(line)
  }
  return bodies
    .map((lines) =>
      lines
        .join('\n')
        .trim()
        .replace(/^```\w*\n/, '')
        .replace(/\n```$/, '')
        .trim(),
    )
    .filter((text) => text !== '')
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
  /** Doc file names claimed by a baselined legacy export (any subpath), which a later v3 subpath may take over. */
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
  // TRANSITIONAL: a baselined legacy export is a shadow (a root export, or a 2.x subpath one such as
  // `./commands`). A non-root (v3) export of the same name takes the doc file; the legacy one stays
  // undocumented and baselined.
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
    if (acc.baseline.has(`${at.subpath}#${name}`)) acc.legacy.add(kebab(name))
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
    examples: jsdocExamples(symbol),
  })
}

/** Every public value export, once, under the first subpath that has it, except that a subpath beats the root. */
function extractExports(roots: GenRoots): {
  exports: Extracted[]
  problems: string[]
  index: ExportIndex
} {
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

  const read = entries.map(({ key, file }) => {
    const source = program.getSourceFile(file)
    return {
      key,
      file,
      source,
      values: source === undefined ? undefined : valueExports(checker, source),
    }
  })
  // The root barrel re-exports the widest set, so a subpath that also exports a symbol names it:
  // `createChannel` is `basalt-ui/data`'s. The root keeps what no subpath has.
  const home = (key: string, symbol: ts.Symbol) =>
    key !== '.'
      ? undefined
      : read.find((r) => r.key !== '.' && r.values?.some((v) => v.symbol === symbol))
  for (const { key, file, source, values } of read) {
    if (source === undefined || values === undefined) {
      acc.problems.push(`${key}: no module symbol for ${relative(roots.pkgRoot, file)}`)
      continue
    }
    for (const value of values.filter((v) => !acc.seen.has(v.symbol))) {
      acc.seen.add(value.symbol)
      const narrower = home(key, value.symbol)
      const at =
        narrower?.source === undefined
          ? { key, source }
          : { key: narrower.key, source: narrower.source }
      extractOne(
        checker,
        roots,
        { ...at, subpath: at.key === '.' ? pkgName : `${pkgName}${at.key.slice(1)}` },
        value,
        acc,
      )
    }
  }
  const cards = read.find((r) => r.key === CARD_TYPES_ENTRY)
  if (cards?.source !== undefined) {
    extractCardTypes(checker, roots, { source: cards.source, subpath: `${pkgName}/cards` }, acc)
  }
  const exports = acc.out.toSorted((x, y) => x.info.name.localeCompare(y.info.name))
  return { exports, problems: acc.problems, index: exportIndex(checker, read, pkgName) }
}

/** The `./cards` entry owns the card value types; its package export key. */
const CARD_TYPES_ENTRY = './cards'

/** The shared card types a page must read to write a card's props. Types, so no value-export walk finds them. */
const CARD_TYPE_DOCS = ['Delta', 'Verdict', 'Empty', 'FootFacts', 'Fact'] as const

/** One doc per card type: its declaration as the signature, JSDoc held to the same gate as a value export. */
function extractCardTypes(
  checker: ts.TypeChecker,
  roots: GenRoots,
  at: { source: ts.SourceFile; subpath: string },
  acc: Collected,
): void {
  const moduleSymbol = checker.getSymbolAtLocation(at.source)
  if (moduleSymbol === undefined) return
  const exported = checker.getExportsOfModule(moduleSymbol)
  for (const name of CARD_TYPE_DOCS) {
    const found = exported.find((e) => e.name === name)
    const symbol =
      found !== undefined && found.flags & ts.SymbolFlags.Alias
        ? checker.getAliasedSymbol(found)
        : found
    const decl = symbol?.declarations?.find(ts.isTypeAliasDeclaration)
    if (symbol === undefined || decl === undefined) {
      acc.problems.push(`${name} (${at.subpath}): not exported as a type alias`)
      continue
    }
    const taken = acc.names.get(kebab(name))
    if (taken !== undefined) {
      acc.problems.push(
        `${name} (${at.subpath}): docs/${kebab(name)}.md is already taken by ${taken}`,
      )
      continue
    }
    acc.names.set(kebab(name), `${name} (${at.subpath})`)
    acc.out.push({
      info: {
        name,
        subpath: at.subpath,
        peers: roots.peersFor(CARD_TYPES_ENTRY),
        slots: [],
        jsdoc: jsdocOf(checker, symbol),
      },
      signature: decl.getText().replace(/^export /, ''),
      examples: jsdocExamples(symbol),
    })
  }
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
export function signatureOf(
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
      : docPropLines(checker, checker.getTypeOfSymbolAtLocation(first, node), node)
  return [head.replace('__0:', 'props:'), ...props, ...returnedMembers(checker, call, node)].join(
    '\n',
  )
}

const isOwnSymbol = (s: ts.Symbol): boolean =>
  s.declarations?.some((d) => !d.getSourceFile().fileName.includes('/node_modules/')) === true

type Carried = { symbol: ts.Symbol; carried: boolean; optional: boolean }

/** `name` → how one union member declares it: absent or `?: never` is not carried. */
function carriedProps(checker: ts.TypeChecker, member: ts.Type, node: ts.Node) {
  const out = new Map<string, Carried>()
  for (const symbol of member.getProperties().filter(isOwnSymbol)) {
    const flags = checker.getTypeOfSymbolAtLocation(symbol, node).flags
    out.set(symbol.name, {
      symbol,
      carried: (flags & (ts.TypeFlags.Never | ts.TypeFlags.Undefined)) === 0,
      optional: (symbol.flags & ts.SymbolFlags.Optional) !== 0,
    })
  }
  return out
}

/** The top-level `|` members of a printed type: a `|` inside `()`, `{}`, `[]`, `<>` or a string stays. */
export function unionMembers(text: string): string[] {
  const out: string[] = []
  let depth = 0
  let quote = ''
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!
    if (quote !== '') {
      if (c === '\\') i++
      else if (c === quote) quote = ''
    } else if (c === '"' || c === "'" || c === '`') quote = c
    else if ('({[<'.includes(c)) depth++
    else if (')}]>'.includes(c) && !(c === '>' && text[i - 1] === '=')) depth--
    else if (c === '|' && depth === 0) {
      out.push(text.slice(start, i).trim())
      start = i + 1
    }
  }
  out.push(text.slice(start).trim())
  return out.filter((m) => m !== '')
}

/** A prop's type whole, each union member once: the one-per-arm types merged into one list. */
function propType(checker: ts.TypeChecker, symbols: ts.Symbol[], node: ts.Node): string {
  const members = symbols.flatMap((symbol) =>
    unionMembers(
      checker
        .typeToString(checker.getTypeOfSymbolAtLocation(symbol, node), node, TYPE_FLAGS)
        .replace(/\s+/g, ' '),
    ),
  )
  // An arm that narrows another arm's prop to a literal (`phase: 'loading'` against `Phase | QueryStateLike`)
  // prints as `(<that union>) & "loading"`: the wider arm already names it, so the intersection is noise.
  const narrowed = /^\(.*\) & ("[^"]*"|'[^']*')$/
  return [...new Set(members.filter((m) => m !== 'undefined' && !narrowed.test(m)))].join(' | ')
}

/** The first sentence of a prop's JSDoc and its `@default`, as one `// ...` comment; '' without either. */
function propNote(checker: ts.TypeChecker, symbol: ts.Symbol): string {
  const summary = ts.displayPartsToString(symbol.getDocumentationComment(checker)).trim()
  const first = /^[\s\S]*?(?:\.(?=\s|$)|$)/.exec(summary)?.[0] ?? ''
  const tag = symbol.getJsDocTags(checker).find((t) => t.name === 'default')
  const fallback = tag?.text === undefined ? '' : ts.displayPartsToString(tag.text).trim()
  const parts = [
    first.replace(/\s+/g, ' ').trim().replace(/\.$/, ''),
    fallback === '' ? '' : `default ${fallback}`,
  ]
  const note = parts.filter((p) => p !== '').join('; ')
  return note === '' ? '' : `  // ${note}`
}

/**
 * The props block of a signature. `propShapeLines` lists every arm's props as one flat list, so a
 * prop that only one arm of a union carries would read as required. Here such a prop is marked
 * omittable, one `// either a or b or neither` line names the arms, and a prop's JSDoc summary and
 * `@default` follow it as a comment.
 */
function docPropLines(checker: ts.TypeChecker, paramType: ts.Type, node: ts.Node): string[] {
  const lines = propShapeLines(checker, paramType, node, TYPE_FLAGS)
  if (lines.length === 0) return lines
  const type = checker.getNonNullableType(paramType)
  const members = currentArms(checker, type, node).map((m) => carriedProps(checker, m, node))
  const names = new Set(members.flatMap((m) => [...m.keys()]))
  const carriedBy = (name: string): number => members.filter((m) => m.get(name)?.carried).length
  const conditional = new Set(
    members.length > 1 ? [...names].filter((n) => carriedBy(n) < members.length) : [],
  )
  const symbolOf = (name: string): ts.Symbol | undefined =>
    members.find((m) => m.get(name)?.carried)?.get(name)?.symbol ??
    members.find((m) => m.has(name))?.get(name)?.symbol

  const armLabel = (arm: Map<string, Carried>): string => {
    const required = [...arm].filter(
      ([name, e]) =>
        e.carried &&
        !e.optional &&
        (conditional.has(name) ||
          members.some((m) => m.get(name)?.carried && m.get(name)?.optional)),
    )
    const optional = [...arm].filter(
      ([name, e]) => e.carried && e.optional && conditional.has(name),
    )
    const req = required.map(([name]) => name)
    const opt = optional.map(([name]) => name)
    return (req.length > 0 ? req : opt).join(' + ') || 'neither'
  }
  const labels = [...new Set(members.map(armLabel))].toSorted(
    (a, b) => Number(a === 'neither') - Number(b === 'neither'),
  )
  const arms =
    members.length > 1 && labels.length > 1
      ? [`  // either ${labels.slice(0, -1).join(', ')} or ${labels.at(-1)}`]
      : []

  const body = lines
    .filter((l) => !l.startsWith('  one of:'))
    .map((line) => {
      const m = /^ {2}(\w+)(\?)?: (.*)$/.exec(line)
      if (m === null) return line
      const [, name, , rest] = m as unknown as [string, string, string | undefined, string]
      const symbol = symbolOf(name)
      const note = symbol === undefined ? '' : propNote(checker, symbol)
      const omittable = m[2] === '?' || conditional.has(name)
      const carriers = members.flatMap((arm) => {
        const e = arm.get(name)
        return e?.carried === true ? [e.symbol] : []
      })
      const owners = carriers.length > 0 ? carriers : symbol === undefined ? [] : [symbol]
      const tag = /( {2}\[with .*\])$/.exec(rest)?.[1] ?? ''
      const type =
        owners.length > 0
          ? propType(checker, owners, node)
          : rest.slice(0, rest.length - tag.length)
      return `  ${name}${omittable ? '?' : ''}: ${type}${tag}${note}`
    })
  return [...arms, ...body]
}

/** The members a call returns when it returns an object of methods (`col<T>()`): one line each. */
function returnedMembers(checker: ts.TypeChecker, call: ts.Signature, node: ts.Node): string[] {
  const returned = call.getReturnType()
  const methods = returned.getProperties().filter(isOwnSymbol)
  const isFactory =
    returned.getCallSignatures().length === 0 &&
    returned.aliasSymbol !== undefined &&
    methods.length >= 3 &&
    methods.every((s) => checker.getTypeOfSymbolAtLocation(s, node).getCallSignatures().length > 0)
  if (!isFactory) return []
  const signatures = methods.map(
    (s) => checker.getTypeOfSymbolAtLocation(s, node).getCallSignatures()[0]!,
  )
  return [
    `  returns ${returned.aliasSymbol!.name}:`,
    ...methods.map(
      (s, i) =>
        `    ${s.name}${checker.signatureToString(signatures[i]!, node, TYPE_FLAGS).replace(/\s+/g, ' ')}`,
    ),
    ...optionTypeLines(checker, signatures, node),
  ]
}

/** Each object type a method of the factory takes as an argument (`StatusOptions<O>`), once, with its fields. */
function optionTypeLines(
  checker: ts.TypeChecker,
  signatures: ts.Signature[],
  node: ts.Node,
): string[] {
  const seen = new Set<string>()
  const lines: string[] = []
  for (const sig of signatures) {
    for (const param of sig.getParameters()) {
      const type = checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(param, node))
      const name = checker.typeToString(type, node, TYPE_FLAGS).replace(/\s+/g, ' ')
      const symbol = type.aliasSymbol ?? type.getSymbol()
      const named = symbol !== undefined && !['__type', '__object', 'Array'].includes(symbol.name)
      if (!named || seen.has(name) || type.getProperties().length === 0) continue
      seen.add(name)
      const fields = docPropLines(checker, type, node)
      if (fields.length > 0) lines.push('', `  ${name}:`, ...fields.map((l) => `  ${l}`))
    }
  }
  return lines
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

// ── Import lines ─────────────────────────────────────────────────────────────────────────────────

/** Where a published name imports from: one entry per subpath that exports it. */
type NameHome = { subpath: string; value: boolean }

/** Every published name, with each entry that exports it: the root barrel last, so a subpath wins. */
type ExportIndex = Map<string, NameHome[]>

function exportIndex(
  checker: ts.TypeChecker,
  read: ReadonlyArray<{ key: string; source: ts.SourceFile | undefined }>,
  pkgName: string,
): ExportIndex {
  const index: ExportIndex = new Map()
  const ordered = read.toSorted(
    (x, y) => Number(x.key === '.') - Number(y.key === '.') || x.key.localeCompare(y.key),
  )
  for (const { key, source } of ordered) {
    const moduleSymbol = source === undefined ? undefined : checker.getSymbolAtLocation(source)
    if (moduleSymbol === undefined) continue
    const subpath = key === '.' ? pkgName : `${pkgName}${key.slice(1)}`
    for (const exported of checker.getExportsOfModule(moduleSymbol)) {
      if (exported.name === 'default') continue
      const symbol =
        exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported
      const value = (symbol.flags & ts.SymbolFlags.Value) !== 0
      index.set(exported.name, [...(index.get(exported.name) ?? []), { subpath, value }])
    }
  }
  return index
}

/** Names a signature uses that the language or React owns: never a published export. */
const BUILTIN_NAMES: ReadonlySet<string> = new Set([
  'any',
  'unknown',
  'never',
  'void',
  'undefined',
  'null',
  'true',
  'false',
  'object',
  'string',
  'number',
  'boolean',
  'bigint',
  'symbol',
  'readonly',
  'extends',
  'keyof',
  'typeof',
  'infer',
  'const',
  'new',
  'in',
  'as',
  'is',
  'returns',
  'Array',
  'ReadonlyArray',
  'Record',
  'Partial',
  'Required',
  'Readonly',
  'Pick',
  'Omit',
  'Exclude',
  'Extract',
  'NonNullable',
  'Parameters',
  'ReturnType',
  'Awaited',
  'Promise',
  'PromiseLike',
  'Map',
  'Set',
  'Date',
  'Error',
  'Function',
  'Object',
  'String',
  'Number',
  'Boolean',
  'Symbol',
  'PropertyKey',
  'Iterable',
  'Element',
  'HTMLElement',
  'Event',
  'MouseEvent',
  'KeyboardEvent',
  'ChangeEvent',
  'FocusEvent',
  'ReactElement',
  'ReactNode',
  'ReactPortal',
  'ComponentProps',
  'ComponentType',
  'CSSProperties',
  'RefObject',
  'MutableRefObject',
  'JSX',
])

/** The identifiers a signature names as code: comments, strings, notes, property keys and members left out. */
function namesIn(signature: string): string[] {
  const code = signature
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\[with [^\]]*\]/g, '')
    .replace(/"[^"\n]*"|'[^'\n]*'|`[^`\n]*`/g, '')
    .replace(/\.[A-Za-z_$][\w$]*/g, '')
    .replace(/[A-Za-z_$][\w$]*\??(?=\s*:)/g, '')
  return [...new Set(code.match(/[A-Za-z_$][\w$]*/g) ?? [])]
}

/** The root barrel sorts last; other subpaths by name. */
const rootLast = (x: string, y: string): number =>
  Number(!x.includes('/')) - Number(!y.includes('/')) || x.localeCompare(y)

/**
 * One import line per subpath the signature's published types and components come from, grouped and
 * sorted; '' when it names none. A name exported by several entries imports from the doc's own
 * subpath when that one exports it, else from the first entry in index order. Only a PascalCase name
 * is a candidate: a lowercase export (`field`, `spec`) is a parameter name in a signature, not a type.
 */
function importLines(item: Extracted, index: ExportIndex): string {
  const picked = new Map<string, Array<{ name: string; value: boolean }>>()
  for (const name of namesIn(item.signature)) {
    if (name === item.info.name || BUILTIN_NAMES.has(name) || !/^[A-Z]/.test(name)) continue
    const homes = index.get(name)
    const home = homes?.find((h) => h.subpath === item.info.subpath) ?? homes?.[0]
    if (home === undefined) continue
    picked.set(home.subpath, [...(picked.get(home.subpath) ?? []), { name, value: home.value }])
  }
  return [...picked]
    .toSorted(([x], [y]) => rootLast(x, y))
    .map(([subpath, members]) => {
      const named = members.toSorted((x, y) => x.name.localeCompare(y.name))
      const names = named.map((m) => m.name)
      const statement = named.every((m) => !m.value)
        ? `import type { ${names.join(', ')} } from '${subpath}'`
        : `import { ${named.map((m) => (m.value ? m.name : `type ${m.name}`)).join(', ')} } from '${subpath}'`
      return `\n\`${names.join('`, `')}\` import from \`${subpath}\`: \`${statement}\`.\n`
    })
    .join('')
}

/** `docs/<kebab-name>.md`: the docs-format text, the signature, then the example regions. */
function renderDoc(item: Extracted, examples: readonly Example[], index: ExportIndex): string {
  const { name } = item.info
  const mine = examples.filter((e) => e.name === name || e.name === kebab(name))
  const parts = [
    formatExportDoc(item.info).markdown,
    `\n## Signature\n\n\`\`\`ts\n${item.signature}\n\`\`\`\n${importLines(item, index)}`,
    ...item.examples.map((body) => `\n## Example\n\n\`\`\`tsx\n${body}\n\`\`\`\n`),
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
  const { exports, problems: extraction, index } = extractExports(roots)
  const examples = scanExamples(roots)
  const baseline = new Set(readBaseline(roots))
  const docs = new Map<string, string>()
  const undocumented: string[] = []
  const problems = [...extraction]

  for (const item of exports) {
    const gaps = checkExport(item.info)
    if (gaps.length === 0) {
      docs.set(`${kebab(item.info.name)}.md`, renderDoc(item, examples, index))
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
