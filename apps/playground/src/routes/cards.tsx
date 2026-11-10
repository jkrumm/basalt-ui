import { createFileRoute } from '@tanstack/react-router'
import { EmptyState, Section } from 'basalt-ui'

function CardsRoute() {
  return (
    <Section title="Cards">
      <EmptyState
        title="Nothing here yet"
        description="This page is reserved for the card and stat-group specimens."
      />
    </Section>
  )
}

export const Route = createFileRoute('/cards')({
  staticData: { title: 'Cards' },
  component: CardsRoute,
})
