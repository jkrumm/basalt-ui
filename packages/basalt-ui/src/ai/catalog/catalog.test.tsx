/**
 * `defineCatalog` products under `expectCatalog` (P5): the section 4 `stat` exemplar and a link
 * block pass; a seeded block that renders a model href from a field the validator does not walk
 * fails, naming the field.
 */
import { describe, expect, test } from 'bun:test'
import { z } from 'zod'
import { StatCard } from '../../cards/stat-card'
import { expectCatalog } from '../../testing/expect-catalog'
import { defineBlock, defineCatalog } from './define'

const stat = defineBlock({
  name: 'stat',
  description: 'One headline number with a delta. Never for lists.',
  props: z.object({ label: z.string().max(40), value: z.number(), delta: z.number().optional() }),
  sample: [
    { label: 'Shipped', value: 388, delta: 12 },
    { label: 'Open', value: 4 },
  ],
  render: (p) => (
    <StatCard
      title={p.label}
      value={p.value}
      {...(p.delta !== undefined && { delta: { value: p.delta, polarity: 'up-good' } })}
    />
  ),
})

const docLink = defineBlock({
  name: 'doc-link',
  description: 'A link to one document.',
  props: z.object({ title: z.string(), href: z.string() }),
  sample: [{ title: 'Guide', href: '/docs/guide' }],
  render: (p) => <a href={p.href}>{p.title}</a>,
})

/** Seeded: the destination sits under `target`, which the url walk does not visit. */
const unfiltered = defineBlock({
  name: 'doc-link',
  description: 'A link to one document.',
  props: z.object({ title: z.string(), target: z.string() }),
  sample: [{ title: 'Guide', target: '/docs/guide' }],
  render: (p) => <a href={p.target}>{p.title}</a>,
})

describe('expectCatalog over defineCatalog', () => {
  test('the compliant catalog passes', () => {
    expect(() => expectCatalog(defineCatalog([stat, docLink]))).not.toThrow()
  })

  test('a catalog that renders a model href unfiltered fails', () => {
    expect(() => expectCatalog(defineCatalog([stat, unfiltered]))).toThrow(
      'block "doc-link" sample 0: the model string in target reaches an attribute unfiltered',
    )
  })
})

const ticketRow = (textKeys: readonly string[], asLink: boolean) =>
  defineBlock({
    name: 'tickets',
    description: 'Tickets with a url cell.',
    props: z.object({ type: z.literal('tickets'), rows: z.array(z.object({ url: z.string() })) }),
    textKeys,
    sample: [{ type: 'tickets', rows: [{ url: 'http://tracker.example/EP-2' }] }],
    render: (p) => (
      <ul>
        {p.rows.map((r) => (
          <li key={r.url}>{asLink ? <a href={r.url}>ticket</a> : r.url}</li>
        ))}
      </ul>
    ),
  })

describe('expectCatalog over a catalog with text keys and its own discriminator', () => {
  test('a url cell drawn as text passes, and the discriminator names the block', () => {
    const catalog = defineCatalog([ticketRow(['url'], false)], { discriminator: 'type' })
    expect(() => expectCatalog(catalog)).not.toThrow()
  })

  test('a text key the block draws as a link fails, naming the field', () => {
    const catalog = defineCatalog([ticketRow(['url'], true)], { discriminator: 'type' })
    expect(() => expectCatalog(catalog)).toThrow(
      'the model string in rows.0.url reaches an attribute',
    )
  })

  test('without the text key, the http: sample is refused', () => {
    const catalog = defineCatalog([ticketRow([], false)], { discriminator: 'type' })
    expect(() => expectCatalog(catalog)).toThrow('does not validate')
  })
})
