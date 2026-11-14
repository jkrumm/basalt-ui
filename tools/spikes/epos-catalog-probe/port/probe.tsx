/**
 * P6 measurements over the port. Not a gate: each `it` records what the engine did with epos's
 * payloads into `metrics.json`; the spike doc quotes it. A failing assertion here means the harness
 * is broken, never that the hypothesis failed.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { catalog } from './catalog'
import { defineBlock, defineCatalog, expectCatalog } from './basalt'
import { specs } from './fixtures'
import * as orig from './schema.orig'

const metrics: Record<string, unknown> = {}
const bytes = (x: unknown): number => new TextEncoder().encode(JSON.stringify(x)).length
const depth = (x: unknown): number =>
  typeof x !== 'object' || x === null ? 0 : 1 + Math.max(0, ...Object.values(x).map(depth))
const via = (spec: { type: string }) => catalog.validate({ ...spec, block: spec.type })
const verdict = (spec: { type: string }) => {
  const r = via(spec)
  return {
    bytes: bytes(spec),
    depth: depth(spec) + 0,
    ok: r.ok,
    ...(r.ok ? {} : { error: r.error }),
  }
}
const word = (n: number, c = 'x'): string => c.repeat(n)

describe('P6', () => {
  it('the ten fixtures through the engine', () => {
    const out: Record<string, unknown> = {}
    for (const [type, spec] of Object.entries(specs)) {
      const r = via(spec)
      const same =
        r.ok && JSON.stringify(r.block.props) === JSON.stringify(orig.parseShowSpec(spec))
      out[type] = { ...verdict(spec), sameAsEpos: same }
    }
    metrics.fixtures = out
    expect(Object.keys(out)).toHaveLength(10)
  })

  it('every fixture renders through catalog.Block in each phase', () => {
    const out: Record<string, string> = {}
    for (const [type, spec] of Object.entries(specs)) {
      const ready = renderToStaticMarkup(
        createElement(catalog.Block, { spec: { ...spec, block: type }, phase: 'ready' }),
      )
      out[type] = ready.includes(`data-probe="${type}"`)
        ? 'drawn'
        : ready.includes('unavailable')
          ? 'could not be displayed'
          : 'other'
    }
    metrics.rendered = out
  })

  it('the server maxima against the engine ceiling (32 KiB, depth 6)', () => {
    const text = word(40)
    const row = (cols: number) =>
      Object.fromEntries(Array.from({ length: cols }, (_, i) => [`c${i}`, text]))
    const cols = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ key: `c${i}`, label: `C${i}` }))
    const table = (rows: number, c: number) => ({
      type: 'table',
      columns: cols(c),
      rows: Array.from({ length: rows }, () => row(c)),
    })
    const chart = (points: number, series: number) => ({
      type: 'chart',
      variant: 'line',
      x: 'd',
      series: Array.from({ length: series }, (_, i) => ({ key: `s${i}`, label: `S${i}` })),
      data: Array.from({ length: points }, (_, p) => ({
        d: `2026-01-${p}`,
        ...Object.fromEntries(Array.from({ length: series }, (_, i) => [`s${i}`, p * i])),
      })),
    })
    const list = {
      type: 'list',
      layout: 'list',
      items: Array.from({ length: 50 }, () => ({
        title: word(60),
        subtitle: word(60),
        meta: ['a', 'b'],
      })),
    }
    const out: Record<string, unknown> = {
      'table 20 rows x 6 cols (a normal answer)': verdict(table(20, 6)),
      'table 100 rows x 6 cols': verdict(table(100, 6)),
      'table 500 rows x 3 cols (server max rows)': verdict(table(500, 3)),
      'chart 30 points x 3 series': verdict(chart(30, 3)),
      'chart 200 points x 4 series (server max rows)': verdict(chart(200, 4)),
      'list 50 items': verdict(list),
    }
    metrics.maxima = out
  })

  it('layout nesting depth', () => {
    const leaf = (spec: { type: string }) => ({
      type: 'layout',
      columns: 2,
      items: [{ spec }, { spec: { type: 'callout', tone: 'info', text: 'x' } }],
    })
    const out = {
      'layout of a stat': verdict(leaf(specs.stat)),
      'layout of a chart': verdict(leaf(specs.chart)),
      'layout of a table': verdict(leaf(specs.table)),
      'layout of a table with a spark cell': verdict(
        leaf({
          type: 'table',
          columns: [{ key: 'k', label: 'K', kind: 'spark' }],
          rows: [{ k: [1, 2, 3] }],
        }),
      ),
      'table with a spark cell, no layout': verdict({
        type: 'table',
        columns: [{ key: 'k', label: 'K', kind: 'spark' }],
        rows: [{ k: [1, 2, 3] }],
      }),
      'stat with a delta and spark': verdict({
        type: 'stat',
        items: [{ label: 'L', value: 1, spark: [1, 2], delta: { value: 1 } }],
      }),
    }
    metrics.nesting = out
  })

  it('url fields: data columns named like a url key, and the insecure http cell', () => {
    const table = (key: string, value: unknown) => ({
      type: 'table',
      columns: [{ key, label: 'L' }],
      rows: [{ [key]: value }],
    })
    metrics.urlKeys = {
      'column "url" holding http://insecure.example': verdict(
        table('url', 'http://insecure.example/EP-2'),
      ),
      'column "link" holding a plain label': verdict(table('link', 'see the run')),
      'column "src" holding a plain label': verdict(table('src', 'kafka')),
      'column "href" holding https://jira.example/EP-1': verdict(
        table('href', 'https://jira.example/EP-1'),
      ),
      'list item url //evil.example': verdict({
        type: 'list',
        layout: 'list',
        items: [{ title: 'T', url: '//evil.example/p' }],
      }),
      'ticket href javascript:': verdict({
        type: 'ticket',
        items: [{ key: 'EP-1', title: 'T', status: 'S', href: 'javascript:alert(1)' }],
      }),
      'board item url https://jira.example/EP-5': verdict({
        type: 'board',
        columns: [{ title: 'C', items: [{ title: 'T', url: 'https://jira.example/EP-5' }] }],
      }),
      'vega data.url': verdict({
        ...specs.vega,
        spec: { ...specs.vega.spec, data: { url: 'https://example.com/d.json' } },
      }),
    }
  })

  it('refusals carry advice a model can act on', () => {
    const bad = (spec: unknown) => {
      const r = catalog.validate(spec)
      return r.ok ? 'accepted' : r.error
    }
    metrics.advice = {
      unknownBlock: bad({ block: 'pie' }),
      schemaViolation: bad({ ...specs.callout, block: 'callout', text: '' }),
      layoutRefine: bad({
        block: 'layout',
        type: 'layout',
        columns: 2,
        items: [{ spec: specs.stat, span: 3 }, { spec: specs.callout }],
      }),
    }
    // a message written in the schema reaches the model verbatim
    const own = defineCatalog([
      defineBlock({
        name: 'chart',
        description: 'x',
        props: z.object({
          series: z.array(z.string()).max(4, 'A chart shows at most 4 series: send two charts.'),
        }),
        sample: [{ series: ['a'] }],
        render: () => null,
      }),
    ])
    const r = own.validate({ block: 'chart', series: ['a', 'b', 'c', 'd', 'e'] })
    metrics.customAdvice = r.ok ? 'accepted' : r.error
  })

  it('what an epos block does that the engine has no seam for', () => {
    // render(p, box): box is { height, phase }; there is no emit, so a block cannot raise a BlockEvent.
    const probe = defineBlock({
      name: 'probe',
      description: 'x',
      props: z.object({}),
      sample: [{}],
      render: (_p, box) => <i data-keys={Object.keys(box).join(',')} />,
    })
    const html = renderToStaticMarkup(
      createElement(defineCatalog([probe]).Block, { spec: { block: 'probe' }, phase: 'ready' }),
    )
    metrics.boxKeys = /data-keys="([^"]*)"/.exec(html)?.[1]
  })

  it('expectCatalog over the ported catalog', () => {
    try {
      expectCatalog(catalog)
      metrics.expectCatalog = 'passed'
    } catch (error) {
      metrics.expectCatalog = String(error).split('\n').slice(0, 40)
    }
  })

  it('writes metrics.json', () => {
    writeFileSync(join(process.cwd(), '../metrics.json'), JSON.stringify(metrics, null, 2))
  })
})
