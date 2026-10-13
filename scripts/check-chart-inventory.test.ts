import { describe, expect, test } from 'bun:test'
import { checkInventory } from './check-chart-inventory'

const table = (prefix: string, rows: string[]): string =>
  [
    '| # | File:line | 1.x | 2.0 | must |',
    '| - | - | - | - | - |',
    ...rows.map((r, i) => `| ${prefix}${i + 1} | ${r} |`),
  ].join('\n')

const DOC = (
  over: { headline?: string; totals?: string; argo?: string; drop?: 'linewatch' } = {},
): string =>
  [
    '# inventory',
    over.headline ??
      "**3 production charts** in 3 repos — argo 1, linewatch 1, weatherorb 1 — plus 1 on argo's dev-only smoke route.",
    '### argo',
    over.argo ??
      table('a', [
        'x.tsx:1 | Bars | `Bars` | grouped',
        'routes/s.tsx:2 (dev) | Bars | `Bars` | dev',
      ]),
    ...(over.drop === 'linewatch'
      ? []
      : ['### linewatch', table('l', ['y.tsx:1 | Bars | `Bars` | grouped'])]),
    '### weatherorb',
    table('w', ['z.tsx:1 | X | `Lines` | line']),
    '### Totals',
    over.totals ??
      [
        '| 2.0 | Charts | From |',
        '| - | - | - |',
        '| `Bars` | 2 (+1 dev) | argo 1, linewatch 1, weatherorb 0 |',
        '| `Lines` | 1 | Line 1 |',
        '| **Total** | **3** (+1 dev) | |',
      ].join('\n'),
    '## next',
  ].join('\n')

describe('checkInventory', () => {
  test('a clean doc passes and counts (dev) rows as dev', () => {
    const r = checkInventory(DOC())
    expect(r.errors).toEqual([])
    expect(r.production).toBe(3)
    expect(r.dev).toBe(1)
  })

  test('an off-by-one headline is reported', () => {
    const r = checkInventory(
      DOC({
        headline:
          "**4 production charts** in 3 repos — argo 1, linewatch 1, weatherorb 1 — plus 1 on argo's dev-only smoke route.",
      }),
    )
    expect(r.errors).toContain('production total (prose): stated 4, counted 3')
  })

  test('a kind with rows but no Totals row is reported', () => {
    const totals = [
      '| 2.0 | Charts | From |',
      '| - | - | - |',
      '| `Bars` | 2 (+1 dev) | argo 1, linewatch 1, weatherorb 0 |',
      '| **Total** | **3** (+1 dev) | |',
    ].join('\n')
    expect(checkInventory(DOC({ totals })).errors).toContain(
      'kind Lines has rows but is missing from § Totals',
    )
  })

  test('an empty count cell is a clear error, not a TypeError', () => {
    const totals = ['| 2.0 | Charts | From |', '| - | - | - |', '| `Bars` |  | argo 1 |'].join('\n')
    const r = checkInventory(DOC({ totals }))
    expect(r.errors[0]).toBe('Totals row `Bars`: empty or missing cell 2')
  })

  test('a missing repo section is reported', () => {
    expect(checkInventory(DOC({ drop: 'linewatch' })).errors[0]).toContain('missing section')
  })

  test('a missing headline is reported', () => {
    expect(checkInventory(DOC({ headline: 'no numbers here' })).errors).toContain(
      'headline prose not found',
    )
  })

  test('an unparseable per-kind breakdown is an error, not a skip', () => {
    const totals = [
      '| 2.0 | Charts | From |',
      '| - | - | - |',
      '| `Bars` | 2 (+1 dev) | nothing useful |',
      '| `Lines` | 1 | Line 1 |',
      '| **Total** | **3** (+1 dev) | |',
    ].join('\n')
    expect(checkInventory(DOC({ totals })).errors[0]).toContain('unparseable breakdown')
  })
})
