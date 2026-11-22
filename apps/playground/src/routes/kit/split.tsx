import { createFileRoute } from '@tanstack/react-router'
import { EmptyState, InnerNav, Page, PageBar, Section, SplitPage } from 'basalt-ui/page'
import { defineControls, field, navTarget } from 'basalt-ui/router'
import type { ReactElement } from 'react'
import { PhotoDetail } from '../../demo/kit-photo-detail'
import { COLLECTIONS, COLLECTION_LABELS, PHOTOS, VERDICT_LABELS } from '../../demo/kit-photos'

const store = defineControls({
  id: 'kit-split',
  scope: 'page',
  fields: { photo: field.string('', { history: 'push' }) },
})

/** The list pane: the photos by collection, six each; a picked one gets a dot. */
const GROUPS = COLLECTIONS.map((collection) => ({
  id: collection,
  label: COLLECTION_LABELS[collection],
  items: PHOTOS.filter((photo) => photo.collection === collection)
    .slice(0, 6)
    .map((photo) => ({
      id: photo.id,
      label: photo.title,
      ...(photo.verdict === 'picked' && { badge: { dot: true as const } }),
    })),
}))

/**
 * SplitPage list and detail: a wide container shows both, a narrow one the list until a photo is chosen and
 * then the photo with a way back. The choice is a push field, so Back walks the photos.
 */
function SplitRoute(): ReactElement {
  const [id] = store.field.photo.use()
  const selected = store.field.photo.useIsSet()
  const photo = PHOTOS.find((p) => p.id === id)
  return (
    <Page area="kit-split" fill>
      <PageBar
        title={photo?.title ?? 'Split page'}
        {...(photo !== undefined && {
          parent: {
            label: 'Photos',
            href: navTarget({ to: '/kit/split', ...store.field.photo.link('') }),
          },
        })}
      />
      <SplitPage
        selected={selected}
        onBack={store.field.photo.clear}
        backLabel="Photos"
        list={() => <InnerNav label="Photos" state={store.field.photo} groups={GROUPS} />}
        detail={() =>
          photo === undefined ? (
            <EmptyState cause="Pick a photo to see its properties and views." tier="section" />
          ) : (
            <Section
              title="Properties"
              summary={`${COLLECTION_LABELS[photo.collection]} · ${VERDICT_LABELS[photo.verdict]}`}
            >
              <PhotoDetail photo={photo} />
            </Section>
          )
        }
      />
    </Page>
  )
}

export const Route = createFileRoute('/kit/split')({
  staticData: { title: 'Split page' },
  validateSearch: store.validateSearch,
  search: { middlewares: store.middlewares },
  component: SplitRoute,
})
