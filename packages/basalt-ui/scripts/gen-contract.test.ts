import { describe, expect, test } from 'bun:test'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

import { ALLOTMENT } from '../src/vite/allotment'
import { CONTRACT_LIMIT, CONTRACT_PATH, SECTIONS, renderContract } from './gen-contract'

const contract = readFileSync(CONTRACT_PATH, 'utf8')
const REPO = resolve(import.meta.dirname, '../../..')

describe('docs/v3/CONTRACT.md', () => {
  test('every generated section is what the tree renders (regenerate: bun packages/basalt-ui/scripts/gen-contract.ts)', () => {
    expect(renderContract(contract)).toBe(contract)
  })

  test('holds every section the generator knows, once', () => {
    for (const name of Object.keys(SECTIONS)) {
      expect(contract.split(`<!-- generated:${name} -->`), name).toHaveLength(2)
    }
  })

  test('stays under 25 KB', () => {
    expect(Buffer.byteLength(contract)).toBeLessThan(CONTRACT_LIMIT)
  })

  test('names the composites and the declared edges the allotment holds', () => {
    const composites = /^Composites: (.+)$/m.exec(contract)?.[1]?.split(', ')
    expect(composites).toEqual(ALLOTMENT.composites)
    const edges = /^Declared L4 edges: (.+)$/m.exec(contract)?.[1] ?? ''
    const stated = edges.split('; ').map((e) => {
      const [from = '', to = ''] = e.split(' -> ')
      return [from, to.split(', ')] as const
    })
    for (const [from, to] of stated) {
      const reaches = ALLOTMENT.subpaths[from]?.reaches.filter((r) => r !== '.')
      expect(reaches, from).toEqual(to)
    }
    const declared = ALLOTMENT.composites.filter((dir) =>
      (ALLOTMENT.subpaths[dir]?.reaches ?? []).some((r) => r !== '.'),
    )
    expect(stated.map(([from]) => from).toSorted()).toEqual(declared.toSorted())
  })
})

describe('docs/v3/STOCKTAKE.md', () => {
  test('every freeze row has a status with a PR or an open reason', () => {
    const text = readFileSync(join(REPO, 'docs/v3/STOCKTAKE.md'), 'utf8')
    const section = text.slice(text.indexOf('## 4.'), text.indexOf('## 5.'))
    const rows = section.split('\n').filter((l) => /^\|\s*\d+\s*\|/.test(l))
    expect(rows).toHaveLength(13)
    for (const line of rows) {
      const status =
        line
          .split('|')
          .filter((c) => c.trim() !== '')
          .at(-1)
          ?.trim() ?? ''
      expect(status, line.slice(0, 40)).toMatch(/^(?:Closed, PR #\d+|Open, \S.*)/)
    }
  })
})

describe('the history', () => {
  const SKIP = new Set(['node_modules', 'dist', '.git', '.claude'])
  /** Files that could read a file: scripts, sources and build configs. */
  const CODE = /\.(?:ts|tsx|mts|cts|mjs|cjs|js|sh)$/

  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      if (SKIP.has(name)) continue
      const path = join(dir, name)
      if (statSync(path).isDirectory()) walk(path, out)
      else if (CODE.test(name)) out.push(path)
    }
    return out
  }

  /**
   * `legacy-names.ts` lists the file as history to skip, it opens none; `tools/spikes` are the one-time
   * harnesses of the 2026-11 spike wave (frozen history, `legacy-names.ts` skips them too), and the census
   * harness is the only one that opens the file.
   */
  const EXEMPT = [
    'packages/basalt-ui/scripts/gen-contract.test.ts',
    'scripts/legacy-names.ts',
    'tools/spikes/',
  ]

  test('no script or source reads docs/v3/ARCHITECTURE.md', () => {
    const readers = [
      ...walk(join(REPO, 'packages/basalt-ui/src')),
      ...walk(join(REPO, 'packages/basalt-ui/scripts')),
      ...walk(join(REPO, 'packages/basalt-ui/tests')),
      ...walk(join(REPO, 'scripts')),
      ...walk(join(REPO, 'apps')),
      ...walk(join(REPO, 'tools')),
    ]
      .filter((file) => !EXEMPT.some((path) => relative(REPO, file).startsWith(path)))
      .filter((file) =>
        /\bARCHITECTURE(?:\.md|\b['"`])/.test(
          readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''),
        ),
      )
      .map((file) => relative(REPO, file))
    expect(readers).toEqual([])
  })
})
