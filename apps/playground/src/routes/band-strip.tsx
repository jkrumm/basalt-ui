import { createFileRoute } from '@tanstack/react-router'
import { BandStripDemoPage } from '../demo/BandStripDemoPage'

export const Route = createFileRoute('/band-strip')({
  staticData: { title: 'Band strip' },
  component: BandStripDemoPage,
})
