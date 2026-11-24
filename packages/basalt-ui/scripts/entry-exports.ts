/**
 * The names each published JS entry exports, read by the TypeScript checker from the source entry
 * files the `exports` map points at (`./dist/<path>.d.ts` is `src/<path>.ts` or `.tsx`). `export *`,
 * re-exports and `export type` all count, so the answer is what a consumer can import, never a grep.
 *
 * `./ui/*` expands to one entry per shipped primitive seed (`basalt-ui/ui/<name>`). `./core/*` paths
 * are left out on purpose: they exist for ejected primitives, never as a home for a public type.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

import { seedNames } from '../src/cli/merge/seed'

type ExportTarget = string | null | { readonly types?: string; readonly import?: string }

/** `./dist/router/index.d.ts` → `<root>/src/router/index.ts(x)`, or undefined for a non-TS asset. */
function sourceOf(pkgRoot: string, types: string): string | undefined {
  if (!types.startsWith('./dist/') || !types.endsWith('.d.ts')) return undefined
  const stem = join(pkgRoot, 'src', types.slice('./dist/'.length, -'.d.ts'.length))
  return [`${stem}.ts`, `${stem}.tsx`].find((f) => existsSync(f))
}

/** Published specifier (`basalt-ui`, `basalt-ui/shell`, `basalt-ui/ui/button`) → its source entry file. */
export function entryFiles(pkgRoot: string): Map<string, string> {
  const manifest = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8')) as {
    exports: Record<string, ExportTarget>
  }
  const out = new Map<string, string>()
  for (const [key, target] of Object.entries(manifest.exports)) {
    if (target === null || typeof target === 'string' || target.types === undefined) continue
    const specifier = key === '.' ? 'basalt-ui' : `basalt-ui/${key.slice(2)}`
    if (key === './ui/*') {
      for (const name of seedNames(pkgRoot)) {
        const file = sourceOf(pkgRoot, target.types.replace('*', name))
        if (file !== undefined) out.set(`basalt-ui/ui/${name}`, file)
      }
      continue
    }
    if (key.includes('*') || key.startsWith('./core/')) continue
    const file = sourceOf(pkgRoot, target.types)
    if (file !== undefined) out.set(specifier, file)
  }
  return out
}

/** Published specifier → every name it exports (values and types). */
export function entryExports(pkgRoot: string): Map<string, ReadonlySet<string>> {
  const files = entryFiles(pkgRoot)
  const program = ts.createProgram([...files.values()], {
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
    allowImportingTsExtensions: true,
    noEmit: true,
    skipLibCheck: true,
    types: [],
  })
  const checker = program.getTypeChecker()
  const out = new Map<string, ReadonlySet<string>>()
  for (const [specifier, file] of files) {
    const source = program.getSourceFile(file)
    const symbol = source === undefined ? undefined : checker.getSymbolAtLocation(source)
    const names = symbol === undefined ? [] : checker.getExportsOfModule(symbol).map((s) => s.name)
    out.set(specifier, new Set(names))
  }
  return out
}

/** The specifiers that export `name`, sorted. */
export function homesOf(exports: ReadonlyMap<string, ReadonlySet<string>>, name: string): string[] {
  return [...exports]
    .filter(([, names]) => names.has(name))
    .map(([s]) => s)
    .toSorted()
}
