// Blocks: see colour-literal.tsx.

// @invalid
const o = liveQuery(queryOptions({ queryKey: ['gyms'], queryFn, staleTime: 'static' }), 'standard')

// @invalid
const o = liveQuery({ queryKey: ['gyms'], queryFn, staleTime: 'static' }, 'static')

// @invalid
const o = liveQuery({ ...base, staleTime: 'static' }, { class: 'standard', onFocus: true })

// @invalid
const o = live.liveQuery(
  queryOptions({ queryKey: ['gyms'], queryFn, staleTime: 'static' }),
  'static',
)

// @invalid
const o = liveQuery(queryOptions({ queryKey: ['gyms'], queryFn, staleTime: Infinity }), 'standard')

// @invalid
const o = liveQuery({ queryKey: ['gyms'], queryFn, staleTime: Number.POSITIVE_INFINITY }, 'static')

// @invalid
const opts = queryOptions({ queryKey: ['gyms'], queryFn, staleTime: Infinity })
const o = liveQuery(opts, 'standard')

// @valid
const o = liveQuery(queryOptions({ queryKey: ['gyms'], queryFn }), 'static')

// @valid
const o = queryOptions({ queryKey: ['gyms'], queryFn, staleTime: 'static' })

// @valid
const o = liveQuery(base, { class: 'ticker', every: 5_000 })

// @valid
const label = { staleTime: 'static' }

// @invalid
const q = useQuery({ queryKey: ['gyms'], queryFn, staleTime: 'static' })

// @invalid
const q = useSuspenseQuery(queryOptions({ queryKey: ['gyms'], queryFn, staleTime: 'static' }))

// @invalid
const opts = { queryKey: ['flags'], queryFn, staleTime: 'static' }
const o = liveQuery(opts, 'live')

// @invalid
const flagsOptions = queryOptions({ queryKey: ['flags'], queryFn, staleTime: 'static' })
const o = liveQuery(flagsOptions, 'standard')

// @valid
const q = useQuery({ queryKey: ['gyms'], queryFn, staleTime: Infinity })

// @valid
const opts = { queryKey: ['flags'], queryFn }
const o = liveQuery(opts, 'live')

// @valid
const opts = { queryKey: ['flags'], queryFn, staleTime: 'static' }
const other = liveQuery(base, 'live')
