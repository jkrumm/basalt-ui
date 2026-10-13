/** The structural subset of a TanStack Query result that `Section`/`BasaltDataTable` read. */
export type QueryStateLike<TData> = {
  data: TData | undefined
  isError: boolean
  error: unknown
  fetchStatus: 'fetching' | 'paused' | 'idle'
  refetch: () => unknown
}
