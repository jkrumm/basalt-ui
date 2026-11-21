/**
 * The start page: `/` under the `_app` layout, the page the nav's Home item opens. Replace the
 * body with the app's first page; a page returns `Page` as its root and `PageBar` names it once.
 *
 * Scaffold written by `basalt-ui init` to `src/routes/_app/index.tsx`. This file is yours — `basalt-ui sync` will not overwrite it.
 */
import { createFileRoute } from '@tanstack/react-router'
import { EmptyState, Page, PageBar } from 'basalt-ui/page'

export const Route = createFileRoute('/_app/')({
  component: StartPage,
})

function StartPage() {
  return (
    <Page>
      <PageBar title="Home" />
      <EmptyState
        title="Nothing here yet"
        cause="This is the start page of {{APP_NAME}}: edit src/routes/_app/index.tsx."
      />
    </Page>
  )
}
