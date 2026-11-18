/**
 * `RowList` on its own: the four row shapes the owner's review found hand-written (n02, n04, n07
 * and c10), quiet by default, one with the hairline opt-in, the first joined to a focus.
 * `basalt-ui shot /scenarios/row-list` is the Spec's evidence beside n07.
 */
import type { ReactElement } from 'react'
import { RowList } from 'basalt-ui/cards'
import type { Phase } from 'basalt-ui/cards'
import { useChartFocus } from 'basalt-ui/charts'
import { Page, PageBar } from 'basalt-ui/page'
import type { ScenarioProps } from '../shot-state'

type Item = Parameters<typeof RowList>[0]['items'][number]

const ISSUES: readonly Item[] = [
  {
    key: 'a',
    label: 'issue_2283',
    meta: 'building',
    detail: 'Lists: a bare border paints ink',
    value: '3.1 d',
    valueDetail: '2.4× of 1.3 d',
  },
  {
    key: 'b',
    label: 'issue_2271',
    meta: 'review',
    detail: 'Table filters on the phone',
    value: '2.2 d',
    valueDetail: '1.7× of 1.3 d',
  },
  {
    key: 'c',
    label: 'issue_2260',
    meta: 'verify',
    detail: 'Chart hover sweep',
    value: '1.4 d',
    valueDetail: '1.1× of 1.3 d',
  },
  {
    key: 'd',
    label: 'issue_2254',
    meta: 'building',
    detail: 'Interval track kind',
    value: '19 h',
    valueDetail: '0.6× of 1.3 d',
  },
  {
    key: 'e',
    label: 'issue_2249',
    meta: 'queued',
    detail: 'Page top spacing',
    value: '6 h',
    valueDetail: '0.2× of 1.3 d',
  },
  {
    key: 'f',
    label: 'issue_2241',
    meta: 'review',
    detail: 'Showcase page',
    value: '4 h',
    valueDetail: '0.2× of 1.3 d',
  },
]

const WINDOWS: readonly Item[] = [
  { key: 'w1', label: 'Mon 06:00 – 09:00', value: '3 h' },
  { key: 'w2', label: 'Mon 17:00 – 19:00', value: '2 h' },
  { key: 'w3', label: 'Tue 14:00 – 15:00', value: '1 h' },
  { key: 'w4', label: 'Wed 07:00 – 11:00', value: '4 h' },
  { key: 'w5', label: 'Thu 16:00 – 17:00', value: '1 h' },
]

const NIGHTS: readonly Item[] = [
  {
    key: 'n1',
    label: 'Fri 20 Nov',
    status: { tone: 'accent', label: 'Best' },
    detail: 'Moon sets 21:40',
    value: '71°',
  },
  {
    key: 'n2',
    label: 'Sat 21 Nov',
    status: { tone: 'neutral', label: 'Clear' },
    detail: 'Moon up all night',
    value: '64°',
  },
  {
    key: 'n3',
    label: 'Sun 22 Nov',
    status: { tone: 'warn', label: 'Haze' },
    detail: 'Thin cloud after 02:00',
    value: '58°',
  },
  {
    key: 'n4',
    label: 'Mon 23 Nov',
    status: { tone: 'bad', label: 'Ruled out' },
    detail: 'Cloud cover 90 %',
    value: '—',
  },
]

const HOPS: readonly Item[] = [
  { key: 'h0', label: 'sg-prod-web', meta: 'security group', value: '0' },
  {
    key: 'h1',
    label: 'i-0a1b2c',
    meta: 'instance · via sg-prod-web',
    indent: 1,
    status: { tone: 'bad', label: 'Affected' },
    value: '1',
  },
  { key: 'h2', label: 'vol-77aa', meta: 'volume · via i-0a1b2c', indent: 2, value: '2' },
  { key: 'h3', label: 'snap-12cd', meta: 'snapshot · via vol-77aa', indent: 3, value: '3' },
]

export function RowListScenario({ shotState }: ScenarioProps): ReactElement {
  const phase: Phase | undefined = shotState === 'loading' ? 'loading' : undefined
  const items = shotState === 'empty' ? [] : ISSUES
  const focus = useChartFocus(items, { announce: (item) => item.label })
  return (
    <Page area="row-list">
      <PageBar title="Row lists" />
      <div className="grid items-start gap-3 p-3 @wide:grid-cols-2">
        <RowList
          title="Open Issues"
          subtitle="Longest past typical first"
          items={items}
          lines={2}
          mono
          bodyRows={5}
          focus={focus}
          phase={phase}
        />
        <RowList title="Ride windows" items={WINDOWS} mono bodyRows={5} phase={phase} />
        <RowList
          title="Verdict for each night"
          items={NIGHTS}
          lines={2}
          bodyRows={4}
          phase={phase}
        />
        <RowList
          title="Resources by hop"
          subtitle="separator: hairline"
          items={HOPS}
          mono
          separator="hairline"
          bodyRows={4}
          phase={phase}
        />
      </div>
    </Page>
  )
}
