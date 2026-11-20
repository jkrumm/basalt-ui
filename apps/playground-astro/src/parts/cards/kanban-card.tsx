import { KanbanCard } from 'basalt-ui/cards'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <div className="flex w-72 flex-col gap-2">
      <KanbanCard
        id="EP-412"
        title="Dual-write window for the event tables"
        href="/issues/EP-412"
        age="2 h"
        meta={['EP-412']}
        chips={[{ label: 'api' }]}
        status={{ tone: 'warn', label: 'Blocked' }}
        move="static"
      />
      <KanbanCard
        id="EP-418"
        title="Point the search service at the cluster"
        href="/issues/EP-418"
        age="1 d"
        meta={['EP-418']}
        move="static"
      />
      <KanbanCard
        id="EP-421"
        title="Validate row counts"
        href="/issues/EP-421"
        age="3 d"
        meta={['EP-421']}
        chips={[{ label: 'data' }]}
        move="static"
      />
    </div>
  )
}
