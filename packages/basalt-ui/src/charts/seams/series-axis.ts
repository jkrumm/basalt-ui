import { carried } from './define'

/** `Series.axis: 'right'`: measured against the second axis; `toEngineSpec` adds the chart's `y2`. Carried by `toEngineSpec`. */
export const axis = carried({
  id: 'axis',
  consumer:
    'argo overlay series on a second scale (concept charts-cards-kanban § 4: `axis` kept, same name)',
})
