/**
 * Pins every width `@media` literal — in `src/**\/*.css` and in the emitted token CSS — to
 * `SIZE_CLASSES`. A media condition cannot read a custom property, so the number is written in
 * CSS and this test is the only tie back to the table.
 */
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildPaletteCss } from '.'
import {
  CONTAINER_CLASSES,
  SIZE_CLASSES,
  SIZE_CLASS_BREAKPOINTS,
  sizeClassMaxEm,
} from './size-classes'

const SRC = join(import.meta.dir, '..')

const sizeLiterals = new Set(
  Object.values(SIZE_CLASSES)
    .filter((px) => px > 0)
    .flatMap((px) => [`${px / 16}em`, sizeClassMaxEm(px)]),
)

/**
 * Component-shape rules still on a viewport `@media` (a container question — later waves move them
 * onto `@container` and delete their entry here). Keyed by file relative to `src/`.
 */
const COMPONENT_SHAPE_LEGACY: Record<string, readonly string[]> = {
  'forms/form-layout.module.css': ['47.99375em'],
  'dashboard/stat-card.module.css': ['47.99375em'],
  'dashboard/widget-header.module.css': ['47.99375em'],
  'dashboard/widget-grid.module.css': ['48em'],
  'dashboard/stat-group.module.css': ['48em', '47.99375em'],
  'content/article-layout.module.css': ['1200px'],
}

function widthLiterals(css: string): string[] {
  const out: string[] = []
  for (const line of css.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')) {
    if (!line.includes('@media')) continue
    for (const m of line.matchAll(/\((?:min|max)-width:\s*([\d.]+(?:em|px))\)/g)) out.push(m[1]!)
  }
  return out
}

describe('breakpoint literals', () => {
  const files = [...new Bun.Glob('**/*.css').scanSync({ cwd: SRC })]

  test('finds the stylesheets', () => {
    expect(files.length).toBeGreaterThan(20)
  })

  test.each(files)('%s writes only SIZE_CLASSES literals', (file) => {
    const allowed = COMPONENT_SHAPE_LEGACY[file] ?? []
    const stray = widthLiterals(readFileSync(join(SRC, file), 'utf8')).filter(
      (lit) => !sizeLiterals.has(lit) && !allowed.includes(lit),
    )
    expect(stray).toEqual([])
  })

  test('every allowlist entry is still in use', () => {
    for (const [file, lits] of Object.entries(COMPONENT_SHAPE_LEGACY)) {
      const used = widthLiterals(readFileSync(join(SRC, file), 'utf8'))
      for (const lit of lits) expect(used).toContain(lit)
    }
  })

  test('the emitted token CSS uses only SIZE_CLASSES literals', () => {
    const used = widthLiterals(buildPaletteCss())
    expect(used.length).toBeGreaterThan(0)
    for (const lit of used) expect(sizeLiterals.has(lit)).toBe(true)
  })
})

describe('the tables', () => {
  test('theme breakpoints are the SIZE_CLASSES boundaries', () => {
    expect(SIZE_CLASS_BREAKPOINTS.sm).toBe('52.5em')
    expect(SIZE_CLASS_BREAKPOINTS.lg).toBe('75em')
  })

  test('both tables ascend from 0', () => {
    for (const table of [SIZE_CLASSES, CONTAINER_CLASSES]) {
      const mins: number[] = Object.values(table)
      expect(mins[0]).toBe(0)
      expect(mins).toEqual([...mins].sort((a, b) => a - b))
    }
  })
})
