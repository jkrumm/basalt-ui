// Blocks: see color-literal.tsx.

// @invalid
const queryClient = new QueryClient()

// @invalid
export function setup() {
  return new QueryClient({ defaultOptions: { queries: { retry: 0 } } })
}

// @valid
export function createQueryClient(config) {
  return new QueryClient(config)
}

// @valid
export const createQueryClient = (config) => {
  const client = new QueryClient(config)
  return client
}

// @valid
const queryClient = createQueryClient()
