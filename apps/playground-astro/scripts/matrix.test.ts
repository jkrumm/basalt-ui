import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { FINDINGS } from '../src/parts/findings'
import {
  BYTE_SLACK,
  PIXEL_TOLERANCE,
  compare,
  decide,
  judge,
  render,
  renderRun,
  serialize,
  toRecord,
} from './matrix'
import type { MatrixRecord, ModeVerdict, Run, Verdict, ViewVerdict } from './matrix'
import { MODES } from '../src/parts/registry'
import type { Mode, PartEntry } from '../src/parts/registry'
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

function run(parts: Verdict[], over: Partial<Run> = {}): Run {
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

const entry = (id: string): PartEntry =>
  ({
    id,
    family: 'ui',
    module: `ui/${id}`,
    covers: ['Button'],
    interaction: 'none',
    why: 'a button',
  }) as PartEntry

/** The record a run sets: every budget at the measured size plus the slack. */
const recordOf = (r: Run): MatrixRecord =>
  toRecord(r, null, { parts: r.parts.map((p) => entry(p.id)) }).record

/** A run whose button pages load `by` more bytes of JavaScript in client:load. */
const grown = (by: number, key: 'js' | 'further' = 'js'): Run => {
  const p = part('button')
  const load = mode(80_000, { [key]: (key === 'js' ? 80_000 : 10_000) + by })
  return run([{ ...p, modes: { ...p.modes, load } }])
}

describe('compare', () => {
  test('passes an unchanged run', () => {
    const r = run([part('button')])
    expect(compare(recordOf(r), r)).toEqual({ failures: [], notes: [] })
  })

  test('fails a part that was static-clean and is not (the seeded regression)', () => {
    const was = recordOf(run([part('button')]))
    const views = { ...part('button').views, '390-dark': view(0.04) }
    const is = run([part('button', { staticClean: false, views })])
    const { failures } = compare(was, is)
    expect(failures).toEqual(['button: was static-clean, now 2227 px (4.0%) at 390-dark'])
  })

  test('fails a part that stops rendering on the server', () => {
    const is = run([
      part('button', { staticClean: false, ssr: 'fail', ssrError: 'useRouter outside a router' }),
    ])
    expect(compare(recordOf(run([part('button')])), is).failures).toEqual([
      'button: was static-clean, now ssr fail: useRouter outside a router',
    ])
  })

  test('a page that grows inside its budget passes; one byte past it fails (an island raised past its tolerance)', () => {
    const rec = recordOf(run([part('button')]))
    expect(rec.parts[0]?.budget.js).toBe(80_000 + BYTE_SLACK)
    expect(compare(rec, grown(BYTE_SLACK)).failures).toEqual([])
    const [failure] = compare(rec, grown(BYTE_SLACK + 1)).failures
    expect(failure).toStartWith(
      'button: JavaScript 81025 B gzip, budget 81024 B; raise it on purpose',
    )
  })

  test('fails a further-island cost past its budget', () => {
    const rec = recordOf(run([part('button')]))
    expect(compare(rec, grown(BYTE_SLACK + 1, 'further')).failures).toHaveLength(1)
    expect(compare(rec, grown(BYTE_SLACK + 1, 'further')).failures[0]).toStartWith(
      'button: further-island JavaScript 11025 B gzip, budget 11024 B',
    )
  })

  test('fails a page without an island that loads a script', () => {
    const is = run([part('button')], { zeroJs: { pages: 3, js: 812, scriptTags: 1 } })
    expect(compare(recordOf(run([part('button')])), is).failures).toEqual([
      'a page without an island loaded 812 B of JavaScript from 1 script tags',
    ])
  })

  test('a partial run checks the parts it measured and leaves the rest', () => {
    const was = recordOf(run([part('button'), part('badge')]))
    const views = { ...part('button').views, '390-dark': view(0.04) }
    expect(compare(was, run([part('button')]), true).failures).toEqual([])
    expect(compare(was, run([part('button')])).failures).toEqual([
      'badge: recorded but not measured (removed from the registry? record it with UPDATE=1)',
    ])
    expect(
      compare(was, run([part('button', { staticClean: false, views })]), true).failures,
    ).toEqual(['button: was static-clean, now 2227 px (4.0%) at 390-dark'])
  })

  test('reports an improvement without failing', () => {
    const was = recordOf(run([part('chart', { staticClean: false })]))
    expect(compare(was, run([part('chart')]))).toEqual({
      failures: [],
      notes: [
        'chart: now static-clean; record it with UPDATE=1',
        'chart: best is now static, the record says visible; record it with UPDATE=1',
      ],
    })
  })
})

describe('toRecord', () => {
  test('a run inside every budget leaves the record byte for byte', () => {
    const rec = recordOf(run([part('button')]))
    const shrunk = run([part('button', { modes: { ...part('button').modes, load: mode(60_000) } })])
    const { record, raised } = toRecord(grown(BYTE_SLACK), rec, { parts: [entry('button')] })
    expect(raised).toEqual([])
    expect(serialize(record)).toBe(serialize(rec))
    expect(serialize(toRecord(shrunk, rec, { parts: [entry('button')] }).record)).toBe(
      serialize(rec),
    )
  })

  test('raises an exceeded budget to the measured size plus the slack, with its reason', () => {
    const rec = recordOf(run([part('button')]))
    const { record, raised } = toRecord(grown(5000), rec, {
      parts: [entry('button')],
      reason: 'the table view',
    })
    expect(raised).toEqual(['button JavaScript: 81024 B to 86024 B'])
    expect(record.parts[0]?.budget.js).toBe(85_000 + BYTE_SLACK)
    expect(record.parts[0]?.raised).toBe('the table view')
    expect(render(record, [])).toContain('- button: the table view')
  })

  test('a partial run keeps the parts it did not measure', () => {
    const rec = recordOf(run([part('button'), part('badge')]))
    const { record } = toRecord(grown(5000), rec, {
      parts: [entry('button'), entry('badge')],
      reason: 'grew',
    })
    expect(record.parts.map((p) => p.id)).toEqual(['button', 'badge'])
    expect(record.parts[1]).toEqual(rec.parts[1]!)
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
    const r = recordOf(run([part('button'), part('lines', { chart: true })]))
    expect(JSON.parse(serialize(r))).toEqual(r)
  })
})

describe('render', () => {
  test('is a pure function of the record', () => {
    const r = recordOf(run([part('button')]))
    expect(render(r, [])).toBe(render(r, []))
    expect(render(r, [])).toContain('| button | Button | clean | no directive | 79.1 kB |')
  })

  test("the run's table carries the measured sizes", () => {
    expect(renderRun(run([part('button')]), [])).toContain('| button | 78.1 kB |')
  })
})

describe('the committed record', () => {
  const dir = join(import.meta.dir, '../../../docs/v3/verdicts')
  const json = readFileSync(join(dir, 'astro-matrix.json'), 'utf8')
  const rec = JSON.parse(json) as MatrixRecord

  test('is in its serialized form, one part per line', () => {
    expect(serialize(rec)).toBe(json)
  })

  test('astro-matrix.md is its rendering (bun apps/playground-astro/scripts/matrix.ts --render)', () => {
    expect(readFileSync(join(dir, 'astro-matrix.md'), 'utf8') === render(rec, FINDINGS)).toBe(true)
  })

  test('holds budgets, never a measured size', () => {
    for (const p of rec.parts)
      expect(Object.keys(p.budget).toSorted()).toEqual(['css', 'further', 'js'])
    expect(json).not.toContain('"lcp"')
  })
})
