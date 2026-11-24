/**
 * Compile-time guards of `Sparkline` and `MiniBars`: no free color channel, one lit bar by type, a
 * name on every chart. One `@ts-expect-error` per bad line; tsc is the test, the runtime body only
 * keeps bun from skipping.
 */
import { describe, expect, test } from 'bun:test'
import { MiniBars } from './mini-bars'
import { Sparkline } from './sparkline'

export const ok = (
  <>
    <Sparkline points={[1, null, { at: 0, value: 2 }]} label="A" height="fill" reference="mean" />
    <MiniBars points={[1, 2]} label="B" height={40} highlight="last" />
  </>
)

export const bad = (
  <>
    {/* @ts-expect-error no color channel */}
    <Sparkline points={[1]} label="A" height={40} color="red" />
    {/* @ts-expect-error no tone channel */}
    <Sparkline points={[1]} label="A" height={40} tone="muted" />
    {/* @ts-expect-error no color channel on the bars */}
    <MiniBars points={[1]} label="A" height={40} color="red" />
    {/* @ts-expect-error highlight is one index, never an array */}
    <MiniBars points={[1]} label="A" height={40} highlight={[0, 1]} />
    {/* @ts-expect-error a chart without a name is an unlabelled image */}
    <Sparkline points={[1]} height={40} />
    {/* @ts-expect-error a chart without a name is an unlabelled image */}
    <MiniBars points={[1]} height={40} />
    {/* @ts-expect-error bars have no reference */}
    <MiniBars points={[1]} label="A" height={40} reference={1} />
    {/* @ts-expect-error bars have no form */}
    <MiniBars points={[1]} label="A" height={40} form="area" />
  </>
)

describe('Sparkline type guards', () => {
  test('are checked by tsc', () => {
    expect(ok).toBeDefined()
    expect(bad).toBeDefined()
  })
})
