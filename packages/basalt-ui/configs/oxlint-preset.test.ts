/**
 * The shipped `oxlint.json` preset against the real oxlint binary: a TanStack file route (`Route` +
 * its component in one file) lints clean, a non-route mixed export still warns.
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'

const OXLINT_BIN = resolve(import.meta.dir, '../../../node_modules/.bin/oxlint')
const PRESET = resolve(import.meta.dir, 'oxlint.json')

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

let dir: string
beforeAll(() => {
  dir = mkdtempSync(resolve(tmpdir(), 'basalt-preset-'))
  writeFileSync(resolve(dir, '.oxlintrc.json'), JSON.stringify({ extends: [PRESET] }))
})
afterAll(() => rmSync(dir, { recursive: true, force: true }))

function lint(file: string, source: string): string {
  const path = resolve(dir, file)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, source)
  const result = Bun.spawnSync([OXLINT_BIN, '-c', '.oxlintrc.json', file], { cwd: dir })
  return `${result.stdout}${result.stderr}`
}

describe('preset react(only-export-components)', () => {
  it.each(['src/routes/index.tsx', 'src/routes/__root.tsx', 'apps/web/src/routes/a/b.tsx'])(
    'a file route (%s) with Route + a component lints clean',
    (file) => {
      expect(lint(file, ROUTE)).not.toContain('only-export-components')
    },
  )

  it('a non-route mixed export still warns', () => {
    expect(lint('src/mixed.tsx', MIXED)).toContain('only-export-components')
  })

  it('allowExportNames still lets a non-route file export Route beside a component', () => {
    const src = 'export const Route = { x: 1 }\nexport function Page() {\n  return <div />\n}\n'
    expect(lint('src/page.tsx', src)).not.toContain('only-export-components')
  })
})
