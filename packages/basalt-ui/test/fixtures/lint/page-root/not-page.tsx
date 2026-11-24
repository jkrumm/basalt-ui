// Blocks: a `// @valid` or `// @invalid` header starts one (see structure-rest/color-literal.tsx).
// Every invalid block reports `not-page` once unless `// @errors` says otherwise.

// @invalid
import { PageBar } from 'basalt-ui/page'
export function Spend() {
  return (
    <div className="flex flex-col gap-4">
      <PageBar title="AI spend" />
    </div>
  )
}

// @invalid
import { PageBar } from 'basalt-ui/page'
export const Spend = () => (
  <>
    <PageBar title="AI spend" />
    <Section title="Cost" />
  </>
)

// @invalid
import { Page, PageBar } from 'basalt-ui/page'
export function Spend() {
  return (
    <div className="@container">
      <Page>
        <PageBar title="AI spend" />
      </Page>
    </div>
  )
}

// @invalid
import { Fragment } from 'react'
import { PageBar } from 'basalt-ui/page'
export const Spend = () => (
  <Fragment>
    <PageBar title="AI spend" />
  </Fragment>
)

// @invalid
import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/runs')({ component: Runs })
function Runs() {
  return <main className="p-4">runs</main>
}

// @invalid
import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/runs')({
  component: () => <div className="p-6">runs</div>,
})

// @invalid
import { Page, PageBar } from 'basalt-ui/page'
export function Spend({ loading }) {
  if (loading) return <div className="p-4">Loading</div>
  return (
    <Page>
      <PageBar title="AI spend" />
    </Page>
  )
}

// @invalid
import { Page, PageBar } from 'basalt-ui/page'
export function Spend({ empty }) {
  return empty ? (
    <section>Nothing yet</section>
  ) : (
    <Page>
      <PageBar title="AI spend" />
    </Page>
  )
}

// @invalid
import { memo } from 'react'
import { PageBar } from 'basalt-ui/page'
export const Spend = memo(() => (
  <div className="p-4">
    <PageBar title="AI spend" />
  </div>
))

// @invalid
import { PageBar } from 'basalt-ui/page'
export default function () {
  return (
    <section>
      <PageBar title="AI spend" />
    </section>
  )
}

// @valid
// @filename src/spend.test.tsx
import { PageBar } from 'basalt-ui/page'
export function Harness() {
  return (
    <div>
      <PageBar title="AI spend" />
    </div>
  )
}

// @valid
import { Page, PageBar } from 'basalt-ui/page'
export function Spend() {
  return (
    <Page area="spend">
      <PageBar title="AI spend" />
    </Page>
  )
}

// @valid
import { SplitPage, PageBar } from 'basalt-ui/page'
export const Inbox = () => (
  <SplitPage list={() => <PageBar title="Inbox" />} detail={() => null} />
)

// @valid
import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/scenarios/$name')({ component: ScenarioRoute })
function ScenarioRoute() {
  return <ScenarioView name="x" />
}

// @valid
export function Badge() {
  return <span className="text-sm">new</span>
}

// @valid
import { Page, PageBar } from 'basalt-ui/page'
export function Spend() {
  const header = () => <div className="sr-only">x</div>
  return (
    <Page>
      <PageBar title="AI spend" />
      {header()}
    </Page>
  )
}
