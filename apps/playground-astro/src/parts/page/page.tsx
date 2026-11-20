import { StatCard } from 'basalt-ui/cards'
import { CardGrid, Page, PageBar, PageSummary, Section } from 'basalt-ui/page'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <Page area="runs">
      <PageBar
        title="Runs"
        actions={[
          { id: 'new', label: 'New run', primary: true, onClick: () => undefined },
          { id: 'export', label: 'Export', onClick: () => undefined },
        ]}
      />
      <PageSummary
        sentence="12 open, 3 need you"
        facts={['oldest 4 days', '18 runs today']}
        aside="Today"
      />
      <Section title="Overview">
        <CardGrid min="regular">
          <StatCard
            title="Shipped"
            subtitle="vs last week"
            value={388}
            delta={{ value: '+12%', polarity: 'up-good' }}
          />
          <StatCard title="Open" value={12} status={{ tone: 'warn', label: '3 need you' }} />
        </CardGrid>
      </Section>
    </Page>
  )
}
