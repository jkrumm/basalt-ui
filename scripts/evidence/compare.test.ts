import { describe, expect, test } from 'bun:test'
import {
  buildBoardHtml,
  esc,
  metricDelta,
  metricRows,
  parseInventory,
  patternIds,
  isInside,
} from './compare-board'
import type { BoardEntry } from './compare-board'
import { EXPECTED_IDS, PATTERNS, isMissing, mappingFor } from './compare-patterns'

const entry = (over: Partial<BoardEntry> = {}): BoardEntry => ({
  id: 'metric-card',
  mapping: { route: '/dashboard', note: 'a <b>note</b>' },
  keel: undefined,
  keelCrops: {},
  basalt: { crops: {}, metrics: {}, errors: {} },
  ...over,
})

describe('parseInventory', () => {
  test('absent file (null/undefined) is an empty inventory', () => {
    expect(parseInventory(null).patterns).toEqual([])
    expect(parseInventory(undefined).patterns).toEqual([])
  })

  test('a present but corrupt file throws instead of reading as absent', () => {
    for (const input of ['', '  ', '{not json', '[]', '"x"', '{}', '{"patterns":{}}']) {
      expect(() => parseInventory(input)).toThrow(/inventory\.json/)
    }
  })

  test('a partial file keeps what is usable and drops the rest', () => {
    const inv = parseInventory(
      JSON.stringify({
        capturedAt: '2026-10-16',
        patterns: [
          {
            id: 'metric-card',
            crops: { 'dark-desktop': 'a.png', 'dark-mobile': 3 },
            metrics: { desktop: { width: 200, bogus: 1, gap: 'x', height: NaN } },
          },
          { name: 'no id' },
          null,
          { id: 'extra', name: 'Extra', instances: 4 },
        ],
      }),
    )
    expect(inv.patterns.map((p) => p.id)).toEqual(['metric-card', 'extra'])
    const [card, extra] = inv.patterns
    expect(card?.crops).toEqual({ 'dark-desktop': 'a.png' })
    expect(card?.metrics.desktop).toEqual({ width: 200, gap: 'x' })
    expect(card?.metrics.mobile).toBeUndefined()
    expect(card?.name).toBe('metric-card')
    expect(extra?.instances).toBe(4)
  })
})

describe('patternIds', () => {
  test('expected ids first, inventory additions after, no duplicates', () => {
    const inv = parseInventory(
      JSON.stringify({ patterns: [{ id: 'tabs' }, { id: 'metric-card' }] }),
    )
    const ids = patternIds(inv)
    const expected: string[] = [...EXPECTED_IDS]
    expect(ids.slice(0, expected.length)).toEqual(expected)
    expect(expected).toEqual(Object.keys(PATTERNS))
    expect(ids.at(-1)).toBe('tabs')
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('the mapping covers every expected id', () => {
    expect(EXPECTED_IDS).toEqual(
      expect.arrayContaining(['metric-card', 'kanban-card', 'page-header', 'loading-state']),
    )
    for (const id of EXPECTED_IDS) {
      const m = mappingFor(id)
      if (isMissing(m)) expect(m.missing.length).toBeGreaterThan(0)
      else expect(m.route.startsWith('/')).toBe(true)
    }
  })
})

describe('mappingFor', () => {
  test('an id the basalt side does not know is missing, not a crash', () => {
    const m = mappingFor('brand-new-pattern')
    expect(isMissing(m)).toBe(true)
  })
})

describe('isInside', () => {
  test('rejects a sibling sharing the name prefix, ../ escapes and absolute paths', () => {
    const root = '/repo/docs/keel'
    expect(isInside(root, '/repo/docs/keel/a/b.png')).toBe(true)
    expect(isInside(root, '/repo/docs/keel-evil/b.png')).toBe(false)
    expect(isInside(root, '/repo/docs/keel/../secret.png')).toBe(false)
    expect(isInside(root, '/etc/passwd')).toBe(false)
    expect(isInside(root, root)).toBe(false)
  })
})

describe('metrics table', () => {
  test('numbers get a signed delta, roles =/≠, mixed types –', () => {
    expect(metricDelta(10, 12)).toBe('+2')
    expect(metricDelta(12.5, 10)).toBe('-2.5')
    expect(metricDelta(7, 7)).toBe('0')
    expect(metricDelta(-0.001, 0)).toBe('0')
    expect(metricDelta('--vx-ink', '--vx-ink')).toBe('=')
    expect(metricDelta('--vx-ink', 'unknown')).toBe('≠')
    expect(metricDelta(1, 'unknown')).toBe('–')
  })

  test('only keys both sides have, in contract order', () => {
    const rows = metricRows(
      { height: 90, width: 200, gap: 8, radius: 6 },
      { width: 210, radius: 7, shadow: 'none' },
    )
    expect(rows).toEqual([
      { metric: 'width', keel: 200, basalt: 210, delta: '+10' },
      { metric: 'radius', keel: 6, basalt: 7, delta: '+1' },
    ])
    expect(metricRows(undefined, { width: 1 })).toEqual([])
  })
})

describe('board html', () => {
  test('escapes names, notes and errors', () => {
    const html = buildBoardHtml({
      label: 'x"<y>',
      inventory: parseInventory(
        JSON.stringify({
          patterns: [
            {
              id: 'metric-card',
              name: '<script>alert(1)</script>',
              notes: 'a & b',
              selectorNote: '"q"',
            },
          ],
        }),
      ),
      entries: [
        entry({
          keel: parseInventory(
            JSON.stringify({
              patterns: [{ id: 'metric-card', name: '<script>alert(1)</script>', notes: 'a & b' }],
            }),
          ).patterns[0]!,
          basalt: { crops: {}, metrics: {}, errors: { 'dark-desktop': '<img onerror=x>' } },
        }),
      ],
    })
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img onerror')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('a &lt;b&gt;note&lt;/b&gt;')
    expect(html).toContain('a &amp; b')
    expect(html).toContain('Design parity — x&quot;&lt;y&gt;')
  })

  test('renders reference pending, missing, and a Δ table', () => {
    const keel = parseInventory(
      JSON.stringify({
        patterns: [{ id: 'metric-card', metrics: { desktop: { width: 200 } } }],
      }),
    ).patterns[0]!
    const html = buildBoardHtml({
      label: 'l',
      inventory: parseInventory(null),
      entries: [
        entry({
          keel,
          keelCrops: {},
          basalt: {
            crops: { 'dark-desktop': 'basalt/a b.png' },
            metrics: { desktop: { width: 210 } },
            errors: {},
          },
        }),
        entry({ id: 'kanban-card', mapping: { missing: 'no kanban' } }),
      ],
    })
    expect(html).toContain('reference pending')
    expect(html).toContain('missing: no kanban')
    expect(html).toContain('src="basalt/a b.png"')
    expect(html).toContain('<td>+10</td>')
    expect(html).toContain('Keel inventory: absent')
  })

  test('esc covers the five HTML metacharacters', () => {
    expect(esc(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;')
  })
})

describe('inherited ids', () => {
  test('Object.prototype names from an inventory are missing, not mappings', () => {
    for (const id of ['constructor', 'toString', '__proto__']) {
      const m = mappingFor(id)
      expect(isMissing(m)).toBe(true)
    }
  })
})

describe('playground anchors', () => {
  test('every non-missing, tag-based mapping has a data-compare attribute in the playground', async () => {
    const files = new Bun.Glob('**/*.tsx').scan({
      cwd: new URL('../../apps/playground/src', import.meta.url).pathname,
      absolute: true,
    })
    let source = ''
    for await (const file of files) source += await Bun.file(file).text()
    for (const id of EXPECTED_IDS) {
      const m = mappingFor(id)
      if (isMissing(m) || m.selector !== undefined) continue
      const anchor = m.anchor ?? id
      expect(source, `${id} needs data-compare="${anchor}"`).toContain(`data-compare="${anchor}"`)
    }
  })
})

describe('board errored pairs', () => {
  test('a failed capture with no crop and no reference still renders its pair', () => {
    const html = buildBoardHtml({
      label: 'l',
      inventory: parseInventory(null),
      entries: [
        entry({
          basalt: {
            crops: { 'dark-desktop': 'basalt/a.png' },
            metrics: {},
            errors: { 'light-mobile': 'anchor is off-screen' },
          },
        }),
      ],
    })
    expect(html).toContain('light-mobile')
    expect(html).toContain('failed: anchor is off-screen')
  })
})
