/**
 * P6 port: the epos `show` catalog as one `defineCatalog`. The props are epos's own zod objects,
 * imported from the staged copy (`schema.orig.ts`), never retyped; the samples are its own fixtures.
 * `render` draws a marker: the epos components are the G6 migration, not this probe, so what is
 * measured here is the engine contract (validate, limits, url policy, phases, samples).
 */
import type { ReactNode } from 'react'
import { defineBlock, defineCatalog } from './basalt'
import { specs } from './fixtures'
import * as s from './schema.orig'

const mark =
  (type: string) =>
  (p: unknown): ReactNode => <div data-probe={type} data-size={JSON.stringify(p).length} />

export const catalog = defineCatalog([
  defineBlock({
    name: 'table',
    description:
      'Rows and columns of records; text, number, link, status, delta, spark and bar cells.',
    props: s.tableSpec,
    sample: [specs.table],
    render: mark('table'),
  }),
  defineBlock({
    name: 'chart',
    description: 'Bar, line, stacked or area chart of up to four series over one x field.',
    props: s.chartSpec,
    sample: [specs.chart],
    render: mark('chart'),
  }),
  defineBlock({
    name: 'stat',
    description: 'One to eight headline figures with a hint, delta or sparkline.',
    props: s.statSpec,
    sample: [specs.stat],
    render: mark('stat'),
  }),
  defineBlock({
    name: 'list',
    description: 'Titled items as a list or cards, with status, person and link.',
    props: s.listSpec,
    sample: [specs.list],
    render: mark('list'),
  }),
  defineBlock({
    name: 'board',
    description: 'Columns of items, a kanban view of work.',
    props: s.boardSpec,
    sample: [specs.board],
    render: mark('board'),
  }),
  defineBlock({
    name: 'diagram',
    description: 'A Mermaid diagram.',
    props: s.diagramSpec,
    sample: [specs.diagram],
    render: mark('diagram'),
  }),
  defineBlock({
    name: 'callout',
    description: 'A short note with a tone and inline markdown.',
    props: s.calloutSpec,
    sample: [specs.callout],
    render: mark('callout'),
  }),
  defineBlock({
    name: 'ticket',
    description: 'One to twelve Jira tickets as cards.',
    props: s.ticketSpec,
    sample: [specs.ticket],
    render: mark('ticket'),
  }),
  defineBlock({
    name: 'vega',
    description: 'A declarative Vega-Lite chart for what no other block draws.',
    props: s.vegaSpec,
    sample: [specs.vega],
    render: mark('vega'),
  }),
  defineBlock({
    name: 'layout',
    description: 'Two to six other blocks in a grid of up to three columns.',
    props: s.layoutSpec,
    sample: [specs.layout],
    render: mark('layout'),
  }),
])
