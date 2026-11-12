import { carried } from './define'

/**
 * Per-datum bar `opacity`. Carried by `shadeBars`/`barMarks`. A per-datum `fill` is not here:
 * `contract.ts` has no such field (a colour per datum is a second series), so it needs an amendment.
 */
export const barOpacity = carried({
  id: 'per-datum opacity',
  consumer:
    'argo fillOpacity on bars (5 sites, concept charts-cards-kanban § 4: `opacity`), a bar fades with the datum it stands for',
})
