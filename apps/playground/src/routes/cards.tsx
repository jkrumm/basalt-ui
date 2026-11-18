import { createFileRoute } from '@tanstack/react-router'
import { CardGrid, Page, Section } from 'basalt-ui/page'
import { StatCard } from 'basalt-ui/cards'
import { Sparkline } from 'basalt-ui/charts'
import type { ReactElement } from 'react'

/** A merge: two branches joining, for merged pull requests. */
function MergeGlyph({ className }: { className?: string }): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="18" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <path d="M6 21V9a9 9 0 0 0 9 9" />
    </svg>
  )
}

/** Merges per day over the 14 days to today, each dated so a hover reads its day beside its count. */
const PER_DAY = [4, 9, 6, 12, 8, 15, 11, 18, 14, 21, 17, 13, 19, 24].map((value, i) => ({
  value,
  at: new Date(2026, 9, 29 + i),
}))

/** The label row under the plot: start, middle, now. */
const X_LABELS = ['Oct 29', 'Nov 4', 'Today'] as const

/** The per-day trend in the box the card owns, over the label row the contract reserves. */
function ShippedTrend({ height }: { height: number | 'fill' }): ReactElement {
  return (
    <Sparkline
      series={PER_DAY}
      height={height}
      axisLabels={X_LABELS}
      label={`Shipped per day, ${PER_DAY.length} days`}
    />
  )
}

const SHIPPED = {
  icon: MergeGlyph,
  title: 'Shipped',
  value: 388,
  sub: 'Most since March',
  chart: (box: { height: number | 'fill' }) => <ShippedTrend height={box.height} />,
  menu: [
    { id: 'report', label: 'Open report', href: '#shipped' },
    { id: 'export', label: 'Export CSV', onClick: () => undefined },
  ],
} as const

// #region stat-card
const shipped = (
  <StatCard
    icon={MergeGlyph}
    title="Shipped"
    subtitle="vs last week"
    info="Pull requests merged into the default branch in the selected range."
    value={388}
    delta={{ value: '+12%', polarity: 'up-good' }}
    sub="Most since March"
    href="#shipped"
    chart={(box) => <ShippedTrend height={box.height} />}
    footer={[
      { label: 'Open', value: 12 },
      { label: 'Merged', value: 4 },
    ]}
    menu={SHIPPED.menu}
  />
)
// #endregion

function CardsRoute(): ReactElement {
  return (
    <Page area="cards">
      <Section title="Cards">
        <CardGrid narrow="stack">
          {shipped}
          <StatCard
            {...SHIPPED}
            subtitle="loading"
            phase="loading"
            footer={[{ label: 'Open', value: 12 }]}
          />
          <StatCard
            {...SHIPPED}
            subtitle="stale"
            phase="stale"
            delta={{ value: '-3%', polarity: 'up-good' }}
            status={{ tone: 'warn', label: 'Behind' }}
            footer={[{ label: 'Open', value: 12 }]}
          />
          <StatCard
            {...SHIPPED}
            subtitle="empty"
            value={null}
            empty={{
              cause: 'No merges in this range',
              action: { label: 'Widen range', href: '#range' },
            }}
            footer={[{ label: 'Open', value: 12 }]}
          />
          <StatCard
            {...SHIPPED}
            subtitle="error"
            phase={{ tag: 'error', retry: () => undefined }}
            footer={[{ label: 'Open', value: 12 }]}
          />
          <StatCard
            title="Open"
            value={12}
            unit="PRs"
            status={{ tone: 'good', label: 'On track' }}
          />
        </CardGrid>
      </Section>
    </Page>
  )
}

export const Route = createFileRoute('/cards')({
  staticData: { title: 'Cards' },
  component: CardsRoute,
})
