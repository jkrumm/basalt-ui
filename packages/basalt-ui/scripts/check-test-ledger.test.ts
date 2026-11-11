import { describe, expect, test } from 'bun:test'

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  SECTION_8,
  bucketOf,
  bucketTotals,
  checkLedgers,
  formatReport,
  loadLedgers,
  loadManifest,
  parseKillList,
  parseLawLabels,
} from './check-test-ledger'
import type { CheckInput, Ledger, LedgerRow } from './check-test-ledger'

const row = (file: string, over: Partial<LedgerRow> = {}): LedgerRow => ({
  file,
  area: 'tokens',
  class: 'ab',
  disposition: 'port',
  target: `dest/${file}`,
  laws: ['Tokens'],
  ...over,
})

function input(
  rows: LedgerRow[],
  over: Partial<CheckInput> & { status?: 'open' | 'closed'; files?: string[] } = {},
): CheckInput {
  const ledger: Ledger = { area: 'tokens', status: over.status ?? 'open', rows }
  const files = over.files ?? rows.map((r) => r.file)
  return {
    ledgers: [ledger],
    manifest: { ref: 'origin/v2', command: 'git ls-tree', count: files.length, files },
    lawLabels: new Set(['Tokens', 'Markdown']),
    killList: 'Grace ladder, `check-grace` on master.',
    exists: () => true,
    ...over,
  }
}

const messages = (i: CheckInput) => checkLedgers(i).map((f) => `${f.where}: ${f.message}`)

describe('checkLedgers', () => {
  test('a complete ledger passes', () => {
    expect(checkLedgers(input([row('a.test.ts'), row('b.test.ts')]))).toEqual([])
  })

  test('an unnamed 2.x file fails', () => {
    const i = input([row('a.test.ts')], { files: ['a.test.ts', 'b.test.ts'] })
    expect(messages(i)).toEqual([
      'b.test.ts: has no ledger row: every 2.x test file must be named once',
    ])
  })

  test('a row for a file outside the 2.x list fails', () => {
    const i = input([row('a.test.ts'), row('ghost.test.ts')], { files: ['a.test.ts'] })
    expect(
      messages(i).some((m) => m.startsWith('ghost.test.ts: is not in the 2.x file list')),
    ).toBe(true)
  })

  test('a file named in two rows fails', () => {
    const i = input([row('a.test.ts'), row('a.test.ts')], { files: ['a.test.ts'] })
    expect(messages(i).some((m) => m.includes('is named twice'))).toBe(true)
  })

  test('an uncited retire fails', () => {
    const i = input([row('a.test.ts', { disposition: 'retire', target: null, laws: [] })])
    expect(messages(i)).toEqual([
      'a.test.ts: retire row cites nothing: name a kill-list item or a migration row',
    ])
  })

  test('a kill-list citation must quote section 14', () => {
    const bad = input([
      row('a.test.ts', {
        disposition: 'retire',
        target: null,
        laws: [],
        cites: 'kill-list: Coexistence kit',
      }),
    ])
    expect(messages(bad)[0]).toContain('is not in migration-release.md section 14')
    const good = input([
      row('a.test.ts', {
        disposition: 'retire',
        target: null,
        laws: [],
        cites: 'kill-list: grace ladder',
      }),
    ])
    expect(checkLedgers(good)).toEqual([])
  })

  test('a migration-row citation needs an id; any other shape fails', () => {
    const ok = input([
      row('a.test.ts', {
        disposition: 'retire',
        target: null,
        laws: [],
        cites: 'migration-row: basalt-ui/agent',
      }),
    ])
    expect(checkLedgers(ok)).toEqual([])
    const bad = input([
      row('a.test.ts', { disposition: 'retire', target: null, laws: [], cites: 'because' }),
    ])
    expect(messages(bad)[0]).toContain('neither "kill-list: <item>" nor "migration-row: <id>"')
  })

  test('a missing target of a closed area fails; an open area does not', () => {
    const rows = [row('a.test.ts')]
    expect(checkLedgers(input(rows, { status: 'open', exists: () => false }))).toEqual([])
    expect(messages(input(rows, { status: 'closed', exists: () => false }))).toEqual([
      'a.test.ts: port target dest/a.test.ts does not exist but area "tokens" is closed',
    ])
  })

  test('a port row without a target fails', () => {
    expect(messages(input([row('a.test.ts', { target: null })]))).toEqual([
      'a.test.ts: port row has no target path',
    ])
  })

  test('laws must name a digest section 3 label, with an optional detail', () => {
    expect(checkLedgers(input([row('a.test.ts', { laws: ['Tokens: fill band'] })]))).toEqual([])
    expect(messages(input([row('a.test.ts', { laws: [] })]))[0]).toContain('names no invariant')
    expect(messages(input([row('a.test.ts', { laws: ['Vibes'] })]))[0]).toContain(
      'is not a digest section 3 area label',
    )
    expect(messages(input([row('a.test.ts', { laws: ['TokensExtra'] })]))[0]).toContain(
      'is not a digest section 3 area label',
    )
  })

  test('an unknown disposition and a row in the wrong area fail', () => {
    const wrong = input([row('a.test.ts', { disposition: 'keep' as never })])
    expect(messages(wrong)).toEqual(['a.test.ts: unknown disposition "keep"'])
    expect(messages(input([row('a.test.ts', { area: 'charts' })]))[0]).toContain(
      'sits in the "tokens" ledger',
    )
  })

  test('a manifest whose count disagrees with its list fails', () => {
    const i = input([row('a.test.ts')])
    i.manifest.count = 2
    expect(messages(i)[0]).toContain('count 2 does not match 1 listed files')
  })
})

describe('report', () => {
  test('buckets map onto the section 8 table', () => {
    expect(bucketOf(row('a', { class: 'c', disposition: 'retarget', area: 'charts' }))).toBe(
      'retarget, charts',
    )
    expect(bucketOf(row('a', { class: 'c', disposition: 'retarget', area: 'shell' }))).toBe(
      'retarget, composites',
    )
    expect(bucketOf(row('a', { class: 'c', disposition: 'retire' }))).toBe('retire (provider swap)')
    expect(bucketOf(row('a', { class: 'layout', disposition: 'retarget' }))).toBe('layout re-point')
    expect(bucketOf(row('a', { class: 'def', disposition: 'rewrite' }))).toBe('rewrite (D, E, F)')
  })

  test('the report lists every section 8 bucket with its figure', () => {
    const report = formatReport([row('a'), row('b')])
    expect(bucketTotals([row('a'), row('b')]).get('port (portable)')).toBe(2)
    for (const { bucket, claimed } of SECTION_8) {
      expect(report).toContain(`| ${bucket} |`)
      expect(report).toContain(`| ${claimed} |`)
    }
    expect(report).toContain('| port (portable) | 2 | 115 | -113 |')
  })
})

describe('doc parsers', () => {
  test('parseLawLabels reads the first column of digest section 3 only', () => {
    const digest = [
      '## 2. x',
      '| Other | v |',
      '## 3. Must-survive invariants and lessons',
      '| Area | Invariants |',
      '| --- | --- |',
      '| Tokens | a |',
      '| Charts, render | b |',
      '## 4. y',
      '| Later | v |',
    ].join('\n')
    expect([...parseLawLabels(digest)]).toEqual(['Tokens', 'Charts, render'])
  })

  test('parseKillList returns the section 14 body', () => {
    const concept = [
      '## 13. Proof',
      'no',
      '## 14. Kill list',
      'Grace ladder',
      '## 15. Next',
      'other',
    ].join('\n')
    expect(parseKillList(concept)).toContain('Grace ladder')
    expect(parseKillList(concept)).not.toContain('other')
  })
})

const root = join(import.meta.dirname, '..', '..', '..')
const dir = join(root, 'tools', 'migrate-v3', 'ledger')

// The ledger lands in its own commit after this script; `make check` runs the script itself, which
// fails on a missing directory, so skipping here hides nothing once both are in.
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8')

describe.skipIf(!existsSync(dir))('the committed ledger', () => {
  const ledgers = loadLedgers(dir)
  const manifest = loadManifest(dir)

  test('names every 2.x test file exactly once and passes', () => {
    const failures = checkLedgers({
      ledgers,
      manifest,
      lawLabels: parseLawLabels(read('docs', 'v3', 'DISCOVERY-DIGEST.md')),
      killList: parseKillList(read('docs', 'v3', 'concepts', 'migration-release.md')),
      exists: (p) => existsSync(join(root, p)),
    })
    expect(failures).toEqual([])
    expect(ledgers.flatMap((l) => l.rows)).toHaveLength(manifest.files.length)
    expect(manifest.files).toHaveLength(429)
  })

  test('reconciles with section 8 except the one recorded difference', () => {
    const totals = bucketTotals(ledgers.flatMap((l) => l.rows))
    const diffs = SECTION_8.filter(
      ({ bucket, claimed }) => (totals.get(bucket) ?? 0) !== claimed,
    ).map(({ bucket, claimed }) => `${bucket}: ${(totals.get(bucket) ?? 0) - claimed}`)
    // dev-dock.type-guard.test.ts guards a retired export, so it retires instead of porting.
    expect(diffs).toEqual(['port (portable): -1', 'retire (portable): 1'])
  })
})
