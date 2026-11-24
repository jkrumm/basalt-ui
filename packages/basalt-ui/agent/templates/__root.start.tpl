/**
 * TanStack Start root route. `shellComponent` is the document: the server renders it, the browser
 * hydrates it. `ScriptOnce` runs basalt's pre-paint scheme script before React hydrates, so the
 * stored color scheme is on the root element at first paint; `suppressHydrationWarning` is for that one
 * attribute. `component` holds the app: `BasaltProvider` wraps the outlet, and nothing in it reads
 * `window` or storage while rendering (read browser state in an effect, or behind `ClientOnly`).
 * `RouterContext` types what `getRouter()` (`router.tsx`) passes as `context`. The frame is the
 * pathless `_app` layout (`_app.tsx`), so routes outside it (a sign-in page) render with no shell.
 *
 * Scaffold written by `basalt-ui init --start` to `src/routes/__root.tsx`. This file is yours — `basalt-ui sync` will not overwrite it.
 */
import type { QueryClient } from '@tanstack/react-query'
import {
  HeadContent,
  Outlet,
  ScriptOnce,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { BasaltProvider, routerDefaults } from 'basalt-ui/router'
import { themeScript } from 'basalt-ui/theme-script'
import { LucideProvider } from 'lucide-react'
import appCss from '{{CSS_ENTRY}}?url'

export type RouterContext = { queryClient: QueryClient }

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { title: '{{APP_NAME}}' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ScriptOnce>{themeScript()}</ScriptOnce>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function RootLayout() {
  return (
    <BasaltProvider link={routerDefaults().link}>
      <LucideProvider size={16} strokeWidth={1.5} absoluteStrokeWidth>
        <Outlet />
      </LucideProvider>
    </BasaltProvider>
  )
}
