import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { checkLiterals } from './check-literals'

const SCRIPT = join(import.meta.dirname, 'check-literals.ts')
const roots: string[] = []

function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'check-literals-'))
  roots.push(root)
  for (const [path, content] of Object.entries(files)) {
    const file = join(root, 'src', path)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, content)
  }
  return root
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function run(root: string): { code: number; stderr: string } {
  const result = Bun.spawnSync(['bun', SCRIPT, '--root', root])
  return { code: result.exitCode, stderr: result.stderr.toString() }
}

const OFFENDER = `export const A = () => (
  <>
    <button aria-label="Close" />
    <button title={'Close'} />
    <input placeholder="Search" />
    <img alt="Logo" src="x" />
  </>
)
`

describe('check-literals', () => {
  test('exits 1 on aria-label, title, placeholder and alt literals', () => {
    const root = fixture({ 'ui/offender.tsx': OFFENDER })
    const { code, stderr } = run(root)
    expect(code).toBe(1)
    for (const name of ['aria-label', 'title', 'placeholder', 'alt']) {
      expect(stderr).toContain(`ui/offender.tsx:`)
      expect(stderr).toContain(`${name} is a string literal`)
    }
  })

  test('flags a default string parameter', () => {
    const root = fixture({ 'cards/p.ts': `export const f = (label = 'Close') => label\n` })
    expect(checkLiterals(root)).toHaveLength(1)
  })

  test('passes dynamic values, tests, core/messages and unscanned 2.x directories', () => {
    const root = fixture({
      'ui/ok.tsx': `export const A = ({ t }: { t: string }) => <button aria-label={t} title={\`\${t}\`} />\n`,
      'ui/ok.test.tsx': OFFENDER,
      'core/messages/table.ts': `export const f = (label = 'Close') => label\n`,
      'forms/legacy.tsx': OFFENDER,
    })
    expect(checkLiterals(root)).toEqual([])
    expect(run(root).code).toBe(0)
  })

  test('a file elsewhere that imports core/messages is checked', () => {
    const root = fixture({
      'core/messages/table.ts': `export const table = {}\n`,
      'table/part.tsx': `import { table } from '../core/messages/table'\nexport const A = () => <p title="x">{String(table)}</p>\n`,
      'charts/other.tsx': OFFENDER,
    })
    const findings = checkLiterals(root)
    expect(findings.map((f) => f.file)).toEqual(['src/table/part.tsx'])
  })

  test('the real tree is clean', () => {
    expect(run(join(import.meta.dirname, '..')).code).toBe(0)
  })
})
