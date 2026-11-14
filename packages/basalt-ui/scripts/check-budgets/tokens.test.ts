/**
 * The G0 freeze (v3-freeze-g0): the tokens area's rows measure under their ceilings, and a seeded
 * overshoot of each fails.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { PKG_ROOT } from './lib'
import type { AreaModule, Ctx, Measured } from './lib'
import { gzipFileBytes, publicVxNames, tokensPeers } from './areas/tokens'

const area = (await import('./areas/tokens')) as AreaModule
const ctx: Ctx = { providerOnlyDist: '', once: (_key, build) => build() }
const scratch = mkdtempSync(join(tmpdir(), 'tokens-budget-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))

function row(id: string) {
  const found = area.rows.find((r) => r.id === id)
  if (found === undefined) throw new Error(`no row ${id}`)
  return found
}

function valueOf(measured: Measured): number {
  return typeof measured === 'number' ? measured : measured.value
}

describe('tokens area', () => {
  test.each(area.rows.map((r) => r.id))(
    '%s measures within its ceiling',
    async (id) => {
      const r = row(id)
      expect(valueOf(await r.measure(ctx))).toBeLessThanOrEqual(r.ceiling)
    },
    60_000,
  )

  test('the names ceiling is 90 and the peers ceiling is 0', () => {
    expect(row('tokens-public-names').ceiling).toBe(90)
    expect(row('tokens-peers').ceiling).toBe(0)
  })

  test('tokens.css ceiling is the measured size plus 5 percent, not looser', () => {
    const measured = gzipFileBytes(join(PKG_ROOT, 'src/css/tokens.css'))
    const { ceiling } = row('tokens-css-gzip')
    expect(ceiling).toBeGreaterThanOrEqual(measured * 1.05)
    expect(ceiling).toBeLessThan(measured * 1.06)
  })

  test('a tokens.css 6 percent over its ceiling fails', () => {
    const { ceiling } = row('tokens-css-gzip')
    // Incompressible padding, so the gzip size tracks the byte count.
    let text = readFileSync(join(PKG_ROOT, 'src/css/tokens.css'), 'utf8')
    const file = join(scratch, 'tokens.css')
    for (let n = 0; ; n += 64) {
      writeFileSync(file, text)
      if (gzipFileBytes(file) >= ceiling * 1.06) break
      text += `/* ${Bun.randomUUIDv7()}${Bun.randomUUIDv7()}${n} */\n`
    }
    expect(gzipFileBytes(file)).toBeGreaterThan(ceiling)
  })

  test('a 91st public --vx-* name fails the names budget', () => {
    const names = Array.from({ length: 91 }, (_, i) => ({ name: `seeded-${i}` }))
    expect(publicVxNames(names)).toBe(91)
    expect(publicVxNames(names)).toBeGreaterThan(row('tokens-public-names').ceiling)
  })

  test('a bare import in the tokens layer counts as a peer', () => {
    writeFileSync(join(scratch, 'seed.ts'), "import { x } from 'some-peer'\nexport const y = x\n")
    expect(tokensPeers([scratch], [])).toEqual(['some-peer'])
  })
})
