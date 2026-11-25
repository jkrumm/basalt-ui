/** The data of the showcase page: twelve weeks of deploys and the tables read from them. */
const START = Date.UTC(2026, 6, 6)
const WEEK_MS = 7 * 24 * 3_600_000
const DEPLOYS = [14, 18, 17, 22, 19, 25, 24, 28, 26, 31, 29, 34]
const ROLLBACKS = [2, 1, 3, 1, 2, 1, 0, 2, 1, 1, 0, 1]

export const WEEKS = DEPLOYS.map((deploys, i) => ({
  week: new Date(START + i * WEEK_MS).toISOString().slice(0, 10),
  deploys,
  rollbacks: ROLLBACKS[i] ?? 0,
}))

export const SERIES = [
  { key: 'deploys', label: 'Deploys' },
  { key: 'rollbacks', label: 'Rollbacks', color: 3 as const },
]

export const COLUMNS = [
  { key: 'week', label: 'Week', kind: 'date' as const },
  { key: 'deploys', label: 'Deploys', kind: 'number' as const },
  { key: 'rollbacks', label: 'Rollbacks', kind: 'number' as const },
]

export const RECENT = WEEKS.slice(-6)

export const MODES = {
  title: 'Static, enhanced or island',
  description:
    'What each way of reaching the reader costs, measured on this page by the Astro matrix.',
  caption: 'The three render modes compared',
  rowHeader: 'Mode',
  columns: [
    { key: 'static', label: 'Static', ours: true },
    { key: 'enhanced', label: 'Enhanced' },
    { key: 'island', label: 'Island' },
  ],
  rows: [
    {
      label: 'Directive',
      values: {
        static: 'None',
        enhanced: 'client:visible or client:idle',
        island: 'client:only or client:load',
      },
    },
    { label: 'Works with no script', values: { static: true, enhanced: true, island: false } },
    { label: 'Ships JavaScript', values: { static: false, enhanced: true, island: true } },
    {
      label: 'Layout shift when it arrives',
      values: { static: 'None', enhanced: 'None', island: 'None: the card loads first' },
    },
    {
      label: 'Parts on this page',
      values: {
        static: 'Stat cards, bars, meter, tabs, table',
        enhanced: 'A chart, a sortable table',
        island: 'A chart that measures its box',
      },
    },
  ],
}
