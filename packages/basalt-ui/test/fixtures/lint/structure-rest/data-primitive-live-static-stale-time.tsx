// Blocks: see colour-literal.tsx.

// @invalid
const o = liveQuery(queryOptions({ queryKey: ['gyms'], queryFn, staleTime: 'static' }), 'standard')

// @invalid
const o = liveQuery({ queryKey: ['gyms'], queryFn, staleTime: 'static' }, 'static')

// @invalid
const o = liveQuery({ ...base, 'staleTime': 'static' }, { class: 'standard', onFocus: true })

// @invalid
const o = live.liveQuery(queryOptions({ queryKey: ['gyms'], queryFn, staleTime: 'static' }), 'static')

// @valid
const o = liveQuery(queryOptions({ queryKey: ['gyms'], queryFn }), 'static')

// @valid
const o = liveQuery(queryOptions({ queryKey: ['gyms'], queryFn, staleTime: Infinity }), 'standard')

// @valid
const o = queryOptions({ queryKey: ['gyms'], queryFn, staleTime: 'static' })

// @valid
const o = liveQuery(base, { class: 'ticker', every: 5_000 })

// @valid
const label = { staleTime: 'static' }
