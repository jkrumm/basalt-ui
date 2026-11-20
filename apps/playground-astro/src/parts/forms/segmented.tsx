import { Segmented, SegmentedItem } from 'basalt-ui/ui/segmented'
import type { ReactElement } from 'react'

const WINDOWS = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
]

export function Demo(): ReactElement {
  return (
    <div className="flex max-w-md flex-col gap-4">
      <Segmented aria-label="Window" options={WINDOWS} defaultValue="30d" />
      <Segmented aria-label="View" defaultValue="table">
        <SegmentedItem value="table">Table</SegmentedItem>
        <SegmentedItem value="chart">Chart</SegmentedItem>
      </Segmented>
    </div>
  )
}
