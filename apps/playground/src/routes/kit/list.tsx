import { createFileRoute } from '@tanstack/react-router'
import { StatCell, StatGroup } from 'basalt-ui/cards'
import { Sparkline } from 'basalt-ui/charts'
import { ControlHome, filterSlot, spec } from 'basalt-ui/controls'
import { Page, PageBar } from 'basalt-ui/page'
import { defineControls, field } from 'basalt-ui/router'
import { col, DataTable, useDataTable } from 'basalt-ui/table'
import { Sheet, SheetContent } from 'basalt-ui/ui/sheet'
import { LayoutGrid, Plus, Rows3, Upload } from 'lucide-react'
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

const CAMERAS = [...new Set(PHOTOS.map((photo) => photo.camera))].toSorted()

const store = defineControls({
  id: 'kit-list',
  scope: 'page',
  fields: {
    view: field.enum(['all', ...VERDICTS], 'all').labels({ all: 'All photos', ...VERDICT_LABELS }),
    search: field.string(''),
    collection: field.multi(COLLECTIONS, []).labels(COLLECTION_LABELS),
    camera: field
      .enum(['any', ...CAMERAS], 'any')
      .labels({ any: 'Any', ...Object.fromEntries(CAMERAS.map((c) => [c, c])) }),
    taken: field
      .range({ presets: ['all', '30d', '90d'], fallback: 'all', custom: true })
      .labels({ all: 'Any day', '30d': 'Last 30 days', '90d': 'Last 90 days', custom: 'Between' }),
    layout: field.enum(['table', 'cards'], 'table').labels({ table: 'Table', cards: 'Cards' }),
    look: field.enum(['reading', 'grid'], 'reading').labels({ reading: 'Reading', grid: 'Grid' }),
    settings: field.boolean(false),
  },
})

const lookSlot = filterSlot([spec(store.field.look, 'Rows', { as: 'segmented' })])

const c = col<Photo>()

/** Views per day across `photos`, the last 14 days, dated so a readout names its day. */
function viewsPerDay(photos: readonly Photo[]): { value: number; at: Date }[] {
  return Array.from({ length: 14 }, (_, i) => ({
    value: photos.reduce((sum, photo) => sum + (photo.perDay[i] ?? 0), 0),
    at: new Date(Date.UTC(2026, 10, 1 + i, 12)),
  }))
}

/**
 * The reference list page: one view row (counted tabs; search, filter, layout, view settings and
 * the one primary), a flush summary strip under it, and one table to the work surface's edges.
 */
function ListRoute(): ReactElement {
  const values = store.useValues()
  const narrowed = filterPhotos(PHOTOS, {
    search: values.search,
    collection: 'all',
    verdict: 'all',
    taken: values.taken,
  }).filter(
    (photo) =>
      (values.collection.length === 0 || values.collection.includes(photo.collection)) &&
      (values.camera === 'any' || photo.camera === values.camera),
  )
  const rows = values.view === 'all' ? narrowed : narrowed.filter((p) => p.verdict === values.view)
  const countOf = (verdict: Photo['verdict']): number =>
    narrowed.filter((p) => p.verdict === verdict).length
  const picked = countOf('picked')
  const unrated = countOf('unrated')
  const views = rows.reduce((sum, photo) => sum + photo.views, 0)
  const pickedShare =
    rows.length === 0
      ? 0
      : Math.round((rows.filter((p) => p.verdict === 'picked').length / rows.length) * 100)
  const sortedViews = rows.map((photo) => photo.views).toSorted((a, b) => a - b)
  const mid = Math.floor(sortedViews.length / 2)
  const medianViews =
    sortedViews.length === 0
      ? null
      : sortedViews.length % 2 === 1
        ? sortedViews[mid]!
        : Math.round((sortedViews[mid - 1]! + sortedViews[mid]!) / 2)
  const newest = rows.reduce<string | null>(
    (day, photo) => (day === null || photo.taken > day ? photo.taken : day),
    null,
  )

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
      c.text('camera', { header: 'Camera' }),
      c.date('taken', { header: 'Taken', mono: true }),
      c.number('views', { header: 'Views, 14 days' }),
    ],
    data: rows,
    getRowId: (photo) => photo.id,
    mode: { kind: 'client' },
    look: values.look,
    cardsBelow: values.layout === 'cards' ? 'always' : 'regular',
  })
  const [, openSettings] = store.field.settings.use()

  return (
    <Page area="kit-list" fill>
      <PageBar
        tabs={{
          state: store.field.view,
          label: 'Photo views',
          badges: {
            all: { count: narrowed.length },
            picked: { count: picked, tone: 'good' },
            unrated: { count: unrated, attention: unrated > 0 },
            rejected: { count: countOf('rejected'), tone: 'bad' },
          },
        }}
        search={{
          state: store.field.search,
          label: 'Search photos',
          placeholder: 'Title, camera or lens',
        }}
        controls={filterSlot(
          [
            spec(store.field.collection, 'Collection'),
            spec(store.field.camera, 'Camera'),
            spec(store.field.taken, 'Taken'),
          ],
          { match: { shown: rows.length, total: PHOTOS.length } },
        )}
        layout={{
          state: store.field.layout,
          label: 'Layout',
          options: [
            { value: 'table', label: 'Table', icon: Rows3 },
            { value: 'cards', label: 'Cards', icon: LayoutGrid },
          ],
        }}
        settings={{
          label: 'View settings',
          onClick: () => {
            openSettings(true)
          },
        }}
        actions={[
          { id: 'import', label: 'Import', icon: Upload, onClick: () => {} },
          { id: 'new', label: 'New photo', icon: Plus, primary: true, onClick: () => {} },
        ]}
      />
      <StatGroup variant="flush" label="Shown photos">
        <StatCell
          title="Picked"
          value={rows.length === 0 ? null : pickedShare}
          unit="%"
          sub="Of the photos in this view"
        />
        <StatCell
          title="Views, 14 days"
          value={views}
          sub="Across the shown photos"
          chart={(box) => (
            <Sparkline points={viewsPerDay(rows)} height={box.height} label="Views per day" />
          )}
        />
        <StatCell title="Views per photo" value={medianViews} sub="Median over 14 days" />
        <StatCell title="Newest" value={newest} sub="Day taken" />
      </StatGroup>
      <DataTable table={t} />
      <Sheet state={store.field.settings}>
        <SheetContent title="View settings">
          <ControlHome home="sheet">{lookSlot.render()}</ControlHome>
        </SheetContent>
      </Sheet>
    </Page>
  )
}

export const Route = createFileRoute('/kit/list')({
  staticData: { title: 'List' },
  validateSearch: store.validateSearch,
  search: { middlewares: store.middlewares },
  component: ListRoute,
})
