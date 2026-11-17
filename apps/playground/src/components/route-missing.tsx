/**
 * `defaultNotFoundComponent`: a path no route matched, or a loader that threw `notFound()`.
 *
 * A loader shapes the screen with `throw notFound({ data: { message, link } })`: a missing record
 * says which one, and the link goes back to where the reader came from. Without data the screen
 * says the address matches no page and links home.
 *
 * Scaffold written by `basalt-ui init` to `src/components/route-missing.tsx`. This file is yours — `basalt-ui sync` will not overwrite it.
 */
import { EmptyState, Page, PageBar } from 'basalt-ui/page'

type NotFoundData = { message?: string; link?: { to: string; label: string } }

const HOME = { to: '/', label: 'Go to the start page' }

export function RouteMissing({ data }: { data?: unknown }) {
  const { message, link }: NotFoundData = typeof data === 'object' && data !== null ? data : {}
  const back = typeof link?.to === 'string' && typeof link.label === 'string' ? link : HOME
  return (
    <Page>
      <PageBar title="Not found" />
      <EmptyState
        title="Page not found"
        cause={typeof message === 'string' ? message : 'This address does not match any page.'}
        action={{ label: back.label, href: back.to }}
      />
    </Page>
  )
}
