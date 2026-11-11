import { createFileRoute } from '@tanstack/react-router'
import { Section } from 'basalt-ui'
import { StatCard } from 'basalt-ui/cards'
import type { ReactElement } from 'react'
import { useV3Tokens } from '../demo/v3-tokens'

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

const PER_DAY = [4, 9, 6, 12, 8, 15, 11, 18, 14, 21, 17, 13, 19, 24]

/** The label row under the plot: start, middle, now. */
const X_LABELS = ['Oct 29', 'Nov 4', 'Today'] as const

/**
 * A stand-in for a bar sparkline in the 72 px box the card owns: thin bars on a hairline baseline,
 * the latest in the accent, over the 16 px label row the contract reserves.
 */
function ShippedBars({ height }: { height: number | 'fill' }): ReactElement {
  const max = Math.max(...PER_DAY)
  return (
    <div className="flex h-full flex-col gap-1" data-box-height={String(height)}>
      <div
        role="img"
        aria-label={`Shipped per day, ${PER_DAY.length} days, latest ${PER_DAY.at(-1)}`}
        className="flex h-14 shrink-0 items-end justify-between border-b border-grid"
      >
        {PER_DAY.map((value, index) => (
          // theme-allow hidden-inline-style — a bar's height is data, not a class
          <div
            key={index}
            className={
              index === PER_DAY.length - 1
                ? 'w-2.5 rounded-t-chip bg-brand-fill'
                : 'w-2.5 rounded-t-chip bg-dim-bar'
            }
            style={{ height: `${(value / max) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex h-3 shrink-0 items-center justify-between text-micro text-muted-foreground tabular-nums">
        {X_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  )
}

const SHIPPED = {
  icon: MergeGlyph,
  title: 'Shipped',
  value: 388,
  sub: 'Most since March',
  chart: (box: { height: number | 'fill' }) => <ShippedBars height={box.height} />,
  menu: [
    { label: 'Open report', href: '#shipped' },
    { label: 'Export CSV', onSelect: () => undefined },
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
    chart={(box) => <ShippedBars height={box.height} />}
    footer={[
      { label: 'Open', value: 12 },
      { label: 'Merged', value: 4 },
    ]}
    menu={SHIPPED.menu}
  />
)
// #endregion

function CardsRoute(): ReactElement {
  useV3Tokens()
  return (
    <Section title="Cards">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))] items-start gap-4">
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
        <StatCard title="Open" value={12} unit="PRs" status={{ tone: 'good', label: 'On track' }} />
      </div>
    </Section>
  )
}

export const Route = createFileRoute('/cards')({
  staticData: { title: 'Cards' },
  component: CardsRoute,
})
