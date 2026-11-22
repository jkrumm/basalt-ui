import { createFileRoute } from '@tanstack/react-router'
import { filterSlot, spec } from 'basalt-ui/controls'
import { Page, PageBar } from 'basalt-ui/page'
import { defineControls, field } from 'basalt-ui/router'
import { col, DataTable, useDataTable } from 'basalt-ui/table'
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

const store = defineControls({
  id: 'kit-list',
  scope: 'page',
  fields: {
    search: field.string(''),
    collection: field
      .enum(['all', ...COLLECTIONS], 'all')
      .labels({ all: 'All collections', ...COLLECTION_LABELS }),
    verdict: field.enum(['all', ...VERDICTS], 'all').labels({ all: 'All', ...VERDICT_LABELS }),
    taken: field
      .range({ presets: ['all', '30d', '90d'], fallback: 'all', custom: true })
      .labels({ all: 'Any day', '30d': 'Last 30 days', '90d': 'Last 90 days', custom: 'Between' }),
  },
})

const filters = filterSlot([
  spec(store.field.search, 'Search'),
  spec(store.field.collection, 'Collection'),
  spec(store.field.verdict, 'Verdict', { as: 'segmented' }),
  spec(store.field.taken, 'Taken'),
])

const c = col<Photo>()

/**
 * A fill page: the band, then one table that runs to the work surface's edges, with no gutter and no
 * card around it. A list fills; a dashboard keeps the padded default.
 */
function ListRoute(): ReactElement {
  const values = store.useValues()
  const rows = filterPhotos(PHOTOS, values)
  const t = useDataTable({
    id: 'kit-list-photos',
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
      c.date('taken', { header: 'Taken', mono: true }),
      c.number('views', { header: 'Views' }),
    ],
    data: rows,
    getRowId: (photo) => photo.id,
    mode: { kind: 'client' },
  })
  return (
    <Page area="kit-list" fill>
      <PageBar controls={filters} />
      <DataTable table={t} />
    </Page>
  )
}

export const Route = createFileRoute('/kit/list')({
  staticData: { title: 'List' },
  validateSearch: store.validateSearch,
  search: { middlewares: store.middlewares },
  component: ListRoute,
})
