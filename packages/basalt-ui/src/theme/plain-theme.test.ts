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
import { createBasaltTheme } from './index'

const DIR = import.meta.dir

/** Functions and hooks: no component module comes with them. */
const FUNCTIONS = new Set([
  'createTheme',
  'defaultVariantColorsResolver',
  'getPrimaryShade',
  'mergeThemeOverrides',
  'rem',
  'px',
  'useMantineTheme',
])

/** Files that RENDER components (not theme config): the components they use are allowed by name. */
const RENDERING: Record<string, readonly string[]> = {
  'ctl-theme.tsx': ['Box', 'MantineThemeProvider'],
  'theme-toggle.tsx': [
    'ActionIcon',
    'Popover',
    'SegmentedControl',
    'useComputedColorScheme',
    'useMantineColorScheme',
  ],
}

const VALUE_IMPORT = /import\s+(?!type\b)\{([^}]*)\}\s+from\s+'@mantine\/core'/g

const sources = readdirSync(DIR).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))

describe('src/theme value-imports no Mantine component', () => {
  test.each(sources)('%s', (file) => {
    const text = readFileSync(join(DIR, file), 'utf8')
    const allowed = new Set([...FUNCTIONS, ...(RENDERING[file] ?? [])])
    const bound = [...text.matchAll(VALUE_IMPORT)].flatMap(([, names = '']) =>
      names
        .split(',')
        .map((n) => n.trim())
        .filter((n) => n !== '' && !n.startsWith('type ')),
    )
    expect(bound.filter((n) => !allowed.has(n))).toEqual([])
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
