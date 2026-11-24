import './layers.css'
import 'basalt-ui/styles.css'
import './index.css'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { createQueryClient } from 'basalt-ui/data'
import { IntlScope } from 'basalt-ui'
import { BasaltProvider, routerDefaults } from 'basalt-ui/router'
import { LucideProvider } from 'lucide-react'
import { StrictMode } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouteError } from './components/route-error'
import { RouteMissing } from './components/route-missing'
import { RoutePending } from './components/route-pending'
import { PAGE_FORMAT } from './demo/page-format'
import { bootPhoneNav } from './lib/phone-nav'
import { routeTree } from './routeTree.gen'

const queryClient = createQueryClient()
const defaults = routerDefaults()

const router = createRouter({
  routeTree,
  context: { queryClient },
  ...defaults.options,
  defaultPendingComponent: RoutePending,
  defaultErrorComponent: RouteError,
  defaultNotFoundComponent: RouteMissing,
  Wrap: ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  ),
})
defaults.bind(router)

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

bootPhoneNav()

const root = document.getElementById('root')
if (!root) throw new Error('root element not found')

createRoot(root).render(
  <StrictMode>
    <BasaltProvider link={defaults.link} locale={PAGE_FORMAT.locale}>
      <IntlScope {...PAGE_FORMAT}>
        <LucideProvider size={16} strokeWidth={1.5} absoluteStrokeWidth>
          <RouterProvider router={router} />
        </LucideProvider>
      </IntlScope>
    </BasaltProvider>
  </StrictMode>,
)
