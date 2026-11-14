import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { basename, join, sep } from 'node:path'

const MAX_ROUTE_FILES = 11
const MAX_DEMO_LINES = 10_000

const filesUnder = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? filesUnder(path) : [path]
  })

const lineCount = (path: string): number => readFileSync(path, 'utf8').split('\n').length

describe('playground budget', () => {
  it(`keeps src/routes to ${MAX_ROUTE_FILES} files`, () => {
    // routes/cycle-*.tsx host the improvement cycles' builds (docs/v3/CYCLES.md) whose state lives in
    // the URL, which the scenario route drops: cycle evidence, like scenarios/expr below, not demo routes.
    const files = filesUnder(join(import.meta.dir, 'routes')).filter(
      (f) => !basename(f).startsWith('cycle-'),
    )
    expect(files.length, `src/routes has ${files.length} files`).toBeLessThanOrEqual(
      MAX_ROUTE_FILES,
    )
  })

  it(`keeps src/demo + src/scenarios under ${MAX_DEMO_LINES} non-test lines`, () => {
    const files = [
      ...filesUnder(join(import.meta.dir, 'demo')),
      ...filesUnder(join(import.meta.dir, 'scenarios')),
    ]
      // scenarios/expr holds the expression cycles' trial builds, kept as their builders left them
      // (docs/v3/EXPRESSION.md § The loop): cycle evidence that grows per cycle, not demo code.
      .filter((f) => !f.startsWith(join(import.meta.dir, 'scenarios', 'expr') + sep))
      .filter((f) => /\.(ts|tsx|css)$/.test(f) && !f.includes('.test.'))
    const total = files.reduce((sum, f) => sum + lineCount(f), 0)
    expect(total, `demo + scenarios have ${total} non-test lines`).toBeLessThanOrEqual(
      MAX_DEMO_LINES,
    )
  })
})
