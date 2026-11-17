/** The records the peek demo lists: a short fixture, so the page and its panel read the same facts. */
export type PeekRecord = { id: string; title: string; state: string; owner: string; note: string }

export const PEEK_RECORDS: readonly PeekRecord[] = [
  {
    id: '12',
    title: 'Deploy checkout',
    state: 'Running',
    owner: 'Ada',
    note: 'Rolling out to 25% of traffic.',
  },
  {
    id: '13',
    title: 'Rotate API keys',
    state: 'Queued',
    owner: 'Grace',
    note: 'Waits for the 02:00 window.',
  },
  {
    id: '14',
    title: 'Migrate billing',
    state: 'Done',
    owner: 'Linus',
    note: 'Verified against the replica.',
  },
  {
    id: '15',
    title: 'Warm the cache',
    state: 'Failed',
    owner: 'Ada',
    note: 'The origin timed out twice.',
  },
]

export const recordOf = (id: string): PeekRecord | undefined =>
  PEEK_RECORDS.find((record) => record.id === id)
