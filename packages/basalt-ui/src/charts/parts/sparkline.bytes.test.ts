/**
 * Byte test of the hand-SVG `Sparkline` and `MiniBars` (S2 verdict HAND-SVG, `docs/v3/spikes/charts-s2.md`).
 * Each probe is a production Vite build with every peer bundled (React included) minus the same
 * `base0` the S2 probes subtract (`core/bytes.test.ts`), the contract's method (quality-contract
 * section 6). Two gates: the S2 ceiling (the engine probe's gz plus 5 percent, rounded up to 0.5 KB,
 * which the engine-free parts must sit far under) and the parts' own ceiling (this measurement plus
 * 5 percent, rounded up to 0.5 KB), which is the number a later change has to move on purpose.
 */
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { describe, expect, test } from 'bun:test'
import { build } from 'vite'

const KB = 1024
const PROBE_DIR = join(import.meta.dir, 'sparkline-probe')
const BASE0 = join(import.meta.dir, '..', 'core', 'probe', 'base0.tsx')

/** The one formula of v3-freeze-g1: measured gz plus 5 percent, rounded up to 0.5 KB. */
export const ceilingOf = (measured: number): number =>
  Math.ceil((measured * 1.05) / (KB / 2)) * (KB / 2)
export const ceilingKb = (measured: number): number => ceilingOf(measured) / KB

/** charts-1a S2, gz over base0: the sparkline probe (40,699 B) and the bar probe (42,344 B) on the engine. */
const S2 = { sparkline: 40_699, bar: 42_344 } as const

/** Measured 2026-11-11, Vite 8 / Rolldown, React 19.3.0, minus base0 (gz bytes). */
const MEASURED = { sparkline: 8924, miniBars: 8197, both: 9596 }
const CEILING_KB = { sparkline: 9.5, miniBars: 8.5, both: 10 }

async function gzOf(entry: string): Promise<number> {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    root: PROBE_DIR,
    define: { 'process.env.NODE_ENV': '"production"' },
    build: { write: false, minify: true, lib: { entry, formats: ['es'] } },
  })
  const bundle = Array.isArray(result) ? result[0] : result
  if (bundle === undefined || !('output' in bundle)) throw new Error(`no output for ${entry}`)
  let bytes = 0
  for (const o of bundle.output) if (o.type === 'chunk') bytes += gzipSync(o.code).length
  return bytes
}

describe('Sparkline and MiniBars bytes', () => {
  test('gz over base0 is inside the S2 ceilings and the parts ceilings', async () => {
    const base0 = await gzOf(BASE0)
    const got = {
      sparkline: (await gzOf(join(PROBE_DIR, 'sparkline.tsx'))) - base0,
      miniBars: (await gzOf(join(PROBE_DIR, 'mini-bars.tsx'))) - base0,
      both: (await gzOf(join(PROBE_DIR, 'both.tsx'))) - base0,
    }
    console.log(JSON.stringify({ base0, ...got }))
    expect(got.sparkline).toBeLessThanOrEqual(ceilingOf(S2.sparkline))
    expect(got.miniBars).toBeLessThanOrEqual(ceilingOf(S2.bar))
    for (const k of ['sparkline', 'miniBars', 'both'] as const) {
      expect(got[k]).toBeLessThanOrEqual(CEILING_KB[k] * KB)
      // The recorded value tracks the build: a ceiling far above it is stale.
      expect(Math.abs(got[k] - MEASURED[k])).toBeLessThanOrEqual(400)
    }
  }, 120_000)
})
