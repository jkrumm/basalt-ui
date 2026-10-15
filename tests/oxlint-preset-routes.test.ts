/**
 * The shipped `oxlint.json` preset against the real oxlint binary: a TanStack file route (`Route` +
 * its component in one file) lints clean, a non-route mixed export still warns.
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'

const OXLINT_BIN = resolve(import.meta.dir, '../node_modules/.bin/oxlint')
const PRESET = resolve(import.meta.dir, '../packages/basalt-ui/configs/oxlint.json')

const ROUTE = `import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return <div />
}
`
const MIXED = `export const helper = 1

export function Comp() {
  return <div />
}
`

const WITH = '.oxlintrc.json'
/** The same preset minus the route-file override: the positive control proving the cases can fail. */
const WITHOUT = 'without-override.json'

let dir: string
beforeAll(() => {
  dir = mkdtempSync(resolve(tmpdir(), 'basalt-preset-'))
  writeFileSync(resolve(dir, WITH), JSON.stringify({ extends: [PRESET] }))
  const preset = JSON.parse(readFileSync(PRESET, 'utf8')) as {
    extends: string[]
    overrides: { files: string[] }[]
  }
  const stripped = {
    ...preset,
    extends: preset.extends.map((e) => resolve(dirname(PRESET), e)),
    overrides: preset.overrides.filter((o) => !o.files.includes('**/__root.tsx')),
  }
  writeFileSync(resolve(dir, WITHOUT), JSON.stringify(stripped))
})
afterAll(() => rmSync(dir, { recursive: true, force: true }))

function lint(file: string, source: string, config = WITH): { code: number; output: string } {
  const path = resolve(dir, file)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, source)
  const result = Bun.spawnSync([OXLINT_BIN, '-c', config, file], { cwd: dir })
  return { code: result.exitCode ?? 0, output: `${result.stdout}${result.stderr}` }
}

describe('preset react(only-export-components)', () => {
  it.each(['src/routes/index.tsx', 'src/routes/__root.tsx', 'apps/web/src/routes/a/b.tsx'])(
    'a file route (%s) with Route + a component lints clean, and warns without the override',
    (file) => {
      const clean = lint(file, ROUTE)
      expect(clean.code).toBe(0)
      // oxlint prints a `Found 0 warnings and 0 errors.` summary in some environments (CI), so
      // assert on the rule id rather than the word "warning".
      expect(clean.output).not.toContain('only-export-components')
      expect(lint(file, ROUTE, WITHOUT).output).toContain('only-export-components')
    },
  )

  it('a non-route mixed export still warns', () => {
    expect(lint('src/mixed.tsx', MIXED).output).toContain('only-export-components')
  })

  it('allowExportNames still lets a non-route file export Route beside a component', () => {
    const src = 'export const Route = { x: 1 }\nexport function Page() {\n  return <div />\n}\n'
    expect(lint('src/page.tsx', src).output).not.toContain('only-export-components')
  })
})
