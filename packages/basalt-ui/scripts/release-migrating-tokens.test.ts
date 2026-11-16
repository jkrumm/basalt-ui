/**
 * The tokens area of the migration ledger (`migrations/areas/tokens.json`): every name of the fleet
 * census has a row or an app-owned group, and `tokens.valueShifts` carries each class a release
 * must not ship silently (tokens-visual section 9).
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { loadAreas } from './release-migrating'

const PKG = join(import.meta.dir, '..')
const REAL_ROOT = join(PKG, '..', '..')
const CENSUS = join(REAL_ROOT, 'docs/v3/census/tokens-fleet.md')

const tokens = loadAreas(REAL_ROOT).find((a) => a.area === 'tokens')
if (tokens === undefined) throw new Error('no tokens area file')
const rowFrom = new Map(tokens.rows.map((r) => [r.from, r]))
const rowId = new Map(tokens.rows.map((r) => [r.id, r]))

/**
 * The census counts 2.x reads, so its names carry the 2.x prefix and accessor; both are read from the
 * rename rows rather than spelled here.
 */
const OLD_PREFIX = rowId.get('tok-prefix-basalt')?.from.slice(0, -1) ?? ''
const OLD_ACCESSOR = rowId.get('tok-js-accessor')?.from.split('#')[1] ?? ''
const CENSUS_NAME = new RegExp(`^\`((?:${OLD_PREFIX}|${OLD_ACCESSOR}\\.)[^\`]*)\`$`)

/** The census table: `| \`name\` | reads | repos | disposition | target |`. */
function censusRows(): { name: string; disposition: string }[] {
  return readFileSync(CENSUS, 'utf8')
    .split('\n')
    .flatMap((line) => {
      const cells = line.split(/(?<!\\)\|/).map((c) => c.trim())
      const name = CENSUS_NAME.exec(cells[1] ?? '')?.[1]
      return name === undefined ? [] : [{ name, disposition: cells[4] ?? '' }]
    })
}

describe.skipIf(!existsSync(CENSUS))('fleet token census', () => {
  const rows = censusRows()

  test('the table is not empty', () => {
    expect(rows.length).toBeGreaterThan(100)
  })

  test('every name is a row from or an app-owned group', () => {
    const uncovered = rows
      .filter((r) => r.disposition !== 'app-owned' && !rowFrom.has(r.name))
      .map((r) => r.name)
    expect(uncovered).toEqual([])
  })

  test('the disposition matches the row kind', () => {
    const wrong = rows.flatMap((r) => {
      const kind = rowFrom.get(r.name)?.kind
      if (r.disposition === 'app-owned') return kind === undefined ? [] : [r.name]
      const want =
        r.disposition === 'manual' || r.disposition === 'kept' ? r.disposition : undefined
      return want !== undefined && kind !== want ? [r.name] : []
    })
    expect(wrong).toEqual([])
  })
})

describe('tokens.valueShifts', () => {
  const shifted = new Set(tokens.tokens.valueShifts.map((s) => s.token))

  const classes: [string, string[]][] = [
    ['hue', ['--basalt-brand', '--basalt-good', '--basalt-warn', '--basalt-bad']],
    ['radius', ['--basalt-radius-card', '--basalt-radius-ctrl']],
    ['display and kpi', ['--basalt-text-display']],
    ['line heights', ['xs', 'sm', 'md', 'base', 'lg'].map((rung) => `--basalt-text-${rung}-lh`)],
    ['control height', ['--basalt-ctl-h']],
  ]
  for (const [name, wanted] of classes) {
    test(`has an entry for ${name}`, () => {
      expect(wanted.filter((token) => !shifted.has(token))).toEqual([])
    })
  }

  test('radius entries carry the 10 to 14 and 6 to 8 steps', () => {
    const pick = (token: string) => tokens.tokens.valueShifts.find((s) => s.token === token)
    expect([pick('--basalt-radius-card')?.from, pick('--basalt-radius-card')?.to]).toEqual([
      '10px',
      '14px',
    ])
    expect([pick('--basalt-radius-ctrl')?.from, pick('--basalt-radius-ctrl')?.to]).toEqual([
      '6px',
      '8px',
    ])
  })
})

describe('legacy keys', () => {
  test('the scheme storage key and attribute have rows; the 2.x key is no longer read', () => {
    const scheme = tokens.storage.find((s) => s.to === 'basalt:scheme')
    expect(scheme?.action).toStartWith('no longer read')
    expect(tokens.attrs.some((a) => a.to === '[data-theme]')).toBe(true)
  })

  test('the five tokens:css flags map to --selector', () => {
    const flags = [
      '--only',
      '--selector-attribute',
      '--light-class',
      '--default-scheme',
      '--media-fallback',
    ]
    for (const flag of flags) {
      expect(rowFrom.get(`tokens:css ${flag}`)?.to).toBe('tokens:css --selector')
    }
  })
})
