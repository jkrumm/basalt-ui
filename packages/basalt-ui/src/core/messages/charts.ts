import type { BasaltMessages } from './index'

/** The strings `./charts` prints itself; `charts.unavailable` is the note a failed series' legend entry reads. */
export type ChartsMessages = Record<'charts.unavailable', string>

export const charts = {
  'charts.unavailable': 'unavailable',
} satisfies Partial<BasaltMessages>
