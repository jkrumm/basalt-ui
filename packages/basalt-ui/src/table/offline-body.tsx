/**
 * The body a table paints for a query that is paused with no data: the same line `QueryState` shows
 * for the same query, kept in its own module so `data-table.tsx` stays free of `core/messages`.
 */
import type { ReactElement } from 'react'
import { OfflineLine } from '../core/offline-line'

export function OfflineBody(): ReactElement {
  return (
    <output data-slot="data-table-offline" className="block px-3 py-8 text-center">
      <OfflineLine />
    </output>
  )
}
