// Blocks: see colour-literal.tsx.

// @invalid
await queryClient.ensureQueryData(gymsOptions())

// @invalid
await context.queryClient.prefetchQuery(gymsOptions())

// @invalid
const data = await client.fetchQuery(gymsOptions())

// @invalid
await queryClient.ensureInfiniteQueryData(feedOptions())

// @invalid
await queryClient.prefetchInfiniteQuery(feedOptions())

// @valid
await queryClient.query(gymsOptions())

// @valid
const cached = queryClient.getQueryData(['gyms'])

// @valid
await queryClient.invalidateQueries({ queryKey: ['gyms'] })
