// The server half of `ai-blocks`: name, description, props, sample and a loading height. No UI import.
import { z } from 'zod'

const label = z.string().max(40)
// A title reaches aria attributes in the composites, so it is plain words, never a URL.
const title = z
  .string()
  .max(60)
  .regex(/^[\p{L}\p{N} .,%&()-]+$/u, 'Use plain words in a title')
const point = z.object({ label: z.string().max(16), value: z.number() })
const row = z.object({ name: label, status: z.string().max(20), value: z.number() })
export type Row = z.infer<typeof row>
export type Point = z.infer<typeof point>
const points = [
  { label: 'Mon', value: 4 },
  { label: 'Tue', value: 7 },
]

export const stat = {
  name: 'stat',
  description: 'One headline number with a label. Never for a series or a list.',
  props: z.object({ label, value: z.number() }),
  sample: [{ label: 'Shipped', value: 388 }],
}
export const chart = {
  name: 'chart',
  description: 'A bar chart of one measure over a few labelled points.',
  props: z.object({ title, points: z.array(point).min(1).max(24) }),
  sample: [{ title: 'Deploys', points }],
  reserve: 280,
}
export const table = {
  name: 'table',
  description: 'Rows that compare a name, a status word and one number.',
  props: z.object({ title, rows: z.array(row).max(20) }),
  sample: [{ title: 'Services', rows: [{ name: 'api', status: 'up', value: 99 }] }],
}
export const callout = {
  name: 'callout',
  description: 'A short note beside the answer: a tip, a warning or an error.',
  props: z.object({ kind: z.enum(['info', 'good', 'warn', 'bad']), text: z.string().max(400) }),
  sample: [{ kind: 'warn' as const, text: 'The index is rebuilding.' }],
}
export const list = {
  name: 'list',
  description: 'A ranked list of named things by one number (a top-N).',
  props: z.object({ title, items: z.array(point).min(1).max(10) }),
  sample: [{ title: 'Top routes', items: points }],
}
export const layout = {
  name: 'layout',
  description: 'Two to four other blocks side by side, as one answer.',
  props: z.object({ items: z.array(z.record(z.string(), z.unknown())).min(2).max(4) }),
  reserve: 160,
  sample: [
    {
      items: [
        { block: 'stat', label: 'Shipped', value: 388 },
        { block: 'callout', kind: 'info' as const, text: 'Done.' },
      ],
    },
  ],
}

export const schemas = [stat, chart, table, callout, list, layout] as const
