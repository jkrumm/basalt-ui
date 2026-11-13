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
