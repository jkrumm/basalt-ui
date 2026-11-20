import { describe, expect, test } from 'bun:test'
import { BYTE_SLACK, PIXEL_TOLERANCE, compare, decide, judge, render, serialize } from './matrix'
import type { MatrixRecord, ModeVerdict, Verdict, ViewVerdict } from './matrix'
import { MODES } from '../src/parts/registry'
import type { Mode } from '../src/parts/registry'
import { VIEWS } from './results'
import type { ModeResult, Results, View } from './results'

const mode = (js: number, over: Partial<ModeVerdict> = {}): ModeVerdict => ({
  js,
  css: 24_000,
  cls: 0,
  lcp: 40,
  hydrated: true,
  hydrationErrors: 0,
  further: js ? js - 70_000 : 0,
  errors: 0,
  error: '',
  ...over,
})

const view = (ratio: number): ViewVerdict => ({
  changed: Math.round(ratio * 1392 * 40),
  ratio,
  sameSize: true,
  static: [1392, 40],
  only: [1392, 40],
})

function part(id: string, over: Partial<Verdict> = {}): Verdict {
  return {
    id,
    family: 'ui',
    covers: ['Button'],
    interaction: 'none',
    ssr: 'ok',
    ssrError: '',
    staticClean: true,
    views: Object.fromEntries(VIEWS.map((v) => [v, view(0)])) as Record<View, ViewVerdict>,
    modes: Object.fromEntries(MODES.map((m) => [m, mode(m === 'static' ? 0 : 80_000)])) as Record<
      Mode,
      ModeVerdict
    >,
    best: 'static',
    why: 'no directive',
    chart: false,
    ...over,
  }
}

function record(parts: Verdict[], over: Partial<MatrixRecord> = {}): MatrixRecord {
  return {
    browser: 'shell',
    runtime: { js: 72_000, css: 24_000 },
    parts,
    families: [
      {
        family: 'ui',
        parts: parts.length,
        js: { static: 0, visible: 80_000, idle: 80_000, load: 80_000, only: 80_000 },
        css: 24_000,
        cls: 0,
      },
    ],
    zeroJs: { pages: 3, js: 0, scriptTags: 0 },
    uncovered: [],
    missingFonts: 0,
    ...over,
  }
}

describe('compare', () => {
  test('passes an unchanged record', () => {
    const r = record([part('button')])
    expect(compare(r, r)).toEqual({ failures: [], notes: [] })
  })

  test('fails a part that was static-clean and is not (the seeded regression)', () => {
    const was = record([part('button')])
    const views = { ...part('button').views, '390-dark': view(0.04) }
    const is = record([part('button', { staticClean: false, views })])
    const { failures } = compare(was, is)
    expect(failures).toEqual(['button: was static-clean, now 2227 px (4.0%) at 390-dark'])
  })

  test('fails a part that stops rendering on the server', () => {
    const is = record([
      part('button', { staticClean: false, ssr: 'fail', ssrError: 'useRouter outside a router' }),
    ])
    expect(compare(record([part('button')]), is).failures).toEqual([
      'button: was static-clean, now ssr fail: useRouter outside a router',
    ])
  })

  test('fails a page whose JavaScript grows past its budget, and only past the slack', () => {
    const grown = (by: number) => {
      const p = part('button')
      return record([{ ...p, modes: { ...p.modes, load: mode(80_000 + by) } }])
    }
    expect(compare(record([part('button')]), grown(BYTE_SLACK)).failures).toEqual([])
    expect(compare(record([part('button')]), grown(BYTE_SLACK + 1)).failures).toEqual([
      'button load: JavaScript 81025 B gzip, budget 80000 B',
    ])
  })

  test('fails a page without an island that loads a script', () => {
    const is = record([part('button')], { zeroJs: { pages: 3, js: 812, scriptTags: 1 } })
    expect(compare(record([part('button')]), is).failures).toEqual([
      'a page without an island loaded 812 B of JavaScript from 1 script tags',
    ])
  })

  test('reports an improvement without failing', () => {
    const was = record([part('chart', { staticClean: false })])
    expect(compare(was, record([part('chart')]))).toEqual({
      failures: [],
      notes: ['chart: now static-clean; record it with UPDATE=1'],
    })
  })
})

describe('decide', () => {
  test('a static-clean part that needs no JavaScript takes no directive', () => {
    expect(decide({ interaction: 'none', why: 'typography only' }, part('prose')).best).toBe(
      'static',
    )
  })

  test('a part that fails on the server falls back to client:only', () => {
    const p = part('controls', { ssr: 'fail', ssrError: 'no router', staticClean: false })
    expect(decide({ interaction: 'enhance', why: 'filters' }, p)).toEqual({
      best: 'only',
      why: 'fails on the server (no router); client:only is the one mode that renders, with no static picture',
    })
  })

  test('a part that should be static but differs is repaired by an island until fixed', () => {
    const p = part('lines', {
      staticClean: false,
      views: { ...part('lines').views, '1440-light': view(0.03) },
    })
    expect(decide({ interaction: 'none', why: 'drawn at rest' }, p).best).toBe('visible')
  })
})

describe('judge', () => {
  test('counts pixels, not the rounded share: a few changed pixels past the tolerance are a difference', () => {
    const load: ModeResult = {
      hydrated: true,
      htmlScriptTags: 0,
      scriptTags: 0,
      js: 0,
      jsInline: 0,
      css: 0,
      cls: 0,
      lcp: 0,
      errors: [],
      hydrationErrors: 0,
    }
    const pic = (changed: number) => ({
      changed,
      ratio: 0,
      static: [1392, 800] as [number, number],
      only: [1392, 800] as [number, number],
    })
    const results: Results = {
      browser: 'shell',
      seconds: 1,
      baseline: Object.fromEntries(MODES.map((m) => [m, load])) as Results['baseline'],
      parts: [
        {
          id: 'button',
          ssr: 'ok',
          ssrError: '',
          textMatch: true,
          modes: Object.fromEntries(
            MODES.map((m) => [m, { ...load, further: 0 }]),
          ) as Results['parts'][number]['modes'],
          views: {
            '1440-light': pic(PIXEL_TOLERANCE + 1),
            '1440-dark': pic(0),
            '390-light': pic(0),
            '390-dark': pic(0),
          },
        },
      ],
      families: [],
      index: load,
    }
    const entry = {
      id: 'button',
      family: 'ui',
      module: 'ui/button',
      covers: ['Button'],
      interaction: 'none',
      why: 'a button',
    } as const
    expect(judge(results, [entry], ['Button']).parts[0]?.staticClean).toBe(false)
  })
})

describe('serialize', () => {
  test('round-trips the record', () => {
    const r = record([part('button'), part('lines', { chart: true })])
    expect(JSON.parse(serialize(r))).toEqual(r)
  })
})

describe('render', () => {
  test('is a pure function of the record', () => {
    const r = record([part('button')])
    expect(render(r, [])).toBe(render(r, []))
    expect(render(r, [])).toContain('| button | Button | clean |')
  })
})
