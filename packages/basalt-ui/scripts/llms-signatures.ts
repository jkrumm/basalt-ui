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
  // A mode is named by its required props that no other mode carries.
  const modeName = (i: number): string => {
    const own = perMember[i]!.filter((e) => e.has && (e.sym.flags & ts.SymbolFlags.Optional) === 0)
      .filter((e) => hasIn(e.sym.name).length === 1)
      .map((e) => e.sym.name)
    return own.length > 0 ? own.join(' + ') : `mode ${i + 1}`
  }

  const seen = new Set<string>()
  const lines: string[] = []
  for (const member of perMember) {
    for (const { sym, has } of member) {
      const owners = hasIn(sym.name)
      if (seen.has(sym.name) || (!has && owners.length > 0)) continue
      seen.add(sym.name)
      const optional = (sym.flags & ts.SymbolFlags.Optional) !== 0
      // `getNonNullableType` would expand an alias like ReactNode into its union; strip the text instead.
      const text = checker
        .typeToString(checker.getTypeOfSymbolAtLocation(sym, node), node, flags)
        .replace(/ \| undefined$/, '')
      const tag =
        members.length > 1 && owners.length > 0 && owners.length < members.length
          ? `  [with ${owners.map(modeName).join(' | ')}]`
          : ''
      lines.push(`  ${sym.name}${optional && !tag ? '?' : ''}: ${clip(text, MAX_PROP_TYPE)}${tag}`)
    }
  }
  const shown = lines.slice(0, MAX_PROPS)
  if (lines.length > MAX_PROPS) shown.push(`  … +${lines.length - MAX_PROPS} more`)
  return shown
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
        if (call === undefined) {
          // A value object (`VX`, `field`) is listed by its keys; the full literal type is noise.
          const keys = type.getProperties().map((k) => k.name)
          const shape =
            keys.length === 0 ? checker.typeToString(type, node, flags) : `{ ${keys.join(', ')} }`
          return clip(`${name}: ${shape}`, MAX_LINE)
        }
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
