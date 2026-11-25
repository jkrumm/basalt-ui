import { createFileRoute } from '@tanstack/react-router'
import { Bars, ChartCard } from 'basalt-ui/charts'
import { Facts, Page, Section } from 'basalt-ui/page'
import { defineControls, field } from 'basalt-ui/router'
import { col, DataTable, useDataTable } from 'basalt-ui/table'
import { BASALT } from 'basalt-ui/tokens'
import type { ReactElement } from 'react'
import { globals } from '../../demo/globals'
import {
  COLLECTION_LABELS,
  PHOTOS,
  VERDICTS,
  VERDICT_LABELS,
  VERDICT_TONE,
} from '../../demo/kit-photos'
import type { Photo } from '../../demo/kit-photos'

const VIEWS = { light: BASALT.brand, dark: BASALT.brand }

/** The twelve most viewed photos, most viewed first: the chart's bars. */
const TOP = PHOTOS.toSorted((a, b) => b.views - a.views).slice(0, 12)

const c = col<Photo>()

/** The row the table's own record panel shows, `?row=<id>`: a reload and a shared link restore it. */
const store = defineControls({ id: 'kit-peek', scope: 'page', fields: { row: field.string('') } })

/**
 * A table whose rows open their record in the table's own panel: a side panel, a window, the page or
 * a short drawer under the rows (the header's Open as menu, remembered for this table), with previous
 * and next through the rows.
 */
function FromRows(): ReactElement {
  const t = useDataTable({
    id: 'kit-peek-rows',
    label: 'Photos',
    columns: [
      c.entity('title', { header: 'Photo', sub: (photo) => COLLECTION_LABELS[photo.collection] }),
      c.status('verdict', {
        header: 'Verdict',
        options: [...VERDICTS],
        labels: VERDICT_LABELS,
        tone: (value) => VERDICT_TONE[value],
      }),
      c.number('views', { header: 'Views' }),
    ],
    data: PHOTOS.slice(12, 24),
    getRowId: (photo) => photo.id,
    mode: { kind: 'client' },
    detail: (photo) => (
      <Facts
        rows={[
          { label: 'Collection', value: COLLECTION_LABELS[photo.collection] },
          { label: 'Camera', value: photo.camera },
          { label: 'Views', value: String(photo.views) },
          { label: 'Verdict', value: VERDICT_LABELS[photo.verdict] },
        ]}
      />
    ),
    detailTitle: (photo) => photo.title,
    detailState: store.field.row,
  })
  return <DataTable table={t} />
}

/** A list of photos whose names link to each photo's page: a plain click opens it in the peek instead. */
function FromList(): ReactElement {
  const t = useDataTable({
    id: 'kit-peek-photos',
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
      c.date('taken', { header: 'Taken', priority: 2 }),
      c.number('views', { header: 'Views' }),
    ],
    data: PHOTOS.slice(0, 12),
    getRowId: (photo) => photo.id,
    mode: { kind: 'client' },
  })
  return <DataTable table={t} />
}

/** A bar per photo: selecting a mark writes the peek's address, so the same panel opens over the chart. */
function FromChart(): ReactElement {
  const [address, setAddress] = globals.field.peek.use()
  const selected = TOP.find((photo) => address === `photo/${photo.id}`) ?? null
  return (
    <ChartCard
      title="Most viewed"
      subtitle="views in the last 14 days"
      figure={{ value: String(TOP[0]?.views ?? 0), period: TOP[0]?.title }}
      chart={() => (
        <Bars
          label="Views in the last 14 days of the twelve most viewed photos"
          data={TOP}
          x={{ value: (photo) => photo.id, format: (id) => `#${String(id)}` }}
          series={[
            { mark: 'bar', key: 'views', label: 'Views', color: VIEWS, y: (photo) => photo.views },
          ]}
          selection={{
            selected,
            onSelect: (photo) =>
              photo === null ? globals.field.peek.clear() : setAddress(`photo/${photo.id}`),
          }}
        />
      )}
    />
  )
}

/** Peek over a list and over a chart: the root layout's one `usePeek` opens either beside the page. */
function PeekRoute(): ReactElement {
  return (
    <Page area="kit-peek">
      <Section
        title="From a list"
        summary="A plain click on a name opens the photo beside the list"
      >
        <FromList />
      </Section>
      <Section
        title="From a row"
        summary="A row opens its record; previous and next step through the rows"
      >
        <FromRows />
      </Section>
      <Section title="From a chart" summary="Selecting a bar opens the same panel">
        <FromChart />
      </Section>
    </Page>
  )
}

export const Route = createFileRoute('/kit/peek')({
  staticData: { title: 'Peek' },
  validateSearch: store.validateSearch,
  search: { middlewares: store.middlewares },
  component: PeekRoute,
})
