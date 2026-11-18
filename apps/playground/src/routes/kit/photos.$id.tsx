import { createFileRoute } from '@tanstack/react-router'
import { EmptyState, Page, PageBar } from 'basalt-ui/page'
import type { ReactElement } from 'react'
import { PhotoDetail } from '../../demo/kit-photo-detail'
import { photoOf } from '../../demo/kit-photos'

export const Route = createFileRoute('/kit/photos/$id')({
  staticData: { title: 'Photo' },
  component: PhotoPage,
})

/** A photo's own page: what the peek's `Open full page` and a modifier click on a photo link open. */
function PhotoPage(): ReactElement {
  const { id } = Route.useParams()
  const photo = photoOf(id)
  return (
    <Page area="kit-photo">
      <PageBar title={photo?.title ?? `Photo ${id}`} />
      {photo === undefined ? (
        <EmptyState cause={`No photo has the id ${id}.`} />
      ) : (
        <PhotoDetail photo={photo} />
      )}
    </Page>
  )
}
