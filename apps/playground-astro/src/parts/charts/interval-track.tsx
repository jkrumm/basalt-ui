import { IntervalTrack } from 'basalt-ui/charts'
import type { IntervalSeries } from 'basalt-ui/charts'
import type { ReactElement } from 'react'
import { CHART_WIDTH, DEMO_SERIES } from '../../demo/data'

type Span = { id: string; host: string; start: Date; end: Date | null; kind: 'deploy' | 'incident' }

const at = (h: number): Date => new Date(Date.UTC(2026, 10, 13, h))
const SPANS: readonly Span[] = [
  { id: 's1', host: 'api', start: at(8), end: at(10), kind: 'deploy' },
  { id: 's2', host: 'api', start: at(13), end: null, kind: 'incident' },
  { id: 's3', host: 'web', start: at(9), end: at(12), kind: 'deploy' },
  { id: 's4', host: 'worker', start: at(11), end: at(15), kind: 'incident' },
  { id: 's5', host: 'worker', start: at(16), end: at(17), kind: 'deploy' },
]
const SERIES: readonly IntervalSeries<Span['kind']>[] = [
  { key: 'deploy', label: 'Deploy', color: DEMO_SERIES.sessions },
  { key: 'incident', label: 'Incident', color: DEMO_SERIES.churn },
]

export function Demo(): ReactElement {
  return (
    <div style={{ width: CHART_WIDTH, maxWidth: '100%' }}>
      <IntervalTrack
        label="Deploys and incidents per host"
        data={SPANS}
        getRow={(s) => s.host}
        rows={['api', 'web', 'worker']}
        getStart={(s) => s.start}
        getEnd={(s) => s.end}
        series={SERIES}
        getSeries={(s) => s.kind}
        xDomain={[at(7), at(18)]}
        height={180}
      />
    </div>
  )
}
