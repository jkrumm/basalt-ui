import './layers.css'
import 'basalt-ui/styles.css'
import './index.css'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { createQueryClient } from 'basalt-ui/data'
import { IntlScope } from 'basalt-ui/core/provider-props'
import { BasaltProvider, routerDefaults } from 'basalt-ui/router'
import { StrictMode } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { PAGE_FORMAT } from './demo/page-format'
import { routeTree } from './routeTree.gen'

const queryClient = createQueryClient()
// oxlint-disable-next-line no-use-before-define -- lazy read: `router` is built from these defaults
const defaults = routerDefaults({ router: (): object => router })

const router = createRouter({
  routeTree,
  context: { queryClient },
  ...defaults.options,
  Wrap: ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  ),
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const root = document.getElementById('root')
if (!root) throw new Error('root element not found')

createRoot(root).render(
  <StrictMode>
    <BasaltProvider link={defaults.link} locale={PAGE_FORMAT.locale}>
      <IntlScope {...PAGE_FORMAT}>
        <RouterProvider router={router} />
      </IntlScope>
    </BasaltProvider>
  </StrictMode>,
)
