/**
 * The peer table in MAINTAINING.md is the written reason for every range: it lists exactly the
 * declared peers, with the range `package.json` declares, and the class matches the range's shape
 * (caret or compound = stable, tilde = coupled, exact = pinned).
 *
 * Run: bun test packages/basalt-ui/tests/peer-table.test.ts
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'

const pkgRoot = join(import.meta.dir, '..')
const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8')) as {
  peerDependencies: Record<string, string>
}
const doc = readFileSync(join(pkgRoot, 'MAINTAINING.md'), 'utf8')

type Row = { peer: string; cls: string; range: string; reason: string }

function tableRows(): Row[] {
  const body = /<!-- peers:begin -->([\s\S]*?)<!-- peers:end -->/.exec(doc)?.[1] ?? ''
  return body
    .split('\n')
    .filter((line) => line.startsWith('| `'))
    .map((line) => {
      const [peer = '', cls = '', range = '', ...reason] = line
        .slice(1, -1)
        .split(/(?<!\\)\|/)
        .map((cell) => cell.trim().replaceAll('\\|', '|'))
      return {
        peer: peer.replaceAll('`', ''),
        cls,
        range: range.replaceAll('`', ''),
        reason: reason.join('|'),
      }
    })
}

const classOf = (range: string): string => {
  if (/^\d/.test(range)) return 'pinned'
  return range.startsWith('~') ? 'coupled' : 'stable'
}

describe('lint tool pins', () => {
  it('keeps the dev copies of oxlint and @shadcn/lint on their peer pins', () => {
    const rootDev = (
      JSON.parse(readFileSync(join(pkgRoot, '../../package.json'), 'utf8')) as {
        devDependencies: Record<string, string>
      }
    ).devDependencies
    const pkgDev = (
      JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8')) as {
        devDependencies: Record<string, string>
      }
    ).devDependencies
    expect(rootDev['oxlint']).toBe(pkg.peerDependencies['oxlint'])
    expect(pkgDev['@shadcn/lint']).toBe(pkg.peerDependencies['@shadcn/lint'])
  })
})

describe('peer table (MAINTAINING.md)', () => {
  const rows = tableRows()

  it('lists every declared peer once and no other', () => {
    expect(rows.map((r) => r.peer).toSorted()).toEqual(Object.keys(pkg.peerDependencies).toSorted())
  })

  it.each(rows)('$peer: range, class and reason agree with package.json', (row) => {
    const declared = pkg.peerDependencies[row.peer]
    expect(declared).toBeDefined()
    expect(row.range).toBe(declared as string)
    expect(row.cls).toBe(classOf(declared ?? ''))
    expect(row.reason.length).toBeGreaterThan(0)
  })
})
