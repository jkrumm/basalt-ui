import { createFormat } from 'basalt-ui'
import type { ListItems } from 'basalt-ui/ui/combobox'
import { Bot, Factory, Package, Sparkles, Zap } from 'lucide-react'
import type { MentionTarget, Turn } from '../../../../packages/basalt-ui/blocks/assistant/model'
import { PARTS, SUPPLIERS } from './ref-inventory'

/**
 * The assistant reference page's fixtures: two exchanges over the inventory (one answered and
 * folded, one waiting on an order approval), what `@` lists and the models the picker offers.
 */

const lowBearings = PARTS.filter((p) => p.category === 'bearings' && p.stock !== 'in-stock').slice(
  0,
  3,
)
const nordlager = SUPPLIERS.find((s) => s.name === 'Nordlager Bearings') ?? SUPPLIERS[0]!

/** A due day as `Nov 29`, held on one line. */
const format = createFormat()
const dueOf = (day: string): string =>
  format.date(Date.parse(`${day}T00:00:00Z`), 'day').replace(' ', '\u00a0')

const table = [
  '| Part | Stock | Due |',
  '| --- | ---: | ---: |',
  ...lowBearings.map((p) => `| ${p.sku} | ${p.onHand} | ${dueOf(p.nextDelivery)} |`),
].join('\n')

export const TURNS: readonly Turn[] = [
  {
    id: 't1',
    from: 'user',
    parts: [{ type: 'text', text: 'Which bearings run out before their next delivery?' }],
  },
  {
    id: 't2',
    from: 'assistant',
    parts: [
      {
        type: 'reasoning',
        text: 'Bearings below their reorder point first, then the due day of each one’s next delivery against the daily draw.',
      },
      {
        type: 'tool-stock_lookup',
        toolCallId: 'c1',
        state: 'output-available',
        input: { category: 'bearings', below: 'reorder' },
        output: { count: lowBearings.length },
      },
      {
        type: 'tool-deliveries',
        toolCallId: 'c2',
        state: 'output-available',
        input: { parts: lowBearings.map((p) => p.sku) },
        output: {},
      },
      {
        type: 'text',
        text: `${lowBearings.length} bearings run short before their next delivery lands:\n\n${table}\n\nAll of them come from **${nordlager.name}**, whose quoted lead time is ${nordlager.leadDays} days.`,
      },
    ],
  },
  {
    id: 't3',
    from: 'user',
    parts: [{ type: 'text', text: `Reorder them from @${nordlager.name}, one order.` }],
  },
  {
    id: 't4',
    from: 'assistant',
    parts: [
      {
        type: 'reasoning',
        text: `One supplier, so one purchase order with ${lowBearings.length} lines, each topped up to twice its reorder point.`,
      },
      {
        type: 'tool-place_order',
        toolCallId: 'c3',
        state: 'approval-requested',
        input: {
          supplier: nordlager.id,
          lines: lowBearings.map((p) => ({ sku: p.sku, qty: p.reorderAt * 2 })),
        },
      },
      {
        type: 'text',
        text: 'The order is drafted. It goes out once you approve it above.',
      },
    ],
  },
]

const SUPPLIER_OPTIONS = SUPPLIERS.map((s) => ({
  value: { kind: 'supplier', id: s.id } satisfies MentionTarget,
  label: s.name,
  description: `${s.city}, ${s.country}`,
  icon: Factory,
}))

const PART_OPTIONS = PARTS.map((p) => ({
  value: { kind: 'part', id: p.id } satisfies MentionTarget,
  label: p.name,
  hint: p.sku,
  icon: Package,
}))

/** `@` asks this loader: suppliers and parts matching the typed text, grouped, eight of each. */
export async function mentionLoader(query: string): Promise<ListItems<MentionTarget>> {
  const q = query.trim().toLowerCase()
  const hit = (label: string, extra = ''): boolean =>
    q === '' || label.toLowerCase().includes(q) || extra.toLowerCase().includes(q)
  const groups = [
    { label: 'Suppliers', options: SUPPLIER_OPTIONS.filter((o) => hit(o.label)).slice(0, 8) },
    { label: 'Parts', options: PART_OPTIONS.filter((o) => hit(o.label, o.hint)).slice(0, 8) },
  ]
  return groups.filter((group) => group.options.length > 0)
}

export const MODELS: ListItems<string> = [
  {
    label: 'Fast',
    options: [
      {
        value: 'swift-2',
        label: 'Swift 2',
        description: 'Quick answers, short context',
        icon: Zap,
      },
      {
        value: 'swift-2-mini',
        label: 'Swift 2 mini',
        description: 'Cheapest, for lookups',
        icon: Zap,
      },
    ],
  },
  {
    label: 'Deep',
    options: [
      {
        value: 'atlas-4',
        label: 'Atlas 4',
        description: 'Plans and multi-step work',
        icon: Sparkles,
      },
      {
        value: 'atlas-4-long',
        label: 'Atlas 4 Long',
        description: 'Whole order histories',
        icon: Sparkles,
      },
    ],
  },
  {
    label: 'On site',
    options: [
      { value: 'ollie-8b', label: 'Ollie 8B', description: 'Runs on the plant server', icon: Bot },
    ],
  },
]
