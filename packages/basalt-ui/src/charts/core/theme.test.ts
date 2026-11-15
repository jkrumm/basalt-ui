import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { VX } from '../../tokens'
import { CHART_ENGINE_VARS, CHART_THEME, CV, CV_STATUS } from './theme'

/** The chart layer paints with the v3 sheet alone: every `--vx-*` it reads is one `tokens.css` defines. */
const CHARTS = join(import.meta.dir, '..')
const SHEET = readFileSync(join(CHARTS, '..', 'css', 'tokens.css'), 'utf8')
const DEFINED = new Set(SHEET.match(/--vx-[a-z0-9-]+(?=\s*:)/g))
/** Set by a chart file itself on the element that reads it (`legend.tsx`), with a fallback at the read. */
const LOCAL = new Set(['--vx-hit-gap'])

const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === 'probe' ? [] : sources(path)
    return /\.(tsx?|css)$/.test(name) && !/\.(test|type-guard)\.|\.d\.ts$/.test(name) ? [path] : []
  })

const names = (text: string): string[] => text.match(/--vx-[a-z0-9-]+/g) ?? []
const missing = (found: Iterable<string>): string[] =>
  [...new Set(found)].filter((n) => !DEFINED.has(n) && !LOCAL.has(n))

describe('chart layer reads v3 tokens only', () => {
  test('no source or stylesheet names a --vx-* the v3 sheet lacks', () => {
    const bad = sources(CHARTS).flatMap((file) =>
      missing(names(readFileSync(file, 'utf8'))).map((n) => `${file.slice(CHARTS.length)}: ${n}`),
    )
    expect(bad).toEqual([])
  })

  test('every VX.* a chart file reads resolves to a v3 name', () => {
    const bad: string[] = []
    for (const file of sources(CHARTS)) {
      for (const [, path] of readFileSync(file, 'utf8').matchAll(
        /\bVX\.([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)/g,
      )) {
        const value = path!
          .split('.')
          .reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], VX)
        if (typeof value === 'string')
          for (const n of missing(names(value)))
            bad.push(`${file.slice(CHARTS.length)}: VX.${path} -> ${n}`)
      }
    }
    expect(bad).toEqual([])
  })

  test('the theme bridge, the engine variables and the roles are v3 names', () => {
    const all = [
      JSON.stringify(CHART_THEME),
      ...Object.values(CHART_ENGINE_VARS),
      ...Object.values(CV),
      ...Object.values(CV_STATUS),
    ]
    expect(missing(all.flatMap(names))).toEqual([])
  })

  test('the palette is the five v3 series colours, in order', () => {
    expect(Object.entries(CHART_ENGINE_VARS).filter(([k]) => /^--ts-chart-\d$/.test(k))).toEqual(
      [1, 2, 3, 4, 5].map((n) => [`--ts-chart-${n}`, `var(--vx-chart-${n})`]),
    )
  })
})
