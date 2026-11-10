import { createFileRoute } from '@tanstack/react-router'
import { EmptyState, Section } from 'basalt-ui'

function TableRoute() {
  return (
    <Section title="Table">
      <EmptyState
        title="Nothing here yet"
        description="This page is reserved for the data-table specimens."
      />
    </Section>
  )
}

export const Route = createFileRoute('/table')({
  staticData: { title: 'Table' },
  component: TableRoute,
})
