#!/usr/bin/env bun
/**
 * Guard-completeness gate (docs/v3/ARCHITECTURE.md 4.2). A composite (L4) that calls a primitive
 * with an axis the primitive's guard does not list must fail `tsc` before the primitive is ever
 * changed: the guard's `requires` block is the contract npm composites rely on.
 *
 * For every `basalt-ui/ui/<name>` an L4 composite imports, a stub declaration is derived from the
 * `requires` block of `src/ui/<name>.guard.ts`: each `requires*` function's parameter type is the
 * called-axes type, its `Pick<XProps, ...>` return names the component `X`. The stub's `X` accepts
 * exactly those axes plus the plain DOM attributes. The composites are then type-checked with
 * `basalt-ui/ui/<name>` mapped to the stubs; only diagnostics inside the composites are reported.
 *
 * A module an L4 composite imports must ship a guard; a module none imports needs none.
 * Not a lint id (the lint ceiling is 18): a script gate, wired into `make check`.
 *
 * Usage: bun packages/basalt-ui/src/ui/guard-completeness.ts [--file <composite>]...
 *   --file  check these files instead of scanning the L4 directories (fixtures)
 * Exit 0 when complete, 1 on a violation.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import ts from 'typescript'

const PKG_ROOT = join(import.meta.dirname, '..', '..')

/** The L4 composite directories (ARCHITECTURE section 3). */
export const L4_DIRS = [
  'page',
  'shell',
  'cards',
  'controls',
  'table',
  'charts',
  'content',
  'ai',
  'router',
] as const

const SPECIFIER = /['"]basalt-ui\/ui\/([a-z0-9-]+)['"]/g
const REQUIRES_MARK = '// basalt:guard requires'
const CLOSED_MARK = '// basalt:guard closed'

export type Violation = { file: string; message: string }

const isSource = (f: string): boolean =>
  /\.tsx?$/.test(f) && !f.endsWith('.d.ts') && !/\.test\.tsx?$/.test(f)

function walk(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return walk(p)
    return e.isFile() && isSource(e.name) ? [p] : []
  })
}

/** The `basalt-ui/ui/<name>` modules a file imports. */
export const importedModules = (text: string): string[] => [
  ...new Set([...text.matchAll(SPECIFIER)].map((m) => m[1] ?? '')),
]

/** The `requires` block of a guard: the text between the two markers. */
export function requiresBlock(guardText: string): string | undefined {
  const start = guardText.indexOf(REQUIRES_MARK)
  if (start === -1) return undefined
  const from = start + REQUIRES_MARK.length
  const end = guardText.indexOf(CLOSED_MARK, from)
  return guardText.slice(from, end === -1 ? undefined : end)
}

type Component = { name: string; calledType: string }

/**
 * Stub declaration text for one guard, or an error string. `requires*` consts are
 * `(c: Called): Pick<XProps, ...> => c`; `Called` is a type alias in the block.
 */
export function stubFromGuard(guardText: string): { stub: string } | { error: string } {
  const block = requiresBlock(guardText)
  if (block === undefined) return { error: `no "${REQUIRES_MARK}" marker` }
  const sf = ts.createSourceFile('requires.ts', block, ts.ScriptTarget.ES2022, true)
  const aliases: string[] = []
  const components: Component[] = []
  for (const stmt of sf.statements) {
    if (ts.isTypeAliasDeclaration(stmt)) {
      aliases.push(stmt.getText(sf))
      continue
    }
    if (!ts.isVariableStatement(stmt)) continue
    for (const decl of stmt.declarationList.declarations) {
      const fn = decl.initializer
      if (!decl.name.getText(sf).startsWith('requires') || !fn || !ts.isArrowFunction(fn)) continue
      const param = fn.parameters[0]?.type
      const ret = fn.type
      const pick = ret && ts.isTypeReferenceNode(ret) ? ret : undefined
      const target = pick?.typeArguments?.[0]
      const propsName = target && ts.isTypeReferenceNode(target) ? target.typeName.getText(sf) : ''
      if (!param || !ts.isTypeReferenceNode(param) || !propsName.endsWith('Props')) {
        return {
          error: `${decl.name.getText(sf)} must read (c: Called): Pick<XProps, ...> => c`,
        }
      }
      components.push({
        name: propsName.slice(0, -'Props'.length),
        calledType: param.typeName.getText(sf),
      })
    }
  }
  if (components.length === 0) return { error: 'the requires block declares no requires* function' }
  const lines = [
    "import type { ComponentPropsWithoutRef, ReactElement } from 'react'",
    ...aliases,
    'type Plain = ComponentPropsWithoutRef<"div">',
  ]
  for (const { name, calledType } of components) {
    lines.push(
      `export type ${name}Props = ${calledType} & Omit<Plain, keyof ${calledType}>`,
      `export declare function ${name}(props: ${name}Props): ReactElement`,
    )
  }
  return { stub: `${lines.join('\n')}\n` }
}

export type CheckOptions = {
  pkgRoot?: string
  /** Check these files instead of scanning the L4 directories. */
  files?: readonly string[]
}

/** Every violation, empty when the guards cover every composite call. */
export function checkGuardCompleteness(options: CheckOptions = {}): Violation[] {
  const pkgRoot = options.pkgRoot ?? PKG_ROOT
  const composites = (options.files ?? L4_DIRS.flatMap((d) => walk(join(pkgRoot, 'src', d)))).map(
    (f) => resolve(f),
  )
  const importers = new Map<string, string[]>()
  for (const file of composites) {
    const mods = importedModules(readFileSync(file, 'utf8'))
    if (mods.length > 0) importers.set(file, mods)
  }
  const violations: Violation[] = []
  const modules = [...new Set([...importers.values()].flat())].toSorted()
  const stubDir = join(pkgRoot, '.cache', `guard-completeness-${process.pid}`)
  const paths: Record<string, string[]> = {}
  try {
    mkdirSync(stubDir, { recursive: true })
    for (const name of modules) {
      const guardPath = join(pkgRoot, 'src', 'ui', `${name}.guard.ts`)
      const owner = [...importers].find(([, m]) => m.includes(name))?.[0] ?? guardPath
      if (!existsSync(guardPath)) {
        violations.push({
          file: owner,
          message: `basalt-ui/ui/${name} has no src/ui/${name}.guard.ts`,
        })
        continue
      }
      const result = stubFromGuard(readFileSync(guardPath, 'utf8'))
      if ('error' in result) {
        violations.push({ file: guardPath, message: result.error })
        continue
      }
      const stubPath = join(stubDir, `${name}.d.ts`)
      writeFileSync(stubPath, result.stub)
      paths[`basalt-ui/ui/${name}`] = [stubPath]
    }
    if (Object.keys(paths).length === 0) return violations

    const configPath = join(pkgRoot, 'tsconfig.json')
    const raw = ts.readConfigFile(configPath, ts.sys.readFile)
    const parsed = ts.parseJsonConfigFileContent(raw.config, ts.sys, pkgRoot)
    const { rootDir: _rootDir, ...base } = parsed.options
    const compilerOptions: ts.CompilerOptions = {
      ...base,
      noEmit: true,
      declaration: false,
      declarationMap: false,
      emitDeclarationOnly: false,
      baseUrl: pkgRoot,
      paths,
      skipLibCheck: true,
    }
    const program = ts.createProgram([...importers.keys()], compilerOptions)
    const reported = new Set(importers.keys())
    for (const d of ts.getPreEmitDiagnostics(program)) {
      if (!d.file || !reported.has(resolve(d.file.fileName))) continue
      const { line, character } = d.file.getLineAndCharacterOfPosition(d.start ?? 0)
      violations.push({
        file: d.file.fileName,
        message: `${line + 1}:${character + 1} TS${d.code} ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`,
      })
    }
    return violations
  } finally {
    rmSync(stubDir, { recursive: true, force: true })
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  const files = args.flatMap((a, i) => (a === '--file' && args[i + 1] ? [args[i + 1] ?? ''] : []))
  const violations = checkGuardCompleteness(files.length > 0 ? { files } : {})
  for (const v of violations) console.error(`guard-completeness: ${v.file}: ${v.message}`)
  if (violations.length > 0) process.exit(1)
  console.log('guard-completeness: ok')
}
