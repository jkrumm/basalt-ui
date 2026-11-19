import { createFileRoute } from '@tanstack/react-router'
import { CardGrid, Page, Section } from 'basalt-ui/page'
import { StatCard, StatCell, StatGroup } from 'basalt-ui/cards'
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

/** A one-path outline glyph in the icon library's shape: `currentColor` stroke on a 24 grid. */
function glyph(d: string): (props: { className?: string }) => ReactElement {
  return function Glyph({ className }) {
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
        <path d={d} />
      </svg>
    )
  }
}

const ServerGlyph = glyph('M4 4h16v6H4zM4 14h16v6H4zM8 7h.01M8 17h.01')
const RocketGlyph = glyph('M12 2c4 3 6 7 6 11l-3 3H9l-3-3c0-4 2-8 6-11zM9 16l-2 5 5-2 5 2-2-5')
const AlertGlyph = glyph('M12 3l10 18H2zM12 10v5M12 18h.01')
const ClockGlyph = glyph('M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2')

/** The fleet's last seven days, one value per day, dated so a readout names its day. */
const week = (values: readonly number[]) =>
  values.map((value, i) => ({ value, at: new Date(Date.UTC(2026, 10, 13 + i, 12)) }))
const HEALTHY = week([6, 6, 5, 6, 6, 6, 5])
const DEPLOYS = week([21, 26, 19, 24, 27, 22, 25])
const FAILURE = week([9.5, 11.5, 21.1, 4.2, 11.1, 9.1, 12])
const MEDIAN = week([181, 176, 170, 179, 168, 174, 172])
const BASE = 'vs last week'

// #region stat-group
/** The stat row: four figures of equal weight, each against its base, its target or its trend. */
const fleet = (
  <StatGroup variant="strip" label="Fleet health">
    <StatCell
      icon={ServerGlyph}
      label="Services healthy"
      value="5 / 6"
      status={{ tone: 'warn', label: '1 degraded' }}
      chart={(box) => (
        <Sparkline
          series={HEALTHY}
          height={box.height}
          reference={6}
          label="Healthy services per day"
        />
      )}
    />
    <StatCell
      icon={RocketGlyph}
      label="Deploys"
      value={164}
      delta={{ value: '+12%', polarity: 'up-good', label: BASE }}
      chart={(box) => <Sparkline series={DEPLOYS} height={box.height} label="Deploys per day" />}
    />
    <StatCell
      icon={AlertGlyph}
      label="Failure rate"
      value="11.0"
      unit="%"
      delta={{ value: '+2.4 pts', polarity: 'up-bad', label: BASE }}
      chart={(box) => (
        <Sparkline
          series={FAILURE}
          height={box.height}
          reference={10}
          label="Failure rate per day, target 10 %"
        />
      )}
    />
    <StatCell
      icon={ClockGlyph}
      label="Median duration"
      value={174}
      unit="s"
      delta={{ value: '-14 s', polarity: 'up-bad', label: BASE }}
      chart={(box) => (
        <Sparkline series={MEDIAN} height={box.height} label="Median deploy duration per day" />
      )}
    />
  </StatGroup>
)
// #endregion

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
      <Section title="Stat row">{fleet}</Section>
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
