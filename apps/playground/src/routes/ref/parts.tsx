import { createFileRoute, linkOptions } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { shotState } from 'basalt-ui/data'
import { navTarget } from 'basalt-ui/router'
import type { ReactElement } from 'react'
import {
  ListPage,
  createPartViews,
} from '../../../../../packages/basalt-ui/blocks/list-page/ListPage'
import { BASELINE, PARTS, TODAY, partsQuery } from '../../demo/ref-inventory'

/** The saved views, counted over the fixture's parts: an in-memory stand-in for the server. */
const views = createPartViews(PARTS)

function PartsRoute(): ReactElement {
  const qc = useQueryClient()
  const query = shotState(useQuery(partsQuery))
  return (
    <ListPage
      parts={query}
      viewStore={views}
      now={TODAY}
      baseline={BASELINE}
      supplierHref={(supplierId) =>
        navTarget(linkOptions({ to: '/ref/suppliers/$id', params: { id: supplierId } }))
      }
      onReplan={(ids, plan) => {
        qc.setQueryData(partsQuery.queryKey, (prev) =>
          prev?.map((x) => (ids.has(x.id) ? { ...x, plan } : x)),
        )
      }}
    />
  )
}

export const Route = createFileRoute('/ref/parts')({
  staticData: { title: 'Parts' },
  component: PartsRoute,
})
