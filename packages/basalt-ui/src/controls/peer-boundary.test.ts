/**
 * The packaging invariant `./controls` and `./controls-dates` exist to express
 * (`docs/CONTROLS-SPEC.md` §3): `@mantine/dates` is an OPTIONAL peer, so `basalt-ui/controls` must
 * resolve for a consumer who has never installed it.
 *
 * Source-level, and deliberately so: `scripts/pack-test.sh` proves the same thing from the PACKED
 * tarball with the peer genuinely absent, which is the stronger claim — but it runs in CI, on a
 * built artifact, minutes later. This file fails in the unit loop, on the line that broke it, which
 * is what makes the invariant cheap enough to hold. Both, not either.
 *
 * The second half is the direction of the dependency: `./controls-dates` may reach INTO `./controls`
 * (for the `RangeCustomPickerProps` contract, type-only), never the reverse — a runtime import back
 * would put `@mantine/dates` in `./controls`' graph through the side door, which is exactly the
 * failure a lazy `import()` would also cause and the reason `RangeFilter` takes the picker as a prop.
 */
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(import.meta.dir, '..')

const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g
const LINE_COMMENT = /\/\/.*$/gm

/** Every static or dynamic reference to `spec` that survives to runtime. Type-only forms excluded. */
function runtimeReferences(source: string, spec: string): boolean {
  const code = source.replace(BLOCK_COMMENT, '').replace(LINE_COMMENT, '')
  const quoted = `['"]${spec.replace(/[/*]/g, (c) => `\\${c}`)}['"]`
  const staticForm = new RegExp(
    `^(?:import|export)\\s+(?!type\\b)[^\\n]*from\\s+${quoted}|^import\\s+(?!type\\b)${quoted}`,
    'm',
  )
  const dynamicForm = new RegExp(`import\\s*\\(\\s*${quoted}`)
  return staticForm.test(code) || dynamicForm.test(code)
}

function filesUnder(dir: string): string[] {
  const glob = new Bun.Glob('**/*.{ts,tsx}')
  return [...glob.scanSync({ cwd: join(SRC, dir) })].map((rel) => join(SRC, dir, rel))
}

describe('./controls never reaches @mantine/dates', () => {
  const files = filesUnder('controls')

  test('the walk found files to scan', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  test('no file under src/controls imports @mantine/dates, statically or lazily', () => {
    const violations = files
      .filter((file) => runtimeReferences(readFileSync(file, 'utf8'), '@mantine/dates'))
      .map((file) => file.slice(SRC.length + 1))
    expect(violations).toEqual([])
  })
})

describe('the dependency points one way', () => {
  test('no file under src/controls imports src/controls-dates', () => {
    const violations = filesUnder('controls')
      .filter((file) => /from\s+['"]\.\.\/controls-dates/.test(readFileSync(file, 'utf8')))
      .map((file) => file.slice(SRC.length + 1))
    expect(violations).toEqual([])
  })

  test('src/controls-dates reaches ../controls for TYPES only — a runtime edge would leak the peer', () => {
    const violations = filesUnder('controls-dates')
      .filter((file) => {
        const source = readFileSync(file, 'utf8')
        return /from\s+['"]\.\.\/controls/.test(
          source
            .replace(/export\s+type\s+\{[^}]*\}\s+from\s+['"][^'"]*['"]/g, '')
            .replace(/import\s+type\s+\{[^}]*\}\s+from\s+['"][^'"]*['"]/g, ''),
        )
      })
      .map((file) => file.slice(SRC.length + 1))
    expect(violations).toEqual([])
  })

  test('@mantine/dates is reached from exactly one place — src/controls-dates', () => {
    const importers = filesUnder('controls-dates')
      .filter((file) => runtimeReferences(readFileSync(file, 'utf8'), '@mantine/dates'))
      .map((file) => file.slice(SRC.length + 1))
    expect(importers).toEqual(['controls-dates/date-range-picker.tsx'])
  })
})
