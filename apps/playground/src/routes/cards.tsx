import { createFileRoute } from '@tanstack/react-router'
import { Section } from 'basalt-ui'
import { StatCard } from 'basalt-ui/cards'
import type { ReactElement } from 'react'

function MergeGlyph({ className }: { className?: string }): ReactElement {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" aria-hidden="true">
      <circle cx="4" cy="4" r="1.75" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="1.75" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 6v3a3 3 0 0 0 3 3h3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

const PER_DAY = [4, 9, 6, 12, 8, 15, 11, 18, 14, 21, 17, 24]

/** A stand-in for a Sparkline: bars that fill the 72 px box the card owns. */
function PerDayBars({ height }: { height: number | 'fill' }): ReactElement {
  const max = Math.max(...PER_DAY)
  return (
    <div
      role="img"
      aria-label="Shipped per day"
      className="flex h-full items-end gap-0.5"
      data-box-height={String(height)}
    >
      {PER_DAY.map((value, index) => (
        // theme-allow hidden-inline-style — a bar's height is data, not a class
        <div
          key={index}
          className={index === PER_DAY.length - 1 ? 'flex-1 bg-brand' : 'flex-1 bg-dim-bar'}
          style={{ height: `${(value / max) * 78}%` }}
        />
      ))}
    </div>
  )
}

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
    chart={(box) => <PerDayBars height={box.height} />}
    footer={[
      { label: 'Open', value: 12 },
      { label: 'Merged', value: 4 },
    ]}
  />
)
// #endregion

function CardsRoute(): ReactElement {
  return (
    <Section title="Cards">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))] items-start gap-4">
        {shipped}
        <StatCard
          icon={MergeGlyph}
          title="Shipped"
          subtitle="loading"
          value={388}
          phase="loading"
          sub="Most since March"
          chart={(box) => <PerDayBars height={box.height} />}
          footer={[{ label: 'Open', value: 12 }]}
        />
        <StatCard
          icon={MergeGlyph}
          title="Shipped"
          subtitle="stale"
          value={388}
          phase="stale"
          delta={{ value: '-3%', polarity: 'up-good' }}
          status={{ tone: 'warn', label: 'Behind' }}
          sub="Most since March"
          chart={(box) => <PerDayBars height={box.height} />}
          footer={[{ label: 'Open', value: 12 }]}
        />
        <StatCard
          icon={MergeGlyph}
          title="Shipped"
          subtitle="empty"
          value={null}
          empty={{
            cause: 'No merges in this range',
            action: { label: 'Widen range', href: '#range' },
          }}
          sub="Most since March"
          chart={(box) => <PerDayBars height={box.height} />}
          footer={[{ label: 'Open', value: 12 }]}
        />
        <StatCard
          icon={MergeGlyph}
          title="Shipped"
          subtitle="error"
          value={388}
          phase={{ tag: 'error', retry: () => undefined }}
          sub="Most since March"
          chart={(box) => <PerDayBars height={box.height} />}
          footer={[{ label: 'Open', value: 12 }]}
        />
        <StatCard title="Open" value={12} unit="PRs" status={{ tone: 'good', label: 'On track' }} />
      </div>
    </Section>
  )
}

export const Route = createFileRoute('/cards')({
  staticData: { title: 'Cards' },
  component: CardsRoute,
})
