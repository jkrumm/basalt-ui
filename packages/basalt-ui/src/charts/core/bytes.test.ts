/**
 * Spike S2: gz bytes of the engine behind the chart core. Each probe is a production Vite build
 * with every peer bundled (React included) minus an identical `base0` (React + `createRoot`), the
 * contract's method (quality-contract section 6). Recorded numbers are asserted within TOLERANCE
 * so a toolchain bump moves them visibly; the verdict is the Sparkline probe against the 36 KB line.
 */
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { describe, expect, test } from 'bun:test'
import { build } from 'vite'

const PROBE_DIR = join(import.meta.dir, 'probe')
const KB = 1024
const SPARKLINE_LINE_BYTES = 36 * KB
/** Bytes of drift a rebuild may show before the recorded value is stale. */
const TOLERANCE = 400

/** Measured 2026-11-11, Vite 8 / Rolldown, @tanstack/charts 1.5.0, React 19.3.0, minus base0. */
const MEASURED = { line: 36535, bar: 42344, sparkline: 40699 } as const

async function gzOf(entry: string): Promise<number> {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    root: PROBE_DIR,
    define: { 'process.env.NODE_ENV': '"production"' },
    build: {
      write: false,
      minify: true,
      lib: { entry: join(PROBE_DIR, entry), formats: ['es'] },
    },
  })
  const bundle = Array.isArray(result) ? result[0] : result
  if (bundle === undefined || !('output' in bundle)) throw new Error(`no output for ${entry}`)
  let bytes = 0
  for (const o of bundle.output) if (o.type === 'chunk') bytes += gzipSync(o.code).length
  return bytes
}

describe('charts core S2 byte probe', () => {
  test('engine probes, minus base0', async () => {
    const base0 = await gzOf('base0.tsx')
    const delta = async (name: string) => (await gzOf(`${name}.tsx`)) - base0
    const got = {
      line: await delta('line'),
      bar: await delta('bar'),
      sparkline: await delta('sparkline'),
    }
    console.log(JSON.stringify({ base0, ...got }))
    for (const k of ['line', 'bar', 'sparkline'] as const) {
      expect(Math.abs(got[k] - MEASURED[k])).toBeLessThanOrEqual(TOLERANCE)
    }
    // Verdict: ENGINE while the Sparkline probe is at most the 36 KB line, else HAND-SVG.
    expect(got.sparkline <= SPARKLINE_LINE_BYTES ? 'ENGINE' : 'HAND-SVG').toBe(VERDICT)
  }, 120_000)
})

const VERDICT: 'ENGINE' | 'HAND-SVG' = 'HAND-SVG'
