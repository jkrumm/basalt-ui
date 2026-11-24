import { text } from '@tanstack/charts/text'
import { BarList } from 'basalt-ui/cards'
import type { ComponentProps } from 'react'
import { CartesianChart, ChartCard, chartLabels, useChartFocus } from 'basalt-ui/charts'
import { CardGrid, Page, PageBar } from 'basalt-ui/page'
import { BASALT } from 'basalt-ui/tokens'
import { OWNER_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { KIND_LABEL, REVIEW_LIMIT, goesAheadIn, itemName, queueItems, type Item } from './fixture'

type BarListProps = ComponentProps<typeof BarList>
type BodyRows = NonNullable<BarListProps['bodyRows']>
const BODY_ROWS: readonly BodyRows[] = [3, 4, 5, 6, 7, 8, 9, 10]

const Y_CAP = 14
const hours = (h: number) => `${h} h`

/** A review this old goes ahead on its own within a few hours: the one status hue. */
const SOON_AT = 20
const HIT_PAD = BASALT.dotR + 1
const LABEL_GAP = BASALT.dotR + 3
const FALLBACK_GAP = BASALT.dotR + 4

const isSoon = (d: Item) => d.kind === 'review' && d.age >= SOON_AT

const SERIES = [
  ...(['decision', 'review', 'chore'] as const).map((kind) => ({
    mark: 'dot' as const,
    key: kind,
    label: KIND_LABEL[kind],
    color: OWNER_SERIES[kind],
    y: (d: Item) => (d.kind === kind && !isSoon(d) ? d.behind : null),
  })),
  {
    mark: 'dot' as const,
    key: 'soon',
    label: `Review, ahead within ${REVIEW_LIMIT - SOON_AT} h`,
    color: OWNER_SERIES.soon,
    y: (d: Item) => (isSoon(d) ? d.behind : null),
  },
]

const EMPTY = {
  cause: 'Nothing waits on you. New questions and reviews appear when an agent asks.',
}

const EMPTY_LIST = { cause: 'Nothing to rank until an item waits.' }

export function ExprN38Scenario({ shotState, fixture }: ScenarioProps) {
  const items = shotState === 'empty' ? [] : queueItems(fixture)
  const retry = () => undefined
  const phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error' as const, message: 'The queue did not answer.', retry }
        : 'ready'
  const ready = phase === 'ready' && items.length > 0

  const focus = useChartFocus(items, {
    announce: (d) =>
      `${itemName(d)}: ${hours(d.age)} waiting, ${d.behind} ${d.behind === 1 ? 'Issue' : 'Issues'} behind it`,
  })

  const total = items.reduce((n, i) => n + i.behind, 0)
  const top = items[0]
  const next = items
    .filter((i) => goesAheadIn(i) !== null)
    .reduce<Item | undefined>((m, i) => (!m || i.age > m.age ? i : m), undefined)

  const rows: BarListProps['items'][number][] = items.map((i) => {
    return {
      label: itemName(i),
      value: i.behind,
      secondary: hours(i.age),
    }
  })

  const figure = ready
    ? {
        value: focus.readout<number | string | null>(total, (d) => d.behind),
        unit: 'Issues held up',
        period: focus.readout<string | undefined>(
          undefined,
          (d) => `${itemName(d)}, ${hours(d.age)}`,
        ),
      }
    : { value: null, unit: 'Issues held up', period: undefined }
  const placeholder = shotState === 'loading' ? '' : '–'
  const count = (kind: Item['kind']) => items.filter((i) => i.kind === kind).length
  const subtitle = ready
    ? `${count('decision')} decisions, ${count('review')} reviews, ${count('chore')} chores`
    : 'Decisions, reviews and chores'
  const footer = [
    {
      label: 'Ahead next',
      value: ready && next ? `Issue ${next.issue}, ${hours(REVIEW_LIMIT - next.age)}` : placeholder,
      mono: true,
    },
  ] as const

  return (
    <Page area="expr-n38">
      <PageBar title="Waiting on you" />
      <CardGrid min="regular">
        <ChartCard
          title="Age and work held up"
          subtitle={subtitle}
          phase={phase}
          empty={items.length === 0 ? EMPTY : null}
          figure={figure}
          footer={footer}
          chart={() => (
            <CartesianChart<Item>
              label="Open items by hours waiting and Issues held up"
              data={items}
              x={{
                value: (d) => d.age,
                title: 'Hours waiting',
                domain: [
                  0,
                  Math.round(Math.max(REVIEW_LIMIT * 2, ...items.map((i) => i.age)) * 1.3),
                ],
              }}
              y={{
                title: 'Issues behind',
                domain: ([, hi]) => [0, Math.min(Math.max(hi, 4), Y_CAP)],
              }}
              series={SERIES}
              tooltip={false}
              focus={focus}
              refLines={[
                {
                  axis: 'x',
                  value: REVIEW_LIMIT,
                  color: OWNER_SERIES.rule,
                  dashed: true,
                  label: `Reviews go ahead at ${REVIEW_LIMIT} h`,
                },
              ]}
              marks={CartesianChart.custom<Item>((plot) => {
                if (!top || top.behind === 0) return []
                const r = HIT_PAD
                const dots = plot.data.flatMap((d) => {
                  const px = plot.x(d.age)
                  return px === null
                    ? []
                    : [
                        {
                          left: px - r,
                          top: plot.y(Math.min(d.behind, Y_CAP)) - r,
                          width: 2 * r,
                          height: 2 * r,
                        },
                      ]
                })
                // cycle-expression-9: a placed label's measured width is narrower than its drawn width, so the end of a long text clips at the plot edge; the label stays short.
                const label = `${KIND_LABEL[top.kind]} ${top.issue}, ${top.behind > Y_CAP ? top.behind : hours(top.age)}`
                const px = plot.x(top.age) ?? 0
                const { placed } = chartLabels.place(
                  [
                    {
                      key: 'top',
                      text: label,
                      x: px,
                      y: plot.y(Math.min(top.behind, Y_CAP)),
                    },
                  ],
                  { width: plot.plotWidth, height: plot.plotHeight },
                  { obstacles: dots, gap: LABEL_GAP },
                )
                // cycle-expression-9: chartLabels.place drops the label when the plot is narrow (390), so the worst item goes unnamed; a fixed spot left of the dot stands in.
                const spots: {
                  text: string
                  dx: number
                  dy: number
                  textAnchor: 'start' | 'middle' | 'end'
                }[] = placed.length
                  ? placed
                  : [{ text: label, dx: -FALLBACK_GAP, dy: 0, textAnchor: 'end' as const }]
                return [
                  text(spots, {
                    x: () => top.age,
                    y: () => Math.min(top.behind, Y_CAP),
                    text: (l) => l.text,
                    dx: (l) => l.dx,
                    dy: (l) => l.dy,
                    anchor: (l) => l.textAnchor,
                  }),
                ]
              })}
            />
          )}
        />
        <BarList
          title="Holding up the most"
          subtitle="Issues waiting behind each item"
          phase={phase}
          empty={items.length === 0 ? EMPTY_LIST : null}
          items={rows}
          bodyRows={BODY_ROWS.find((n) => n >= rows.length) ?? 10}
          focus={focus}
        />
      </CardGrid>
      {focus.live}
    </Page>
  )
}
