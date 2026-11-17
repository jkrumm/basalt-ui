/**
 * `defaultErrorComponent`: branches on a structural `status` (any error that carries a numeric one,
 * as an API client's does): 403 is forbidden, 401 sends the user to the session path, anything
 * else is the crash copy with a retry.
 *
 * Scaffold written by `basalt-ui init` to `src/components/route-error.tsx`. This file is yours — `basalt-ui sync` will not overwrite it.
 */
import { useRouter } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { EmptyState, Page, PageBar } from 'basalt-ui/page'

/** The session path: where a 401 goes. Change it to the app's sign-in route. */
const SIGN_IN = '/login'

function statusOf(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('status' in error)) return undefined
  return typeof error.status === 'number' ? error.status : undefined
}

/** The shell's scrollport, the skip link's target: where focus goes once the retry has replaced this screen. */
const MAIN_ID = 'shell-main'

export function RouteError({ error, reset }: ErrorComponentProps) {
  // `reset` alone re-renders the boundary over the same failed match; invalidating first re-runs the loader.
  const router = useRouter()
  const retry = async () => {
    await router.invalidate()
    reset()
    // The button goes with this screen and focus falls to `<body>`; main takes it two frames on. A
    // retry that failed again keeps the button, and with it the focus.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (document.activeElement !== null && document.activeElement !== document.body) return
        document.getElementById(MAIN_ID)?.focus({ preventScroll: true })
      }),
    )
  }
  const status = statusOf(error)
  // The bar names the screen once, as every page does: the shell's crumb and title, the `h1`.
  if (status === 403)
    return (
      <Page>
        <PageBar title="No access" />
        <EmptyState cause="You do not have access to this page." />
      </Page>
    )
  if (status === 401)
    return (
      <Page>
        <PageBar title="Signed out" />
        <EmptyState
          cause="Your session ended. Sign in again to continue."
          action={{ label: 'Sign in', href: SIGN_IN }}
        />
      </Page>
    )
  return (
    <Page>
      <PageBar title="Something went wrong" />
      <EmptyState
        cause="Something went wrong loading this page. Try again."
        action={{ label: 'Try again', onClick: retry }}
      />
    </Page>
  )
}
