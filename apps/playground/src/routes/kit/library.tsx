import { createFileRoute } from '@tanstack/react-router'
import { filterSlot, spec } from 'basalt-ui/controls'
import { Page, PageAside, PageBar } from 'basalt-ui/page'
import { defineControls, field } from 'basalt-ui/router'
import { col, DataTable, useDataTable } from 'basalt-ui/table'
import type { ReactElement } from 'react'
import { filterPhotos } from '../../demo/kit-filter'
import { PhotoDetail } from '../../demo/kit-photo-detail'
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
  id: 'kit-library',
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
    photo: field.string(''),
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
 * The reference page a media or records app starts from: the filters on top, the results as a grid of cards,
 * a photo's name opens it in the peek, and activating a card shows its details in the aside. The side filter
 * panel and the image in each card are missing on purpose: the kit has no surface for either yet
 * (docs/v3/verdicts/showcase-gaps.md).
 */
function LibraryRoute(): ReactElement {
  const values = store.useValues()
  const rows = filterPhotos(PHOTOS, values)
  const t = useDataTable({
    id: 'kit-library-photos',
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
    cardsBelow: 'always',
    detail: (photo) => <PhotoDetail photo={photo} />,
    detailTitle: (photo) => photo.title,
    detailState: store.field.photo,
  })
  return (
    <Page area="kit-library">
      <PageBar controls={filters} />
      <DataTable table={t} />
      <PageAside title="Photo" state={store.field.photo} />
    </Page>
  )
}

export const Route = createFileRoute('/kit/library')({
  staticData: { title: 'Library' },
  validateSearch: store.validateSearch,
  search: { middlewares: store.middlewares },
  component: LibraryRoute,
})
