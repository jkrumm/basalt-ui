import { createFileRoute, linkOptions } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { shotState } from 'basalt-ui/data'
import { navTarget } from 'basalt-ui/router'
import type { ReactElement } from 'react'
import { NewOrderDialog } from '../../../../../packages/basalt-ui/blocks/create-flow/NewOrderDialog'
import {
  RecordPage,
  recordControls,
} from '../../../../../packages/basalt-ui/blocks/record-page/RecordPage'
import { PARTS, SUPPLIERS, TODAY, supplierOf, supplierRecordsQuery } from '../../demo/ref-inventory'

export const Route = createFileRoute('/ref/suppliers/$id')({
  staticData: { title: 'Supplier' },
  validateSearch: recordControls.validateSearch,
  search: { middlewares: recordControls.middlewares },
  component: SupplierRoute,
})

function SupplierRoute(): ReactElement {
  const { id } = Route.useParams()
  const records = shotState(useQuery(supplierRecordsQuery(id)), {
    empty: { orders: [], parts: [], notes: [] },
  })
  return (
    <RecordPage
      id={id}
      supplier={supplierOf(id)}
      records={records}
      now={TODAY}
      partsHref={navTarget(linkOptions({ to: '/ref/parts' }))}
      recordHref={navTarget(linkOptions({ to: '/ref/suppliers/$id', params: { id } }))}
      partHref={(partId) => navTarget(linkOptions({ to: '/ref/part/$id', params: { id: partId } }))}
      newOrder={(dialog) => (
        <NewOrderDialog {...dialog} suppliers={SUPPLIERS} parts={PARTS} now={TODAY} />
      )}
    />
  )
}
