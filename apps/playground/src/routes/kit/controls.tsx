import { createFileRoute } from '@tanstack/react-router'
import { filterSlot, spec } from 'basalt-ui/controls'
import { Page, PageBar, Section } from 'basalt-ui/page'
import { defineControls, field } from 'basalt-ui/router'
import { col, DataTable, TableToolbar, tableCodec, useDataTable } from 'basalt-ui/table'
import type { ReactElement } from 'react'
import { filterPhotos } from '../../demo/kit-filter'
import {
  COLLECTIONS,
  COLLECTION_LABELS,
  PHOTOS,
  VERDICTS,
  VERDICT_LABELS,
  VERDICT_TONE,
} from '../../demo/kit-photos'
import type { Photo } from '../../demo/kit-photos'

const c = col<Photo>()

const schema = c.codec({
  title: 'entity',
  verdict: 'status',
  camera: 'text',
  taken: 'date',
  views: 'number',
})

/**
 * Every control of the page in one store: the view the tabs switch, the four filters of the page bar and the
 * table's own state (sort, page, its saved view).
 */
const store = defineControls({
  id: 'kit-controls',
  scope: 'page',
  fields: {
    as: field
      .enum(['table', 'cards'], 'table', { history: 'push' })
      .labels({ table: 'Table', cards: 'Cards' }),
    search: field.string(''),
    collection: field
      .enum(['all', ...COLLECTIONS], 'all')
      .labels({ all: 'All collections', ...COLLECTION_LABELS }),
    verdict: field.enum(['all', ...VERDICTS], 'all').labels({ all: 'All', ...VERDICT_LABELS }),
    taken: field
      .range({ presets: ['all', '30d', '90d'], fallback: 'all', custom: true })
      .labels({ all: 'Any day', '30d': 'Last 30 days', '90d': 'Last 90 days', custom: 'Between' }),
    table: field.composite(tableCodec(schema)),
    view: field.string(''),
  },
})

const filters = filterSlot([
  spec(store.field.search, 'Search'),
  spec(store.field.collection, 'Collection'),
  spec(store.field.verdict, 'Verdict', { as: 'segmented' }),
  spec(store.field.taken, 'Taken'),
])

function Photos(): ReactElement {
  const values = store.useValues()
  const [applied, setApplied] = store.field.view.use()
  const rows = filterPhotos(PHOTOS, values)
  const t = useDataTable({
    id: 'kit-controls-photos',
    label: 'Photos',
    columns: [
      c.entity('title', {
        header: 'Photo',
        href: (photo) => `/kit/photos/${photo.id}`,
        sub: (photo) => COLLECTION_LABELS[photo.collection],
      }),
      c.status('verdict', {
        header: 'Verdict',
        options: [...VERDICTS],
        labels: VERDICT_LABELS,
        tone: (value) => VERDICT_TONE[value],
      }),
      c.text('camera', { header: 'Camera', priority: 2 }),
      c.date('taken', { header: 'Taken', priority: 2 }),
      c.number('views', { header: 'Views', footer: 'sum' }),
    ],
    data: rows,
    getRowId: (photo) => photo.id,
    mode: { kind: 'client' },
    state: store.field.table,
    cardsBelow: values.as === 'cards' ? 'always' : 'regular',
  })
  const view = {
    id: applied === '' ? undefined : applied,
    set: (id: string | undefined) => (id === undefined ? store.field.view.clear() : setApplied(id)),
  }
  return (
    <>
      <TableToolbar table={t} view={view} />
      <DataTable table={t} />
    </>
  )
}

/**
 * Page controls: the page bar's tabs switch table and cards, its controls are one `FilterSet` (text, enum,
 * segmented and a date range), and the table keeps saved views. The range's custom span is two native date
 * inputs: `DateRangePicker` cannot bind a range field yet (docs/v3/verdicts/showcase-gaps.md).
 */
function ControlsRoute(): ReactElement {
  return (
    <Page area="kit-controls">
      <PageBar tabs={{ state: store.field.as, label: 'Photos view' }} controls={filters} />
      <Section title="Photos">
        <Photos />
      </Section>
    </Page>
  )
}

export const Route = createFileRoute('/kit/controls')({
  staticData: { title: 'Page controls' },
  validateSearch: store.validateSearch,
  search: { middlewares: store.middlewares },
  component: ControlsRoute,
})
