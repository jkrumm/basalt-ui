import { createFileRoute } from '@tanstack/react-router'
import { DataStressPage } from '../demo/DataStressPage'
import { dataStressFilters } from '../demo/data-stress-store'

export const Route = createFileRoute('/data-stress')({
  staticData: { title: 'Data stress' },
  validateSearch: dataStressFilters.validateSearch,
  component: DataStressPage,
})
