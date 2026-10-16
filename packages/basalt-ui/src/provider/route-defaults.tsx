/**
 * The router's default pending / error / not-found screens. Provider-free on purpose: a route's
 * screen renders at the route that failed, which can sit above `BasaltProvider` (a root-level error,
 * or a pathless-layout provider), so no Mantine primitive. Wired by `createBasaltRouter`.
 */
import type { ErrorComponentProps } from '@tanstack/react-router'
import { toErrorMessage } from '../common/errors'
import fallback from './fallback.module.css'
import classes from './route-defaults.module.css'

export function PendingComponent() {
  return (
    <div className={classes.center}>
      <output className={classes.spinner} aria-label="Loading" />
    </div>
  )
}

// No log here: `defaultOnCatch` (create-router.tsx) already reports every route error.
export function ErrorComponent({ error, reset }: ErrorComponentProps) {
  return (
    <div className={fallback.stack} role="alert">
      <p className={fallback.title}>Something went wrong</p>
      <p className={fallback.text}>{toErrorMessage(error)}</p>
      <button type="button" className={fallback.action} onClick={reset}>
        Try again
      </button>
    </div>
  )
}

export function NotFoundComponent() {
  return (
    <div className={classes.notFound}>
      <p className={fallback.title}>Page not found</p>
      <p className={fallback.text}>This address does not match any page.</p>
    </div>
  )
}
