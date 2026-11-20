import { VirtualList } from 'basalt-ui/ui/virtual-list'
import type { ReactElement } from 'react'

const ROWS = Array.from({ length: 400 }, (_, i) => ({
  id: `run-${i + 1}`,
  name: `Run ${i + 1}`,
  km: 4 + (i % 13) * 0.5,
}))

export function Demo(): ReactElement {
  return (
    <VirtualList
      className="max-h-96 max-w-md"
      count={ROWS.length}
      estimateSize={() => 44}
      getItemKey={(index) => ROWS[index]?.id ?? index}
    >
      {(items) =>
        items.map((item) => {
          const row = ROWS[item.index]
          return (
            <div
              key={item.key}
              className="flex h-11 items-center justify-between border-b px-3 text-sm"
            >
              <span>{row?.name}</span>
              <span className="text-muted-foreground">{row?.km} km</span>
            </div>
          )
        })
      }
    </VirtualList>
  )
}
