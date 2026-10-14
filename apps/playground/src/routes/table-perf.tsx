import { createFileRoute } from '@tanstack/react-router'
import { TablePerfPage } from '../demo/TablePerfPage'

export const Route = createFileRoute('/table-perf')({
  staticData: { title: 'Table perf' },
  component: TablePerfPage,
})
