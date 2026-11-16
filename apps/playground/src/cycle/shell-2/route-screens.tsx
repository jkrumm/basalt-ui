/**
 * Shell cycle 2 (docs/v3/cycles/shell-2.md): the pending, error and not-found screens `basalt-ui
 * init` scaffolds into an app's `src/components/route-*.tsx` (`agent/templates/_app-*.tpl`), copied
 * as they ship. Scaffold, not glue: a v3 app hands them to `createRouter` once in `main.tsx`. The
 * playground's shared `main.tsx` installs none, so the cycle's routes take them as route options.
 */
import { useRouter } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { EmptyState } from 'basalt-ui/page'
import type { ReactElement } from 'react'

export function RoutePending(): ReactElement {
  return (
    <output>
      <EmptyState cause="Loading this page." />
    </output>
  )
}

export function RouteError({ reset }: ErrorComponentProps): ReactElement {
  const router = useRouter()
  const retry = async () => {
    await router.invalidate()
    reset()
  }
  return (
    <EmptyState
      cause="Something went wrong loading this page. Try again."
      action={{ label: 'Try again', onClick: retry }}
    />
  )
}

type NotFoundData = { message?: string; link?: { to: string; label: string } }

const HOME = { to: '/', label: 'Go to the start page' }

export function RouteMissing({ data }: { data?: unknown }): ReactElement {
  const { message, link }: NotFoundData = typeof data === 'object' && data !== null ? data : {}
  const back = typeof link?.to === 'string' && typeof link.label === 'string' ? link : HOME
  return (
    <EmptyState
      title="Page not found"
      cause={typeof message === 'string' ? message : 'This address does not match any page.'}
      action={{ label: back.label, href: back.to }}
    />
  )
}

/** The three screens as route options, spread into each cycle route. */
export const SCREENS = {
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  notFoundComponent: RouteMissing,
} as const
