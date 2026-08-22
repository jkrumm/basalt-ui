import { createFileRoute } from '@tanstack/react-router'
import { DataTableChromeDemoPage } from '../demo/DataTableChromeDemoPage'

export const Route = createFileRoute('/data-table-chrome')({
  staticData: { title: 'Data table chrome' },
  component: DataTableChromeDemoPage,
})
