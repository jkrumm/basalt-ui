import { createRouter, parseSearchWith, stringifySearchWith } from '@tanstack/react-router'
import type { RouterHistory } from '@tanstack/react-router'
import { routeTree } from './route-tree.gen'

/**
 * The two router parse configs of controls-url-state.md 1.3: argo's default JSON codec and
 * shutterflow's string-only router (`router.tsx` sets `parseSearchWith((v) => v)` and
 * `stringifySearchWith(String)`).
 */
export type ParseConfig = 'json' | 'stringOnly'

export function makeRouter(options: {
  parse: ParseConfig
  history: RouterHistory
  server?: boolean
}) {
  return createRouter({
    routeTree,
    history: options.history,
    isServer: options.server ?? false,
    // a client router otherwise reads `window.origin`, and the harness has no DOM
    origin: 'http://harness.invalid',
    ...(options.parse === 'stringOnly'
      ? {
          parseSearch: parseSearchWith((value) => value),
          stringifySearch: stringifySearchWith(String),
        }
      : {}),
  })
}

export type HarnessRouter = ReturnType<typeof makeRouter>

declare module '@tanstack/react-router' {
  interface Register {
    router: HarnessRouter
  }
}
