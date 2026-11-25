/**
 * The landing page is the tour: the stops of the nav's `tour` section in order, each a card that
 * links to its page and names the parts it proves.
 */
import { Link, createFileRoute } from '@tanstack/react-router'
import { CardGrid, Page, Section } from 'basalt-ui/page'
import { Card } from 'basalt-ui/ui/card'
import type { ReactElement } from 'react'
import { NAV } from '../demo/nav-model'
import { TOUR } from '../demo/tour'

const STOPS = (NAV.sections.find((section) => section.id === 'tour')?.items ?? []).filter(
  (item) => item.id !== 'home',
)

/** The auth pages, linked from the landing: they have no nav entry. */
const ACCOUNT_PAGES = [
  {
    to: '/sign-in',
    label: 'Sign in',
    line: 'A username and a password, a reset link that ends in a sent state, and the demo login.',
    parts: 'useAppForm, FormField, PasswordInput, Alert',
  },
  {
    to: '/register',
    label: 'Register',
    line: 'A name, an email and a new password; the server refuses one address, on the field.',
    parts: 'useAppForm, toSubmitErrors, PasswordInput',
  },
] as const

function IndexRoute(): ReactElement {
  return (
    <Page area="home">
      <CardGrid min="narrow">
        {STOPS.map((item, index) => {
          const stop = TOUR[item.id]
          return (
            <Card key={item.id} render={<Link {...item.link} />}>
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <span className="text-muted-foreground tabular-nums">{index + 1}</span>
                  {item.label}
                </span>
                <span className="text-sm text-muted-foreground">{stop?.line}</span>
                <span className="font-mono text-xs text-muted-foreground">{stop?.parts}</span>
              </div>
            </Card>
          )
        })}
      </CardGrid>
      <Section
        title="Account pages"
        summary="Drawn outside the shell. The demo signs in with demo and demo."
      >
        <CardGrid min="narrow">
          {ACCOUNT_PAGES.map((entry) => (
            <Card key={entry.label} render={<Link to={entry.to} />}>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-foreground">{entry.label}</span>
                <span className="text-sm text-muted-foreground">{entry.line}</span>
                <span className="font-mono text-xs text-muted-foreground">{entry.parts}</span>
              </div>
            </Card>
          ))}
        </CardGrid>
      </Section>
    </Page>
  )
}

export const Route = createFileRoute('/')({
  staticData: { title: 'Tour' },
  component: IndexRoute,
})
