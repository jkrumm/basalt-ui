/**
 * `expectCatalog` against hand-built `CatalogLike`s: it passes a compliant catalog and names the
 * failure on each way a catalog can let model output through.
 */
import { describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import type { CatalogLike, Phase } from '../core/ports'
import { expectCatalog } from './expect-catalog'

type Spec = { block?: unknown; [key: string]: unknown }
type View = (p: { spec: unknown; phase: Phase }) => ReactElement | null

const SAMPLE = { label: 'Docs', target: '/docs', href: '/docs' }
const BAD = /^(\/\/|javascript:|data:)/i

function depth(x: unknown): number {
  if (typeof x !== 'object' || x === null) return 0
  return 1 + Math.max(0, ...Object.values(x).map(depth))
}

function hasBadUrl(x: unknown): boolean {
  if (typeof x !== 'object' || x === null) return false
  return Object.entries(x).some(([k, v]) =>
    typeof v === 'string' ? k === 'href' && BAD.test(v) : hasBadUrl(v),
  )
}

/** A catalog with one `link` block; the knobs remove one safeguard each. */
function linkCatalog(o: {
  walk?: boolean
  limits?: boolean
  renderKey?: 'href' | 'target'
  view?: boolean
  throws?: boolean
}): CatalogLike & { Block?: View } {
  const validate = (x: unknown): ReturnType<CatalogLike['validate']> => {
    const spec = x as Spec
    if (spec.block !== 'link' || typeof spec['label'] !== 'string')
      return { ok: false, error: 'Bad. Fix it.' }
    if (o.limits !== false && (JSON.stringify(spec).length > 32 * 1024 || depth(spec) > 6))
      return { ok: false, error: 'Too big. Shrink it.' }
    if (o.walk !== false && hasBadUrl(spec)) return { ok: false, error: 'Bad url. Fix it.' }
    return { ok: true, block: { name: 'link', props: spec } }
  }
  const key = o.renderKey ?? 'href'
  const Block: View = ({ spec }) => {
    if (o.throws) throw new Error('boom')
    const s = spec as Record<string, string>
    return <a href={s[key]}>{s['label']}</a>
  }
  return {
    validate,
    blocks: [{ name: 'link', props: {}, sample: [SAMPLE] }],
    ...(o.view !== false && { Block }),
  }
}

describe('expectCatalog', () => {
  test('passes the compliant catalog', () => {
    expect(() => expectCatalog(linkCatalog({}))).not.toThrow()
  })

  test('fails a catalog that renders a model string from a non-url field into an href', () => {
    expect(() => expectCatalog(linkCatalog({ renderKey: 'target' }))).toThrow(
      'the model string in target reaches an attribute unfiltered',
    )
  })

  test('fails a validator that does not walk url fields', () => {
    expect(() => expectCatalog(linkCatalog({ walk: false }))).toThrow(
      'the hostile URL "//basalt-fuzz.invalid/p" in href is accepted',
    )
  })

  test('fails a validator that enforces no limits', () => {
    const run = (): void => expectCatalog(linkCatalog({ limits: false }))
    expect(run).toThrow('padded past 32768 bytes is accepted')
    expect(run).toThrow('nested past depth 6 is accepted')
  })

  test('fails a block that throws while rendering, naming the phase', () => {
    expect(() => expectCatalog(linkCatalog({ throws: true }))).toThrow(
      'throws while rendering in ready',
    )
  })

  test('fails a sample that does not validate, and a block with no sample', () => {
    const catalog = linkCatalog({})
    expect(() =>
      expectCatalog({ ...catalog, blocks: [{ name: 'link', props: {}, sample: [{ label: 3 }] }] }),
    ).toThrow('sample 0 does not validate')
    expect(() =>
      expectCatalog({ ...catalog, blocks: [{ name: 'link', props: {}, sample: [] }] }),
    ).toThrow('has no sample')
  })

  test('without a Block it checks the validator only', () => {
    expect(() => expectCatalog(linkCatalog({ view: false, renderKey: 'target' }))).not.toThrow()
  })
})
