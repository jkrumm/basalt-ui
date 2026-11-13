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

/** The census table: `| \`name\` | reads | repos | disposition | target |`. */
function censusRows(): { name: string; disposition: string }[] {
  return readFileSync(CENSUS, 'utf8')
    .split('\n')
    .flatMap((line) => {
      const cells = line.split(/(?<!\\)\|/).map((c) => c.trim())
      const name = /^`((?:--vx-|VX\.)[^`]*)`$/.exec(cells[1] ?? '')?.[1]
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
    ['hue', ['--vx-brand', '--vx-good', '--vx-warn', '--vx-bad']],
    ['radius', ['--vx-radius-card', '--vx-radius-ctrl']],
    ['display and kpi', ['--vx-text-display']],
    ['line heights', ['xs', 'sm', 'md', 'base', 'lg'].map((rung) => `--vx-text-${rung}-lh`)],
    ['control height', ['--vx-ctl-h']],
  ]
  for (const [name, wanted] of classes) {
    test(`has an entry for ${name}`, () => {
      expect(wanted.filter((token) => !shifted.has(token))).toEqual([])
    })
  }

  test('radius entries carry the 10 to 14 and 6 to 8 steps', () => {
    const pick = (token: string) => tokens.tokens.valueShifts.find((s) => s.token === token)
    expect([pick('--vx-radius-card')?.from, pick('--vx-radius-card')?.to]).toEqual(['10px', '14px'])
    expect([pick('--vx-radius-ctrl')?.from, pick('--vx-radius-ctrl')?.to]).toEqual(['6px', '8px'])
  })
})

describe('legacy keys', () => {
  test('the scheme storage key and attribute have rows', () => {
    expect(tokens.storage).toContainEqual({
      key: 'mantine-color-scheme-value',
      action: 'read-legacy',
      to: 'basalt:scheme',
    })
    expect(tokens.attrs).toContainEqual({ from: '[data-mantine-color-scheme]', to: '[data-theme]' })
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
