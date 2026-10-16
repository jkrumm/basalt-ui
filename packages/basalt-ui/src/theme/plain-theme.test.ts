/**
 * The theme configures Mantine components by NAME and reaches none of them.
 *
 * `Component.extend({...})` is `identity` at runtime, but calling it value-imports the component, so
 * every consumer bundle shipped ~40 components the app never rendered (weatherorb `/map`: ~112 kB
 * gzip). The theme uses `ext<typeof Card>({...})` (`./extend`, type-only imports) instead. Two pins:
 * no value binding of a component under `src/theme/**`, and the produced theme's shape.
 */
import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { createBasaltTheme } from './index'

const DIR = import.meta.dir

/** Functions and hooks: no component module comes with them. */
const FUNCTIONS: ReadonlySet<string> = new Set([
  'createTheme',
  'defaultVariantColorsResolver',
  'getPrimaryShade',
  'mergeThemeOverrides',
  'rem',
  'useMantineTheme',
])

/** Files that RENDER components (not theme config): the components they use are allowed by name. */
const RENDERING: Readonly<Record<string, readonly string[]>> = {
  'ctl-theme.tsx': ['Box', 'MantineThemeProvider'],
  'theme-toggle.tsx': [
    'ActionIcon',
    'Popover',
    'SegmentedControl',
    'useComputedColorScheme',
    'useMantineColorScheme',
  ],
}

const isMantine = (specifier: string): boolean => specifier.startsWith('@mantine/')

const stringOf = (node: ts.Node | undefined): string | undefined =>
  node !== undefined && ts.isStringLiteralLike(node) ? node.text : undefined

/**
 * Every runtime (non-type) binding the source takes from `@mantine/*`: named, default, namespace,
 * side-effect, `export … from`, `import x = require()`, dynamic `import()` and `require()`. Parsed
 * with the compiler API, so formatting, comments and strings cannot hide one.
 */
export function mantineValueBindings(text: string, fileName = 'fixture.tsx'): string[] {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true)
  const found: string[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && isMantine(stringOf(node.moduleSpecifier) ?? '')) {
      const clause = node.importClause
      if (clause === undefined) found.push('(side-effect import)')
      else if (!clause.isTypeOnly) {
        if (clause.name !== undefined) found.push('default')
        const bindings = clause.namedBindings
        if (bindings !== undefined && ts.isNamespaceImport(bindings)) found.push('* as')
        if (bindings !== undefined && ts.isNamedImports(bindings)) {
          for (const el of bindings.elements) {
            if (!el.isTypeOnly) found.push((el.propertyName ?? el.name).text)
          }
        }
      }
    } else if (ts.isExportDeclaration(node) && isMantine(stringOf(node.moduleSpecifier) ?? '')) {
      if (!node.isTypeOnly) {
        const clause = node.exportClause
        if (clause === undefined || ts.isNamespaceExport(clause)) found.push('*')
        else
          for (const el of clause.elements)
            if (!el.isTypeOnly) found.push((el.propertyName ?? el.name).text)
      }
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      isMantine(stringOf(node.moduleReference.expression) ?? '') &&
      !node.isTypeOnly
    ) {
      found.push(node.name.text)
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression
      const isLoad =
        callee.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(callee) && callee.text === 'require')
      if (isLoad && isMantine(stringOf(node.arguments[0]) ?? '')) found.push('(dynamic load)')
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

const sources = (readdirSync(DIR, { recursive: true }) as string[])
  .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && !f.endsWith('.d.ts'))
  .toSorted()

describe('src/theme value-imports no Mantine component', () => {
  test('the scan sees the theme', () => {
    expect(sources).toContain('index.ts')
    expect(sources).toContain('extend.ts')
  })

  test.each(sources)('%s', (file) => {
    const allowed = new Set([...FUNCTIONS, ...(RENDERING[file] ?? [])])
    const bound = mantineValueBindings(readFileSync(join(DIR, file), 'utf8'), file)
    expect(bound.filter((n) => !allowed.has(n))).toEqual([])
  })
})

describe('mantineValueBindings catches every bypass form', () => {
  test.each([
    ['named', `import { Card } from '@mantine/core'`, ['Card']],
    ['named, aliased', `import { Card as C } from '@mantine/core'`, ['Card']],
    ['mixed inline type', `import { type MantineSize, Card } from '@mantine/core'`, ['Card']],
    ['default', `import Core from '@mantine/core'`, ['default']],
    ['namespace', `import * as M from '@mantine/core'`, ['* as']],
    ['side-effect', `import '@mantine/core'`, ['(side-effect import)']],
    ['subpath', `import { Spotlight } from '@mantine/spotlight'`, ['Spotlight']],
    ['subpath, deep', `import { x } from '@mantine/core/styles'`, ['x']],
    ['export-from', `export { Card } from '@mantine/core'`, ['Card']],
    ['export-star', `export * from '@mantine/core'`, ['*']],
    ['export-namespace', `export * as M from '@mantine/core'`, ['*']],
    ['import-equals', `import M = require('@mantine/core')`, ['M']],
    ['dynamic import', `const m = import('@mantine/core')`, ['(dynamic load)']],
    ['require', `const m = require('@mantine/core')`, ['(dynamic load)']],
    ['multiline', `import {\n  rem,\n  Card,\n} from "@mantine/core"`, ['rem', 'Card']],
  ])('%s', (_, text, expected) => {
    expect(mantineValueBindings(text)).toEqual(expected)
  })

  test.each([
    ['import type', `import type { Card } from '@mantine/core'`],
    ['inline type', `import { type Card } from '@mantine/core'`],
    ['default type', `import type Core from '@mantine/core'`],
    ['namespace type', `import type * as M from '@mantine/core'`],
    ['export type', `export type { Card } from '@mantine/core'`],
    ['inline export type', `export { type Card } from '@mantine/core'`],
    ['another package', `import { Card } from 'other'`],
    ['a string that looks like an import', `const s = "import { Card } from '@mantine/core'"`],
    ['a comment', `// import { Card } from '@mantine/core'`],
  ])('%s is not a value binding', (_, text) => {
    expect(mantineValueBindings(text)).toEqual([])
  })
})

describe('createBasaltTheme().components shape', () => {
  const shape = Object.fromEntries(
    Object.entries(createBasaltTheme().components ?? {}).map(([name, c]) => [
      name,
      JSON.parse(
        JSON.stringify(c, (_k, v: unknown) => (typeof v === 'function' ? '[fn]' : v)),
      ) as unknown,
    ]),
  )

  test('keys, defaultProps, classNames, styles, vars-presence', () => {
    expect(shape).toMatchSnapshot()
  })
})
