import { createFileRoute } from '@tanstack/react-router'
import { filterSlot, spec } from 'basalt-ui/controls'
import { Page, PageAside, PageBar } from 'basalt-ui/page'
import { defineControls, field } from 'basalt-ui/router'
import { col, DataTable, useDataTable } from 'basalt-ui/table'
import { Button } from 'basalt-ui/ui/button'
import { useState } from 'react'
import type { ReactElement } from 'react'
import { PhotoDetail } from '../../demo/kit-photo-detail'
import {
  COLLECTION_LABELS,
  PHOTOS,
  VERDICTS,
  VERDICT_LABELS,
  VERDICT_TONE,
} from '../../demo/kit-photos'
import type { Photo, Verdict } from '../../demo/kit-photos'

/** The four widths the shell's aside region ships (decision DPO 17, docs/v3/concepts/shell-nav-router.md). */
const WIDTHS = ['320', '360', '480', '640'] as const

const store = defineControls({
  id: 'kit-aside',
  scope: 'page',
  fields: {
    photo: field.string(''),
    width: field
      .enum(WIDTHS, '360')
      .labels({ '320': '320 px', '360': '360 px', '480': '480 px', '640': '640 px' }),
  },
})

const c = col<Photo>()

/** The selected photo in the aside: its facts and views, then the two verdicts the reader can give it. */
function Inspector({
  photo,
  judge,
}: {
  photo: Photo
  judge: (verdict: Verdict) => void
}): ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <PhotoDetail photo={photo} />
      <div className="flex gap-2">
        <Button
          variant="primary"
          disabled={photo.verdict === 'picked'}
          onClick={() => judge('picked')}
        >
          Pick
        </Button>
        <Button
          variant="secondary"
          disabled={photo.verdict === 'rejected'}
          onClick={() => judge('rejected')}
        >
          Reject
        </Button>
      </div>
    </div>
  )
}

/**
 * The aside as an inspector beside a list: activating a row writes its id to `?photo=`, the table shows that
 * row's detail in the page's aside, and the page bar sets the aside to each width the shell ships.
 */
function AsideRoute(): ReactElement {
  const [width] = store.field.width.use()
  // The verdicts given in this session: the fixture is read-only, so an edit lives beside it.
  const [verdicts, setVerdicts] = useState<Readonly<Record<string, Verdict>>>({})
  const rows = PHOTOS.map((photo) => ({ ...photo, verdict: verdicts[photo.id] ?? photo.verdict }))
  const t = useDataTable({
    id: 'kit-aside-photos',
    label: 'Photos',
    columns: [
      c.entity('title', { header: 'Photo', sub: (photo) => COLLECTION_LABELS[photo.collection] }),
      c.status('verdict', {
        header: 'Verdict',
        options: [...VERDICTS],
        labels: VERDICT_LABELS,
        tone: (value) => VERDICT_TONE[value],
      }),
      c.text('camera', { header: 'Camera', priority: 2 }),
      c.date('taken', { header: 'Taken', priority: 3 }),
      c.number('views', { header: 'Views' }),
    ],
    data: rows,
    getRowId: (photo) => photo.id,
    mode: { kind: 'client' },
    detail: (photo) => (
      <Inspector
        photo={photo}
        judge={(verdict) => setVerdicts((prev) => ({ ...prev, [photo.id]: verdict }))}
      />
    ),
    detailTitle: (photo) => photo.title,
    detailState: store.field.photo,
  })
  return (
    <Page area="kit-aside">
      <PageBar
        controls={filterSlot([spec(store.field.width, 'Aside width', { as: 'segmented' })])}
      />
      <DataTable table={t} />
      <PageAside title="Photo" width={Number(width)} state={store.field.photo} />
    </Page>
  )
}

export const Route = createFileRoute('/kit/aside')({
  staticData: { title: 'Inspector aside' },
  validateSearch: store.validateSearch,
  search: { middlewares: store.middlewares },
  component: AsideRoute,
})
