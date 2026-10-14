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

/** `./dist/charts/index.d.ts` → `<pkg>/src/charts/index.ts(x)`; undefined when no source entry exists. */
function sourceEntry(typesPath: string): string | undefined {
  const base = join(pkgRoot, typesPath.replace(/^\.\/dist\//, 'src/').replace(/\.d\.ts$/, ''))
  return [`${base}.ts`, `${base}.tsx`].find(existsSync)
}

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ')
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`
}

/** Signatures keyed by subpath, each list sorted by export name. */
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
        return clip(`${name}(${params.join(', ')}): ${clip(returns, MAX_PARAM_TYPE)}`, MAX_LINE)
      })
      .toSorted()
  }
  return out
}
