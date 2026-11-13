// Blocks: see colour-literal.tsx.

// @invalid
const queryClient = new QueryClient()

// @invalid
export function setup() {
  return new QueryClient({ defaultOptions: { queries: { retry: 0 } } })
}

// @valid
export function makeQueryClient(config) {
  return new QueryClient(config)
}

// @valid
export const makeQueryClient = (config) => {
  const client = new QueryClient(config)
  return client
}

// @valid
const queryClient = makeQueryClient()
