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

/** `./dist/charts/index.d.ts` → `<pkg>/src/charts/index.ts(x)`; undefined when no source entry exists. */
function sourceEntry(typesPath: string): string | undefined {
  const base = join(pkgRoot, typesPath.replace(/^\.\/dist\//, 'src/').replace(/\.d\.ts$/, ''))
  return [`${base}.ts`, `${base}.tsx`].find(existsSync)
}

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ')
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`
}

/** Past this many members an alias stays a name: a 30-way union would swamp the line it sits on. */
const MAX_UNION_MEMBERS = 12

/**
 * Every own type alias whose declared type is a union of string or number literals, as
 * `name → "a" | "b"`. The alias NAME is all the checker prints for a prop typed with it, and the
 * members live only in `dist/*.d.ts` — an agent reading `llms.txt` alone had to grep for them.
 * A name declared twice with different members is dropped rather than guessed.
 */
export function collectLiteralUnions(
  checker: ts.TypeChecker,
  files: readonly ts.SourceFile[],
  flags: ts.TypeFormatFlags = ts.TypeFormatFlags.NoTruncation,
): ReadonlyMap<string, string> {
  const found = new Map<string, string | null>()
  const literal = ts.TypeFlags.StringLiteral | ts.TypeFlags.NumberLiteral
  const visit = (node: ts.Node): void => {
    if (ts.isTypeAliasDeclaration(node)) {
      const type = checker.getTypeAtLocation(node.name)
      const ok =
        type.isUnion() &&
        type.types.length <= MAX_UNION_MEMBERS &&
        type.types.every((t) => (t.flags & literal) !== 0)
      if (ok) {
        const declared =
          ts.isUnionTypeNode(node.type) && node.type.types.every(ts.isLiteralTypeNode)
            ? node.type.types.map((n) => checker.getTypeFromTypeNode(n))
            : type.types
        const text = declared.map((t) => checker.typeToString(t, node, flags)).join(' | ')
        const name = node.name.text
        found.set(name, found.has(name) && found.get(name) !== text ? null : text)
      }
    }
    ts.forEachChild(node, visit)
  }
  for (const file of files) {
    if (file.isDeclarationFile || file.fileName.includes('/node_modules/')) continue
    visit(file)
  }
  return new Map([...found].flatMap(([k, v]) => (v === null ? [] : [[k, v] as const])))
}

/** Replaces each known union alias name in a printed type with its members (parenthesised before `[]`). */
function expandUnions(text: string, unions: ReadonlyMap<string, string>): string {
  if (unions.size === 0) return text
  return text.replace(/(?<![\w"'.])[A-Za-z_$][\w$]*(?![\w"'])(\[\])?/g, (match, arr?: string) => {
    const name = arr === undefined ? match : match.slice(0, -2)
    const members = unions.get(name)
    if (members === undefined) return match
    return arr === undefined ? members : `(${members})[]`
  })
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
  unions: ReadonlyMap<string, string> = new Map(),
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
    lines.push(
      `  ${name}${optional ? '?' : ''}: ${expandUnions(clip(types.join(' | '), MAX_PROP_TYPE), unions)}${tag}`,
    )
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

const LITERAL =
  ts.TypeFlags.StringLiteral | ts.TypeFlags.NumberLiteral | ts.TypeFlags.BooleanLiteral

/** The members of a plain nested object; empty for primitives, arrays, functions and anything else. */
function membersOf(checker: ts.TypeChecker, t: ts.Type): ts.Symbol[] {
  const plain =
    (t.flags & ts.TypeFlags.Object) !== 0 &&
    t.getCallSignatures().length === 0 &&
    !checker.isArrayLikeType(t)
  return plain ? t.getProperties() : []
}

/** `{ a, b: { c, d } }` — every key at every depth, no values. */
function keyTree(checker: ts.TypeChecker, type: ts.Type, node: ts.Node): string {
  const parts = type.getProperties().map((k) => {
    const t = checker.getTypeOfSymbolAtLocation(k, node)
    const nested = membersOf(checker, t)
    return nested.length > 0 ? `${k.name}: ${keyTree(checker, t, node)}` : k.name
  })
  return `{ ${parts.join(', ')} }`
}

/**
 * A value object (not callable). A small `as const` map whose every member is a literal
 * (`CONTAINER_KEYS`) prints its values — the values ARE the API. Anything bigger prints its full key
 * tree (`VX`: the whole token vocabulary, never truncated), wrapped to one indented line per
 * top-level member when it will not fit on the signature line.
 */
function valueSignature(
  checker: ts.TypeChecker,
  name: string,
  type: ts.Type,
  node: ts.Node,
  flags: ts.TypeFormatFlags,
): string {
  const props = type.getProperties()
  if (props.length === 0)
    return clip(`${name}: ${checker.typeToString(type, node, flags)}`, MAX_LINE)
  const types = props.map((k) => checker.getTypeOfSymbolAtLocation(k, node))
  if (props.length <= 8 && types.every((t) => (t.flags & LITERAL) !== 0)) {
    const entries = props.map(
      (k, i) => `${k.name}: ${checker.typeToString(types[i]!, node, flags)}`,
    )
    return clip(`${name}: { ${entries.join(', ')} }`, MAX_LINE)
  }
  const flat = `${name}: ${keyTree(checker, type, node)}`
  if (flat.length <= MAX_LINE) return flat
  const rows = props.map((k, i) => {
    const nested = membersOf(checker, types[i]!)
    return nested.length > 0 ? `  ${k.name}: ${keyTree(checker, types[i]!, node)}` : undefined
  })
  const leaves = props.filter((_, i) => rows[i] === undefined).map((k) => k.name)
  return [
    `${name}: { full key list below }`,
    `  ${leaves.join(', ')}`,
    ...rows.filter((r) => r !== undefined),
  ].join('\n')
}

/**
 * Signatures keyed by subpath, each list sorted by export name. An entry may span several lines:
 * the signature, then (for a component or hook taking an object) one indented line per props member.
 */
export function readSignatures(
  subpaths: Readonly<Record<string, string>>,
): Record<string, string[]> {
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
  const checker = program.getTypeChecker()
  const flags =
    ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope
  const unions = collectLiteralUnions(checker, program.getSourceFiles(), flags)

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
          const text = expandUnions(
            clip(checker.typeToString(paramType, node, flags), MAX_PARAM_TYPE),
            unions,
          )
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
          unions,
        )
        return [head, ...props].join('\n')
      })
      .toSorted()
  }
  return out
}
