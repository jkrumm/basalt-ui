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
import { DEFAULT_THEME, mergeMantineTheme } from '@mantine/core'
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
function mantineValueBindings(text: string, fileName = 'fixture.tsx'): string[] {
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

const sources = readdirSync(DIR, { recursive: true, encoding: 'utf8' })
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

const SIZES = [undefined, 'xs', 'sm', 'md', 'lg', 'xl', 'ctl', 'icon']
const VARIANTS = [
  undefined,
  'filled',
  'light',
  'outline',
  'subtle',
  'default',
  'transparent',
  'white',
]
const COLORS = [undefined, 'blue', 'red', 'gray', 'dark', 'accent']
const SCHEMES = ['light', 'dark'] as const

/** `(theme, props, ctx)` probes: size x variant x checked x color x scheme, plus icon-color cases. */
const PROBES: ReadonlyArray<readonly [Record<string, unknown>, { scheme: string }]> = [
  ...SCHEMES.flatMap((scheme) =>
    SIZES.flatMap((size) =>
      VARIANTS.flatMap((variant) =>
        [undefined, true, false].flatMap((checked) =>
          COLORS.map((color) => [{ size, variant, checked, color }, { scheme }] as const),
        ),
      ),
    ),
  ),
  ...SCHEMES.flatMap((scheme) =>
    [{ iconColor: 'red' }, { iconColor: 'var(--x)', size: 'md' }].map(
      (props) => [props, { scheme }] as const,
    ),
  ),
]

/** Functions become their source text; resolver entries also become their distinct outputs. */
function describeValue(value: unknown, theme: unknown, path: string): unknown {
  if (typeof value === 'function') {
    const isResolver = /\.(vars|classNames|styles|variantColorResolver)$/.test(path)
    return isResolver
      ? {
          fn: String(value),
          outputs: distinctOutputs(value as (...args: unknown[]) => unknown, theme, path),
        }
      : String(value)
  }
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((v, i) => describeValue(v, theme, `${path}[${i}]`))
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, describeValue(v, theme, `${path}.${k}`)]),
  )
}

/** The distinct results of a resolver over the probes, with how many probes produced each. */
function distinctOutputs(fn: (...args: unknown[]) => unknown, theme: unknown, path: string) {
  const counts = new Map<string, number>()
  const call = (...args: unknown[]): string => {
    try {
      return JSON.stringify(describeValue(fn(...args), theme, `${path}()`))
    } catch (error) {
      return `threw: ${String(error)}`
    }
  }
  const calls = path.endsWith('variantColorResolver')
    ? VARIANTS.flatMap((variant) =>
        COLORS.flatMap((color) =>
          [false, true].map((autoContrast) =>
            call({ color, theme, variant, gradient: undefined, autoContrast }),
          ),
        ),
      )
    : PROBES.map(([props, ctx]) => call(theme, props, ctx))
  for (const result of calls) counts.set(result, (counts.get(result) ?? 0) + 1)
  return [...counts].map(([result, probes]) => ({ probes, result }))
}

describe('createBasaltTheme() shape and resolver output', () => {
  test.each([
    ['default', undefined],
    ['all knobs', { derive: { accent: '#0b7285' }, radius: 3, density: -2 }],
  ] as const)('%s', (_, options) => {
    const theme = createBasaltTheme(undefined, options)
    const resolved = mergeMantineTheme(DEFAULT_THEME, theme)
    expect(describeValue(theme, resolved, '')).toMatchSnapshot()
  })
})
