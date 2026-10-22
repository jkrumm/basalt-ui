import type { ReactElement } from 'react'
import { ChartCard } from '../../../src/charts'
import { Section } from '../../../src/dashboard/section'

const KEY = 'Dashed line: 30 d average · dot: new PR'

/** A body taller than the 280px short-card fold, so only the width fold is in play. */
const TALL = <div style={{ height: 320 }} />
/** A body under it: the card measures short and folds its subtitle whatever the width. */
const LOW = <div style={{ height: 120 }} />

/** One 390px host per case: ChartCard (tall, with and without `info`), short ChartCard, Section, nested Section. */
export function W43SubtitleFixture(): ReactElement {
  return (
    <>
      {/* theme-allow -- the wrapper width IS the fixture's payload (a container-class probe) */}
      <div data-testid="w43-sub-chart-info" style={{ width: 390 }}>
        <ChartCard title="Estimated 1RM" subtitle={KEY} info="How it is measured.">
          {TALL}
        </ChartCard>
      </div>
      {/* theme-allow -- the wrapper width IS the fixture's payload (a container-class probe) */}
      <div data-testid="w43-sub-chart-bare" style={{ width: 390 }}>
        <ChartCard title="Estimated 1RM" subtitle={KEY}>
          {TALL}
        </ChartCard>
      </div>
      {/* theme-allow -- the wrapper width IS the fixture's payload (a container-class probe) */}
      <div data-testid="w43-sub-short-info" style={{ width: 390 }}>
        <ChartCard title="Estimated 1RM" subtitle={KEY} info="How it is measured.">
          {LOW}
        </ChartCard>
      </div>
      {/* theme-allow -- the wrapper width IS the fixture's payload (a container-class probe) */}
      <div data-testid="w43-sub-short-bare" style={{ width: 390 }}>
        <ChartCard title="Estimated 1RM" subtitle={KEY}>
          {LOW}
        </ChartCard>
      </div>
      {/* theme-allow -- the wrapper width IS the fixture's payload (a container-class probe) */}
      <div data-testid="w43-sub-section" style={{ width: 390 }}>
        <Section title="Training" subtitle={KEY}>
          {TALL}
        </Section>
      </div>
      {/* theme-allow -- the wrapper width IS the fixture's payload (a container-class probe) */}
      <div data-testid="w43-sub-nested" style={{ width: 390 }}>
        <ChartCard title="Estimated 1RM" subtitle={KEY}>
          <Section title="Inside" subtitle={KEY} info="Nested.">
            {TALL}
          </Section>
        </ChartCard>
      </div>
    </>
  )
}
