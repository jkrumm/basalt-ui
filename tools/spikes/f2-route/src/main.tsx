import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { makeQueryClient } from 'basalt-ui/data'
import { createRoot } from 'react-dom/client'
import './app.css'
import { rootRoute } from './router'
import { strengthRoute } from './strength-tracker'

const queryClient = makeQueryClient()
const routeTree = rootRoute.addChildren([strengthRoute])
const params = new URLSearchParams(location.search)
const router = createRouter({
  routeTree,
  context: { queryClient },
  history: createMemoryHistory({ initialEntries: [`/strength-tracker?${params.get('q') ?? ''}`] }),
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const scheme = params.get('scheme')
if (scheme === 'dark' || scheme === 'light') document.documentElement.dataset['theme'] = scheme

const root = document.getElementById('root')
if (root !== null) {
  createRoot(root).render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}
