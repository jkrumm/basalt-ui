// The playground has no `_app` layout, so the add-page recipe's `/_app/runs` is declared here the
// way the route generator would declare it in an app that has one.
import type { AnyRoute } from '@tanstack/react-router'

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/_app/runs': {
      id: '/_app/runs'
      path: '/runs'
      fullPath: '/runs'
      preLoaderRoute: AnyRoute
      parentRoute: AnyRoute
    }
  }
}
