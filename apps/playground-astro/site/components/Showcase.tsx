import { BarList, StatCard } from 'basalt-ui/cards'
import { Sparkline } from 'basalt-ui/charts'
import { Lozenge } from 'basalt-ui/ui/badge'
import { Meter } from 'basalt-ui/ui/meter'
import type { ReactElement } from 'react'

/** How a part reaches the reader: HTML alone, HTML that a script improves, or a part that needs its script. */
export type Mode = 'static' | 'enhanced' | 'island'

const MODE = {
  static: { tone: 'good', word: 'Static', hint: 'HTML and CSS only' },
  enhanced: { tone: 'info', word: 'Enhanced', hint: 'works as HTML, a script adds behavior' },
  island: { tone: 'neutral', word: 'Island', hint: 'needs its script' },
} as const

/** The mark every part of the showcase carries, so a reader sees what each one costs. */
export function ModeTag({ mode }: { mode: Mode }): ReactElement {
  const { tone, word, hint } = MODE[mode]
  return (
    <Lozenge tone={tone} title={hint}>
      {word}
    </Lozenge>
  )
}

const DEPLOYS = [14, 18, 17, 22, 19, 25, 24, 28, 26, 31, 29, 34]
const BUILD = [212, 205, 198, 201, 190, 186, 181, 184, 179, 176, 178, 174]

/** Two stat cards with sparklines, drawn to HTML at build time: no directive, no script. */
export function StatCards(): ReactElement {
  return (
    <div className="@container">
      <div className="grid grid-cols-1 gap-4 @regular:grid-cols-2">
        <StatCard
          title="Deploys"
          subtitle="this week"
          value={34}
          delta={{ value: '+17%', polarity: 'up-good' }}
          chart={(box) => (
            <Sparkline points={DEPLOYS} height={box.height} label="Deploys per week" />
          )}
          axisLabels={['Jul', 'Aug', 'Sep']}
          footer={[
            { label: 'Rollbacks', value: 1 },
            { label: 'Services', value: 6 },
          ]}
        />
        <StatCard
          title="Median build"
          subtitle="this week"
          value={174}
          unit="s"
          delta={{ value: '-4 s', polarity: 'up-bad' }}
          chart={(box) => (
            <Sparkline points={BUILD} height={box.height} label="Median build per week" />
          )}
          axisLabels={['Jul', 'Aug', 'Sep']}
          footer={[
            { label: 'Cache hits', value: '92%' },
            { label: 'Runners', value: 3 },
          ]}
        />
      </div>
    </div>
  )
}

/** A ranked list with bars: static, a share of the total on each row. */
export function ServiceBars(): ReactElement {
  return (
    <BarList
      title="Deploys by service"
      items={[
        { label: 'api', value: 34 },
        { label: 'web', value: 29 },
        { label: 'worker', value: 17 },
        { label: 'docs', value: 9 },
        { label: 'cli', value: 4 },
      ]}
    />
  )
}

/** A meter with its limit and its cause: a native element, static. */
export function CacheMeter(): ReactElement {
  return (
    <Meter
      label="Cache hit rate"
      value={92}
      max={100}
      caption="%"
      zones={[
        { to: 70, tone: 'bad' },
        { to: 90, tone: 'warn' },
        { to: 100, tone: 'good' },
      ]}
      cause="Healthy above 90 %"
    />
  )
}
