import type { TimelineEvent } from '../agents-data'
import type { ShotState } from '../shot-state'

// Wave 44: EventList fills this
export function ItemTimeline(_props: {
  events: readonly TimelineEvent[]
  total: number
  shotState: ShotState | undefined
}): null {
  return null
}
