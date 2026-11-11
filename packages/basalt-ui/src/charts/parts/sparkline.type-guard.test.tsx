/**
 * Compile-time guards of `Sparkline` and `MiniBars`: no free colour channel, one lit bar by type, a
 * name on every chart. One `@ts-expect-error` per bad line; tsc is the test, the runtime body only
 * keeps bun from skipping.
 */
import { describe, expect, test } from 'bun:test'
import { MiniBars } from './mini-bars'
import { Sparkline } from './sparkline'

export const ok = (
  <>
    <Sparkline
      series={[1, null, { at: 0, value: 2 }]}
      ariaLabel="A"
      height="fill"
      reference="mean"
    />
    <MiniBars series={[1, 2]} ariaLabel="B" height={40} highlight="last" />
  </>
)

export const bad = (
  <>
    {/* @ts-expect-error no colour channel */}
    <Sparkline series={[1]} ariaLabel="A" height={40} color="red" />
    {/* @ts-expect-error no tone channel */}
    <Sparkline series={[1]} ariaLabel="A" height={40} tone="muted" />
    {/* @ts-expect-error no colour channel on the bars */}
    <MiniBars series={[1]} ariaLabel="A" height={40} color="red" />
    {/* @ts-expect-error highlight is one index, never an array */}
    <MiniBars series={[1]} ariaLabel="A" height={40} highlight={[0, 1]} />
    {/* @ts-expect-error a chart without a name is an unlabelled image */}
    <Sparkline series={[1]} height={40} />
    {/* @ts-expect-error a chart without a name is an unlabelled image */}
    <MiniBars series={[1]} height={40} />
    {/* @ts-expect-error bars have no reference */}
    <MiniBars series={[1]} ariaLabel="A" height={40} reference={1} />
    {/* @ts-expect-error bars have no form */}
    <MiniBars series={[1]} ariaLabel="A" height={40} form="area" />
  </>
)

describe('Sparkline type guards', () => {
  test('are checked by tsc', () => {
    expect(ok).toBeDefined()
    expect(bad).toBeDefined()
  })
})
