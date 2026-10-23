/**
 * One-line signatures for every public VALUE export of a published subpath, read from the SOURCE
 * entry through the TypeScript checker. Not from `dist/*.d.ts`: `gen-llms --check` runs before the
 * build (Makefile, ci.yml), and the declaration emit is the same checker over the same source.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const pkgRoot = join(import.meta.dirname, '..')
const MAX_LINE = 170
const MAX_PARAM_TYPE = 70
export const MAX_PROP_TYPE = 60
export const MAX_PROPS = 40
/** Named option types printed under one subpath: a prop or parameter type read by name, expanded one level. */
export const MAX_OPTION_TYPES = 10
/** An option type body prints on one line up to this width, else one member per line. */
const MAX_OPTION_LINE = 150
/** Members an expanded option type prints before `… +n more`. */
const MAX_OPTION_MEMBERS = 12
/** A literal-union alias wider than this stays out of the glossary: it would swamp the section. */
export const MAX_UNION_MEMBERS = 12
/** A constant map with more keys than this prints its key tree instead of its values. */
export const MAX_LITERAL_MAP_KEYS = 8
/** Deepest nesting the key tree follows: a self-referential object type must terminate. */
const MAX_TREE_DEPTH = 4

const SCALAR_LITERAL =
  ts.TypeFlags.StringLiteral | ts.TypeFlags.NumberLiteral | ts.TypeFlags.BooleanLiteral

/** `./dist/charts/index.d.ts` → `<pkg>/src/charts/index.ts(x)`; undefined when no source entry exists. */
function sourceEntry(typesPath: string): string | undefined {
  const base = join(pkgRoot, typesPath.replace(/^\.\/dist\//, 'src/').replace(/\.d\.ts$/, ''))
  return [`${base}.ts`, `${base}.tsx`].find(existsSync)
}

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ')
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`
}

type PropEntry = { sym: ts.Symbol; has: boolean }

const isOwn = (p: ts.Symbol): boolean =>
  p.declarations?.some((d) => !d.getSourceFile().fileName.includes('/node_modules/')) === true

/**
 * A first parameter's own top-level members as `name?: type` lines, empty unless it is an object
 * type or a union of them (a primitive has no shape). Nullability is stripped first, so an optional
 * `props?` still gets its block. Members inherited from node_modules (Mantine's `BoxProps`, DOM
 * attributes) are dropped: they are Mantine's to document and would drown the few props basalt-ui
 * adds.
 *
 * A union is a props type with modes (`BasaltProvider`: `router` XOR `children`). Every member's
 * props are merged into one list; a prop that carries a real type in only some members (the other
 * members declare it `?: never`) is tagged `[with <the mode's own required props>]`.
 */
export function propShapeLines(
  checker: ts.TypeChecker,
  paramType: ts.Type,
  node: ts.Node,
  flags: ts.TypeFormatFlags,
): string[] {
  const type = checker.getNonNullableType(paramType)
  const isShape = (t: ts.Type): boolean =>
    (t.flags & (ts.TypeFlags.Object | ts.TypeFlags.Intersection)) !== 0
  const members = type.isUnion() ? type.types : [type]
  if (!members.every(isShape)) return []

  // Per member: which own props carry a real type there (not `?: never` / `undefined`).
  const perMember = members.map((m) =>
    m
      .getProperties()
      .filter(isOwn)
      .map<PropEntry>((sym) => ({
        sym,
        has:
          (checker.getTypeOfSymbolAtLocation(sym, node).flags &
            (ts.TypeFlags.Never | ts.TypeFlags.Undefined)) ===
          0,
      })),
  )
  const hasIn = (name: string): number[] =>
    perMember.flatMap((m, i) => (m.some((e) => e.sym.name === name && e.has) ? [i] : []))
  // A mode is named by a discriminant literal (`kind="a"`) when the members differ in one, else by the
  // required props no other mode carries; a mode with neither stays unnamed.
  const literalOf = (i: number, name: string): string | undefined => {
    const e = perMember[i]!.find((x) => x.sym.name === name && x.has)
    const t = e && checker.getTypeOfSymbolAtLocation(e.sym, node)
    const literal =
      ts.TypeFlags.StringLiteral | ts.TypeFlags.NumberLiteral | ts.TypeFlags.BooleanLiteral
    return t && t.flags & literal ? checker.typeToString(t, node, flags) : undefined
  }
  const discriminant = [...new Set(perMember.flat().map((e) => e.sym.name))].find((name) => {
    const values = perMember.map((_, i) => literalOf(i, name))
    return values.every((v) => v !== undefined) && new Set(values).size === values.length
  })
  const modeName = (i: number): string | undefined => {
    if (discriminant !== undefined) return `${discriminant}=${literalOf(i, discriminant)}`
    const own = perMember[i]!.filter((e) => e.has && (e.sym.flags & ts.SymbolFlags.Optional) === 0)
      .filter((e) => hasIn(e.sym.name).length === 1)
      .map((e) => e.sym.name)
    return own.length > 0 ? own.join(' + ') : undefined
  }
  const modes = members.map((_, i) => modeName(i))

  const lines: string[] = []
  const names = [...new Set(perMember.flat().map((e) => e.sym.name))]
  for (const name of names) {
    // `?` = omittable in some mode. The members that really carry the prop; a prop only ever declared `?: never` falls back to all.
    const carriers = hasIn(name)
    const owners = carriers.length > 0 ? carriers : perMember.map((_, i) => i)
    const entries = owners.flatMap((i) => perMember[i]!.filter((e) => e.sym.name === name))
    const optional = entries.some((e) => (e.sym.flags & ts.SymbolFlags.Optional) !== 0)
    // `getNonNullableType` would expand an alias like ReactNode into its union; strip the text instead.
    const types = [
      ...new Set(
        entries.map((e) =>
          checker
            .typeToString(checker.getTypeOfSymbolAtLocation(e.sym, node), node, flags)
            .replace(/ \| undefined$/, ''),
        ),
      ),
    ]
    // The discriminant prop names its own mode; tagging it `[with <itself>]` says nothing.
    const named = owners
      .flatMap((i) => modes[i] ?? [])
      .filter((m) => !m.split(' + ').includes(name))
    const tag =
      owners.length < members.length && named.length > 0 ? `  [with ${named.join(' | ')}]` : ''
    lines.push(`  ${name}${optional ? '?' : ''}: ${clip(types.join(' | '), MAX_PROP_TYPE)}${tag}`)
  }
  const shown = lines.slice(0, MAX_PROPS)
  if (lines.length > MAX_PROPS) shown.push(`  … +${lines.length - MAX_PROPS} more`)
  // The mode header is not a prop: it sits outside the MAX_PROPS cut.
  const header =
    modes.length > 1 && modes.every((m) => m !== undefined)
      ? [`  one of: ${modes.join(' | ')}`]
      : []
  return [...header, ...shown]
}

/** The members of a plain nested object; empty for primitives, arrays, tuples and functions. */
function membersOf(checker: ts.TypeChecker, t: ts.Type): ts.Symbol[] {
  const plain =
    (t.flags & ts.TypeFlags.Object) !== 0 &&
    t.getCallSignatures().length === 0 &&
    !checker.isArrayLikeType(t)
  return plain ? t.getProperties() : []
}

/** `{ a, b: { c, d } }` — every key down to `MAX_TREE_DEPTH`, no values. */
function keyTree(checker: ts.TypeChecker, type: ts.Type, node: ts.Node, depth = 0): string {
  const parts = type.getProperties().map((k) => {
    const t = checker.getTypeOfSymbolAtLocation(k, node)
    const nested = depth + 1 < MAX_TREE_DEPTH && membersOf(checker, t).length > 0
    return nested ? `${k.name}: ${keyTree(checker, t, node, depth + 1)}` : k.name
  })
  return `{ ${parts.join(', ')} }`
}

/**
 * A non-callable value export. A small `as const` map whose every member is a scalar literal
 * (`CONTAINER_KEYS`) prints its values — the values ARE the API. Anything bigger prints its full key
 * tree (`VX`: the whole token vocabulary, never truncated), wrapped to one indented line per nested
 * group when it will not fit on the signature line.
 */
export function valueSignature(
  checker: ts.TypeChecker,
  name: string,
  type: ts.Type,
  node: ts.Node,
  flags: ts.TypeFormatFlags,
): string {
  const props = type.getProperties()
  if (props.length === 0)
    return clip(`${name}: ${checker.typeToString(type, node, flags)}`, MAX_LINE)
  const entries = props.map((k) => ({ key: k.name, t: checker.getTypeOfSymbolAtLocation(k, node) }))
  if (
    entries.length <= MAX_LITERAL_MAP_KEYS &&
    entries.every(({ t }) => (t.flags & SCALAR_LITERAL) !== 0)
  ) {
    const values = entries.map(({ key, t }) => `${key}: ${checker.typeToString(t, node, flags)}`)
    return clip(`${name}: { ${values.join(', ')} }`, MAX_LINE)
  }
  const flat = `${name}: ${keyTree(checker, type, node)}`
  if (flat.length <= MAX_LINE) return flat
  const groups = entries.filter(({ t }) => membersOf(checker, t).length > 0)
  const leaves = entries.filter((e) => !groups.includes(e)).map((e) => e.key)
  return [
    `${name}: { full key list below }`,
    ...(leaves.length > 0 ? [`  ${leaves.join(', ')}`] : []),
    ...groups.map(({ key, t }) => `  ${key}: ${keyTree(checker, t, node, 1)}`),
  ].join('\n')
}

/** `'a' | 'b'` from a declaration's own type node, in declaration order; undefined unless every member is a scalar literal. */
export function literalUnionText(decl: ts.TypeAliasDeclaration): string | undefined {
  const node = decl.type
  if (!ts.isUnionTypeNode(node) || node.types.length > MAX_UNION_MEMBERS) return undefined
  return node.types.every(ts.isLiteralTypeNode)
    ? node.types.map((n) => n.getText()).join(' | ')
    : undefined
}

/**
 * The exported literal-union type aliases of one entry module that a printed signature references by
 * name, as `type X = 'a' | 'b'` lines sorted by name. Read from declaration source text, so it does
 * not depend on (and must not run before) the checker printing the signatures.
 */
export function typeGlossary(
  checker: ts.TypeChecker,
  source: ts.SourceFile,
  printed: string,
): string[] {
  const moduleSymbol = checker.getSymbolAtLocation(source)
  if (moduleSymbol === undefined) return []
  return checker
    .getExportsOfModule(moduleSymbol)
    .flatMap((exported) => {
      const symbol =
        exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported
      const decl = symbol.declarations?.find(ts.isTypeAliasDeclaration)
      const members = decl && literalUnionText(decl)
      const referenced = new RegExp(
        `(?<![\\w$"'])${exported.name.replace(/\$/g, '\\$')}(?![\\w$"'])`,
      )
      return members !== undefined && referenced.test(printed)
        ? [`type ${exported.name} = ${members}`]
        : []
    })
    .toSorted()
}

const printer = ts.createPrinter({ removeComments: true })

/** A declaration's members/alias body as source text, comments dropped, whitespace collapsed. */
function declBody(decl: ts.TypeAliasDeclaration | ts.InterfaceDeclaration): string[] {
  const source = decl.getSourceFile()
  const text = (n: ts.Node): string =>
    printer
      .printNode(ts.EmitHint.Unspecified, n, source)
      .replace(/\s+/g, ' ')
      .replace(/; \}/g, ' }')
      .replace(/; /g, ', ')
  if (ts.isInterfaceDeclaration(decl)) return decl.members.map((m) => text(m).replace(/;$/, ''))
  const body = decl.type
  return ts.isTypeLiteralNode(body)
    ? body.members.map((m) => text(m).replace(/;$/, ''))
    : [text(body)]
}

/**
 * `Type: Name = { a: A, b?: B }` — one line when it fits, else a block of one member per line. A
 * non-object alias (a union of shapes) prints as its body on one line.
 */
export function optionTypeBlock(decl: ts.TypeAliasDeclaration | ts.InterfaceDeclaration): string {
  const name = decl.name.text
  const members = declBody(decl)
  const isObject = ts.isInterfaceDeclaration(decl) || ts.isTypeLiteralNode(decl.type)
  if (!isObject) return clip(`Type: ${name} = ${members[0]}`, MAX_LINE * 2)
  const flat = `Type: ${name} = { ${members.join(', ')} }`
  if (flat.length <= MAX_OPTION_LINE) return flat
  const shown = members.slice(0, MAX_OPTION_MEMBERS).map((m) => `  ${clip(m, MAX_LINE)}`)
  if (members.length > MAX_OPTION_MEMBERS)
    shown.push(`  … +${members.length - MAX_OPTION_MEMBERS} more`)
  return [`Type: ${name} = {`, ...shown, '}'].join('\n')
}

/** The own object-ish alias or interface a type names, looking through `| undefined`, unions and arrays. */
function namedOptionTypes(checker: ts.TypeChecker, type: ts.Type): ts.Declaration[] {
  const t = checker.getNonNullableType(type)
  const direct = t.aliasSymbol ?? t.getSymbol()
  const decl = direct?.declarations?.find(
    (d): d is ts.TypeAliasDeclaration | ts.InterfaceDeclaration =>
      ts.isTypeAliasDeclaration(d) || ts.isInterfaceDeclaration(d),
  )
  if (decl !== undefined && direct !== undefined && isOwn(direct)) {
    const shape = ts.isInterfaceDeclaration(decl) || ts.isTypeAliasDeclaration(decl)
    const callable = t.getCallSignatures().length > 0
    const literals = ts.isTypeAliasDeclaration(decl) && literalUnionText(decl) !== undefined
    // A generic shape reads as a puzzle without its arguments (`FieldHandle<F>`, `ChartSeries<T>`).
    const generic = decl.typeParameters !== undefined
    if (shape && !callable && !literals && !generic) return [decl]
  }
  if (checker.isArrayType(t))
    return checker
      .getTypeArguments(t as ts.TypeReference)
      .flatMap((a) => namedOptionTypes(checker, a))
  return t.isUnion() && t.aliasSymbol === undefined
    ? t.types.flatMap((member) => namedOptionTypes(checker, member))
    : []
}

/**
 * Per subpath, the named option types a public export's parameters or props name — `DateOptions`
 * of `date()`, `ChartLegendConfig` of a chart's `legend` — as `Type:` blocks, one level deep
 * (a type named only inside another option type is not followed), each once, capped at
 * `MAX_OPTION_TYPES`. The props type that `propShapeLines` already lists member by member is not
 * repeated. A program of its own, like the glossary, so the signatures print as they always did.
 */
export function readOptionTypes(
  subpaths: Readonly<Record<string, string>>,
): Record<string, string[]> {
  const { entries, program } = entryProgram(subpaths)
  const checker = program.getTypeChecker()
  const out: Record<string, string[]> = {}
  for (const [key, file] of entries) {
    const source = program.getSourceFile(file)
    const moduleSymbol = source === undefined ? undefined : checker.getSymbolAtLocation(source)
    if (moduleSymbol === undefined) continue
    const found = new Map<string, ts.TypeAliasDeclaration | ts.InterfaceDeclaration>()
    for (const exported of checker
      .getExportsOfModule(moduleSymbol)
      .toSorted((a, b) => a.name.localeCompare(b.name))) {
      const symbol =
        exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported
      if (!(symbol.flags & ts.SymbolFlags.Value) || exported.name === 'default') continue
      const node = symbol.valueDeclaration ?? symbol.declarations?.[0] ?? source!
      const call = checker.getTypeOfSymbolAtLocation(symbol, node).getCallSignatures()[0]
      if (call === undefined) continue
      for (const [i, param] of call.getParameters().entries()) {
        const paramType = checker.getTypeOfSymbolAtLocation(param, node)
        const named = namedOptionTypes(checker, paramType)
        // The first parameter's own shape is already printed as props.
        const listedAsProps =
          i === 0 &&
          propShapeLines(checker, paramType, node, ts.TypeFormatFlags.NoTruncation).length > 0
        for (const decl of listedAsProps ? [] : named) {
          if (ts.isTypeAliasDeclaration(decl) || ts.isInterfaceDeclaration(decl))
            found.set(decl.name.text, decl)
        }
        if (listedAsProps) {
          const members = checker.getNonNullableType(paramType)
          for (const m of (members.isUnion() ? members.types : [members])
            .flatMap((t) => t.getProperties())
            .filter(isOwn)) {
            for (const decl of namedOptionTypes(
              checker,
              checker.getTypeOfSymbolAtLocation(m, node),
            )) {
              if (ts.isTypeAliasDeclaration(decl) || ts.isInterfaceDeclaration(decl))
                found.set(decl.name.text, decl)
            }
          }
        }
      }
    }
    const blocks = [...found.values()].map(optionTypeBlock).toSorted()
    if (blocks.length > 0) out[key] = blocks.slice(0, MAX_OPTION_TYPES)
  }
  return out
}

/** Program over the published source entries, shared by the signature and glossary readers. */
function entryProgram(subpaths: Readonly<Record<string, string>>) {
  const entries = Object.entries(subpaths).flatMap(([key, typesPath]) => {
    const file = sourceEntry(typesPath)
    return file === undefined ? [] : [[key, file] as const]
  })
  const config = ts.getParsedCommandLineOfConfigFile(
    join(pkgRoot, 'tsconfig.json'),
    { noEmit: true },
    { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} },
  )
  if (config === undefined) throw new Error('llms-signatures: tsconfig.json did not parse')
  const program = ts.createProgram(
    entries.map(([, file]) => file),
    config.options,
  )
  return { entries, program }
}

/**
 * The glossary lines for every documented entry, in a program of their own: the signatures'
 * checker is never asked anything new, so the order it interns (and prints) union members in is
 * the order it always was.
 */
export function readTypeGlossary(
  subpaths: Readonly<Record<string, string>>,
  printed: string,
): string[] {
  const { entries, program } = entryProgram(subpaths)
  const checker = program.getTypeChecker()
  const lines = entries.flatMap(([, file]) => {
    const source = program.getSourceFile(file)
    return source === undefined ? [] : typeGlossary(checker, source, printed)
  })
  return [...new Set(lines)].toSorted()
}

/**
 * Signatures keyed by subpath, each list sorted by export name. An entry may span several lines:
 * the signature, then (for a component or hook taking an object) one indented line per props member.
 */
export function readSignatures(
  subpaths: Readonly<Record<string, string>>,
): Record<string, string[]> {
  const { entries, program } = entryProgram(subpaths)
  const checker = program.getTypeChecker()
  const flags =
    ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope

  const out: Record<string, string[]> = {}
  for (const [key, file] of entries) {
    const source = program.getSourceFile(file)
    const moduleSymbol = source === undefined ? undefined : checker.getSymbolAtLocation(source)
    if (moduleSymbol === undefined) throw new Error(`llms-signatures: no module for ${file}`)
    out[key] = checker
      .getExportsOfModule(moduleSymbol)
      .filter((s) => s.name !== 'default')
      .map((exported) => {
        const symbol =
          exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported
        return { name: exported.name, symbol }
      })
      .filter(({ symbol }) => symbol.flags & ts.SymbolFlags.Value)
      .map(({ name, symbol }) => {
        const node = symbol.valueDeclaration ?? symbol.declarations?.[0] ?? source!
        const type = checker.getTypeOfSymbolAtLocation(symbol, node)
        const call = type.getCallSignatures()[0]
        if (call === undefined) return valueSignature(checker, name, type, node, flags)
        const params = call.getParameters().map((p) => {
          const optional = (p.flags & ts.SymbolFlags.Optional) !== 0
          const paramType = checker.getTypeOfSymbolAtLocation(p, node)
          const text = clip(checker.typeToString(paramType, node, flags), MAX_PARAM_TYPE)
          return `${p.name === '__0' ? 'props' : p.name}${optional ? '?' : ''}: ${text}`
        })
        const returns = checker.typeToString(call.getReturnType(), node, flags)
        const head = clip(
          `${name}(${params.join(', ')}): ${clip(returns, MAX_PARAM_TYPE)}`,
          MAX_LINE,
        )
        const first = call.getParameters()[0]
        if (first === undefined) return head
        const props = propShapeLines(
          checker,
          checker.getTypeOfSymbolAtLocation(first, node),
          node,
          flags,
        )
        return [head, ...props].join('\n')
      })
      .toSorted()
  }
  return out
}
