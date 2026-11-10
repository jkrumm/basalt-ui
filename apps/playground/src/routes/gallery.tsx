import { Stack } from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'
import { ChartsSection } from '../demo/gallery/charts'
import { ComponentsSection } from '../demo/gallery/components'
import { ContentSection } from '../demo/gallery/content'
import { DataSection } from '../demo/gallery/data'
import { FormsSection } from '../demo/gallery/forms'
import { validateShotSearch } from '../scenarios/shot-state'

function GalleryRoute() {
  const shotState = Route.useSearch()['shot-state']
  return (
    <Stack gap="xl">
      <ComponentsSection shotState={shotState} />
      <FormsSection />
      <ContentSection />
      <ChartsSection />
      <DataSection shotState={shotState} />
    </Stack>
  )
}

export const Route = createFileRoute('/gallery')({
  staticData: { title: 'Gallery' },
  validateSearch: validateShotSearch,
  component: GalleryRoute,
})
